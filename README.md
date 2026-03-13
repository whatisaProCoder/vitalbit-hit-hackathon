# VitalBit

VitalBit is an AI-powered healthcare assistant platform for early disease detection in rural communities.

## Technical documentation

- Architecture overview: `docs/ARCHITECTURE.md`
- Full hackathon technical playbook (judge-ready): `docs/HACKATHON_TECHNICAL_PLAYBOOK.md`

## Monorepo structure

- `frontend/`: React + Vite + Tailwind + GSAP + Leaflet
- `backend/`: Node.js + Express + PostgreSQL API gateway
- `ai_service/`: FastAPI + PyTorch + sentence-transformers + librosa inference service

## Quick start

### 1) Backend

```bash
cd backend
npm install
npm run dev
```

### 2) AI service

```bash
cd ai_service
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 3) Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend: http://localhost:5173  
Backend: http://localhost:5000  
AI service: http://localhost:8000

## PostgreSQL

Connection string used by backend:

`postgresql://pritam_wsl:7865@localhost:5432/vitalbit`

Apply schema:

```bash
psql "postgresql://pritam_wsl:7865@localhost:5432/vitalbit" -f backend/db/schema.sql
```
