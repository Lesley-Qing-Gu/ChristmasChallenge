#!/usr/bin/env python3
"""
Transcribe with faster-whisper (word timestamps). Works on any computer: Windows, Linux, Intel Macs.
Uses an NVIDIA GPU (CUDA) automatically when one is available, otherwise the CPU.
The first run downloads the model; after that everything runs offline, no API needed.

用 faster-whisper 转写（带词级时间戳），任何电脑都能跑；有 N 卡自动用 CUDA，否则用 CPU。

Usage:
    python transcribe.py audio.mp3 -o transcript.json --language en --model medium
"""
import argparse
import json

from faster_whisper import WhisperModel

from prompts import filler_prompt


def has_cuda():
    try:
        import ctranslate2
        return ctranslate2.get_cuda_device_count() > 0
    except Exception:  # noqa
        return False


def stamp(t):
    m, s = divmod(t, 60)
    return f"{int(m):02d}:{s:06.3f}"


def main():
    ap = argparse.ArgumentParser(description="faster-whisper transcription")
    ap.add_argument("audio")
    ap.add_argument("-o", "--output", default="transcript.json")
    ap.add_argument("--model", default="medium", help="tiny/base/small/medium/large-v3; bigger = more accurate, slower")
    ap.add_argument("--device", default="auto", help="auto, cpu or cuda")
    ap.add_argument("--compute-type", default=None, help="int8 on CPU, float16 on GPU by default")
    ap.add_argument("--language", default=None, help="e.g. en, zh, sv. Leave empty to auto-detect")
    ap.add_argument("--prompt", default=None)
    args = ap.parse_args()

    device = args.device if args.device != "auto" else ("cuda" if has_cuda() else "cpu")
    ctype = args.compute_type or ("float16" if device == "cuda" else "int8")
    prompt = args.prompt if args.prompt is not None else filler_prompt(args.language)
    print(f"Loading model {args.model} ({device}/{ctype}); the first run downloads it", flush=True)
    model = WhisperModel(args.model, device=device, compute_type=ctype)

    segments_iter, info = model.transcribe(
        args.audio,
        language=args.language or None,
        word_timestamps=True,
        initial_prompt=prompt,
        condition_on_previous_text=False,
        vad_filter=True,   # skip long silences: faster, and no hallucinated "thanks for watching" at the end
    )
    segments = []
    for i, seg in enumerate(segments_iter):
        words = [{"word": w.word, "start": round(w.start, 3), "end": round(w.end, 3)} for w in (seg.words or [])]
        segments.append({"id": i, "start": round(seg.start, 3), "end": round(seg.end, 3),
                         "text": seg.text.strip(), "words": words})
        # same progress format as MLX Whisper, so the editor can show a progress bar
        print(f"[{stamp(seg.start)} --> {stamp(seg.end)}] {seg.text.strip()}", flush=True)

    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(segments, f, ensure_ascii=False, indent=2)
    print(f"LANGUAGE {info.language}", flush=True)
    print(f"Done: {len(segments)} segments -> {args.output}", flush=True)


if __name__ == "__main__":
    main()
