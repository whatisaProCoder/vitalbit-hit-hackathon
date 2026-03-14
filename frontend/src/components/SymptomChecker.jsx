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
  const [symptomDays, setSymptomDays] = useState(3);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const inputText = useMemo(() => selected.join(" "), [selected]);

  const toggleSymptom = (symptom) => {
    setSelected((prev) =>
      prev.includes(symptom)
        ? prev.filter((item) => item !== symptom)
        : [...prev, symptom],
    );
  };

  const handleAnalyze = async () => {
    if (!selected.length || isAnalyzing) return;

    const parsedDays = Number(symptomDays);
    if (!Number.isInteger(parsedDays) || parsedDays < 1 || parsedDays > 180) {
      setStatusMessage("Please enter symptom duration between 1 and 180 days.");
      return;
    }

    try {
      setIsAnalyzing(true);
      setStatusMessage("");
      setLoading(true);
      const { data } = await api.post("/api/symptoms/analyze", {
        symptoms: inputText,
        symptomDays: parsedDays,
      });
      onResult({ type: "symptom", data });
    } catch (error) {
      const fallbackError =
        "Failed to analyze symptoms. Please ensure backend and AI service are running.";
      const message =
        error.response?.data?.error || error.message || fallbackError;

      setStatusMessage(message);
      onResult({
        type: "symptom",
        data: {
          error: message,
        },
      });
    } finally {
      setLoading(false);
      setIsAnalyzing(false);
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
      <div className="mb-4 rounded-xl border border-white/10 bg-black/20 p-3">
        <label htmlFor="symptomDays" className="mb-2 block text-sm font-medium text-slate-100">
          How many days have you had these symptoms?
        </label>
        <input
          id="symptomDays"
          type="number"
          min="1"
          max="180"
          value={symptomDays}
          onChange={(e) => setSymptomDays(e.target.value)}
          className="w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-400"
          placeholder="Enter days (e.g., 3)"
        />
        <p className="mt-1 text-xs text-slate-300">
          Duration helps AI separate short-term infections from longer-term conditions.
        </p>
      </div>
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
        disabled={isAnalyzing || !selected.length}
        className="w-full rounded-xl bg-sky px-4 py-3 font-semibold text-white transition hover:bg-sky/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isAnalyzing ? "Analyzing..." : "Analyze Symptoms"}
      </button>
      {!!statusMessage && (
        <p className="mt-3 text-sm text-rose-300">{statusMessage}</p>
      )}
    </div>
  );
}

export default SymptomChecker;
