# Next backend experiment: stable translation glossary/context

## Recommendation

**Run one paired A/B test of a compact, explicit per-show glossary (character names, pronouns/forms of address, recurring terms) versus the existing prompt, with everything else held fixed.** This is a better next experiment than adding more generic scene/video context: prior tests already varied segmentation/context handling and prompt wording, while glossary consistency is a distinct factor with direct subtitle-translation precedent. Do not change segmentation, prompt template, model, decoding settings, source text, or timestamps.

## NihonSub-specific implementation findings

- `translator.js` defaults to `batchSize: 25` and builds a full-transcript character/scene dossier before translation. The 11-cue sample fits in one batch, so production sees all 11 Japanese cues together; the saved B candidates instead used one cue per call with the preceding four Japanese cues and no dossier. The earlier runs therefore do not isolate global-context effects.
- The dossier prompt asks the model to infer speaker identity, gender hints, age/vibe, hierarchy, and emotional arc from the transcript. Those guesses can become unsupported context. Any context experiment should keep the Japanese cue authoritative and prefer verified terms/relationships over generated character claims.
- The prior prompt comparison held the Japanese cue timings constant. The new experiment below keeps that constraint too.

## What the downloaded papers contribute

- **EVE** is primarily an efficient multimodal vision-language-model architecture, not document-context MT or subtitle translation. Relevant only if NihonSub later needs a visual model; it does not answer the current text/timestamp-authoritative experiment. [AAAI paper](https://ojs.aaai.org/index.php/AAAI/article/view/32718)
- **LiveCC** studies video LLM streaming speech transcription for real-time video commentary/QA. Its aligned transcript/video setup is adjacent, but the task is not Japanese→English subtitle translation, and Parakeet transcript/timing are assumed authoritative here. [Authors’ project/paper](https://showlab.github.io/livecc/)
- **ShareGPT4Video** focuses on video captions, data and video understanding/generation; useful only as distant evidence about video descriptions, not subtitle translation quality. [Authors’ arXiv paper](https://arxiv.org/abs/2406.04325)
- **TimeChat** is time-sensitive long-video understanding, including temporal localization; timing is already acceptable, so its core contribution is out of scope for the next test. [CVPR paper](https://openaccess.thecvf.com/content/CVPR2024/papers/Ren_TimeChat_A_Time-sensitive_Multimodal_Large_Language_Model_for_Long_Video_CVPR_2024_paper.pdf)

**Interpretation:** Of these four, none directly tests the proposed translation intervention. Treat them as adjacent video-language work, not evidence that their methods improve subtitle translation.

## More directly relevant evidence

- **Subtitle translation with metadata:** *Translating Movie Subtitles by Large Language Models using Movie-meta Information* directly studies LLM subtitle translation and adding movie metadata. This establishes task relevance for supplying structured context, but is not evidence specifically for a compact glossary or for NihonSub’s model/setup. [ACL paper](https://aclanthology.org/2025.acl-srw.22/)
- **Professional subtitling:** *A Case Study on Contextual Machine Translation in a Professional Scenario of Subtitling* evaluates contextual MT with post-editors and reports fewer context-related errors in the contextual condition. The setting is professional subtitling, not necessarily Japanese anime or local Qwen3. [EAMT paper](https://aclanthology.org/2024.eamt-1.46/)
- **Document-level MT measurement:** BlonDe evaluates document-level translation with discourse-related spans, designed to capture errors sentence metrics may miss. It is useful conceptually for continuity, but a general document metric is not a validated anime-subtitle metric. [NAACL paper](https://aclanthology.org/2022.naacl-main.111/)
- **Context use as a causal question:** *On Measuring Context Utilization in Document-Level MT Systems* compares correct context with randomized context and uses phenomenon-focused analysis. This supports controlling the input and evaluating whether context itself helps rather than merely adding tokens. [Findings of EACL paper](https://aclanthology.org/2024.findings-eacl.113/)
- **Human evaluation:** *Experts, Errors, and Context* studies professional human MT evaluation using MQM with document context. It supports evaluating translations in context and labeling error types, rather than relying on a single automatic score. [Authors’ arXiv paper](https://arxiv.org/abs/2104.14478)
- **Refinement caution:** A 2026 arXiv preprint’s systematic literary-translation study reports that document-level translation followed by segment-level refinement improved more consistently than document-level refinement; gains were mainly fluency, style, and terminology, with less consistent adequacy gains. The authors also report that refinement can project outputs toward the refiner’s style instead of repairing specific errors. This is adjacent evidence, not validation for anime/Qwen3 4B. [Paper](https://arxiv.org/abs/2605.13368)

## Controlled experiment

1. Select **30–50 representative scenes** (or all available scenes if fewer), fixed before generation; include recurring characters/terms and scenes with Japanese omitted subjects or ambiguous address terms. Keep every source segment and timestamp identical between arms.
2. **A:** current Qwen3 4B/Ollama baseline. **B:** identical call plus one fixed, concise glossary for that show: Japanese name/term → preferred English rendering; pronouns/forms of address only where established. No plot summaries, extra scene descriptions, or rewritten instructions. Use the same glossary in every B segment; do not derive it from either model output.
3. Randomize and blind A/B outputs for review. A bilingual reviewer compares each matched scene in neighboring subtitle context, marking preference/tie and **major/minor errors** by categories: meaning/omission/addition, terminology/name consistency, pronoun/reference continuity, naturalness/register. Separately record subtitle readability/length only as a guardrail; do not optimize timing or claim timing improvement.
4. Primary measures: pairwise reviewer preference (including ties) and per-segment terminology/continuity error counts. Report counts and paired differences, not just a pooled average; show uncertainty and examples. A second independent reviewer or adjudication on disagreements is preferable if practical.

**Hypothesis, not established result:** a stable glossary may reduce inconsistent names and recurring terms; it may not improve general semantic accuracy, and overly prescriptive entries can introduce errors. If glossary entries are not independently verified, the experiment tests glossary quality plus prompting, not context alone.

## Local glossary pilot

A preliminary 11-cue, ~45-second comparison is saved locally as `abtest_1792965843381_glossary` (not committed; run artifacts live under ignored `storage/runs/`). A reuses the prior accuracy-first, past-only output—not the production default, which batches up to 25 cues and includes a full-transcript dossier. B was regenerated with the same Japanese cues, timestamps, model, temperature, prompt, and preceding-four-cue context, adding only a source-derived glossary entry for `回転 → rotation`. This isolates the glossary within the past-only setup, not against production. Timings match; 6 of 11 English cue texts differ. Both versions already render the recurring term with “rotation,” so the pilot shows no visible consistency gain on that term. A is reused from an earlier run while B is a fresh temperature-0.2 generation; without paired repeats or a fixed seed, text differences cannot be attributed solely to the glossary. This is not evidence that either version is better: it is one short scene, and B also changes other wording. Human review against the Japanese is still needed.

## Evaluation limits

Use any local model judge only for **triage** (candidate error flags or explanations), not as ground truth. A judge can share the translator’s blind spots, favor fluent outputs, or make unsupported claims; verify every decisive label against Japanese source and surrounding scene by a human. BLEU/COMET or an LLM score can be secondary diagnostics, not the sole success criterion: reference translations are not unique, and document/context metrics do not certify subtitle suitability. Human labels also have subjectivity; report reviewer agreement and preserve ties/uncertain cases. Do not call a small convenience sample a statistically conclusive win.

## Source/claim distinction

Measured evidence above is limited to what the cited papers report in their stated settings. The proposed 30–50-scene design, glossary choice, categories and expected benefit are **researcher recommendations/hypotheses**, not reported findings from those papers. No source found establishes that glossary injection will outperform NihonSub’s current baseline on anime. Direct PDF extraction for the EAMT and ACL subtitle papers returned only page numbers, so claims about those papers here are limited to their official anthology abstracts.
