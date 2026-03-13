import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import api from "../lib/api";

const symptomOptions = [
  "fever",
  "dry cough",
  "fatigue",
  "shortness of breath",
  "headache",
  "sore throat",
  "chills",
  "chest pain",
  "wheezing",
  "nausea",
  "joint pain",
  "loss of smell",
  "persistent cough",
  "dizziness",
  "sweating",
  "runny nose",
  "stuffy nose",
  "body ache",
  "muscle pain",
  "abdominal pain",
  "diarrhea",
  "vomiting",
  "loss of appetite",
  "rash",
  "itching",
  "night sweats",
  "weight loss",
  "rapid heartbeat",
  "palpitations",
  "blurred vision",
  "frequent urination",
  "burning urination",
  "dehydration",
  "ear pain",
  "sinus pressure",
  "confusion",
  "fainting",
  "swollen glands",
  "back pain",
  "constipation",
  "chest tightness",
  "phlegm",
  "hoarseness",
  "high fever",
  "low-grade fever",
];

function SymptomChecker({ onResult, setLoading }) {
  const [selected, setSelected] = useState(["fever", "fatigue"]);

  const inputText = useMemo(() => selected.join(" "), [selected]);

  const toggleSymptom = (symptom) => {
    setSelected((prev) =>
      prev.includes(symptom)
        ? prev.filter((item) => item !== symptom)
        : [...prev, symptom],
    );
  };

  const handleAnalyze = async () => {
    if (!selected.length) return;
    try {
      setLoading(true);
      const { data } = await api.post("/api/symptoms/analyze", {
        symptoms: inputText,
      });
      onResult({ type: "symptom", data });
    } catch (error) {
      onResult({
        type: "symptom",
        data: {
          error: error.response?.data?.error || "Failed to analyze symptoms",
        },
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass rounded-2xl p-6">
      <div className="mb-4 flex items-center gap-2">
        <Search className="h-5 w-5 text-mint" />
        <h3 className="text-xl font-bold">AI Symptom Checker</h3>
      </div>
      <p className="mb-4 text-sm text-slate-200">
        Select symptoms and get ranked disease predictions powered by semantic
        AI matching.
      </p>
      <div className="mb-4 flex flex-wrap gap-2">
        {symptomOptions.map((symptom) => {
          const active = selected.includes(symptom);
          return (
            <button
              key={symptom}
              type="button"
              onClick={() => toggleSymptom(symptom)}
              className={`rounded-full border px-3 py-2 text-sm transition ${
                active
                  ? "border-sky bg-sky/20 text-sky-100"
                  : "border-white/20 bg-white/5 text-slate-200 hover:border-mint/60"
              }`}
            >
              {symptom}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={handleAnalyze}
        className="w-full rounded-xl bg-sky px-4 py-3 font-semibold text-white transition hover:bg-sky/90"
      >
        Analyze Symptoms
      </button>
    </div>
  );
}

export default SymptomChecker;
