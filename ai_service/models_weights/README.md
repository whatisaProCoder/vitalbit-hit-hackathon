Place pretrained respiratory classifier here as `voice_model.pkl`.

Expected model type: scikit-learn classifier with:

- `predict(features)`
- `predict_proba(features)`

If no pickle is present, the service falls back to a lightweight PyTorch inference head for demo continuity.
