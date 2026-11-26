#!/usr/bin/env python3
"""
第五步（最后一步）：按 keeplist.json 里的保留片段，实际剪出最终音频。

原音频只解码一次、流式处理，每个剪辑点做一个很短的等功率交叉淡化（默认 40ms），
避免硬切产生的"咔哒"声和环境底噪突然跳变；最后只编码一次，不会因为反复编码损失音质。

用法：
    python cut_audio.py 原始音频.mp3 keeplist.json -o 剪辑完成.mp3
"""
import argparse
import json
import subprocess

import numpy as np

HISTORY_SEC = 120


def probe(path):
    out = subprocess.run(
        ["ffprobe", "-v", "quiet", "-select_streams", "a:0",
         "-show_entries", "stream=sample_rate,channels", "-of", "csv=p=0", path],
        capture_output=True, text=True, check=True,
    ).stdout.strip()
    sr, ch = out.split(",")[:2]
    return int(sr), int(ch)


def main():
    ap = argparse.ArgumentParser(description="按保留片段列表剪辑音频")
    ap.add_argument("audio", help="原始音频文件路径")
    ap.add_argument("keeplist", help="build_cutlist.py 生成的 keeplist.json")
    ap.add_argument("-o", "--output", default="edited_output.mp3", help="输出文件路径（按扩展名决定格式）")
    ap.add_argument("--crossfade", type=float, default=0.04, help="剪辑点交叉淡化时长（秒），默认 0.04")
    ap.add_argument("--bitrate", default="192k", help="输出码率，默认 192k")
    ap.add_argument("--fade-in", type=float, default=0.5, help="开头淡入时长（秒），默认 0.5，0 为不淡入")
    ap.add_argument("--fade-out", type=float, default=1.5, help="结尾淡出时长（秒），默认 1.5，0 为不淡出")
    ap.add_argument("--no-balance", action="store_true", help="同 --level none（保留旧用法）")
    ap.add_argument("--level", choices=["none", "loudnorm", "full"], default="full",
                    help="音量处理：none 原声不处理；loudnorm 只把整体响度统一到 -16 LUFS；"
                         "full（默认）先用 dynaudnorm 拉平两人音量差，再统一到 -16 LUFS")
    ap.add_argument("--denoise", choices=["off", "light", "strong"], default="off",
                    help="降噪：off 不降噪（默认）；light 轻度（去低频嗡嗡 + 轻度 FFT 降噪）；strong 强力")
    ap.add_argument("--random-access", action="store_true",
                    help="keeplist 里有大幅跳回前面的片段（挪动段落顺序）时用：整段解码进内存（约 1GB/小时）")
    args = ap.parse_args()

    with open(args.keeplist, encoding="utf-8") as f:
        keep = json.load(f)

    sr, ch = probe(args.audio)
    frame_bytes = 2 * ch
    xf = max(1, int(sr * args.crossfade))
    t = np.linspace(0, np.pi / 2, xf, dtype=np.float32)[:, None]
    fade_in, fade_out = np.sin(t), np.cos(t)

    dec = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-i", args.audio, "-f", "s16le", "-acodec", "pcm_s16le",
         "-ar", str(sr), "-ac", str(ch), "-"],
        stdout=subprocess.PIPE,
    )
    filters = []
    if args.denoise == "light":
        filters += ["highpass=f=80", "afftdn=nr=12:nf=-42:tn=1"]
    elif args.denoise == "strong":
        filters += ["highpass=f=80", "afftdn=nr=24:nf=-38:tn=1", "anlmdn=s=5"]
    level = "none" if args.no_balance else args.level
    if level == "full":
        # dynaudnorm 按短窗口逐段拉平音量（轻的人声被抬高、响的被压低），loudnorm 再统一整体响度
        filters += ["dynaudnorm=f=400:g=15:p=0.9:m=8:s=5", "loudnorm=I=-16:TP=-1.5:LRA=9"]
    elif level == "loudnorm":
        filters += ["loudnorm=I=-16:TP=-1.5:LRA=11"]
    total = sum(e - s for s, e in keep)
    if args.fade_in > 0:
        filters.append(f"afade=t=in:d={args.fade_in}")
    if args.fade_out > 0 and total > args.fade_out:
        filters.append(f"afade=t=out:st={total - args.fade_out:.3f}:d={args.fade_out}")
    af = ["-af", ",".join(filters)] if filters else []
    enc = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-y", "-f", "s16le", "-ar", str(sr), "-ac", str(ch), "-i", "-",
         *af, "-b:a", args.bitrate, args.output],
        stdin=subprocess.PIPE,
    )

    # 缓存最近解码的一段音频：keeplist 里借用底噪的条目会回头取前面的静音
    chunks, decoded, history = [], 0, HISTORY_SEC * sr

    full = None
    if args.random_access:
        full = np.frombuffer(dec.stdout.read(), dtype=np.int16).reshape(-1, ch)

    def get(si, ei):
        nonlocal chunks, decoded
        if full is not None:
            return full[max(0, si):ei].astype(np.float32)
        while decoded < ei:
            data = dec.stdout.read(sr * 10 * frame_bytes)
            if not data:
                break
            arr = np.frombuffer(data, dtype=np.int16).reshape(-1, ch)
            chunks.append((decoded, arr))
            decoded += len(arr)
        parts = [a[max(0, si - st):ei - st] for st, a in chunks if st < ei and st + len(a) > si]
        chunks = [(st, a) for st, a in chunks if st + len(a) > ei - history]
        if not parts:
            return np.zeros((0, ch), dtype=np.float32)
        return np.concatenate(parts).astype(np.float32)

    def write(x):
        enc.stdin.write(np.clip(x, -32768, 32767).astype(np.int16).tobytes())

    print(f"共 {len(keep)} 个保留片段，开始剪辑（交叉淡化 {args.crossfade * 1000:.0f}ms）...")
    tail = None
    for i, (s, e) in enumerate(keep):
        seg = get(round(s * sr), round(e * sr))
        if len(seg) == 0:
            continue
        if len(seg) <= xf:
            if tail is not None:
                write(tail)
            write(seg)
            tail = None
            continue
        if tail is not None:
            seg[:xf] = tail * fade_out + seg[:xf] * fade_in
        write(seg[:-xf])
        tail = seg[-xf:]
        if (i + 1) % 200 == 0:
            print(f"  已处理 {i + 1}/{len(keep)} 段")
    if tail is not None:
        write(tail)

    enc.stdin.close()
    dec.stdout.close()
    dec.wait()
    if enc.wait() != 0:
        raise SystemExit("编码失败，请检查输出路径/格式")
    print(f"完成！输出文件：{args.output}")


if __name__ == "__main__":
    main()
