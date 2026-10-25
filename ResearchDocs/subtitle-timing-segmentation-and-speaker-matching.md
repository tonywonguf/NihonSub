# Research: subtitle timing, segmentation, and speaker matching

**Question.** Can current research or open-source software stop NihonSub from showing too much subtitle text before it is spoken, keep cues aligned with the scene, and identify which visible character is speaking?

## Bottom line

There is no single open-source model I found that reliably solves all three problems for Japanese anime on this PC. The research does offer separate tools and methods for **cue segmentation**, **streaming/look-ahead control**, and **active-speaker detection**. The most promising first fix is in NihonSub’s existing pipeline—not a replacement model:

1. Preserve short, punctuation-delimited Parakeet segments instead of merging them into longer cues.
2. Stop giving Qwen future dialogue and a whole-episode narrative dossier when translating an early cue.
3. Translate and time short, self-contained phrases; validate line length and reading speed. Use video as weak supporting evidence for speaker/scene identity, never as authority over the audio.

This is a design recommendation from the cited work and current code inspection; it has **not** yet been A/B tested in NihonSub.

## What the existing video papers do—and do not do

The four papers already in `ResearchDocs/` address useful neighboring tasks, but not spoiler-safe subtitle cue formation:

- [EVE](https://arxiv.org/abs/2503.04058) extracts visible video subtitles and their timestamps. It is aimed at recognizing text already present in video, not translating Japanese speech into short, properly timed English cues.
- [LiveCC](https://arxiv.org/abs/2504.16030) studies video-language modeling with timestamp-interleaved ASR words and frames, and real-time video commentary. Its temporal interleaving is a useful design idea, but it is not a subtitle segmenter or Japanese-to-English subtitle pipeline; the released model is 7B-scale ([project](https://github.com/showlab/livecc)), so it is not a straightforward fit for your 6 GB GPU.
- [ShareGPT4Video](https://arxiv.org/abs/2406.04325) studies temporally detailed video captions and differential frame descriptions. That can improve scene notes, but captions do not establish which words have been spoken or when a subtitle should appear. The paper also warns that naïve multi-frame captioning can confuse temporal order.
- [TimeChat](https://openaccess.thecvf.com/content/CVPR2024/papers/Ren_TimeChat_A_Time-sensitive_Multimodal_Large_Language_Model_for_Long_Video_Understanding_CVPR_2024_paper.pdf) adds timestamp-aware video representation and temporal grounding for video questions and captions. It does not solve subtitle translation alignment or readable cue boundaries ([project](https://github.com/RenShuhuai-Andy/TimeChat)).

That fits the local Qwen3-VL prototype: it produced mostly generic scene descriptions, while the direct image-plus-subtitle review returned no final answer at its output limit. Visual context may help with *who/what is visible*; it did not demonstrate a reliable subtitle correction pass.

## Research and open-source options

### 1. Segmentation and readability

- [MuST-Cinema](https://aclanthology.org/2020.lrec-1.460/) is a speech-to-subtitles corpus with audio, transcript, translation, and explicit subtitle-break markers. Its authors train models to split sentences into subtitle blocks. The released pairs are English-to-seven-European-languages, not Japanese-to-English, so it is a research resource rather than a ready model for this project. The corpus repository documents its languages and license: [MuST-Cinema](https://github.com/fatalinha/MuST-Cinema).
- [Point Break](https://aclanthology.org/2020.clicit-1.27/) studies automatic segmentation into readable subtitle units. It finds that a smaller amount of representative, high-quality segmentation data can be more valuable than a larger noisy corpus. This supports learning or evaluating subtitle breaks, but I did not find a drop-in Japanese anime segmenter in the project materials.
- [EvalSubtitle](https://github.com/fyvo/EvalSubtitle), accompanying [the Sigma paper](https://aclanthology.org/2022.lrec-1.328/), evaluates subtitle segmentation even when the generated text differs from the reference. It is useful for an A/B test, **not** a tool that fixes cues or checks speaker identity.
- As a starting reference for English display constraints, Netflix’s [English timed-text guide](https://partnerhelp.netflixstudios.com/hc/en-us/articles/217350977-English-USA-Timed-Text-Style-Guide) specifies up to two lines, 42 characters per line, and a 20 characters/second adult reading-speed limit. These are style-guide limits, not universal Japanese/anime standards; use them as configurable checks, not immutable rules.

### 2. Limited look-ahead / incremental translation

- [Learning Adaptive Segmentation Policy for End-to-End Simultaneous Translation](https://aclanthology.org/2022.acl-long.542/) and [Direct Segmentation Models for Streaming Speech Translation](https://aclanthology.org/2020.emnlp-main.206/) study deciding when to wait and when to translate, using acoustic and translation-history evidence rather than blindly splitting at fixed durations.
- [Simultaneous Speech Translation for Live Subtitling](https://aclanthology.org/2021.mtsummit-asltrw.4/) specifically finds that word-by-word output is not necessarily readable; its experiments compare subtitle display modes and the delay/readability trade-off. Its tested language pairs are not Japanese-to-English, so it motivates the design, not a universal timing setting.
- The open-source [SimulStreaming](https://github.com/ufal/SimulStreaming) is the current successor to Whisper-Streaming and demonstrates streaming ASR/translation policies. It is a research system, not a drop-in improvement for NihonSub: its best-performing setup uses large Whisper and a 9B translation model, and the project recommends at least 10 GB VRAM for its best Whisper setup. Your RX 5600 XT has 6 GB.

The transferable idea is to **withhold future text until it is needed** and commit only stable, local chunks. NihonSub can simulate that during offline generation by processing cues chronologically with the current phrase and past-only context. It does not need to replace Parakeet with streaming Whisper just to test this.

### 3. Word timing and visible-speaker matching

- [WhisperX](https://arxiv.org/abs/2303.00747) adds word-level forced alignment to Whisper and diarization tooling. It answers “where are these transcript words in the audio?”—not “where should the subtitle break?” or “which future words should be hidden?” Parakeet already produces character timestamps here, so a second ASR/alignment stack is not the first thing to add.
- [TalkNet](https://github.com/TaoRuijie/TalkNet-ASD), based on [active-speaker detection research](https://arxiv.org/abs/2107.06592), predicts whether a visible face is speaking by combining face tracks with audio/video timing. This could help map an audio speaker to an on-screen person in clear, live-action footage. Its own [FAQ](https://github.com/TaoRuijie/TalkNet-ASD/blob/main/FAQ.md) warns that the AVA-trained model generalizes poorly when face detection differs and performs poorly on short clips, small faces, and side faces. It is not validated for stylized anime mouth movements; treat it as a low-confidence hint, not a source of dialogue or subtitle timing.

## NihonSub-specific finding

The current code already contains two mechanisms that can produce the reported symptom:

1. **Short utterances can be merged into a long cue.** `parakeet_transcribe.py:12-49` groups Parakeet’s character timestamps at punctuation, pauses, or an 8-second maximum, then merges any next segment shorter than 1 second when the gap is under 0.45 seconds. That merge does not preserve a sentence-final boundary as a cue boundary, and repeated short segments can accumulate into a much longer merged segment because the combined duration is not rechecked. The result is one subtitle cue containing multiple sentences; WebVTT displays the entire cue as soon as its start time arrives.
2. **Translation sees future dialogue.** `translator.js:72-119` builds a global character/narrative dossier from the full transcript (for longer videos it samples beginning, middle, and end). `translator.js:225-246` sends 25 current segments in one batch, and `translator.js:396-420` places the episode-wide dossier in the translation prompt. That lets an early cue be influenced by later dialogue, even though its output timestamps remain tied to the earlier segment. This is a plausible source of premature plot implications or wrong pronoun/character choices.

The system also lacks a distinct final subtitle-segmentation/spotting pass: translated text inherits the source segment’s start and end. CPS scoring in the optional ensemble path can influence candidate choice, but it does not split or re-time a cue.

## Smallest useful experiment

Keep Parakeet and Qwen. On a 30–60 second sample, compare:

- **Current output** versus a version that does not merge across sentence punctuation or speaker changes.
- Translation with the current whole-episode/batch context versus **current cue + past-only context**, with future cues removed from the prompt.
- A small configurable lead-in for each cue (for example, test 100–250 ms before the first aligned source character), while keeping the cue limited to one short sentence or clause. The lead value is a test parameter, not a paper-backed universal constant.

Measure: multiple sentences per cue, maximum cue duration, characters/second, cue start relative to the first spoken word, whether any text appears before its corresponding audio, and manual speaker/scene correctness. Use EvalSubtitle for segmentation comparisons; review timing and speaker attribution separately. Do not let the visual model override Parakeet’s transcript or timestamp authority.

## Conclusion

Research does clarify the problem: readable subtitle segmentation and simultaneous “wait/emit” policies are separate tasks from ASR, word alignment, and visual active-speaker detection. The practical fix is likely a **small deterministic segmentation/context-control stage using the timestamps you already have**, followed by evaluation—not another large video model. The speaker-to-character part remains less solved for anime; use visual analysis only as optional, confidence-gated support.

## Sources

- [MuST-Cinema paper](https://aclanthology.org/2020.lrec-1.460/) · [dataset repository](https://github.com/fatalinha/MuST-Cinema)
- [Point Break paper](https://aclanthology.org/2020.clicit-1.27/)
- [Adaptive segmentation policy](https://aclanthology.org/2022.acl-long.542/) · [Direct segmentation models](https://aclanthology.org/2020.emnlp-main.206/)
- [Live subtitling display paper](https://aclanthology.org/2021.mtsummit-asltrw.4/)
- [Sigma segmentation metric paper](https://aclanthology.org/2022.lrec-1.328/) · [EvalSubtitle source](https://github.com/fyvo/EvalSubtitle)
- [WhisperX paper](https://arxiv.org/abs/2303.00747) · [TalkNet paper](https://arxiv.org/abs/2107.06592) · [TalkNet source/FAQ](https://github.com/TaoRuijie/TalkNet-ASD)
- [EVE](https://arxiv.org/abs/2503.04058) · [LiveCC](https://arxiv.org/abs/2504.16030) · [ShareGPT4Video](https://arxiv.org/abs/2406.04325) · [TimeChat](https://github.com/RenShuhuai-Andy/TimeChat)
- [SimulStreaming source](https://github.com/ufal/SimulStreaming) · [Netflix English timed-text guide](https://partnerhelp.netflixstudios.com/hc/en-us/articles/217350977-English-USA-Timed-Text-Style-Guide)
