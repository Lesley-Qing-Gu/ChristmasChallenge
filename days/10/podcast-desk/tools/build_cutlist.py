#!/usr/bin/env python3
"""
第四步：把静音区间 + 语气词/重复候选区间合并，算出最终"要保留的片段列表"，
并生成一份人类可读的剪辑日志，方便你剪之前先看一眼删的对不对。

思路：静音不是"整段删掉"，而是"修剪到一个自然的停顿长度"。
  - 静音、语气词、重复句如果挨在一起，会合并成一个"空档"一起处理，
    避免"删了嗯，前后两段停顿又各自被压缩"导致的连续碎剪；
  - 每个空档最终保留的停顿 = keep_pause + keep_ratio × 原静音时长，最多 max_pause，
    原来停得越久，剪完也稍微长一点，保留说话的节奏感；
  - 保留的停顿来自原空档两端贴着人声的那部分环境音，不会切进字头字尾；
  - 短于 max_pause 的纯静音不动（那是正常的换气/思考停顿）；
  - 删掉语气词/重说后至少留 min_gap 的停顿，前后真实静音不够时借附近的底噪补齐。

用法：
    python build_cutlist.py --duration 6528 \
        --silences silences.json --candidates candidates.json \
        -o keeplist.json --log edit_log.txt

    --duration 是原始音频总时长（秒），可以用 ffprobe 查：
        ffprobe -i 音频.mp3 -show_entries format=duration -v quiet -of csv="p=0"

    注意：silences.json 需要用 detect_silence.py 的默认 --min-dur 0.15 生成，
    这样语气词前后的短停顿也能被识别到，删完语气词才能留出自然的换气。
"""
import argparse
import json


def build_regions(silences, removals, tol):
    """把重叠或相距不到 tol 秒的静音/删除区间合并成一个个空档"""
    items = [{"start": s["start"], "end": s["end"], "kind": "silence"} for s in silences]
    items += [{**r, "kind": "remove"} for r in removals]
    items.sort(key=lambda x: x["start"])
    regions = []
    for it in items:
        if regions and it["start"] <= regions[-1]["end"] + tol:
            regions[-1]["end"] = max(regions[-1]["end"], it["end"])
            regions[-1]["items"].append(it)
        else:
            regions.append({"start": it["start"], "end": it["end"], "items": [it]})
    return regions


def target_pause(silence_total, args):
    return min(silence_total, args.max_pause, args.keep_pause + args.keep_ratio * silence_total)


def find_room_tone(silences, before, need, lookback):
    """在 before 之前 lookback 秒内找最近一段够长的静音，取中间 need 秒当填充用的环境底噪"""
    for s in reversed(silences):
        if s["end"] > before:
            continue
        if s["end"] < before - lookback:
            return None
        if s["end"] - s["start"] >= need + 0.1:
            mid = (s["start"] + s["end"]) / 2
            return mid - need / 2, mid + need / 2
    return None


def plan_region(region, silences, args):
    """返回 (删除起点, 删除终点, 保留停顿秒数, 填充底噪区间或 None)，不需要剪返回 None"""
    start, end = region["start"], region["end"]
    removes = [it for it in region["items"] if it["kind"] == "remove"]
    silence_total = sum(it["end"] - it["start"] for it in region["items"] if it["kind"] == "silence")

    if not removes:
        if end - start <= args.max_pause:
            return None
        k = target_pause(end - start, args)
        return start + k / 2, end - k / 2, k, None

    # 有要删的内容：优先用删除内容前后贴着人声的真实静音当停顿
    lead_avail = min(it["start"] for it in removes) - start
    trail_avail = end - max(it["end"] for it in removes)
    k = max(args.min_gap, target_pause(silence_total, args))
    lead = min(lead_avail, k / 2)
    trail = min(trail_avail, k - lead)
    lead = min(lead_avail, k - trail)

    # 真实静音不够（语气词/重说紧贴着下一句），借一小段附近的底噪补上，避免两句话直接撞在一起
    fill = None
    deficit = k - lead - trail
    if deficit > 0.05:
        fill = find_room_tone(silences, start, deficit, args.room_tone_lookback)
    kept = lead + trail + (fill[1] - fill[0] if fill else 0)
    return start + lead, end - trail, kept, fill


def describe(region, kept):
    removes = [it for it in region["items"] if it["kind"] == "remove"]
    dur = region["end"] - region["start"]
    t = f"[{region['start']:7.1f}s - {region['end']:7.1f}s]"
    if not removes:
        return f"{t} 静音 {dur:.1f}s → 保留停顿 {kept:.2f}s"
    what = "；".join(f"{it.get('reason', '')} {it.get('text', '')}".strip() for it in removes)
    return f"{t} 删除 {what}（整段空档 {dur:.1f}s → 保留停顿 {kept:.2f}s）"


def main():
    ap = argparse.ArgumentParser(description="生成最终保留片段列表")
    ap.add_argument("--duration", type=float, required=True, help="原始音频总时长（秒）")
    ap.add_argument("--silences", default="silences.json", help="detect_silence.py 输出")
    ap.add_argument("--candidates", default=None,
                    help="analyze_transcript.py 输出（可选，不传则只修剪静音）")
    ap.add_argument("--max-pause", type=float, default=1.2,
                    help="纯静音超过多少秒才修剪，也是修剪后停顿的上限，默认 1.2s")
    ap.add_argument("--keep-pause", type=float, default=0.6,
                    help="修剪后保留停顿的基础长度，默认 0.6s")
    ap.add_argument("--keep-ratio", type=float, default=0.3,
                    help="原静音每多 1 秒，保留停顿多加多少秒，默认 0.3（保留长短停顿的节奏差异）")
    ap.add_argument("--min-gap", type=float, default=0.35,
                    help="删掉语气词/重说后，至少保留多长的停顿，默认 0.35s")
    ap.add_argument("--room-tone-lookback", type=float, default=60.0,
                    help="停顿不够时往前多少秒内找静音借底噪，默认 60s（cut_audio 只缓存最近 120s）")
    ap.add_argument("--merge-tol", type=float, default=0.15,
                    help="静音和语气词相距不到这么多秒就当成同一个空档处理，默认 0.15s")
    ap.add_argument("--min-keep", type=float, default=0.05,
                    help="保留片段短于此长度就丢弃（只清掉碎片，别调大，否则会吞掉短词），默认 0.05s")
    ap.add_argument("-o", "--output", default="keeplist.json", help="输出保留片段 JSON")
    ap.add_argument("--log", default="edit_log.txt", help="输出人类可读剪辑日志")
    args = ap.parse_args()

    with open(args.silences, encoding="utf-8") as f:
        silences = json.load(f)
    for s in silences:
        if s["end"] is None:
            s["end"] = args.duration

    removals, skipped = [], []
    if args.candidates:
        with open(args.candidates, encoding="utf-8") as f:
            for c in json.load(f):
                (skipped if c.get("skip") else removals).append(c)

    regions = build_regions(silences, removals, args.merge_tol)

    cuts, log_lines = [], []
    for region in regions:
        plan = plan_region(region, silences, args)
        if plan is None:
            continue
        cut_s, cut_e, kept, fill = plan
        if cut_e > cut_s:
            cuts.append((cut_s, cut_e, fill))
            log_lines.append(describe(region, kept) + ("（含借用底噪）" if fill else ""))

    # keeplist 按输出顺序排列；填充底噪条目的时间会早于前一条，cut_audio 会从缓存里取
    keep, cursor = [], 0.0
    for s, e, fill in cuts:
        if s > cursor:
            keep.append([round(cursor, 3), round(s, 3)])
        if fill:
            keep.append([round(fill[0], 3), round(fill[1], 3)])
        cursor = max(cursor, e)
    if cursor < args.duration:
        keep.append([round(cursor, 3), round(args.duration, 3)])
    keep = [k for k in keep if (k[1] - k[0]) >= args.min_keep]

    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(keep, f, ensure_ascii=False, indent=2)

    kept_dur = sum(k[1] - k[0] for k in keep)
    cut_dur = args.duration - kept_dur

    with open(args.log, "w", encoding="utf-8") as f:
        f.write(f"原始时长: {args.duration/60:.1f} 分钟\n")
        f.write(f"剪掉约: {cut_dur/60:.1f} 分钟\n")
        f.write(f"剪完约: {kept_dur/60:.1f} 分钟\n\n")
        f.write("=== 剪辑明细 ===\n")
        f.write("\n".join(log_lines) + "\n")
        if skipped:
            f.write("\n=== 疑似语气词/重复但默认没删（确认要删就把 candidates.json 里对应的 skip 改成 false） ===\n")
            for c in skipped:
                f.write(f"[{c['start']:7.1f}s - {c['end']:7.1f}s] {c.get('text', '')} —— {c.get('reason', '')}\n")

    print(f"原始 {args.duration/60:.1f} 分钟 -> 剪完约 {kept_dur/60:.1f} 分钟（删掉 {cut_dur/60:.1f} 分钟）")
    print(f"保留片段列表已存到 {args.output}")
    print(f"详细剪辑日志已存到 {args.log}，强烈建议剪之前先看一遍这份日志")


if __name__ == "__main__":
    main()
