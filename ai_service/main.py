import os
import tempfile
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, File, HTTPException, UploadFile
from pydantic import BaseModel, Field

from models.symptom_model import SymptomPredictor
from models.voice_model import VoicePredictor


symptom_predictor = None
voice_predictor = None


class SymptomRequest(BaseModel):
    symptoms: str
    age: Optional[int] = Field(default=None, ge=0, le=120)
    symptomDays: Optional[int] = Field(default=None, ge=1, le=180)


@asynccontextmanager
async def lifespan(app: FastAPI):
    global symptom_predictor, voice_predictor
    symptom_predictor = SymptomPredictor()
    voice_predictor = VoicePredictor()
    yield


app = FastAPI(title="VitalBit AI Service", lifespan=lifespan)


@app.get('/health')
def health_check():
    return {"status": "ok", "service": "vitalbit-ai", "model": "MiniLM + VoiceClassifier"}


@app.post('/predict/symptoms')
def predict_symptoms(payload: SymptomRequest):
    if not payload.symptoms.strip():
        raise HTTPException(status_code=400, detail="symptoms cannot be empty")

    return symptom_predictor.predict(
        payload.symptoms,
        age=payload.age,
        symptom_days=payload.symptomDays
    )


@app.post('/predict/voice')
async def predict_voice(file: UploadFile = File(...)):
    suffix = os.path.splitext(file.filename or "voice.wav")[1] or ".wav"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="empty audio file")
        tmp.write(content)
        tmp_path = tmp.name

    try:
        result = voice_predictor.predict(tmp_path)
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error))
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

    return result
