#!/usr/bin/env python3
"""
Find who speaks when, and where two people talk at once (pyannote). Runs on CUDA, Apple MPS or CPU.
找出两个人同时开口、声音叠在一起的区间。
用 pyannote 说话人分离（模型已缓存在本地时可离线运行），取"同一时刻有 2 个及以上说话人"的时间段。
输出 overlaps.json（[{start, end}, ...]）和 speakers.rttm，供 analyze/build 阶段当作候选删除区间。

用法：
    HF_HUB_OFFLINE=1 python detect_overlap.py 原始音频.mp3 --num-speakers 2 -o overlaps.json
"""
import argparse
import json
import os

import torch
from pyannote.audio import Pipeline


def main():
    ap = argparse.ArgumentParser(description="检测两人同时说话的重叠区间")
    ap.add_argument("audio")
    ap.add_argument("--num-speakers", type=int, default=2)
    ap.add_argument("-o", "--output", default="overlaps.json")
    ap.add_argument("--rttm", default="speakers.rttm")
    ap.add_argument("--min-dur", type=float, default=0.3, help="重叠短于这么多秒的忽略，默认 0.3s")
    args = ap.parse_args()

    # free model; the first download needs HF_TOKEN (a Hugging Face token, after accepting the model terms)
    token = os.environ.get("HF_TOKEN")
    try:
        pipe = Pipeline.from_pretrained("pyannote/speaker-diarization-3.1", token=token)
    except TypeError:   # pyannote 3.x
        pipe = Pipeline.from_pretrained("pyannote/speaker-diarization-3.1", use_auth_token=token)
    if pipe is None:
        raise SystemExit("pyannote model not available: set HF_TOKEN once to download it")
    if torch.cuda.is_available():
        pipe.to(torch.device("cuda"))
    elif torch.backends.mps.is_available():
        pipe.to(torch.device("mps"))
    diar = pipe(args.audio, num_speakers=args.num_speakers)
    diar = getattr(diar, "speaker_diarization", diar)  # 新版 pyannote 返回的是包了一层的对象
    with open(args.rttm, "w") as f:
        diar.write_rttm(f)

    overlap = diar.get_overlap()
    out = [{"start": round(s.start, 3), "end": round(s.end, 3)} for s in overlap if s.duration >= args.min_dur]
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print(f"重叠区间 {len(out)} 处，共 {sum(o['end'] - o['start'] for o in out):.1f}s，已存到 {args.output}")


if __name__ == "__main__":
    main()
