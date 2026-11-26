# Podcast Desk

Edit a podcast by editing its transcript. Delete a word and it's gone from the audio; move a passage and it plays in the new order. It works like tracked changes in Word.

Everything runs on your own computer. Your recordings never leave it, and you don't need an API key.

## What it does

- **Upload a recording** (mp3, m4a, wav or mp4). It's transcribed with Whisper, split by speaker, and rough-cut automatically. The rough cut removes:
  - ums and uhs
  - false starts
  - coughs
  - cross-talk
  - breaths
  - long gaps
- **Edit the text, edit the audio.**
  - Deleted words turn into red strike-through, and you can restore them at any time.
  - Moved passages get a green double underline.
  - Undo and autosave are always on.
- **Listen as you go.** The player plays the edited episode and highlights each word as it's spoken.
- **Remove filler words in one go.** Tick the fillers to delete, or add your own.
- **Even out the pauses.** Every pause between sentences becomes the same length.
- **Change one speaker's speed.** The pitch stays the same.
- **Export a clean mp3.**
  - Every cut gets a crossfade.
  - Optional: even loudness, levelled speakers, and noise removal (including AI voice isolation).
  - A/B listening lets you compare the settings before you export.
- **Write show notes (optional).** If [Claude Code](https://claude.com/claude-code) is installed, it writes show notes with timestamps that match the edited episode. If earlier show notes are in your projects folder, it follows their format.
- **Languages.** The interface is in English or Chinese. Transcription works for any language Whisper knows. Filler words are built in for English, Chinese, Swedish, German, French, Spanish and Japanese.

## Install (once)

You need **Python 3.10+** and **ffmpeg**:

| | ffmpeg |
|---|---|
| macOS | `brew install ffmpeg` |
| Windows | `winget install ffmpeg` |
| Ubuntu / Debian | `sudo apt install ffmpeg` |

Then run the setup script. It creates a `.venv` folder and installs everything:

- **macOS / Linux:** `./setup.sh`
- **Windows:** double-click `setup.bat`

On an Apple Silicon Mac, setup also installs `mlx-whisper`, which transcribes on the GPU and is several times faster. Other computers use `faster-whisper`. It runs on the CPU, or on an NVIDIA GPU automatically if you have one.

### Telling speakers apart (optional, free)

Speaker detection uses [pyannote](https://huggingface.co/pyannote/speaker-diarization-3.1). The model is free, but the first download needs a Hugging Face token:

1. Create a free account at huggingface.co.
2. Accept the terms on [speaker-diarization-3.1](https://huggingface.co/pyannote/speaker-diarization-3.1) and [segmentation-3.0](https://huggingface.co/pyannote/segmentation-3.0).
3. Create a read token at huggingface.co/settings/tokens.
4. Start Podcast Desk once with it set:
   - macOS / Linux: `HF_TOKEN=hf_xxx ./start.sh`
   - Windows: `set HF_TOKEN=hf_xxx` then `start.bat`

After that the model is cached and works offline. Without a token, everything else still works: the transcript just has one speaker, and cross-talk isn't detected.

## Start

- **macOS:** double-click `start.command`
- **Windows:** double-click `start.bat`
- **Linux:** `./start.sh`

It opens http://localhost:8765 in your browser. Projects are saved in `projects/`, one folder per episode, next to the original audio. Exports are written into the same folder and never overwrite the original.

The first transcription downloads the Whisper model (about 1.5 GB). After that, an M-series Mac transcribes an hour of audio in a few minutes; a CPU takes noticeably longer.

## Keys

| Key | Action |
|---|---|
| Space | Play / pause from the cursor |
| ← → | Move the cursor (⇧ selects, ⌥ jumps a sentence) |
| Backspace / Delete | Delete |
| R | Restore deleted words |
| Ctrl+X, then Ctrl+V (⌘ on Mac) | Move a passage |
| ⌘Z / ⇧⌘Z | Undo / redo |

## Files

```
start.command / start.bat / start.sh   start the editor
setup.sh / setup.bat                   one-time install
app/server.py                          local web server (Python standard library + numpy)
app/index.html                         the editor
tools/auto_rough_cut.py                the whole pipeline: convert → transcribe → speakers → candidates → keep list
tools/transcribe_mlx.py                Whisper on Apple Silicon (MLX)
tools/transcribe.py                    Whisper anywhere else (faster-whisper)
tools/detect_overlap.py                speakers and cross-talk (pyannote)
tools/analyze_transcript.py            fillers and false starts
tools/detect_silence.py, detect_noise.py, build_cutlist.py, cut_audio.py
tools/prompts.py                       per-language filler words and Whisper prompts
projects/                              your episodes
```

Each tool also works on its own from the command line. Run it with `--help` to see how.

Made for [Shipmas](https://lesley-qing-gu.github.io/ChristmasChallenge/) Day 10 by Lesley Qing Gu. Originally built to edit the OutSea podcast.
