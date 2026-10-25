---
version: 1
slug: "public-ab-review-html"
primary_target: "public/ab-review.html"
related_targets: ["public/index.html"]
---

# NihonSub A/B review

## Surface
Mode: Operate. Audience: the owner using NihonSub to review Japanese-to-English subtitle experiments. Task: understand a saved test, play the source once with both subtitle variants visible, then inspect the cue text and timing. Content: saved run metadata, A/B checkpoints, shared source video, and time-coded English cues. Constraints: keep ordinary web navigation and controls; A stays the baseline, B the candidate; both tracks seek and play against the same video; preserve each track's own cue timing; do not claim a translation is better without user judgment. Use the same visual world on the subtitler page and this dedicated review page.

## Direction contract
THESIS: A shared time thread makes two subtitle hypotheses legible in one watch, refusing the category default of switching tracks one at a time.
OWN-WORLD: Japanese program-guide ink: tinted ivory ground, navy shell, cobalt navigation, signal-yellow time marker, vermilion A, teal B; system UI sans for controls and copy, monospace only for timestamps. One yellow playhead links the video clock and both transcript tracks.
STORY: The owner sees what changed and why, plays the same footage with A above B, then checks each timed cue below.
FIRST VIEWPORT: Standard top navigation; saved experiments with what/why summaries; selected test's before/after facts; a wide 16:9 player with simultaneous A/B overlays and a shared time display. The two independently timed cue tracks begin directly below.
FORM: Program guide timecode, assigned lead card (first in the presented hand); seed:d7395e2460541383.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
