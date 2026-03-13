import { useEffect, useMemo, useState } from "react";
import { Calculator } from "lucide-react";
import api from "../lib/api";

function BmiTrend({ records }) {
  const points = useMemo(() => {
    const ordered = [...records]
      .map((item) => ({
        id: item.id,
        value: Number(item.metric_value),
        created_at: item.created_at,
      }))
      .filter((item) => Number.isFinite(item.value))
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    if (!ordered.length) return { values: [], min: 0, max: 0, dots: [] };

    const width = 680;
    const height = 180;
    const pad = 22;
    const values = ordered.map((item) => item.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    const dots = ordered.map((item, index) => {
      const ratio = ordered.length === 1 ? 0.5 : index / (ordered.length - 1);
      const x = pad + ratio * (width - pad * 2);
      const y =
        height - pad - ((item.value - min) / range) * (height - pad * 2);
      return { ...item, x, y };
    });

    return { values, min, max, dots, width, height, pad };
  }, [records]);

  if (!points.dots.length) return null;

  return (
    <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
      <div className="mb-2 flex items-center justify-between text-xs text-slate-300">
        <span>BMI trend</span>
        <span>
          Min {points.min.toFixed(2)} | Max {points.max.toFixed(2)}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${points.width} ${points.height}`}
        preserveAspectRatio="none"
        className="h-36 w-full"
      >
        <line
          x1={points.pad}
          y1={points.height - points.pad}
          x2={points.width - points.pad}
          y2={points.height - points.pad}
          stroke="rgba(255,255,255,0.2)"
        />
        <line
          x1={points.pad}
          y1={points.pad}
          x2={points.pad}
          y2={points.height - points.pad}
          stroke="rgba(255,255,255,0.2)"
        />
        <polyline
          points={points.dots.map((p) => `${p.x},${p.y}`).join(" ")}
          fill="none"
          stroke="#38bdf8"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        {points.dots.map((p) => (
          <g key={p.id}>
            <circle cx={p.x} cy={p.y} r="3" fill="#38bdf8" />
            <title>{`${new Date(p.created_at).toLocaleDateString()} - BMI ${p.value.toFixed(2)}`}</title>
          </g>
        ))}
      </svg>
    </div>
  );
}

function BmiTracker({ user, onBmiRecorded }) {
  const [heightCm, setHeightCm] = useState(170);
  const [weightKg, setWeightKg] = useState(65);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [history, setHistory] = useState([]);

  useEffect(() => {
    const loadBmiHistory = async () => {
      if (!user) {
        setHistory([]);
        return;
      }

      try {
        const { data } = await api.get("/api/dashboard/history");
        setHistory(Array.isArray(data?.bmi) ? data.bmi : []);
      } catch {
        setHistory([]);
      }
    };

    loadBmiHistory();
  }, [user, result]);

  const submit = async () => {
    if (!user) {
      setError("Login required to save BMI");
      return;
    }

    try {
      setError("");
      const { data } = await api.post("/api/bmi", {
        heightCm: Number(heightCm),
        weightKg: Number(weightKg),
      });
      setResult(data);
      onBmiRecorded?.();
    } catch (err) {
      setError(err.response?.data?.error || "BMI save failed");
    }
  };

  return (
    <div className="glass rounded-2xl p-6">
      <div className="mb-4 flex items-center gap-2">
        <Calculator className="h-5 w-5 text-mint" />
        <h3 className="text-xl font-bold">BMI Tracker</h3>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <input
          type="number"
          value={heightCm}
          onChange={(e) => setHeightCm(e.target.value)}
          placeholder="Height (cm)"
          className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 outline-none focus:border-sky"
        />
        <input
          type="number"
          value={weightKg}
          onChange={(e) => setWeightKg(e.target.value)}
          placeholder="Weight (kg)"
          className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 outline-none focus:border-sky"
        />
      </div>
      <button
        type="button"
        onClick={submit}
        className="mt-3 w-full rounded-lg bg-emerald-500 px-4 py-2 font-semibold text-white transition hover:bg-emerald-600"
      >
        Calculate & Save BMI
      </button>
      {result && (
        <p className="mt-3 text-slate-100">
          BMI: <span className="font-bold">{result.bmi}</span> (
          {result.category})
        </p>
      )}
      {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}
      {history.length > 0 && <BmiTrend records={history} />}
    </div>
  );
}

export default BmiTracker;
