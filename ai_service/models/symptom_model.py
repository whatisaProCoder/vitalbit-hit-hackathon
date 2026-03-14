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


test_guidance = {
    "flu": [
        {
            "test": "Complete Blood Count (CBC)",
            "doctorApprovalRequired": False,
            "whereWithoutDoctorApproval": [
                "Any diagnostic lab or pathology center",
                "Primary health center lab"
            ]
        },
        {
            "test": "Influenza Rapid Antigen Test",
            "doctorApprovalRequired": False,
            "whereWithoutDoctorApproval": [
                "Private diagnostic labs",
                "Hospital outpatient sample collection counters"
            ]
        }
    ],
    "covid": [
        {
            "test": "RT-PCR for SARS-CoV-2",
            "doctorApprovalRequired": False,
            "whereWithoutDoctorApproval": [
                "Government approved COVID testing centers",
                "Private diagnostic labs with home collection"
            ]
        },
        {
            "test": "CRP / D-Dimer / Ferritin panel (if moderate symptoms)",
            "doctorApprovalRequired": True,
            "whereWithoutDoctorApproval": []
        }
    ],
    "asthma": [
        {
            "test": "Peak Flow Test",
            "doctorApprovalRequired": False,
            "whereWithoutDoctorApproval": [
                "Pulmonary labs",
                "Respiratory clinics"
            ]
        },
        {
            "test": "Spirometry",
            "doctorApprovalRequired": True,
            "whereWithoutDoctorApproval": []
        }
    ],
    "tuberculosis": [
        {
            "test": "Sputum AFB Smear",
            "doctorApprovalRequired": False,
            "whereWithoutDoctorApproval": [
                "Government TB centers",
                "District hospital labs"
            ]
        },
        {
            "test": "Chest X-Ray",
            "doctorApprovalRequired": True,
            "whereWithoutDoctorApproval": []
        }
    ],
    "malaria": [
        {
            "test": "Malaria Antigen Rapid Test",
            "doctorApprovalRequired": False,
            "whereWithoutDoctorApproval": [
                "Pathology labs",
                "Rural health center labs"
            ]
        },
        {
            "test": "Peripheral Blood Smear",
            "doctorApprovalRequired": False,
            "whereWithoutDoctorApproval": [
                "Government and private labs"
            ]
        }
    ],
    "dengue": [
        {
            "test": "Dengue NS1 Antigen",
            "doctorApprovalRequired": False,
            "whereWithoutDoctorApproval": [
                "Private pathology labs",
                "Hospital sample collection centers"
            ]
        },
        {
            "test": "Dengue IgM / IgG",
            "doctorApprovalRequired": False,
            "whereWithoutDoctorApproval": [
                "Diagnostic centers"
            ]
        }
    ],
    "pneumonia": [
        {
            "test": "Chest X-Ray",
            "doctorApprovalRequired": True,
            "whereWithoutDoctorApproval": []
        },
        {
            "test": "CBC and CRP",
            "doctorApprovalRequired": False,
            "whereWithoutDoctorApproval": [
                "General pathology labs"
            ]
        }
    ],
    "bronchitis": [
        {
            "test": "CBC",
            "doctorApprovalRequired": False,
            "whereWithoutDoctorApproval": [
                "Any pathology lab"
            ]
        },
        {
            "test": "Chest X-Ray (if persistent symptoms)",
            "doctorApprovalRequired": True,
            "whereWithoutDoctorApproval": []
        }
    ],
    "anemia": [
        {
            "test": "CBC",
            "doctorApprovalRequired": False,
            "whereWithoutDoctorApproval": [
                "Any diagnostic lab",
                "Community health center lab"
            ]
        },
        {
            "test": "Serum Ferritin / B12 / Folate",
            "doctorApprovalRequired": False,
            "whereWithoutDoctorApproval": [
                "Private pathology labs"
            ]
        }
    ],
    "dehydration": [
        {
            "test": "Serum Electrolytes",
            "doctorApprovalRequired": False,
            "whereWithoutDoctorApproval": [
                "Diagnostic labs"
            ]
        },
        {
            "test": "Urine Routine",
            "doctorApprovalRequired": False,
            "whereWithoutDoctorApproval": [
                "Any pathology center"
            ]
        }
    ],
    "typhoid": [
        {
            "test": "TyphiDot / IgM",
            "doctorApprovalRequired": False,
            "whereWithoutDoctorApproval": [
                "Private diagnostic labs"
            ]
        },
        {
            "test": "Blood Culture",
            "doctorApprovalRequired": True,
            "whereWithoutDoctorApproval": []
        }
    ],
    "gastroenteritis": [
        {
            "test": "Stool Routine Examination",
            "doctorApprovalRequired": False,
            "whereWithoutDoctorApproval": [
                "Diagnostic labs"
            ]
        },
        {
            "test": "Electrolyte Panel",
            "doctorApprovalRequired": False,
            "whereWithoutDoctorApproval": [
                "General pathology labs"
            ]
        }
    ],
    "sinusitis": [
        {
            "test": "X-Ray PNS / CT PNS",
            "doctorApprovalRequired": True,
            "whereWithoutDoctorApproval": []
        },
        {
            "test": "CBC",
            "doctorApprovalRequired": False,
            "whereWithoutDoctorApproval": [
                "Any pathology lab"
            ]
        }
    ],
    "migraine": [
        {
            "test": "Neurology Clinical Evaluation",
            "doctorApprovalRequired": True,
            "whereWithoutDoctorApproval": []
        },
        {
            "test": "MRI Brain (red-flag symptoms)",
            "doctorApprovalRequired": True,
            "whereWithoutDoctorApproval": []
        }
    ],
    "urinary_tract_infection": [
        {
            "test": "Urine Routine and Microscopy",
            "doctorApprovalRequired": False,
            "whereWithoutDoctorApproval": [
                "Any diagnostic center",
                "Hospital lab collection counters"
            ]
        },
        {
            "test": "Urine Culture",
            "doctorApprovalRequired": False,
            "whereWithoutDoctorApproval": [
                "Pathology and microbiology labs"
            ]
        }
    ],
    "allergy": [
        {
            "test": "Absolute Eosinophil Count / IgE",
            "doctorApprovalRequired": False,
            "whereWithoutDoctorApproval": [
                "General pathology labs"
            ]
        },
        {
            "test": "Allergen-specific panel",
            "doctorApprovalRequired": True,
            "whereWithoutDoctorApproval": []
        }
    ],
    "otitis": [
        {
            "test": "ENT Otoscopy",
            "doctorApprovalRequired": True,
            "whereWithoutDoctorApproval": []
        },
        {
            "test": "Ear Swab Culture (if discharge present)",
            "doctorApprovalRequired": True,
            "whereWithoutDoctorApproval": []
        }
    ],
    "diabetes_warning": [
        {
            "test": "Fasting Blood Sugar / HbA1c",
            "doctorApprovalRequired": False,
            "whereWithoutDoctorApproval": [
                "Any diagnostic lab",
                "Diabetes screening camps"
            ]
        },
        {
            "test": "Lipid Profile",
            "doctorApprovalRequired": False,
            "whereWithoutDoctorApproval": [
                "General pathology labs"
            ]
        }
    ],
    "hypertension_warning": [
        {
            "test": "Blood Pressure Monitoring",
            "doctorApprovalRequired": False,
            "whereWithoutDoctorApproval": [
                "Pharmacy BP kiosks",
                "Community health center"
            ]
        },
        {
            "test": "Kidney Function Test and ECG",
            "doctorApprovalRequired": True,
            "whereWithoutDoctorApproval": []
        }
    ]
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

    def _tests_for_disease(self, disease: str):
        guidance = test_guidance.get(disease, [])
        return [
            {
                "test": item.get("test", "Clinical evaluation"),
                "doctorApprovalRequired": bool(item.get("doctorApprovalRequired", False)),
                "whereWithoutDoctorApproval": item.get("whereWithoutDoctorApproval", [])
            }
            for item in guidance
        ]

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

    def _duration_weight_vector(self, symptom_days):
        weights = torch.ones(len(self.diseases), dtype=torch.float32)
        if symptom_days is None:
            return weights

        try:
            days = int(symptom_days)
        except (TypeError, ValueError):
            return weights

        short_duration = days <= 3
        medium_duration = 4 <= days <= 7
        long_duration = days > 7

        disease_weight_by_duration = {
            "flu": 1.15 if short_duration else (0.97 if long_duration else 1.03),
            "covid": 1.08 if medium_duration else 1.0,
            "malaria": 1.1 if medium_duration else 1.0,
            "dengue": 1.1 if short_duration else 1.0,
            "gastroenteritis": 1.12 if short_duration else 0.98,
            "dehydration": 1.1 if short_duration else 1.0,
            "sinusitis": 1.12 if long_duration else 0.98,
            "bronchitis": 1.1 if long_duration else 0.99,
            "tuberculosis": 1.2 if long_duration else 0.92,
            "asthma": 1.1 if long_duration else 1.0,
            "allergy": 1.1 if long_duration else 0.97,
            "anemia": 1.1 if long_duration else 0.96,
            "diabetes_warning": 1.16 if long_duration else 0.94,
            "hypertension_warning": 1.14 if long_duration else 0.95,
            "urinary_tract_infection": 1.06 if medium_duration else 1.0,
            "pneumonia": 1.08 if medium_duration else 1.0,
            "typhoid": 1.1 if medium_duration else 1.0,
            "migraine": 1.06 if long_duration else 1.0,
            "otitis": 1.08 if short_duration else 1.0,
        }

        for i, disease in enumerate(self.diseases):
            weights[i] = disease_weight_by_duration.get(disease, 1.0)

        return weights

    def predict(self, symptoms: str, top_k: int = 3, age=None, symptom_days=None):
        input_embedding = self.embedder.encode(symptoms, convert_to_tensor=True)
        input_embedding = torch.nn.functional.normalize(input_embedding, p=2, dim=0)

        similarities = torch.matmul(self.profile_embeddings, input_embedding)
        semantic_scores = (similarities + 1.0) / 2.0
        keyword_scores = self._keyword_overlap_score(symptoms).to(semantic_scores.device)

        combined_scores = (0.4 * semantic_scores) + (0.6 * keyword_scores)
        combined_scores = combined_scores * self._age_weight_vector(age).to(combined_scores.device)
        combined_scores = combined_scores * self._duration_weight_vector(symptom_days).to(combined_scores.device)
        top_values, top_indices = torch.topk(combined_scores, k=min(top_k, len(self.diseases)))

        probs = torch.softmax(top_values / self.temperature, dim=0)
        predictions = []
        for i, idx in enumerate(top_indices.tolist()):
            disease = self.diseases[idx]
            predictions.append(
                {
                    "disease": disease,
                    "probability": round(float(probs[i].item()), 4),
                    "recommendedTests": self._tests_for_disease(disease)
                }
            )

        top_probability = float(probs[0].item())
        top_score = float(top_values[0].item())
        confidence = round(min(0.98, (0.45 * top_probability) + (0.55 * top_score)), 4)
        top_disease = predictions[0]["disease"] if predictions else None
        recommended_tests = self._tests_for_disease(top_disease) if top_disease else []
        tests_requiring_approval = [
            test for test in recommended_tests
            if test.get("doctorApprovalRequired")
        ]
        tests_without_approval = [
            test for test in recommended_tests
            if not test.get("doctorApprovalRequired")
        ]

        return {
            "predictions": predictions,
            "confidence": confidence,
            "ageUsed": age,
            "symptomDaysUsed": symptom_days,
            "topDisease": top_disease,
            "recommendedTests": recommended_tests,
            "testsRequiringDoctorApproval": tests_requiring_approval,
            "testsWithoutDoctorApproval": tests_without_approval
        }
