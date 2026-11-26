"""Language-specific bits shared by the pipeline: Whisper prompts, filler words, negations.
按语言区分的配置：Whisper 提示词、语气词、否定词。"""
import re

# Whisper drops "um"/"嗯" unless the initial prompt shows it that we want them transcribed
FILLER_PROMPTS = {
    "zh": "嗯，呃，那个，我觉得，啊，就是，嗯嗯，对对对，然后呃，是这样的。",
    "en": "Um, so, uh, I think, like... hmm. Yeah, I mean, uh, it's, um, it's like that.",
    "sv": "Eh, alltså, öh, jag tycker, typ... hmm. Ja, asså, eh, det är så.",
    "de": "Äh, also, ähm, ich finde, so... hm. Ja, ich meine, äh, das ist so.",
    "fr": "Euh, donc, bah, je pense, genre... hum. Ouais, enfin, euh, c'est comme ça.",
    "es": "Eh, bueno, este, creo que, o sea... mmm. Sí, digamos, eh, es así.",
}

# a token made only of these counts as a hesitation sound
FILLER_RE = {
    "zh": re.compile(r"^[嗯啊呃额哦唉诶噢\s，。、,.!?！？…]+$"),
    "default": re.compile(r"^\W*(u+h+m*|u+m+|e+r+m*|e+h+|h+m+|m+h*m+|a+h+|ö+h+m*|ä+h+m*|e+u+h+|ehm+|öhm+)\W*$", re.I),
}
# sounds that are usually a meaningful reaction ("oh!"), kept by default
REACTION_RE = {
    "zh": re.compile(r"[哦诶噢唉]"),
    "default": re.compile(r"^\W*(a+h+|o+h+)\W*$", re.I),
}
# filler words the rough cut removes entirely (matched as a whole word)
DROP_WORDS = {"zh": ["然后", "然後"]}
NEGATIONS = {
    "zh": re.compile(r"[不没别非无]"),
    "default": re.compile(r"\b(not|no|never|nothing|n't|inte|nicht|kein|pas|jamais|nunca)\b", re.I),
}


def pick(table, lang):
    return table.get((lang or "").split("-")[0], table.get("default"))


def filler_prompt(lang):
    return FILLER_PROMPTS.get((lang or "").split("-")[0])
