import torch
from sentence_transformers import SentenceTransformer
import re


disease_profiles = {
    "flu": "fever cough sore throat fatigue headache body ache chills",
    "covid": "fever dry cough breathing difficulty fatigue loss of smell throat pain",
    "asthma": "shortness of breath chest tightness wheezing cough night breathing problems",
    "tuberculosis": "persistent cough chest pain weight loss fever night sweats fatigue",
    "malaria": "fever chills sweating headache nausea vomiting body pain",
    "dengue": "high fever severe headache joint pain rash nausea weakness",
    "pneumonia": "chest pain cough fever difficulty breathing fatigue rapid breathing",
    "bronchitis": "mucus cough sore throat tiredness chest discomfort wheezing",
    "anemia": "fatigue weakness pale skin dizziness shortness of breath cold hands",
    "dehydration": "thirst dry mouth dizziness weakness low urine headache",
    "typhoid": "high fever weakness abdominal pain headache constipation diarrhea loss appetite",
    "gastroenteritis": "abdominal pain diarrhea vomiting nausea fever dehydration cramps",
    "sinusitis": "facial pain sinus pressure stuffy nose runny nose headache sore throat",
    "migraine": "severe headache nausea vomiting light sensitivity blurred vision dizziness",
    "urinary_tract_infection": "burning urination frequent urination pelvic pain low fever cloudy urine",
    "allergy": "runny nose sneezing itchy eyes rash throat irritation wheezing",
    "otitis": "ear pain fever irritability hearing difficulty fluid discharge",
    "diabetes_warning": "frequent urination increased thirst fatigue blurred vision weight loss",
    "hypertension_warning": "headache dizziness chest pain shortness breath blurred vision nosebleed"
}


class SymptomPredictor:
    def __init__(self) -> None:
        self.embedder = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
        self.diseases = list(disease_profiles.keys())
        self.temperature = 0.03
        descriptions = [disease_profiles[d] for d in self.diseases]
        embeddings = self.embedder.encode(descriptions, convert_to_tensor=True)
        self.profile_embeddings = torch.nn.functional.normalize(embeddings, p=2, dim=1)
        self.profile_tokens = {
            d: self._tokenize(disease_profiles[d])
            for d in self.diseases
        }
        self.token_idf = self._build_token_idf()
        self.profile_token_weight_sums = {
            d: sum(self.token_idf.get(token, 1.0) for token in tokens)
            for d, tokens in self.profile_tokens.items()
        }

    @staticmethod
    def _tokenize(text: str):
        return set(re.findall(r"[a-z]+", str(text if text is not None else '').lower()))

    def _build_token_idf(self):
        token_df = {}
        total_docs = max(1, len(self.diseases))
        for disease in self.diseases:
            for token in self.profile_tokens[disease]:
                token_df[token] = token_df.get(token, 0) + 1

        idf = {}
        for token, df in token_df.items():
            # Smoothed IDF keeps frequent generic tokens (e.g. fever) lower impact.
            idf[token] = float(1.0 + torch.log(torch.tensor((total_docs + 1) / (df + 1))).item())
        return idf

    def _keyword_overlap_score(self, symptoms: str):
        symptom_tokens = self._tokenize(symptoms)
        symptom_weight_sum = sum(self.token_idf.get(token, 1.0) for token in symptom_tokens)
        scores = []
        for d in self.diseases:
            profile_tokens = self.profile_tokens[d]
            if not profile_tokens:
                scores.append(0.0)
                continue

            overlap_tokens = symptom_tokens & profile_tokens
            overlap_weight = sum(self.token_idf.get(token, 1.0) for token in overlap_tokens)
            profile_weight_sum = max(1e-6, self.profile_token_weight_sums.get(d, 0.0))
            if overlap_weight <= 0:
                scores.append(0.0)
                continue

            precision = overlap_weight / max(1e-6, symptom_weight_sum)
            recall = overlap_weight / profile_weight_sum
            f1 = (2 * precision * recall) / max(1e-6, precision + recall)
            scores.append(float(f1))
        return torch.tensor(scores, dtype=torch.float32)

    def _age_weight_vector(self, age):
        weights = torch.ones(len(self.diseases), dtype=torch.float32)
        if age is None:
            return weights

        try:
            age_value = int(age)
        except (TypeError, ValueError):
            return weights

        disease_weight_by_age = {
            "otitis": 1.2 if age_value <= 12 else 1.0,
            "asthma": 1.12 if age_value <= 18 else 1.0,
            "gastroenteritis": 1.1 if age_value <= 12 else 1.0,
            "diabetes_warning": 1.16 if age_value >= 40 else 0.96,
            "hypertension_warning": 1.2 if age_value >= 45 else 0.94,
            "tuberculosis": 1.1 if age_value >= 55 else 1.0,
            "pneumonia": 1.16 if (age_value <= 5 or age_value >= 60) else 1.0,
            "anemia": 1.08 if (age_value <= 16 or age_value >= 60) else 1.0,
            "urinary_tract_infection": 1.1 if age_value >= 50 else 1.0,
        }

        for i, disease in enumerate(self.diseases):
            weights[i] = disease_weight_by_age.get(disease, 1.0)

        return weights

    def predict(self, symptoms: str, top_k: int = 3, age=None):
        input_embedding = self.embedder.encode(symptoms, convert_to_tensor=True)
        input_embedding = torch.nn.functional.normalize(input_embedding, p=2, dim=0)

        similarities = torch.matmul(self.profile_embeddings, input_embedding)
        semantic_scores = (similarities + 1.0) / 2.0
        keyword_scores = self._keyword_overlap_score(symptoms).to(semantic_scores.device)

        combined_scores = (0.4 * semantic_scores) + (0.6 * keyword_scores)
        combined_scores = combined_scores * self._age_weight_vector(age).to(combined_scores.device)
        top_values, top_indices = torch.topk(combined_scores, k=min(top_k, len(self.diseases)))

        probs = torch.softmax(top_values / self.temperature, dim=0)
        predictions = []
        for i, idx in enumerate(top_indices.tolist()):
            predictions.append(
                {
                    "disease": self.diseases[idx],
                    "probability": round(float(probs[i].item()), 4)
                }
            )

        top_probability = float(probs[0].item())
        top_score = float(top_values[0].item())
        confidence = round(min(0.98, (0.45 * top_probability) + (0.55 * top_score)), 4)
        return {"predictions": predictions, "confidence": confidence, "ageUsed": age}
