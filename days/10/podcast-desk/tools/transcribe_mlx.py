#!/usr/bin/env python3
"""
Transcribe with MLX Whisper (Apple Silicon GPU). Much faster than transcribe.py (faster-whisper, CPU)
on an M-series Mac. Output format is identical (transcript.json: segments + word timestamps).

用 MLX 版 Whisper（Apple 芯片 GPU）转写，比 transcribe.py 快很多，输出格式完全一样。

Usage:
    python transcribe_mlx.py audio.mp3 -o transcript.json --language en
"""
import argparse
import json

import mlx_whisper

from prompts import filler_prompt


def main():
    ap = argparse.ArgumentParser(description="MLX Whisper transcription with word timestamps")
    ap.add_argument("audio")
    ap.add_argument("-o", "--output", default="transcript.json")
    ap.add_argument("--model", default="mlx-community/whisper-large-v3-turbo")
    ap.add_argument("--language", default=None, help="e.g. en, zh, sv. Leave empty to auto-detect")
    ap.add_argument("--prompt", default=None, help="initial prompt; defaults to one full of fillers so Whisper keeps 'um'/'嗯'")
    args = ap.parse_args()
    prompt = args.prompt if args.prompt is not None else filler_prompt(args.language)

    print(f"Transcribing {args.audio} (model {args.model})", flush=True)
    # verbose=True prints "[00:12.340 --> 00:15.000] text" per segment; the editor uses it for progress
    result = mlx_whisper.transcribe(
        args.audio,
        path_or_hf_repo=args.model,
        language=args.language or None,
        word_timestamps=True,
        initial_prompt=prompt,
        condition_on_previous_text=False,   # one bad segment shouldn't derail the rest
        verbose=True,
    )
    segments = []
    for i, seg in enumerate(result["segments"]):
        words = [{"word": w["word"], "start": round(w["start"], 3), "end": round(w["end"], 3)}
                 for w in seg.get("words", [])]
        segments.append({"id": i, "start": round(seg["start"], 3), "end": round(seg["end"], 3),
                         "text": seg["text"].strip(), "words": words})
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(segments, f, ensure_ascii=False, indent=2)
    print(f"LANGUAGE {result.get('language') or args.language or ''}", flush=True)
    print(f"Done: {len(segments)} segments -> {args.output}", flush=True)


if __name__ == "__main__":
    main()
