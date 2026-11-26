#!/usr/bin/env python3
"""
找"没有对应文字、但音量很响"的片段：咳嗽、清嗓子、拍桌子、Whisper 漏掉的嗯/啊等杂音。
思路：转写稿里每个词都有时间戳，把词占用的时间（前后各留 pad 秒）标成"有人在说话"，
剩下的时间里，音量超过阈值且持续够久的，就是候选杂音。

用法：
    python detect_noise.py 音频.wav transcript.json -o noise.json
    （音频先转成 16k 单声道 wav：ffmpeg -i 音频.mp3 -ac 1 -ar 16000 a.wav）
"""
import argparse
import json
import wave

import numpy as np


def main():
    ap = argparse.ArgumentParser(description="找无文字对应的大声杂音")
    ap.add_argument("audio", help="16k 单声道 wav")
    ap.add_argument("transcript")
    ap.add_argument("-o", "--output", default="noise.json")
    ap.add_argument("--db", type=float, default=-25, help="音量阈值(dBFS)，默认 -25，正常说话约 -25~-10")
    ap.add_argument("--min-dur", type=float, default=0.15, help="至少持续多少秒，默认 0.15")
    ap.add_argument("--pad", type=float, default=0.1, help="每个词前后各留多少秒当作'有人在说话'，默认 0.1")
    ap.add_argument("--pad-out", type=float, default=0.03, help="输出区间前后各多删多少秒，默认 0.03")
    args = ap.parse_args()

    w = wave.open(args.audio)
    sr = w.getframerate()
    x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
    hop, win = int(sr * 0.01), int(sr * 0.03)
    n = (len(x) - win) // hop
    fr = np.lib.stride_tricks.as_strided(x, (n, win), (x.strides[0] * hop, x.strides[0]))
    db = 20 * np.log10(np.sqrt((fr ** 2).mean(1)) + 1e-9)

    spoken = np.zeros(n, bool)
    with open(args.transcript, encoding="utf-8") as f:
        for seg in json.load(f):
            for wd in seg.get("words", []):
                if "咳" in wd["word"]:
                    continue
                spoken[max(0, int((wd["start"] - args.pad) * 100)):int((wd["end"] + args.pad) * 100) + 1] = True

    m = (db > args.db) & ~spoken
    out, i = [], 0
    while i < n:
        if m[i]:
            j = i
            while j < n and m[j:j + 8].any():
                j += 1
            if (j - i) / 100 >= args.min_dur:
                out.append({"start": round(i / 100 - args.pad_out, 3), "end": round(j / 100 + args.pad_out, 3),
                            "max_db": round(float(db[i:j].max()), 1)})
            i = j
        else:
            i += 1
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print(f"{len(out)} 处，共 {sum(o['end'] - o['start'] for o in out):.1f}s，已存到 {args.output}")


if __name__ == "__main__":
    main()
