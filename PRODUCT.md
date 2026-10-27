# Product

<!-- impeccable:product-schema 1 -->

## Identity

NihonSub is an independently maintained, local-first Japanese-to-English subtitle creation and review tool. It began as a fork of [Abhishantpadam/NihonSub](https://github.com/Abhishantpadam/NihonSub); this repository's current product direction is its own.

## Platform and users

- **Platform:** Local web application.
- **Primary user:** The owner, using it as a personal subtitling and review workspace.
- **Scope:** Short Japanese clips are the current working use case; longer videos are a future goal.

## Product purpose

Create timestamped English subtitles from Japanese dialogue, review them against the source video, and compare alternate subtitle outputs without losing the baseline.

## Core workflow

1. Upload a Japanese video.
2. Transcribe Japanese dialogue and translate it to English.
3. Review English, Japanese, or bilingual subtitles in a synchronized player with searchable transcript cues.
4. Adjust caption presentation and timing; export SRT or WebVTT.
5. Revisit saved A/B experiments, compare aligned baseline and candidate cues, and use embedded reference subtitles when available.

## Product principles and constraints

- Local models are the defaults: Parakeet for Japanese transcription and Qwen through Ollama for translation. Compatible providers can be configured.
- The Japanese transcript and timestamps are the dialogue source of truth; visual context must not override what was spoken.
- An A/B experiment isolates the intended change where possible, keeps the baseline visible, and reports differences without asserting that one candidate is objectively better.
- Saved experiments explain what changed, why, and the before/after outputs.
- NihonSub is currently a personal tool, not a hosted multi-user service.
