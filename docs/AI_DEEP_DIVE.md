# VitalBit AI Deep Dive (Judge-Ready)

This document explains only the AI layer: how the models work, what features they use, how confidence is computed, and how symptoms/voice are mapped to outputs in production.

## 1. AI Stack Overview

VitalBit uses a hybrid AI architecture with two inference paths:

1. Symptom Intelligence Model (text -> ranked disease probabilities)
2. Voice Risk Model (audio -> respiratory risk confidence)

Service runtime split:

- FastAPI microservice performs model inference.
- Node/Express orchestrates requests, adds user context (age), and persists outputs.
- Gemini API is used in backend for LLM tasks (chat generation, symptom extraction enhancement) and speech-to-text fallback.

## 2. Symptom Intelligence Model

## 2.1 Purpose

Given symptom text, estimate likely conditions and return top-k predictions with a calibrated confidence score.

Output example:

- predictions: [{ disease, probability }, ...]
- confidence: number in [0, 0.98]
- ageUsed: optional age

## 2.2 Disease Knowledge Base

The model compares user symptoms against a curated set of disease profiles (flu, covid, asthma, TB, malaria, dengue, pneumonia, UTI, etc.).

Each disease has a profile sentence composed of representative symptom tokens.

Why this matters:

- The model does retrieval-style ranking over medically meaningful anchors.
- It avoids random class behavior by grounding predictions in explicit profile text.

## 2.3 Feature Pipeline

The model combines three signals:

1. Semantic similarity

- Encoder: sentence-transformers/all-MiniLM-L6-v2
- Both user symptom text and disease profiles are embedded.
- L2 normalization is applied.
- Cosine similarity is mapped from [-1,1] to [0,1].

2. Lexical overlap (IDF-weighted)

- Regex tokenization with lowercase alphabetic tokens.
- A smoothed IDF is computed across profile vocabulary.
- Rare, discriminative tokens receive higher weight.
- Frequent generic tokens (like fever) are downweighted.

3. Age prior weights

- Disease-specific multipliers are applied using user profile age.
- Examples:
  - otitis is weighted higher for children
  - hypertension warning weighted higher for older ages
  - pneumonia weighted higher for very young and older groups

## 2.4 Lexical Score Details

For each disease profile:

- overlap_weight = sum(IDF of common tokens)
- precision = overlap_weight / user_token_weight_sum
- recall = overlap_weight / disease_profile_token_weight_sum
- keyword_score = weighted F1 = 2PR / (P + R)

This is stronger than plain token overlap because:

- It measures both relevance (precision) and completeness (recall).
- It values clinically specific terms more than broad terms.

## 2.5 Final Symptom Scoring Formula

For each disease i:

- semantic_i = normalized cosine score
- keyword_i = IDF-weighted lexical F1
- age_weight_i = disease prior from user age

Combined score:

combined_i = (0.4 _ semantic_i + 0.6 _ keyword_i) \* age_weight_i

Top-k selection:

- Highest combined scores are selected.
- Softmax with temperature 0.03 is applied to top-k scores to produce probabilities.

Why low temperature:

- It sharpens distribution among top candidates.
- Helpful for ranking clarity in triage UX.

## 2.6 Confidence Score Calculation

Current confidence returned to frontend:

confidence = min(0.98, 0.45 _ top_probability + 0.55 _ top_score)

Where:

- top_probability = softmax probability of rank-1 disease
- top_score = raw combined score of rank-1 disease

Interpretation:

- top_probability captures separation from other top candidates.
- top_score captures absolute symptom-profile match quality.
- The blend prevents confidence from depending only on relative ranking.

## 2.7 Why Symptom Input Maps Correctly to Disease

When a user enters symptoms, mapping is not keyword-only and not embedding-only.
It is a hybrid:

1. Semantic layer catches paraphrases/synonyms and contextual closeness.
2. Lexical layer enforces concrete symptom evidence with IDF weighting.
3. Age layer adjusts epidemiologic plausibility.

This reduces two failure modes:

- Overly generic predictions from embeddings alone.
- Brittle exact-match behavior from keywords alone.

## 3. Voice Risk Model

## 3.1 Purpose

Voice pipeline currently outputs respiratory risk classification:

- healthy
- respiratory_issue

It does not directly classify disease names in current code.
Disease-level interpretation comes from symptom and chat pipelines.

## 3.2 Audio Features Used

Audio is loaded at 16 kHz and converted to a 42-dimensional feature vector:

1. MFCC mean (40 coefficients)
2. Spectral centroid mean (1 value)
3. Zero-crossing rate mean (1 value)

Why these features:

- MFCC captures timbral/phonetic envelope characteristics.
- Spectral centroid approximates brightness/energy distribution.
- ZCR captures signal roughness/noisiness characteristics.

Together they provide a lightweight respiratory-risk signal.

## 3.3 Inference Paths

Path A (preferred): sklearn model if voice_model.pkl exists

- predict() gives class
- predict_proba() gives probability
- confidence = max class probability

Path B (fallback): lightweight torch head

- 42 -> 16 -> 1 sigmoid network
- output raw in [0,1]
- adjusted confidence:

adjusted = clip((raw + 0.35) / 1.35, 0.05, 0.95)

- threshold:
  - respiratory_issue if adjusted >= 0.5
  - healthy otherwise

## 3.4 How Voice Connects to Disease in Product Flow

Important for judges:

- Voice model alone is risk-level, not disease-name prediction.
- Disease mapping is done by symptom model and chat symptom extraction.
- In voice-to-text flow, transcript is used to extract symptoms, then symptom model predicts disease probabilities.

So practical pipeline is:

voice audio -> voice risk score
voice audio -> transcript (STT/Gemini/browser hint) -> symptoms -> disease ranking

## 4. LLM Integration (Gemini + Fallbacks)

## 4.1 Where LLM is used

Backend chat route uses LLM for:

1. Symptom extraction enhancement from natural language
2. Assistant reply generation with safety prompt
3. Audio transcription fallback in voice-to-text route (Gemini multimodal)

## 4.2 Reliability Strategy

- Candidate model fallback list for Gemini names
- Rule-based assistant fallback if LLM fails
- Voice route still returns voiceAnalysis even if transcript is unavailable

## 4.3 Why this matters in judging

This design separates:

- Deterministic medical ranking logic (symptom/voice models)
- Generative conversational layer (LLM)

Result: better controllability, explainability, and graceful degradation.

## 5. End-to-End AI Request Paths

## 5.1 Symptom API Path

Frontend -> POST /api/symptoms/analyze -> backend adds age -> FastAPI /predict/symptoms -> response persisted and returned.

## 5.2 Voice-to-Text + AI Path

Frontend audio -> POST /api/chat/voice-to-text

Transcription fallback order:

1. External STT API if configured
2. Gemini multimodal transcription
3. Browser transcriptHint

Then:

- voiceAnalysis from /predict/voice always attempted
- if transcript exists -> symptom extraction + /predict/symptoms

## 6. Explainability Notes for Judges

You can explain predictions with these artifacts:

- Disease profile dictionary used for matching
- Weighted token overlap mechanics
- Semantic similarity score contribution
- Age prior multiplier per disease family
- Stored JSON outputs in database for audit and trace

## 7. Known Constraints (Be Honest)

1. Symptom model is retrieval/ranking over predefined disease profiles, not a full differential diagnosis engine.
2. Voice model is binary respiratory risk in current implementation, not disease-specific voice diagnosis.
3. Confidence is model confidence, not clinical certainty.

## 8. High-Value Judge Q&A (AI-Focused)

Q1. Why hybrid semantic + lexical scoring?

- Semantic captures meaning and paraphrase; lexical validates explicit symptom evidence. Hybrid gives better precision and robustness.

Q2. Why use IDF weighting?

- Common symptoms appear in many diseases. IDF boosts discriminative terms and reduces generic-token dominance.

Q3. How do you avoid repetitive top diseases?

- Keyword layer is weighted stronger than semantic layer (0.6 vs 0.4), plus age priors. This increases sensitivity to actual symptom differences.

Q4. Is age used as model input?

- Yes, as disease-specific multiplicative priors applied post-score. Age comes from profile, not ad hoc chat input.

Q5. Is voice model diagnosing disease?

- No. It predicts respiratory risk class with confidence. Disease ranking is generated via transcript-to-symptom pipeline.

Q6. How do you handle transcription failure?

- Multi-level fallback (external STT, Gemini, browser transcriptHint). Voice risk analysis still returns even when transcript fails.

Q7. How should confidence be interpreted?

- As a ranking confidence signal for triage assistance, not a definitive diagnostic probability.

Q8. What would you improve next?

- Calibrated uncertainty analysis, disease-specific voice modeling with labeled datasets, multilingual robustness, and prospective validation.

## 9. One-Minute AI Pitch Script

VitalBit uses a hybrid AI engine for practical rural triage. For symptoms, we combine MiniLM semantic matching with IDF-weighted symptom evidence and age priors, then compute top disease probabilities with a calibrated confidence blend from both ranking separation and absolute score quality. For voice, we extract MFCC plus spectral features and estimate respiratory risk; if transcript is available via STT fallback chain including Gemini, we map spoken complaints back into the symptom model for disease-level ranking. This architecture keeps the system explainable, robust to failures, and suitable for real-world low-resource environments.
