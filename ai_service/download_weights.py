from pathlib import Path
from urllib.request import urlretrieve

import joblib
import numpy as np
from sklearn.ensemble import RandomForestClassifier


TARGET = Path(__file__).resolve().parent / "models_weights" / "voice_model.pkl"

# Candidate sources for pretrained respiratory classifier artifacts.
SOURCE_URLS = [
    "https://github.com/prateekrajgautam/Respiratory-Sound-Classification/raw/main/model.pkl",
    "https://raw.githubusercontent.com/prateekrajgautam/Respiratory-Sound-Classification/main/model.pkl",
]


def _download_pretrained() -> bool:
    for source_url in SOURCE_URLS:
        try:
            print(f"Trying download: {source_url}")
            urlretrieve(source_url, TARGET)
            model = joblib.load(TARGET)
            if hasattr(model, "predict") and hasattr(model, "predict_proba"):
                print("Downloaded and validated pretrained voice model.")
                return True
            print("Downloaded artifact is not a compatible classifier, trying next source.")
        except Exception as error:
            print(f"Download failed from source: {source_url} ({error})")
    return False


def _bootstrap_fallback_model() -> None:
    rng = np.random.default_rng(42)

    # Synthetic feature vectors shaped like [40 MFCC means, spectral centroid, ZCR].
    healthy = np.column_stack(
        [
            rng.normal(loc=0.0, scale=1.0, size=(320, 40)),
            rng.normal(loc=1650.0, scale=180.0, size=(320, 1)),
            rng.normal(loc=0.055, scale=0.012, size=(320, 1)),
        ]
    )
    issue = np.column_stack(
        [
            rng.normal(loc=0.25, scale=1.25, size=(320, 40)),
            rng.normal(loc=1080.0, scale=220.0, size=(320, 1)),
            rng.normal(loc=0.11, scale=0.02, size=(320, 1)),
        ]
    )

    x = np.vstack([healthy, issue]).astype(np.float32)
    y = np.array(["healthy"] * healthy.shape[0] + ["respiratory_issue"] * issue.shape[0])

    model = RandomForestClassifier(
        n_estimators=240,
        max_depth=12,
        min_samples_split=4,
        random_state=42,
        n_jobs=-1,
    )
    model.fit(x, y)
    joblib.dump(model, TARGET)
    print("Created bootstrap voice_model.pkl (RandomForest).")


def main() -> None:
    TARGET.parent.mkdir(parents=True, exist_ok=True)
    if _download_pretrained():
        return
    _bootstrap_fallback_model()


if __name__ == "__main__":
    main()
