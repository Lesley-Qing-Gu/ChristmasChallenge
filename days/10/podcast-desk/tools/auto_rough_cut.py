#!/usr/bin/env python3
"""
Run the whole rough-cut pipeline in one go (this is what "upload audio" in the editor runs):

  convert -> silences -> transcribe (MLX Whisper on Apple Silicon, faster-whisper elsewhere)
  -> speakers / cross-talk (pyannote, optional) -> fillers, restarts, coughs, cross-talk,
  breaths, long gaps -> keep list

一条命令跑完整套初剪流程（剪辑台"上传音频"背后用的就是它）。

Usage:
    python auto_rough_cut.py project_folder --audio raw.mp3 [--speakers 2] [--language en] [--no-cut]
Writes into the folder: .mp3, transcript.json, speakers.rttm, candidates.json, keeplist.json, editor.json
Each step prints "STEP i/N key"; transcription prints "[mm:ss.xxx --> ...]" so the editor can show progress.
"""
import argparse
import json
import os
import platform
import re
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np

TOOLS = Path(__file__).resolve().parent
sys.path.insert(0, str(TOOLS))
from prompts import DROP_WORDS, REACTION_RE, pick  # noqa: E402

PY = sys.executable


def hf_cached(repo):
    """Is this Hugging Face model already downloaded? Then we can run offline."""
    home = Path(os.environ.get("HF_HOME", Path.home() / ".cache" / "huggingface"))
    return (home / "hub" / ("models--" + repo.replace("/", "--"))).is_dir()


def use_mlx():
    if os.environ.get("PODCAST_DESK_NO_MLX") or sys.platform != "darwin" or platform.machine() != "arm64":
        return False
    try:
        import mlx_whisper  # noqa: F401
        return True
    except ImportError:
        return False


def step(i, n, name):
    print(f"STEP {i}/{n} {name}", flush=True)


def run(args, **kw):
    r = subprocess.run([str(a) for a in args], **kw)
    if r.returncode != 0:
        raise SystemExit(f"failed: {' '.join(map(str, args[:3]))}")
    return r


def duration(path):
    out = subprocess.run(["ffprobe", "-v", "quiet", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
                         capture_output=True, text=True).stdout
    return float(out.strip())


def energy_features(wav_path):
    """每 10ms 一帧：音量 dB、高频占比（吸气/气声高频多）"""
    w = wave.open(str(wav_path))
    x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
    n = len(x) // 160
    fr = x[:n * 160].reshape(n, 160)
    db = 20 * np.log10(np.sqrt((fr ** 2).mean(1)) + 1e-7)
    sp = np.abs(np.fft.rfft(fr * np.hanning(160), axis=1)) ** 2
    f = np.fft.rfftfreq(160, 1 / 16000)
    hf = sp[:, f > 3000].sum(1) / (sp.sum(1) + 1e-9)
    return db, hf


def unvoiced_events(db, hf, words, cut_mask, pad):
    """没有对应文字、但有声音的片段：转写漏掉的嗯/呃（低频）和吸气（高频）"""
    n = len(db)
    spk = np.zeros(n, bool)
    for q in words:
        spk[max(0, int((q["start"] - pad) * 100)):int((q["end"] + pad) * 100)] = True
    m = (~spk) & (db > -50) & (~cut_mask)
    out, i = [], 0
    while i < n:
        if m[i]:
            j = i
            while j < n and m[j:j + 4].any():
                j += 1
            d = (j - i) / 100
            if 0.15 <= d <= 1.5:
                h = hf[i:j].mean()
                out.append({"type": "breath" if h > 0.12 else "hesitation", "start": i / 100 - 0.02,
                            "end": j / 100 + 0.02, "text": f"sound with no words ({db[i:j].max():.0f}dB)",
                            "reason": "breath / missed um", "skip": False})
            i = j
        else:
            i += 1
    return out


def mask_of(cands, n):
    m = np.zeros(n, bool)
    for c in cands:
        if not c.get("skip"):
            m[int(c["start"] * 100):int(c["end"] * 100) + 1] = True
    return m


def main():
    ap = argparse.ArgumentParser(description="transcribe + automatic rough cut")
    ap.add_argument("folder")
    ap.add_argument("--audio", required=True, help="raw audio file name (inside folder)")
    ap.add_argument("--speakers", type=int, default=2, help="number of speakers")
    ap.add_argument("--language", default="", help="en, zh, sv, ... (empty = auto-detect)")
    ap.add_argument("--whisper-model", default="", help="override the Whisper model")
    ap.add_argument("--no-cut", action="store_true", help="only transcribe and find speakers, keep the full audio")
    args = ap.parse_args()

    os.chdir(args.folder)
    env = dict(os.environ, PYTHONUNBUFFERED="1", MPLCONFIGDIR=str(Path(".mpl").resolve()))
    N = 4 if args.no_cut else 7
    src = Path(args.audio)

    step(1, N, "convert")
    mp3 = src if src.suffix.lower() == ".mp3" else src.with_suffix(".mp3")
    if mp3 != src:
        run(["ffmpeg", "-v", "error", "-y", "-i", src, "-vn", "-b:a", "192k", mp3])
    run(["ffmpeg", "-v", "error", "-y", "-i", mp3, "-ac", "1", "-ar", "16000", "a.wav"])
    dur = duration(mp3)
    print(f"DURATION {dur:.3f}", flush=True)

    step(2, N, "transcribe")
    lang_args = ["--language", args.language] if args.language else []
    if use_mlx():
        model = args.whisper_model or "mlx-community/whisper-large-v3-turbo"
        tenv = dict(env, HF_HUB_OFFLINE="1") if hf_cached(model) else env
        cmd = [PY, TOOLS / "transcribe_mlx.py", mp3, "-o", "transcript.json", "--model", model]
    else:
        model = args.whisper_model or "medium"
        tenv = dict(env, HF_HUB_OFFLINE="1") if hf_cached("Systran/faster-whisper-" + model) else env
        cmd = [PY, TOOLS / "transcribe.py", mp3, "-o", "transcript.json", "--model", model]
    out = subprocess.run([str(a) for a in cmd + lang_args], env=tenv, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    lang = args.language
    for line in out.stdout.splitlines():
        if line.startswith("LANGUAGE "):
            lang = line.split(" ", 1)[1].strip() or lang
        else:
            print(line, flush=True)
    if out.returncode != 0:
        raise SystemExit("transcription failed")
    lang = lang or "en"

    step(3, N, "speakers")
    # pyannote: free, but the first download needs a Hugging Face token (HF_TOKEN). Without it we carry on
    # with a single speaker and no cross-talk detection instead of failing.
    denv = dict(env, HF_HUB_OFFLINE="1") if hf_cached("pyannote/speaker-diarization-3.1") else env
    r = subprocess.run([str(a) for a in [PY, TOOLS / "detect_overlap.py", "a.wav", "--num-speakers", args.speakers,
                        "-o", "overlaps.json", "--rttm", "speakers.rttm"]], env=denv, capture_output=True, text=True)
    if r.returncode != 0:
        msg = (r.stderr or r.stdout or "").strip().splitlines()
        print("WARN speakers: " + (msg[-1][:300] if msg else "speaker detection failed"), flush=True)
        json.dump([], open("overlaps.json", "w"))
        Path("speakers.rttm").unlink(missing_ok=True)

    if args.no_cut:
        keep = [[0.0, round(dur, 3)]]
    else:
        step(4, N, "fillers")
        run([PY, TOOLS / "detect_silence.py", mp3, "-o", "silences.json"], capture_output=True)
        run([PY, TOOLS / "analyze_transcript.py", "transcript.json", "-o", "candidates.json", "--lang", lang,
             "--drop-words", *(DROP_WORDS.get(lang.split("-")[0]) or [])], capture_output=True)
        c = json.load(open("candidates.json", encoding="utf-8"))
        reaction = pick(REACTION_RE, lang)
        for x in c:   # remove every um/uh/嗯; keep meaningful reactions like "oh" / "哦"
            if x["type"] == "filler" and not reaction.search(x["text"]):
                x["skip"] = False

        step(5, N, "noise")
        run([PY, TOOLS / "detect_noise.py", "a.wav", "transcript.json", "--pad", "0.25", "-o", "noise.json"],
            capture_output=True)
        for nz in json.load(open("noise.json")):
            c.append({"type": "noise", "start": nz["start"], "end": nz["end"],
                      "text": f"sound with no words ({nz['max_db']}dB)", "reason": "cough / noise", "skip": False})
        seg = json.load(open("transcript.json", encoding="utf-8"))
        words = [w for s in seg for w in s["words"]]
        for o in json.load(open("overlaps.json")):
            a, b = o["start"], o["end"]
            for w in words:   # include a word that is cut in half
                if w["start"] < a < w["end"]:
                    a = w["start"]
                if w["start"] < b < w["end"]:
                    b = w["end"]
            c.append({"type": "overlap", "start": a, "end": b, "text": "two people talking at once",
                      "reason": "cross-talk", "skip": False})

        step(6, N, "breaths")
        db, hf = energy_features("a.wav")
        c += unvoiced_events(db, hf, words, mask_of(c, len(db)), pad=0.12)
        c += unvoiced_events(db, hf, words, mask_of(c, len(db)), pad=0.05)
        for a, b in zip(words, words[1:]):
            if b["start"] - a["end"] > 0.7:
                c.append({"type": "gap", "start": a["end"] + 0.12, "end": b["start"] - 0.12,
                          "text": f"gap {b['start'] - a['end']:.1f}s", "reason": "long gap between words", "skip": False})
        c.sort(key=lambda x: x["start"])
        json.dump(c, open("candidates.json", "w", encoding="utf-8"), ensure_ascii=False, indent=2)

        step(7, N, "keeplist")
        run([PY, TOOLS / "build_cutlist.py", "--duration", f"{dur:.3f}", "--silences", "silences.json",
             "--candidates", "candidates.json", "--max-pause", "0.6", "--keep-pause", "0.35",
             "--keep-ratio", "0.15", "--min-gap", "0.35", "-o", "keeplist.json", "--log", "edit_log.txt"],
            capture_output=True)
        keep = json.load(open("keeplist.json"))
    json.dump(keep, open("keeplist.json", "w"))

    cfg = Path("editor.json")
    old = json.load(open(cfg, encoding="utf-8")) if cfg.exists() else {}
    old.update(audio=mp3.name, keeplist="keeplist.json", transcript="transcript.json", lang=lang)
    json.dump(old, open(cfg, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    Path("a.wav").unlink(missing_ok=True)
    print("DONE", flush=True)


if __name__ == "__main__":
    main()
