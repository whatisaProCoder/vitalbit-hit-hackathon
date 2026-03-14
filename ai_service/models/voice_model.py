from pathlib import Path
from typing import Dict
import subprocess
import tempfile
import os

import joblib
import librosa
import numpy as np
import torch
import imageio_ffmpeg


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
        y, sr = self._safe_load_audio(audio_path)
        mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=40)
        mfcc_mean = mfcc.mean(axis=1)

        spectral_centroid = librosa.feature.spectral_centroid(y=y, sr=sr).mean()
        zcr = librosa.feature.zero_crossing_rate(y).mean()

        features = np.concatenate([mfcc_mean, np.array([spectral_centroid, zcr])], axis=0)
        return features.astype(np.float32)

    def _safe_load_audio(self, audio_path: str):
        try:
            return librosa.load(audio_path, sr=16000)
        except Exception as original_error:
            tmp_wav_path = None
            try:
                ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
                with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as tmp_wav:
                    tmp_wav_path = tmp_wav.name

                subprocess.run(
                    [
                        ffmpeg_exe,
                        '-y',
                        '-i',
                        audio_path,
                        '-ac',
                        '1',
                        '-ar',
                        '16000',
                        tmp_wav_path
                    ],
                    check=True,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL
                )
                return librosa.load(tmp_wav_path, sr=16000)
            except Exception as conversion_error:
                raise RuntimeError(
                    f"Unsupported or corrupt audio format. Original load failed: {original_error}; ffmpeg conversion failed: {conversion_error}"
                ) from conversion_error
            finally:
                if tmp_wav_path and os.path.exists(tmp_wav_path):
                    os.remove(tmp_wav_path)

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
