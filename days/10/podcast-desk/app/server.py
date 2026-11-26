#!/usr/bin/env python3
"""
Podcast Desk: edit the transcript in the browser (delete words, move passages) and the audio follows.
播客剪辑台：在浏览器里改转写稿，删字 / 挪段落，自动换算成音频剪辑。

Usage:
    python3 app/server.py                 # projects live in ./projects
    python3 app/server.py --root FOLDER
then open http://localhost:8765

- each episode is a folder under root with editor.json (raw audio, keep list, transcript)
- upload new audio in the page: transcription (Whisper), speakers, automatic rough cut (tools/auto_rough_cut.py)
- edits are saved to text_edit_project.json in that folder
- export -> <name>_edit_vN.mp3; show notes -> shownote_vN.md (uses Claude Code on this computer, optional)
"""
import argparse
import glob
import json
import os
import re
import shutil
import subprocess
import sys
import threading
import time
import webbrowser
from datetime import date
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

import numpy as np

try:
    from opencc import OpenCC   # pip install opencc-python-reimplemented
    to_simplified = OpenCC("t2s").convert
except ImportError:
    to_simplified = lambda s: s  # noqa: E731   (optional: Traditional -> Simplified Chinese)

HERE = Path(__file__).resolve().parent
TOOLS = HERE.parent / "tools"
CUT_AUDIO = TOOLS / "cut_audio.py"
PIPELINE = TOOLS / "auto_rough_cut.py"
GAP_SHARE = 0.15   # 删掉一个字时，前后各最多保留多少秒原来的停顿

ap = argparse.ArgumentParser(description="Podcast Desk")
ap.add_argument("--root", default=str(HERE.parent / "projects"), help="folder with one sub-folder per episode")
ap.add_argument("--port", type=int, default=8765)
ap.add_argument("--no-browser", action="store_true")
args = ap.parse_args()
ROOT = Path(args.root).resolve()

UI = {"lang": "en"}   # interface language, taken from the "ui" cookie on every request
MSG = {
    "exporting": ("Exporting {name} (a few minutes)…", "正在导出 {name}（几分钟）…"),
    "exporting_ai": (" AI voice isolation adds about 6 min per hour of audio.", "，AI 人声分离一小时约多 6 分钟"),
    "exported": ("Exported {name} into the project folder", "已导出 {name}，在这一期的文件夹里"),
    "export_failed": ("Export failed: {e}", "导出失败：{e}"),
    "ai_failed": ("AI noise removal failed (pip install demucs): ", "AI 降噪失败（需要 pip install demucs）："),
    "no_claude": ("Claude Code (the `claude` command) was not found. Install it to generate show notes; everything else works without it.",
                  "没找到 Claude Code（claude 命令）。装好它才能生成 shownote，其他功能不受影响。"),
    "writing": ("Claude is reading the transcript and writing show notes (1–3 min)…", "Claude 正在通读转写稿、写 shownote（1–3 分钟）…"),
    "gen_failed": ("Generation failed: {e}", "生成失败：{e}"),
    "no_output": ("no output", "没有输出"),
    "saved": ("Saved as {path}", "已保存为 {path}"),
    "timeout": ("Timed out after 15 minutes, please try again", "生成超时（15 分钟），请再试一次"),
    "transcribing": ("Transcribing {pct}%", "转写中 {pct}%"),
    "done": ("Done", "完成"),
    "error": ("Something went wrong", "出错了"),
    "failed_log": ("Processing failed, see {path}", "处理失败，详情见 {path}"),
    "queued": ("Queued", "排队中"),
    "preparing": ("Preparing…", "准备中…"),
    "not_found": ("Not found: {e}", "找不到：{e}"),
    "preview_failed": ("Could not make the preview: {e}", "生成试听失败：{e}"),
    "busy": ("The previous task is still running", "上一个任务还在进行中"),
    "busy_delete": ("This episode still has a task running; delete it when it's done", "这一期还有任务在进行中，等它结束再删"),
    "speakers_warn": ("Speakers not separated (see README: HF_TOKEN). Everything else works.", "没能区分说话人（见 README：HF_TOKEN），其他功能正常。"),
}
STEPS = {"convert": ("Converting audio", "转换音频格式"), "transcribe": ("Transcribing", "转写"),
         "speakers": ("Finding speakers", "区分说话人"), "fillers": ("Finding fillers and restarts", "找语气词、重复句"),
         "noise": ("Finding coughs and cross-talk", "找咳嗽杂音、叠音"), "breaths": ("Finding breaths and long gaps", "找吸气、长空档"),
         "keeplist": ("Building the cut list", "生成剪辑列表")}


def T(key, **kw):
    en, zh = MSG[key]
    return (zh if UI["lang"] == "zh" else en).format(**kw)


def step_name(key):
    en, zh = STEPS.get(key, (key, key))
    return zh if UI["lang"] == "zh" else en


def reveal(path):
    """Show the exported file in Finder / Explorer / the file manager"""
    if os.environ.get("PODCAST_DESK_NO_REVEAL"):
        return
    try:
        if sys.platform == "darwin":
            subprocess.Popen(["open", "-R", str(path)])
        elif os.name == "nt":
            subprocess.Popen(["explorer", "/select,", str(path)])
        else:
            subprocess.Popen(["xdg-open", str(Path(path).parent)])
    except Exception:  # noqa
        pass


def to_trash(d):
    """Move a project folder to the system trash when possible, else to projects/.trash"""
    try:
        from send2trash import send2trash
        send2trash(str(d))
        return
    except ImportError:
        pass
    trash = Path.home() / ".Trash" if sys.platform == "darwin" else ROOT / ".trash"
    trash.mkdir(exist_ok=True)
    dest, i = trash / d.name, 1
    while dest.exists():
        i += 1
        dest = trash / f"{d.name} {i}"
    shutil.move(str(d), str(dest))


jobs = {}          # (项目, 种类) -> {"state","msg",...}；种类：export / shownote / pipeline
lock = threading.Lock()


# ---------------- 项目 ----------------
def project_dir(pid):
    d = (ROOT / pid).resolve()
    if d.parent != ROOT or not d.is_dir():
        raise FileNotFoundError(pid)
    return d


def config(d):
    return json.load(open(d / "editor.json", encoding="utf-8"))


def save_config(d, cfg):
    json.dump(cfg, open(d / "editor.json", "w", encoding="utf-8"), ensure_ascii=False, indent=2)


def list_projects():
    out = []
    for d in sorted(ROOT.iterdir()):
        if not d.is_dir():
            continue
        job = jobs.get((d.name, "pipeline"))
        if (d / "editor.json").exists() or job:
            p = d / "text_edit_project.json"
            out.append({"id": d.name, "edited": p.exists(),
                        "mtime": (p if p.exists() else d).stat().st_mtime,
                        "job": job})
    return sorted(out, key=lambda x: -x["mtime"])


def read_rttm(d):
    f = d / "speakers.rttm"
    if not f.exists():
        return []
    segs = []
    for line in open(f):
        p = line.split()
        if len(p) > 7:
            s = float(p[3])
            segs.append((s, s + float(p[4]), p[7]))
    return segs


def speaker_of(ws, we, rttm):
    best, bo = None, 0.0
    for s, e, lab in rttm:
        o = min(we, e) - max(ws, s)
        if o > bo:
            best, bo = lab, o
    if best is None:   # 没有重叠就找最近的一段（1 秒内）
        mid = (ws + we) / 2
        near = [(min(abs(mid - s), abs(mid - e)), lab) for s, e, lab in rttm]
        near = [x for x in near if x[0] < 1.0]
        if near:
            best = min(near)[1]
    return best


def build_tokens(d, cfg):
    """把底稿 keeplist 里的每个片段拆成"字"：每个字占一段原始时间（spans 首尾相接覆盖整个片段）"""
    keep = json.load(open(d / cfg["keeplist"]))
    seg = json.load(open(d / cfg.get("transcript", "transcript.json"), encoding="utf-8"))
    rttm = read_rttm(d)
    db = loudness(d, cfg)
    words = []
    for si, s in enumerate(seg):
        for w in s.get("words", []):
            t = w["word"].strip()
            if t:
                ws, we = refine(w["start"], w["end"], db)
                words.append((w["start"], w["end"], t, si, ws, we))   # 归属按原始时间，切点和停顿按收紧后的时间
    words.sort()
    # each word goes to exactly one kept chunk: the one holding the middle of its audible part (Whisper often
    # pads words with silence), else the one it overlaps most. Chunks of borrowed room tone get no words.
    home = {}
    for wi, w in enumerate(words):
        mid = (w[4] + w[5]) / 2
        best = next((ci for ci, (cs, ce) in enumerate(keep) if cs <= mid < ce), None)
        if best is None:
            ov = [(min(w[5], ce) - max(w[4], cs), ci) for ci, (cs, ce) in enumerate(keep)]
            o, ci = max(ov, default=(0, None))
            best = ci if o > 0.05 and o >= 0.5 * (w[5] - w[4]) else None
        if best is not None:
            home[wi] = best
    by_chunk = {}
    for wi, ci in home.items():
        by_chunk.setdefault(ci, []).append(words[wi])
    tokens = []
    for ci, (cs, ce) in enumerate(keep):
        inside = by_chunk.get(ci, [])
        if not inside:
            tokens.append({"k": "p", "s": cs, "e": ce, "t": "", "seg": -1, "c": ci})
            continue
        bounds = [cs]
        for a, b in zip(inside, inside[1:]):
            gap = max(0.0, b[4] - a[5])
            cut = a[5] + min(gap / 2, GAP_SHARE) if gap > 0 else (a[5] + b[4]) / 2
            bounds.append(min(max(cut, cs), ce))
        bounds.append(ce)
        for k, w in enumerate(inside):
            tokens.append({"k": "w", "s": round(bounds[k], 3), "e": round(bounds[k + 1], 3),
                           "ws": round(min(max(w[4], cs), ce), 3), "we": round(max(min(w[5], ce), cs), 3),
                           "t": w[2], "seg": w[3], "c": ci, "sp": speaker_of(w[0], w[1], rttm)})
    for i, t in enumerate(tokens):
        t["id"] = i
        t["d"] = False
        t["m"] = False
    return tokens


def loudness(d, cfg):
    """原始音频每 10ms 一帧的音量（dB），算一次存成 loudness.npy"""
    cache = d / "loudness.npy"
    if cache.exists() and cache.stat().st_mtime >= (d / cfg["audio"]).stat().st_mtime:
        return np.load(cache)
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(d / cfg["audio"]), "-ac", "1", "-ar", "8000",
                          "-f", "s16le", "-"], capture_output=True).stdout
    x = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768
    n = len(x) // 80
    db = 20 * np.log10(np.sqrt((x[:n * 80].reshape(n, 80) ** 2).mean(1)) + 1e-7)
    np.save(cache, db)
    return db


SPEECH_DB = -42   # 高于这个音量算"在发声"


def refine(ws, we, db):
    """Whisper 常把字后面的静音也算进这个字里：按实际音量把字的起止收紧到真正发声的部分"""
    a, b = int(ws * 100), int(we * 100)
    k = b
    while k > a + 3 and k - 1 < len(db) and db[k - 1] < SPEECH_DB:
        k -= 1
    j = a
    while j < k - 3 and j < len(db) and db[j] < SPEECH_DB:
        j += 1
    return j / 100, k / 100


def quiet_regions(d, cfg):
    """原音频里真正安静的片段（< -50dB，≥0.6s），用来在句子之间补停顿；算一次就缓存"""
    cache = d / "quiet.json"
    if cache.exists():
        return json.load(open(cache))
    db = loudness(d, cfg)
    n = len(db)
    q, i = [], 0
    while i < n:
        if db[i] < -50:
            j = i
            while j < n and db[j] < -50:
                j += 1
            if j - i >= 60:
                q.append([round(i / 100 + 0.05, 3), round(j / 100 - 0.05, 3)])
            i = j
        else:
            i += 1
    q.sort(key=lambda r: r[0] - r[1])
    q = q[:100]
    json.dump(q, open(cache, "w"))
    return q


def next_file(d, stem, ext):
    n = 1
    while (d / f"{stem}{n}{ext}").exists():
        n += 1
    return d / f"{stem}{n}{ext}"


# ---------------- 后台任务 ----------------
LEVEL_FILTERS = {"none": "", "loudnorm": "loudnorm=I=-16:TP=-1.5:LRA=11",
                 "full": "dynaudnorm=f=400:g=15:p=0.9:m=8:s=5,loudnorm=I=-16:TP=-1.5:LRA=9"}


DENOISE_FILTERS = {"off": "", "light": "highpass=f=80,afftdn=nr=12:nf=-42:tn=1",
                   "strong": "highpass=f=80,afftdn=nr=24:nf=-38:tn=1,anlmdn=s=5"}
XF = 0.06   # 剪辑点交叉淡化（秒），和 cut_audio 的 --crossfade 一致


def probe(path):
    out = subprocess.run(["ffprobe", "-v", "quiet", "-select_streams", "a:0", "-show_entries",
                          "stream=sample_rate,channels", "-of", "csv=p=0", str(path)], capture_output=True, text=True).stdout
    sr, ch = out.strip().split(",")[:2]
    return int(sr), int(ch)


def stretch(chunk, sr, ch, rate):
    """用 rubberband 变速不变调；前后垫 50ms 静音，避免开头结尾被吃掉"""
    pad = np.zeros((int(sr * 0.05), ch), np.float32)
    r = subprocess.run(["ffmpeg", "-v", "error", "-f", "f32le", "-ar", str(sr), "-ac", str(ch), "-i", "-",
                        "-af", f"rubberband=tempo={rate}", "-f", "f32le", "-"],
                       input=np.concatenate([pad, chunk, pad]).tobytes(), capture_output=True).stdout
    y = np.frombuffer(r, np.float32).reshape(-1, ch)
    cut = int(sr * 0.05 / rate)
    return y[cut:len(y) - cut].copy()   # frombuffer 是只读的，后面拼接要改写


def apply_tempo(src, dst, plain, rates, join=0.015):
    """剪好的音频里，按每段的语速分块变速再拼回去（拼接处 15ms 交叉淡化）"""
    sr, ch = probe(src)
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(src), "-f", "f32le", "-"], capture_output=True).stdout
    x = np.frombuffer(raw, np.float32).reshape(-1, ch)
    starts, pos = [], 0.0
    for i, (s, e) in enumerate(plain):   # 每段在剪好的音频里从哪里开始
        starts.append(pos)
        pos += (e - s) - (XF if i < len(plain) - 1 else 0)
    blocks = []
    for i, r in enumerate(rates):        # 相同语速的连续段合成一块
        if blocks and abs(blocks[-1][2] - r) < 1e-3:
            continue
        a = starts[i] + (XF / 2 if i else 0)
        if blocks:
            blocks[-1][1] = a
        blocks.append([a, None, r])
    blocks[-1][1] = len(x) / sr
    n = int(sr * join)
    t = np.linspace(0, np.pi / 2, n, dtype=np.float32)[:, None]
    fi, fo = np.sin(t), np.cos(t)
    out, tail = [], None
    for a, b, r in blocks:
        chunk = x[int(a * sr):int(b * sr)].copy()
        if abs(r - 1) > 1e-3 and len(chunk) > sr * 0.05:
            chunk = stretch(chunk, sr, ch, r)
        if len(chunk) <= 2 * n:
            out.append(chunk)
            continue
        if tail is not None:
            chunk[:n] = tail * fo + chunk[:n] * fi
        out.append(chunk[:-n])
        tail = chunk[-n:]
    if tail is not None:
        out.append(tail)
    y = np.concatenate(out)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(sr), "-ac", str(ch), "-i", "-", str(dst)],
                   input=y.tobytes(), check=True)


def render_audio(d, cfg, ranges, out, level="none", denoise="off", fades=True):
    """按 ranges 剪出音频到 out。每段可以带第三个数作为语速（[起, 止, 1.2]）。
    level：none 原声 / loudnorm 统一响度 / full 拉平音量差 + 统一响度；
    denoise：off / light / strong（ffmpeg 滤镜）/ ai（Demucs 只保留人声）。出错时抛 RuntimeError"""
    rates = [float(r[2]) if len(r) > 2 else 1.0 for r in ranges]
    plain = [[r[0], r[1]] for r in ranges]
    kl = out.parent / f".{out.stem}.keeplist.json"
    json.dump(plain, open(kl, "w"))
    base = [sys.executable, str(CUT_AUDIO), str(d / cfg["audio"]), str(kl), "--crossfade", str(XF), "--random-access"]
    if not fades:
        base += ["--fade-in", "0", "--fade-out", "0"]
    tmp = out.parent / f".{out.stem}_work"
    try:
        if denoise != "ai" and all(abs(r - 1) < 1e-3 for r in rates):   # 最常见的情况：一步到位
            r = subprocess.run(base + ["-o", str(out), "--bitrate", "128k", "--level", level, "--denoise", denoise],
                               capture_output=True, text=True)
            if r.returncode != 0:
                raise RuntimeError((r.stderr or r.stdout)[-500:])
            return
        shutil.rmtree(tmp, ignore_errors=True)
        tmp.mkdir()
        wav = tmp / "cut.wav"
        r = subprocess.run(base + ["-o", str(wav), "--level", "none"], capture_output=True, text=True)
        if r.returncode != 0:
            raise RuntimeError((r.stderr or r.stdout)[-500:])
        if any(abs(x - 1) > 1e-3 for x in rates):
            apply_tempo(wav, tmp / "tempo.wav", plain, rates)
            wav = tmp / "tempo.wav"
        if denoise == "ai":
            r = subprocess.run([sys.executable, "-m", "demucs", "--two-stems=vocals", "-n", "htdemucs",
                                "-o", str(tmp), str(wav)], capture_output=True, text=True)
            vocals = tmp / "htdemucs" / wav.stem / "vocals.wav"
            if r.returncode != 0 or not vocals.exists():
                raise RuntimeError(T("ai_failed") + r.stderr[-400:])
            wav = vocals
        filt = ",".join(f for f in ("" if denoise == "ai" else DENOISE_FILTERS[denoise], LEVEL_FILTERS[level]) if f)
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(wav), *(["-af", filt] if filt else []),
                        "-b:a", "128k", str(out)], check=True)
    finally:
        kl.unlink(missing_ok=True)
        shutil.rmtree(tmp, ignore_errors=True)


def run_export(pid, d, cfg, ranges, level="none", denoise="off"):
    job = jobs[(pid, "export")]
    try:
        out = next_file(d, f"{Path(cfg['audio']).stem}_{'文本剪辑' if UI['lang'] == 'zh' else 'edit'}_v", ".mp3")
        json.dump(ranges, open(d / f"keeplist_{out.stem}.json", "w"))
        job.update(state="running", msg=T("exporting", name=out.name) + (T("exporting_ai") if denoise == "ai" else ""))
        render_audio(d, cfg, ranges, out, level, denoise)
        job.update(state="done", msg=T("exported", name=out.name), file=str(out))
        reveal(out)
    except Exception as e:  # noqa
        job.update(state="error", msg=T("export_failed", e=e))


def make_preview(d, cfg, ranges, level, denoise):
    """试听对比：同一段（约 20 秒）分别剪出原声 A 和处理后 B"""
    pv = d / ".preview"
    pv.mkdir(exist_ok=True)
    for f in pv.glob("*.mp3"):   # 只留最近几次
        if time.time() - f.stat().st_mtime > 600:
            f.unlink(missing_ok=True)
    key = f"{abs(hash(json.dumps(ranges))) % 10**8}"
    a, b = pv / f"{key}_A.mp3", pv / f"{key}_B_{level}_{denoise}.mp3"
    if not a.exists():
        render_audio(d, cfg, ranges, a, fades=False)
    if not b.exists():
        render_audio(d, cfg, ranges, b, level, denoise, fades=False)
    return a.name, b.name


def find_claude():
    c = shutil.which("claude") or shutil.which("claude.cmd") or shutil.which("claude.exe")
    if c:
        return c
    exe = "claude.exe" if os.name == "nt" else "claude"
    cands = glob.glob(os.path.expanduser(f"~/.vscode/extensions/anthropic.claude-code-*/resources/native-binary/{exe}"))
    cands += glob.glob(os.path.expanduser(f"~/.claude/local/{exe}"))
    return sorted(cands)[-1] if cands else None


SHOWNOTE_RULES = """You are the editor of a podcast. Write show notes for this episode from its transcript, in Markdown.
Write in the same language as the transcript. If example show notes follow, match their structure and tone closely;
otherwise use this structure:

1. First line `# Title`: a question or a strong theme line, optionally with a subtitle after a colon.
2. **Summary**: one paragraph of 100–200 words, written rather than chatty, covering the main thread and the angles discussed.
   If the episode teases the next one, add a line about it.
3. **Timestamps**: one line per topic, `- m:ss Topic` (h:mm:ss past an hour). Use the time at the start of each transcript
   line (already the time in the edited episode), rounded down to the second; roughly every 1.5–3 minutes, covering the whole
   episode, first line the intro and last line the outro.
4. **Mentioned**: films, books, music, people, places, organisations or projects that come up, grouped by kind, one per line
   with a few words on the context. Only what is actually mentioned.
5. Never invent URLs. Put anything that needs a link under **Links** with "TBD".
6. End with `---` and an italic line saying these notes were generated from an automatic transcript and should be checked.
7. Last, **To check before publishing**: names, titles and terms the transcript may have got wrong, and anything you are unsure of.

Transcripts often mangle names and titles (sound-alikes); restore them from context where you can, and list the doubtful
ones under "To check" instead of guessing. Output only the Markdown, no explanation."""


def run_shownote(pid, d, transcript_text):
    job = jobs[(pid, "shownote")]
    try:
        claude = find_claude()
        if not claude:
            job.update(state="error", msg=T("no_claude"))
            return
        examples = sorted(ROOT.rglob("*shownote*.md"), key=lambda p: -p.stat().st_mtime)
        examples = [p for p in examples if p.parent != d][:2]
        ex_text = "\n\n".join(f"===== Example: {p.name} =====\n{p.read_text(encoding='utf-8')}" for p in examples)
        prompt = (f"{SHOWNOTE_RULES}\n\n{ex_text}\n\n"
                  f"===== Transcript of this episode (each line: time in the edit [speaker] text) =====\n{transcript_text}\n")
        job.update(state="running", msg=T("writing"))
        r = subprocess.run([claude, "-p"], input=prompt, capture_output=True, text=True, cwd=str(d), timeout=900)
        text = r.stdout.strip()
        if r.returncode != 0 or not text:
            job.update(state="error", msg=T("gen_failed", e=(r.stderr or r.stdout or T("no_output"))[-600:]))
            return
        text = re.sub(r"^```(?:markdown)?\n|\n```$", "", text)
        out = next_file(d, "shownote_v", ".md")
        out.write_text(text + "\n", encoding="utf-8")
        job.update(state="done", msg=T("saved", path=out.name), file=str(out), text=text)
    except subprocess.TimeoutExpired:
        job.update(state="error", msg=T("timeout"))
    except Exception as e:  # noqa
        job.update(state="error", msg=T("gen_failed", e=e))


def run_pipeline(pid, d, audio_name, speakers, cut, lang=""):
    job = jobs[(pid, "pipeline")]
    cmd = [sys.executable, "-u", str(PIPELINE), str(d), "--audio", audio_name, "--speakers", str(speakers), "--language", lang]
    if not cut:
        cmd.append("--no-cut")
    dur, log = None, open(d / "pipeline.log", "w", encoding="utf-8")
    try:
        p = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1)
        for line in p.stdout:
            log.write(line); log.flush()
            m = re.match(r"STEP (\d+)/(\d+) (.+)", line)
            if m:
                i, n = int(m.group(1)), int(m.group(2))
                job.update(step=step_name(m.group(3).strip()), i=i, n=n, pct=(i - 1) / n)
            if line.startswith("WARN speakers"):
                job.update(warn=T("speakers_warn"))
            m = re.match(r"DURATION ([\d.]+)", line)
            if m:
                dur = float(m.group(1))
            m = re.match(r"\[(?:(\d+):)?(\d+):([\d.]+) -->", line)
            if m and dur and job.get("n"):
                t = int(m.group(1) or 0) * 3600 + int(m.group(2)) * 60 + float(m.group(3))
                frac = min(1.0, t / dur)
                job.update(pct=(job["i"] - 1 + frac) / job["n"], step=T("transcribing", pct=f"{frac * 100:.0f}"))
        p.wait()
        if p.returncode == 0 and (d / "editor.json").exists():
            job.update(state="done", pct=1.0, step=T("done"))
        else:
            job.update(state="error", step=T("error"), msg=T("failed_log", path=d / "pipeline.log"))
    except Exception as e:  # noqa
        job.update(state="error", step=T("error"), msg=str(e))
    finally:
        log.close()


def new_project_dir(name):
    nums = [int(m.group(1)) for x in ROOT.iterdir() if (m := re.match(r"(\d+)_", x.name))]
    safe = re.sub(r"[^\w一-鿿-]+", "_", name).strip("_") or "untitled"
    d = ROOT / f"{max(nums, default=0) + 1:02d}_{safe}_{date.today():%m%d}"
    d.mkdir()
    return d


# ---------------- HTTP ----------------
class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass   # 不在终端刷屏

    def send(self, code, body, ctype="application/json; charset=utf-8"):
        if isinstance(body, (dict, list)):
            body = json.dumps(body, ensure_ascii=False).encode()
        elif isinstance(body, str):
            body = body.encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def body(self):
        n = int(self.headers.get("Content-Length", 0))
        return json.loads(self.rfile.read(n) or b"null")

    def parse(self):
        m = re.search(r"(?:^|;\s*)ui=(\w+)", self.headers.get("Cookie", ""))
        if m:
            UI["lang"] = "zh" if m.group(1) == "zh" else "en"
        u = urlparse(self.path)
        q = {k: v[0] for k, v in parse_qs(u.query).items()}
        return u.path, q

    def project(self, q):
        d = project_dir(q["p"])
        return q["p"], d, config(d)

    def do_GET(self):
        path, q = self.parse()
        try:
            if path == "/":
                return self.send(200, (HERE / "index.html").read_bytes(), "text/html; charset=utf-8")
            if path.startswith("/assets/"):
                f = HERE / "assets" / Path(unquote(path)).name
                types = {".svg": "image/svg+xml", ".otf": "font/otf", ".png": "image/png"}
                if f.is_file():
                    return self.send(200, f.read_bytes(), types.get(f.suffix, "application/octet-stream"))
                return self.send(404, {"error": "not found"})
            if path == "/api/projects":
                return self.send(200, list_projects())
            if path == "/api/job":
                return self.send(200, jobs.get((q["p"], q.get("kind", "pipeline")), {"state": "idle"}))
            pid, d, cfg = self.project(q)
            if path == "/api/doc":
                return self.send(200, self.doc(pid, d, cfg))
            if path == "/api/quiet":
                return self.send(200, quiet_regions(d, cfg))
            if path == "/audio":
                return self.audio(d / cfg["audio"])
            if path == "/preview":
                return self.audio(d / ".preview" / Path(q["f"]).name)
        except (KeyError, FileNotFoundError) as e:
            return self.send(404, {"error": T("not_found", e=e)})
        self.send(404, {"error": "not found"})

    def doc(self, pid, d, cfg):
        fresh = build_tokens(d, cfg)
        proj = d / "text_edit_project.json"
        state = json.load(open(proj, encoding="utf-8")) if proj.exists() else {"tokens": fresh}
        # 旧的修改记录里没有词时间 / 说话人，按 id 补上（底稿不变时 id 一一对应）
        if len(state["tokens"]) == len(fresh):
            for t in state["tokens"]:
                f = fresh[t["id"]]
                for k in ("ws", "we", "sp"):
                    t[k] = f.get(k)
        for t in state["tokens"]:   # 转写里繁简混杂，统一显示成简体
            t["t"] = to_simplified(t["t"])
        labels = sorted({t["sp"] for t in fresh if t.get("sp")})
        state["speakers"] = {"labels": labels, "names": cfg.get("speakers", {})}
        state["meta"] = {"id": pid, "name": Path(cfg["audio"]).stem, "base": cfg["keeplist"], "lang": cfg.get("lang", "")}
        return state

    def audio(self, f):
        size = f.stat().st_size
        rng = self.headers.get("Range")
        start, end = 0, size - 1
        if rng:
            m = re.match(r"bytes=(\d*)-(\d*)", rng)
            if m.group(1):
                start = int(m.group(1))
            if m.group(2):
                end = int(m.group(2))
        end = min(end, size - 1)
        self.send_response(206 if rng else 200)
        self.send_header("Content-Type", "audio/mpeg")
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Length", str(end - start + 1))
        if rng:
            self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.end_headers()
        with open(f, "rb") as fh:
            fh.seek(start)
            left = end - start + 1
            try:
                while left > 0:
                    chunk = fh.read(min(1 << 16, left))
                    if not chunk:
                        break
                    self.wfile.write(chunk)
                    left -= len(chunk)
            except (BrokenPipeError, ConnectionResetError):
                pass

    def do_POST(self):
        path, q = self.parse()
        try:
            if path == "/api/upload":
                return self.upload(q)
            if path == "/api/delete":
                return self.delete(q)
            pid, d, cfg = self.project(q)
            if path == "/api/save":
                json.dump(self.body(), open(d / "text_edit_project.json", "w", encoding="utf-8"), ensure_ascii=False)
                return self.send(200, {"ok": True})
            if path == "/api/preview":
                b = self.body()
                try:
                    fa, fb = make_preview(d, cfg, b["ranges"], b.get("level", "none"), b.get("denoise", "off"))
                except Exception as e:  # noqa
                    return self.send(500, {"error": T("preview_failed", e=e)})
                return self.send(200, {"a": fa, "b": fb})
            if path == "/api/speakers":
                cfg["speakers"] = self.body()
                save_config(d, cfg)
                return self.send(200, {"ok": True})
            if path in ("/api/export", "/api/shownote"):
                kind = path.rsplit("/", 1)[1]
                with lock:
                    if jobs.get((pid, kind), {}).get("state") == "running":
                        return self.send(409, {"error": T("busy")})
                    jobs[(pid, kind)] = {"state": "running", "msg": T("preparing")}
                b = self.body()
                if kind == "export":
                    t = threading.Thread(target=run_export, daemon=True,
                                         args=(pid, d, cfg, b["ranges"], b.get("level", "none"), b.get("denoise", "off")))
                else:
                    t = threading.Thread(target=run_shownote, args=(pid, d, b["transcript"]), daemon=True)
                t.start()
                return self.send(200, {"ok": True})
        except (KeyError, FileNotFoundError) as e:
            return self.send(404, {"error": T("not_found", e=e)})
        self.send(404, {"error": "not found"})

    def delete(self, q):
        """Delete an episode: the folder goes to the trash, so it can be recovered"""
        d = project_dir(q["p"])
        if any(k[0] == d.name and v.get("state") == "running" for k, v in jobs.items()):
            return self.send(409, {"error": T("busy_delete")})
        to_trash(d)
        for k in [k for k in jobs if k[0] == d.name]:
            jobs.pop(k, None)
        return self.send(200, {"ok": True})

    def upload(self, q):
        """上传音频（请求体就是文件本身），建新项目文件夹，后台跑转写 + 初剪"""
        name = q.get("name") or Path(q.get("filename", "audio")).stem
        fname = re.sub(r"[^\w一-鿿.-]+", "_", Path(q.get("filename", "audio.mp3")).name)
        d = new_project_dir(name)
        n = int(self.headers.get("Content-Length", 0))
        with open(d / fname, "wb") as f:
            left = n
            while left > 0:
                chunk = self.rfile.read(min(1 << 20, left))
                if not chunk:
                    break
                f.write(chunk)
                left -= len(chunk)
        jobs[(d.name, "pipeline")] = {"state": "running", "step": T("queued"), "pct": 0.0}
        lang = re.sub(r"[^a-zA-Z-]", "", q.get("lang", ""))[:8]
        threading.Thread(target=run_pipeline, daemon=True,
                         args=(d.name, d, fname, int(q.get("speakers", 2)), q.get("cut", "1") == "1", lang)).start()
        return self.send(200, {"id": d.name})


if __name__ == "__main__":
    ROOT.mkdir(parents=True, exist_ok=True)
    url = f"http://localhost:{args.port}"
    srv = ThreadingHTTPServer(("127.0.0.1", args.port), H)
    print(f"Podcast Desk is running at {url}  (Ctrl+C to quit)", flush=True)
    if not args.no_browser:
        threading.Timer(0.8, lambda: webbrowser.open(url)).start()
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
