# VitalBit Architecture

```text
React Frontend
      |
      v
Node/Express API Gateway -------------------------------> PostgreSQL
      |                  \
      |                   ---> Gemini API (LLM + STT fallback)
      v
FastAPI AI Service
      |
      v
PyTorch + SentenceTransformer + Librosa
```

## Contracts

- `POST /api/symptoms/analyze` -> proxies to `POST /predict/symptoms`
- `POST /api/voice/analyze` -> proxies to `POST /predict/voice`
- `POST /api/chat/message` -> LLM response generation (Gemini when configured)
- `POST /api/chat/voice-to-text` -> external STT or Gemini multimodal transcription fallback + voice/symptom analysis
- `GET /api/hospitals` -> Overpass API + fallback list
- `POST /api/users` -> persists user profile
