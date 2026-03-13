from pathlib import Path
from typing import Dict

import joblib
import librosa
import numpy as np
import torch


MODEL_PATH = Path(__file__).resolve().parent.parent / "models_weights" / "voice_model.pkl"


class LightweightTorchRiskHead(torch.nn.Module):
    def __init__(self, input_dim: int = 42):
        super().__init__()
        self.net = torch.nn.Sequential(
            torch.nn.Linear(input_dim, 16),
            torch.nn.ReLU(),
            torch.nn.Linear(16, 1),
            torch.nn.Sigmoid()
        )

    def forward(self, x):
        return self.net(x)


class VoicePredictor:
    def __init__(self) -> None:
        self.classifier = None
        self.torch_head = LightweightTorchRiskHead()
        self._load_weights()

    def _load_weights(self) -> None:
        if MODEL_PATH.exists():
            try:
                self.classifier = joblib.load(MODEL_PATH)
            except Exception:
                self.classifier = None

    def _extract_features(self, audio_path: str) -> np.ndarray:
        y, sr = librosa.load(audio_path, sr=16000)
        mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=40)
        mfcc_mean = mfcc.mean(axis=1)

        spectral_centroid = librosa.feature.spectral_centroid(y=y, sr=sr).mean()
        zcr = librosa.feature.zero_crossing_rate(y).mean()

        features = np.concatenate([mfcc_mean, np.array([spectral_centroid, zcr])], axis=0)
        return features.astype(np.float32)

    def predict(self, audio_path: str) -> Dict:
        features = self._extract_features(audio_path)

        if self.classifier is not None:
            pred = self.classifier.predict([features])[0]
            confidence = float(np.max(self.classifier.predict_proba([features])))
            risk = "respiratory_issue" if str(pred).lower() in ["1", "issue", "respiratory_issue"] else "healthy"
            return {"risk": risk, "confidence": round(confidence, 4)}

        with torch.no_grad():
            x = torch.tensor(features).unsqueeze(0)
            raw = float(self.torch_head(x).squeeze().item())

        adjusted = max(0.05, min(0.95, (raw + 0.35) / 1.35))
        risk = "respiratory_issue" if adjusted >= 0.5 else "healthy"
        return {"risk": risk, "confidence": round(adjusted, 4), "model": "torch_fallback"}
