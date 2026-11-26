#!/usr/bin/env python3
"""
第三步：在转写稿里找出"嗯啊语气词"和"重复的话"，输出建议删除的时间区间。

语气词识别：逐词扫描，命中纯语气词（嗯/啊/呃/额/哦...）就标记该词的时间范围。
重复识别：把转写稿按标点切成"句子"，同一说话人相邻两句、间隔很短且内容高度相似，
         判定为"重来了一遍"，标记前一句待删除；拿不准的标 skip=true，默认不删。

⚠️ 这两种判断都不是100%准确，尤其是重复识别，只是"疑似"，
   输出的 candidates.json 建议你人工过一遍再决定要不要真的剪掉，
   而不是无脑全删。

用法：
    python analyze_transcript.py transcript.json -o candidates.json
"""
import argparse
import difflib
import json
import re

from prompts import FILLER_RE, NEGATIONS, REACTION_RE, pick

# set in main() from --lang: hesitation sounds, meaningful reactions ("oh!"), negation words
FILLER_PATTERN = FILLER_RE["zh"]
REACTION_PATTERN = REACTION_RE["zh"]
NEGATION_RE = NEGATIONS["zh"]


def find_filler_words(segments, min_dur=0.35):
    """扫描词级时间戳，找出纯语气词。只默认删拖长的犹豫词（"呃——"），
    短促的嗯/啊是自然口语，单独成段的是对话里的附和，都标 skip=true 默认保留。"""
    candidates = []
    for seg in segments:
        words = seg.get("words", [])
        backchannel = bool(FILLER_PATTERN.match(seg.get("text", "").strip())) if seg.get("text") else False
        for w in words:
            token = w["word"].strip()
            if token and FILLER_PATTERN.match(token):
                dur = w["end"] - w["start"]
                doubts = []
                if REACTION_PATTERN.search(token):
                    doubts.append("可能是有意义的反应")
                if backchannel:
                    doubts.append("单独成段，更像对话附和")
                if dur < min_dur:
                    doubts.append(f"仅 {dur:.2f}s，短促自然")
                reason = "语气词" if not doubts else "语气词；" + "，".join(doubts) + "，默认保留"
                candidates.append({
                    "type": "filler",
                    "start": w["start"],
                    "end": w["end"],
                    "text": token,
                    "reason": reason,
                    "skip": bool(doubts),
                })
    return candidates


def find_drop_words(segments, drop_words):
    """口头连接词（如"然后"）：词本身正好等于指定词才删，"然后来"这种连在一起的词不动"""
    out = []
    for seg in segments:
        for w in seg.get("words", []):
            token = re.sub(r"[\s，。、！？,.!?]", "", w["word"]).lower()
            if token in drop_words:
                out.append({"type": "word", "start": w["start"], "end": w["end"], "text": token,
                            "reason": "指定删除的口头词", "skip": False})
    return out


SENTENCE_END = re.compile(r"[。！？!?.]\s*$")
PUNCT = re.compile(r"[\s，。！？、,.!?]")


def split_sentences(segments):
    """按句末标点切句，起止时间直接取词级时间戳（切到字边界上，不会切进半个字）"""
    sentences = []
    for seg in segments:
        words = seg.get("words") or []
        speaker = seg.get("speaker")
        if not words:
            if seg["text"].strip():
                sentences.append({"start": seg["start"], "end": seg["end"],
                                  "text": seg["text"].strip(), "speaker": speaker})
            continue
        buf, start = "", None
        for w in words:
            if start is None:
                start = w["start"]
            buf += w["word"]
            if SENTENCE_END.search(w["word"]):
                sentences.append({"start": start, "end": w["end"], "text": buf.strip(), "speaker": speaker})
                buf, start = "", None
        if buf.strip():
            sentences.append({"start": start, "end": words[-1]["end"], "text": buf.strip(), "speaker": speaker})
    return sentences




def find_repeats(sentences, similarity_threshold=0.7, review_threshold=0.6, max_gap=4.0,
                 far_gap=15.0, far_similarity=0.8, length_ratio=1.5, min_chars=3):
    """相邻句子高度相似 -> 默认删前一句、留后一句（重说时后一版通常更准）。
    不确定的情况标 skip=true：build_cutlist 默认不删，人工确认后改成 false 才会删。"""
    candidates = []
    for i in range(len(sentences) - 1):
        a, b = sentences[i], sentences[i + 1]
        # 不同人说相似的话是附和/接话，不是重说
        if a.get("speaker") != b.get("speaker"):
            continue
        gap = b["start"] - a["end"]
        if gap > far_gap:
            continue
        ta, tb = PUNCT.sub("", a["text"]), PUNCT.sub("", b["text"])
        if len(ta) < min_chars:
            continue
        ratio = difflib.SequenceMatcher(None, ta, tb).ratio()
        # false start: the first sentence breaks off and the second starts over the same way ("I tried to… / I tried to go")
        head = tb[:len(ta) + 2]
        covered = sum(m.size for m in difflib.SequenceMatcher(None, ta, head).get_matching_blocks())
        restart = len(ta) >= 6 and len(tb) > len(ta) and covered >= 0.8 * len(ta) and gap <= max_gap
        if restart:
            ratio = max(ratio, similarity_threshold)
        if ratio < review_threshold:
            continue
        doubts = []
        if ratio < similarity_threshold:
            doubts.append("相似度一般，可能是列举/换了说法")
        # "是好的发展"→"是不好的发展" 这种字面很像但意思相反
        if set(NEGATION_RE.findall(a["text"].lower())) != set(NEGATION_RE.findall(b["text"].lower())):
            doubts.append("否定词不一致，意思可能相反")
        if gap > max_gap:
            if ratio < far_similarity:
                continue
            doubts.append(f"间隔 {gap:.1f}s，更像呼应前文")
        if len(ta) > len(tb) * length_ratio:
            doubts.append("前一句明显更长，后一句可能只是强调")
        reason = f"与后一句相似度 {ratio:.0%}，疑似重说：「{b['text']}」"
        if doubts:
            reason += "；" + "，".join(doubts) + "，默认不删"
        candidates.append({
            "type": "repeat",
            "start": a["start"],
            "end": a["end"],
            "text": a["text"],
            "reason": reason,
            "skip": bool(doubts),
        })
    return candidates


def main():
    ap = argparse.ArgumentParser(description="从转写稿中找出语气词和重复片段")
    ap.add_argument("transcript", help="transcribe.py 生成的 transcript.json")
    ap.add_argument("-o", "--output", default="candidates.json", help="输出候选删除区间 JSON")
    ap.add_argument("--similarity", type=float, default=0.7,
                    help="相似度达到这个值才默认删除，默认 0.7")
    ap.add_argument("--review-similarity", type=float, default=0.6,
                    help="相似度在 review~similarity 之间的只列出供人工确认、默认不删，默认 0.6")
    ap.add_argument("--max-gap", type=float, default=4.0,
                    help="两句间隔不超过这么多秒才算'重说'，默认 4s（口误重来一般 1~3 秒内就会重新开口）")
    ap.add_argument("--far-gap", type=float, default=15.0,
                    help="间隔在 max-gap~far-gap 之间且相似度很高的，只列出供参考、默认不删，默认 15s")
    ap.add_argument("--filler-min-dur", type=float, default=0.35,
                    help="语气词至少拖这么长（秒）才默认删，更短的保留以免听着太干净，默认 0.35s")
    ap.add_argument("--drop-words", nargs="*", default=[],
                    help="要整体删掉的口头词，如 --drop-words 然后")
    ap.add_argument("--lang", default="zh", help="transcript language: zh, en, sv, ...")
    args = ap.parse_args()
    global FILLER_PATTERN, REACTION_PATTERN, NEGATION_RE
    FILLER_PATTERN, REACTION_PATTERN, NEGATION_RE = pick(FILLER_RE, args.lang), pick(REACTION_RE, args.lang), pick(NEGATIONS, args.lang)

    with open(args.transcript, encoding="utf-8") as f:
        segments = json.load(f)

    fillers = find_filler_words(segments, args.filler_min_dur)
    sentences = split_sentences(segments)
    repeats = find_repeats(sentences, similarity_threshold=args.similarity,
                           review_threshold=args.review_similarity,
                           max_gap=args.max_gap, far_gap=args.far_gap)

    candidates = sorted(fillers + repeats + find_drop_words(segments, {w.lower() for w in args.drop_words}), key=lambda c: c["start"])

    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(candidates, f, ensure_ascii=False, indent=2)

    doubtful = sum(1 for r in repeats if r["skip"])
    f_kept = sum(1 for r in fillers if r["skip"])
    print(f"找到语气词 {len(fillers)} 处（{f_kept} 处较短促/像附和，默认保留），"
          f"疑似重复句 {len(repeats)} 处（其中 {doubtful} 处不确定，默认不删）")
    if not any("speaker" in s for s in segments):
        print("提示：转写稿里没有说话人标注，不同人之间的附和也可能被误判为重复，"
              "建议用 transcript_speakers_pyannote.json 这类带 speaker 的文件")
    print(f"已保存到 {args.output}，建议打开人工检查一遍再进入下一步")


if __name__ == "__main__":
    main()
