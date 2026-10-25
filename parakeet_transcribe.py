#!/usr/bin/env python3
"""Local Japanese transcription worker for NihonSub."""
import json
import sys
import tempfile
import subprocess
from pathlib import Path

MODEL_NAME = "nvidia/parakeet-tdt_ctc-0.6b-ja"


def segments_from_timestamps(timestamps, max_duration=8.0, pause_threshold=0.45):
    chars = timestamps.get("char", [])
    segments = []
    text = ""
    start = end = previous_end = None

    def flush():
        nonlocal text, start, end
        if text.strip():
            segments.append({"start": start, "end": end, "text": text.strip()})
        text = ""
        start = end = None

    for stamp in chars:
        token = "".join(stamp.get("char", []))
        if not token:
            continue
        token_start = float(stamp["start"])
        token_end = float(stamp["end"])
        if text and (token_start - previous_end >= pause_threshold or token_start - start >= max_duration):
            flush()
        if not text:
            start = token_start
        text += token
        end = previous_end = token_end
        if token.rstrip().endswith(("。", "！", "？", "!", "?", "…")):
            flush()

    flush()
    if segments:
        merged = []
        sentence_endings = ("。", "！", "？", "!", "?", "…")
        for segment in segments:
            combined_duration = segment["end"] - merged[-1]["start"] if merged else 0
            preserves_sentence_boundary = (
                segment["text"].rstrip().endswith(sentence_endings)
                or (merged and merged[-1]["text"].rstrip().endswith(sentence_endings))
            )
            if (
                merged
                and not preserves_sentence_boundary
                and segment["end"] - segment["start"] < 1.0
                and segment["start"] - merged[-1]["end"] < pause_threshold
                and combined_duration <= max_duration
            ):
                merged[-1]["end"] = segment["end"]
                merged[-1]["text"] += segment["text"]
            else:
                merged.append(segment)
        return [{**segment, "id": index} for index, segment in enumerate(merged)]

    return [
        {"id": index, "start": float(stamp["start"]), "end": float(stamp["end"]), "text": stamp["segment"].strip()}
        for index, stamp in enumerate(timestamps.get("segment", []))
        if stamp.get("segment", "").strip()
    ]


def main():
    if sys.argv[1:] == ["--check"]:
        import nemo.collections.asr  # noqa: F401
        print(json.dumps({"ready": True}))
        return

    import nemo.collections.asr as nemo_asr
    import torch

    args = sys.argv[1:]
    max_duration = 8.0
    if args[:1] == ["--max-segment-duration"]:
        if len(args) < 3:
            raise ValueError("--max-segment-duration requires a value and audio file")
        max_duration = float(args[1])
        if not 0 < max_duration <= 60:
            raise ValueError("Maximum segment duration must be greater than 0 and at most 60 seconds")
        audio_paths = args[2:]
    else:
        audio_paths = args
    if not audio_paths:
        raise ValueError("No audio files provided")

    model = nemo_asr.models.ASRModel.from_pretrained(model_name=MODEL_NAME)
    model.to(torch.device("cpu"))
    model.eval()

    with tempfile.TemporaryDirectory(prefix="nihonsub-parakeet-") as temp_dir:
        wav_paths = []
        for i, audio_path in enumerate(audio_paths):
            wav_path = str(Path(temp_dir) / f"{i}.wav")
            subprocess.run(
                ["ffmpeg", "-v", "error", "-y", "-i", audio_path, "-ar", "16000", "-ac", "1", wav_path],
                check=True,
            )
            wav_paths.append(wav_path)

        outputs = model.transcribe(
            audio=wav_paths,
            batch_size=1,
            return_hypotheses=True,
            timestamps=True,
            verbose=False,
        )

    results = []
    for hypothesis in outputs:
        segments = segments_from_timestamps(hypothesis.timestamp or {}, max_duration=max_duration)
        results.append({"fullText": hypothesis.text.strip(), "segments": segments})

    print(json.dumps(results, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)
