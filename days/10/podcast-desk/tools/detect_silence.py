#!/usr/bin/env python3
"""
第一步：检测静音片段
用 ffmpeg 的 silencedetect 找出音频中的静音区间，输出为 JSON。
不需要联网、不需要语音识别，纯音量分析，速度很快。

用法：
    python detect_silence.py 原始音频.mp3 -o silences.json
    python detect_silence.py 原始音频.mp3 --noise -35dB
"""
import argparse
import json
import re
import subprocess
import sys


def detect_silence(audio_path: str, noise_db: str = "-30dB", min_dur: float = 0.15):
    """调用 ffmpeg silencedetect，解析 stderr 输出静音区间列表"""
    cmd = [
        "ffmpeg", "-i", audio_path,
        "-af", f"silencedetect=noise={noise_db}:d={min_dur}",
        "-f", "null", "-",
    ]
    proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    stderr = proc.stderr

    starts = [float(m) for m in re.findall(r"silence_start:\s*([0-9.]+)", stderr)]
    ends = [float(m) for m in re.findall(r"silence_end:\s*([0-9.]+)", stderr)]

    # ffmpeg 有时最后一段静音没有 silence_end（音频正好在静音里结束），配对时兜底处理
    silences = []
    for i, s in enumerate(starts):
        if i < len(ends):
            silences.append({"start": round(s, 3), "end": round(ends[i], 3)})
        else:
            silences.append({"start": round(s, 3), "end": None})
    return silences


def main():
    ap = argparse.ArgumentParser(description="检测音频中的静音片段")
    ap.add_argument("audio", help="输入音频文件路径")
    ap.add_argument("-o", "--output", default="silences.json", help="输出 JSON 路径")
    ap.add_argument("--noise", default="-30dB", help="静音判定的音量阈值，越负越严格，默认 -30dB")
    ap.add_argument("--min-dur", type=float, default=0.15,
                    help="最短静音时长（秒），默认 0.15。这里要设小：把短停顿也找出来，"
                         "剪不剪由 build_cutlist.py 决定，删语气词时才能留出前后的换气")
    args = ap.parse_args()

    print(f"分析中：{args.audio} (阈值 {args.noise}，最短 {args.min_dur}s)...")
    silences = detect_silence(args.audio, args.noise, args.min_dur)

    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(silences, f, ensure_ascii=False, indent=2)

    total = sum((s["end"] or s["start"]) - s["start"] for s in silences)
    print(f"共检测到 {len(silences)} 段静音，累计约 {total:.1f} 秒")
    print(f"已保存到 {args.output}")


if __name__ == "__main__":
    main()
