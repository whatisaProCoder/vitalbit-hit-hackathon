# VitalBit Technical Playbook (Judge Edition)

This document is the full technical reference for the VitalBit hackathon project.
It is designed for live judging Q&A and architecture defense.

## 1) Executive Summary

VitalBit is an AI-powered rural health assistant with four major capabilities:

- Symptom-to-disease risk ranking
- Voice respiratory risk detection
- Conversational health guidance chat
- Hospital discovery and recommendation

The system follows a strict gateway architecture:

- Frontend never calls the AI service directly.
- Node/Express is the only gateway between UI and AI services.
- PostgreSQL stores user profiles and analysis history.

## 2) System Architecture and Moving Parts

### 2.1 High-level Architecture

```text
Hardware Smartwatch (current: mock telemetry endpoint)
                |
                v
React Frontend (Vite + Tailwind + GSAP + Leaflet)
                |
                v
Node/Express API Gateway -------------------------------> PostgreSQL
                |         \
                |          ---> Gemini API (LLM + STT fallback)
                v
FastAPI AI Service (Symptom + Voice inference)
                |
                v
PyTorch + SentenceTransformer + Librosa (+ sklearn/joblib when available)
```

### 2.2 Frontend Responsibilities

- Landing and storytelling UX (GSAP)
- Auth, profile, and dashboard UI
- Symptom selection and analysis trigger
- Voice recording + speech transcription hints from browser recognition
- Health chat experience and result rendering
- Hospital map display and recommendation UI
- History and trend visualization (BMI, voice, symptom outputs)

Key frontend features:

- Chat auto-scroll and Enter-to-send
- Voice recording with explicit Stop action
- Auto-scroll from Analyze Symptoms to Prediction Results
- Profile-based age (no age input in chat)
- Phone-based authentication

### 2.3 Backend Responsibilities

The backend is an orchestration and persistence layer:

- Authentication and JWT session control
- User profile CRUD
- Symptom and voice analysis proxying to FastAPI
- Chat orchestration (LLM + rule fallback + symptom extraction)
- Voice-to-text orchestration with multiple fallback paths
- Hospital geocode/search and recommendation data source
- Dashboard/history data aggregation

### 2.4 AI Service Responsibilities

The FastAPI microservice handles inference only (no training during runtime):

- `POST /predict/symptoms`
- `POST /predict/voice`

Models loaded at startup in FastAPI lifespan hook:

- `SymptomPredictor` (semantic + lexical + age weighting)
- `VoicePredictor` (sklearn model if available, else torch fallback head)

### 2.5 Gemini API Responsibilities

Gemini is integrated by the Node/Express gateway for language and transcription intelligence:

- LLM reply generation for chat (`/api/chat/message`) when Gemini provider is enabled
- Symptom extraction enhancement from natural language in chat
- Multimodal speech-to-text fallback in `/api/chat/voice-to-text` when external STT is unavailable

Important architecture rule:

- Frontend does not call Gemini directly; all Gemini calls are centralized in backend routes for security and observability.

## 3) End-to-End Data Flows

### 3.1 Symptom Analysis Flow

1. User selects symptom chips in frontend.
2. Frontend sends `POST /api/symptoms/analyze`.
3. Backend fetches user age from profile (`users.age`) if authenticated.
4. Backend forwards `{ symptoms, age }` to AI service `POST /predict/symptoms`.
5. AI service returns top diseases, probabilities, confidence.
6. Backend stores JSON response in `symptom_queries.prediction_json`.
7. Frontend renders ranked bars and confidence.

### 3.2 Voice Analysis + Voice-to-Text + Chat Flow

1. User records voice in browser.
2. Frontend posts audio to `POST /api/chat/voice-to-text`.
3. Backend transcription fallback chain:
   - External STT (`STT_API_URL` + `STT_API_KEY`) if configured
   - Gemini multimodal transcription fallback (`GEMINI_API_KEY`)
   - Browser transcript hint (`transcriptHint`) from speech recognition
4. Backend always attempts voice risk analysis via AI `POST /predict/voice`.
5. If transcript exists, backend extracts symptoms and runs symptom model too.
6. Frontend now auto-sends transcript as a chat message to `POST /api/chat/message`.
7. Chat route returns assistant reply (LLM or rules fallback) and optional symptom analysis.

### 3.3 Hospital Discovery Flow

1. Frontend calls `GET /api/hospitals` with either:
   - `lat` + `lon`, or
   - `address`
2. Backend geocodes address via Nominatim if coordinates are absent.
3. Backend queries Overpass for hospitals/clinics in radius.
4. If external calls fail, backend returns curated fallback hospital list.
5. Frontend ranks recommendations by disease profile keywords + distance.

### 3.4 Smartwatch/Vitals Flow (Current State)

- Current implementation uses `GET /api/vitals/mock` for simulated telemetry.
- Frontend plots temperature and pulse trends.
- Architecture supports replacing mock source with real smartwatch stream later.

## 4) AI Deep Dive (How Inference Works)

## 4.1 Symptom Predictor Inputs and Features

Input payload:

- `symptoms`: free text (or chip-joined text)
- `age`: optional integer from user profile

Internal features:

- Semantic embedding similarity using `sentence-transformers/all-MiniLM-L6-v2`
- IDF-weighted lexical overlap between user symptom tokens and disease profile tokens
- Age-based disease multipliers for selected conditions

### 4.2 Symptom Scoring Math

Given user text and each disease profile:

1. Semantic score

- Encode user text and disease descriptions with MiniLM
- L2-normalize embeddings
- Cosine similarity then map to [0,1]

`semantic_score = (cosine_similarity + 1) / 2`

2. Lexical score

- Tokenize with regex (`[a-z]+`)
- Build smoothed IDF over disease profile token corpus
- Compute weighted precision and recall, then weighted F1

`precision = overlap_weight / symptom_weight_sum`

`recall = overlap_weight / profile_weight_sum`

`keyword_score = 2 * precision * recall / (precision + recall)`

3. Combine and apply age weight

`combined_score = (0.4 * semantic_score + 0.6 * keyword_score) * age_weight`

4. Top-k probabilities

- Select top-k combined scores
- Temperature-scaled softmax with `temperature = 0.03`

`prob_i = softmax(top_values / 0.03)`

### 4.3 Symptom Confidence Calculation

Current confidence returned to UI:

`confidence = min(0.98, 0.45 * top_probability + 0.55 * top_score)`

Where:

- `top_probability` is softmax probability of highest-ranked disease
- `top_score` is raw highest combined score before softmax

Why this is useful:

- `top_probability` captures ranking separation among top candidates
- `top_score` preserves absolute match quality
- Weighted blend stabilizes confidence for short/noisy text

### 4.4 Voice Predictor Inputs and Features

Input payload:

- audio file (`webm/wav`) sent as multipart

Extracted features:

- 40 MFCC mean values
- Spectral centroid mean
- Zero-crossing rate mean

Final feature vector size: 42

### 4.5 Voice Risk Decision and Confidence

Path A (preferred): sklearn model loaded from `models_weights/voice_model.pkl`

- Predict class and class probability
- Map output to `healthy` or `respiratory_issue`
- Confidence = max class probability

Path B (fallback): lightweight torch sigmoid head

- Raw sigmoid output from 42-dim input
- Adjust confidence with bounded transform:

`adjusted = clip((raw + 0.35) / 1.35, 0.05, 0.95)`

- Risk threshold:

`respiratory_issue if adjusted >= 0.5 else healthy`

## 5) LLM Integration Strategy

LLM is used for two tasks in backend chat route:

- Symptom extraction enhancement from natural text
- Assistant reply generation with safety-oriented prompt

Provider logic:

- OpenAI-compatible path if `LLM_PROVIDER` is not google/gemini
- Gemini path if `LLM_PROVIDER=google` or `gemini`

Reliability design:

- Multiple candidate model fallback sequence for Gemini
- Graceful fallback to rule-based assistant if LLM call fails
- Voice-to-text route can still return voice analysis even without transcript

## 6) API Contract Reference

### Core analysis APIs

- `POST /api/symptoms/analyze`
  - Input: `{ symptoms: string }`
  - Output: `{ predictions: [{ disease, probability }], confidence, ageUsed }`

- `POST /api/voice/analyze`
  - Input: multipart `audio`
  - Output: `{ risk, confidence, ... }`

- `POST /api/chat/message` (auth)
  - Input: `{ message: string }`
  - Output: `{ reply, extractedSymptoms, source, symptomAnalysis }`

- `POST /api/chat/voice-to-text` (auth)
  - Input: multipart `audio`, optional `transcriptHint`
  - Output: `{ transcript, extractedSymptoms, voiceAnalysis, symptomAnalysis, transcriptionAvailable, warning }`

### User/profile APIs

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me` (auth)
- `PUT /api/auth/me` (auth)

### Health history and metrics

- `POST /api/bmi` (auth)
- `GET /api/dashboard/summary` (auth)
- `GET /api/dashboard/history` (auth)

### Location and vitals

- `GET /api/hospitals?lat=...&lon=...` or `?address=...`
- `GET /api/vitals/mock`

## 7) Data Model (PostgreSQL)

Primary tables:

- `users`: auth + profile attributes (age, gender, address, phone, language)
- `symptom_queries`: symptom input and full prediction JSON
- `voice_analysis_results`: voice risk prediction JSON
- `chat_messages`: chat role/message, extracted symptoms, metadata
- `user_metrics`: BMI and extensible user metrics

Design choices:

- JSONB columns preserve full model output for auditability
- Foreign keys allow per-user timeline reconstruction
- Profile age feeds inference without re-entering demographic info

## 8) Configuration and Environment Variables

Backend important variables:

- `PORT`
- `DATABASE_URL`
- `JWT_SECRET`
- `ALLOWED_ORIGIN`
- `AI_SERVICE_URL`
- `LLM_PROVIDER`
- `LLM_API_URL`
- `LLM_MODEL`
- `LLM_API_KEY`
- `GEMINI_API_KEY`
- `GEMINI_STT_MODEL` (optional override)
- `STT_API_URL`
- `STT_API_KEY`

Frontend variable:

- `VITE_API_BASE_URL`

## 9) Reliability, Safety, and Fallback Design

Implemented safeguards:

- Voice flow does not hard-fail if transcription fails
- Rule-based assistant fallback when LLM is unavailable
- Overpass/Nominatim fallback to static hospitals
- Auth middleware supports optional and required modes
- DB logging failures do not block user response

Clinical safety note:

- The assistant provides early guidance and risk signals, not final diagnosis.
- Emergency symptom language is explicitly handled in chat system prompt.

## 10) Performance Characteristics

- Symptom search is fast after model warm load (embeddings precomputed at startup).
- Voice inference cost is bounded to feature extraction + lightweight classifier.
- Main latency contributors are external calls:
  - LLM generation
  - external geocoding/map APIs
  - optional external STT

## 11) Judge-Facing Q&A Cheat Sheet

Use these concise responses in technical judging.

1. Why microservice for AI?

- Separation of concerns: Node handles product APIs and auth, FastAPI handles ML inference lifecycle and Python dependencies.

2. How is confidence computed for symptom prediction?

- Blend of rank confidence and absolute match score: `min(0.98, 0.45*top_prob + 0.55*top_score)`.

3. How do you avoid repetitive predictions for every input?

- We combine semantic similarity with stronger IDF-weighted lexical overlap and age-aware reweighting.

4. How do you handle STT failures?

- Three-level fallback: external STT, Gemini multimodal transcription, browser transcript hint; still returns voice risk analysis.

5. Why include age?

- Age is a clinically relevant prior for several conditions. It is applied as multiplicative disease-specific weights.

6. What is persisted for analytics?

- Full JSON prediction payloads in JSONB, chat transcripts, extracted symptoms, and BMI records.

7. Is the hardware smartwatch integrated?

- Current build includes a mock telemetry service and visualization pipeline. The architecture is prepared for live device ingestion.

8. How do you secure user sessions?

- JWT-based auth middleware, protected routes for user-specific history/profile operations.

9. Why keep Node as gateway?

- Uniform auth, observability, persistence, and policy enforcement before touching AI microservices.

10. How is hospital recommendation personalized?

- Combined scoring over proximity and disease-specific specialty keyword alignment.

## 12) Demo Narrative (3-5 minutes)

1. Register/login with profile (age, phone, address).
2. Run symptom checker; show ranked diseases + confidence.
3. Record voice; show respiratory risk and transcript-driven chat response.
4. Show map and top 3 recommended hospitals.
5. Show analysis history proving persisted timeline.
6. Close with fallback reliability and architecture advantages.

## 13) Current Limitations and Next Steps

Current limitations:

- Smartwatch ingestion is mocked, not yet real-time BLE/cloud stream.
- Voice classifier is lightweight and should be validated with larger clinical datasets.
- LLM outputs are guidance-quality, not diagnostic-grade medical decisions.

Near-term roadmap:

- Real hardware ingestion adapter (BLE/mobile companion or IoT hub)
- Calibration and uncertainty metrics per disease class
- Model versioning and drift monitoring
- Regional language speech support and multilingual symptom extraction

## 14) Compliance and Responsible AI Notes

- Not a diagnostic device; triage and guidance only.
- Preserve explainability via stored predictions and extracted symptom traces.
- Use confidence and warning signals to avoid false certainty.
- Encourage escalation to clinician/hospital for severe symptom patterns.
