# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The primary user is the owner, using NihonSub as a personal subtitling tool. It is an MVP, not currently intended for distribution to other users; broader use is a distant possibility.

## Product Purpose

Create and review Japanese-to-English subtitles for video, using short clips to check that subtitle wording and context are right before expanding to longer-form videos.

## Positioning

The workflow combines Japanese transcription and translation with video review and saved A/B experiments, so the owner can assess subtitle wording against the source video.

## Operating Context

The current test case is about one-minute videos. Longer-form video support is a future goal, not the current MVP target.

## Capabilities and Constraints

- Parakeet's Japanese transcript and timestamps are authoritative; visual context must not override dialogue.
- Local models are preferred. The current workflow uses local Parakeet transcription and Qwen translation.
- A/B experiments keep the baseline separate and display both subtitle tracks synchronized to the same video. The comparison landing page is cinema-first, with both overlays visible and the aligned transcript below.
- Every saved experiment remains discoverable and explains what it tests, why, and the before/after subtitle outputs.
- The user confirmed the current core workflow is accurate.
