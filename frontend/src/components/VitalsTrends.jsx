import { useEffect, useMemo, useState } from "react";
import { ActivitySquare } from "lucide-react";
import api from "../lib/api";

function toPoints(samples, valueKey, width, height, pad) {
  if (!samples.length) return { points: [], min: 0, max: 0 };

  const values = samples.map((s) => Number(s[valueKey]));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = samples.map((sample, index) => {
    const ratio = samples.length === 1 ? 0.5 : index / (samples.length - 1);
    const x = pad + ratio * (width - pad * 2);
    const y =
      height -
      pad -
      ((Number(sample[valueKey]) - min) / range) * (height - pad * 2);
    return {
      x,
      y,
      value: Number(sample[valueKey]),
      timestamp: sample.timestamp,
    };
  });

  return { points, min, max };
}

function VitalsChart({ title, valueKey, unit, colorClass, samples }) {
  const width = 680;
  const height = 200;
  const pad = 24;
  const { points, min, max } = useMemo(
    () => toPoints(samples, valueKey, width, height, pad),
    [samples, valueKey],
  );

  if (!samples.length) {
    return <p className="text-sm text-slate-300">No samples available yet.</p>;
  }

  const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
      <div className="mb-2 flex items-center justify-between text-sm">
        <p className="font-semibold text-slate-100">{title}</p>
        <p className="text-slate-300">
          Min {min.toFixed(1)} {unit} | Max {max.toFixed(1)} {unit}
        </p>
      </div>
      <div className="mb-2 text-xs text-slate-300">
        <p>
          X-axis: Time (oldest to latest sample) | Y-axis: {title} ({unit})
        </p>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="h-44 w-full"
      >
        <line
          x1={pad}
          y1={height - pad}
          x2={width - pad}
          y2={height - pad}
          stroke="rgba(255,255,255,0.2)"
        />
        <line
          x1={pad}
          y1={pad}
          x2={pad}
          y2={height - pad}
          stroke="rgba(255,255,255,0.2)"
        />
        <polyline
          points={polyline}
          fill="none"
          className={colorClass}
          strokeWidth="3"
          strokeLinecap="round"
        />
        {points.map((point, index) => (
          <g key={`${valueKey}-${index}`}>
            <circle cx={point.x} cy={point.y} r="3.5" fill="white" />
            <title>{`${new Date(point.timestamp).toLocaleTimeString()} - ${point.value.toFixed(1)} ${unit}`}</title>
          </g>
        ))}
      </svg>
    </div>
  );
}

function VitalsTrends() {
  const [samples, setSamples] = useState([]);

  useEffect(() => {
    const loadVitals = async () => {
      try {
        const { data } = await api.get("/api/vitals/mock");
        setSamples(Array.isArray(data.samples) ? data.samples : []);
      } catch {
        setSamples([]);
      }
    };

    loadVitals();
  }, []);

  return (
    <div className="glass rounded-2xl p-6">
      <div className="mb-4 flex items-center gap-2">
        <ActivitySquare className="h-5 w-5 text-mint" />
        <h3 className="text-xl font-bold">Temperature & Pulse Trends</h3>
      </div>
      <p className="mb-4 text-sm text-slate-300">
        Mock device telemetry for dashboard illustration. This will be replaced
        by live hardware streaming.
      </p>

      <div className="grid gap-4">
        <VitalsChart
          title="Body Temperature"
          valueKey="temperatureC"
          unit="F"
          colorClass="stroke-rose-300"
          samples={samples}
        />
        <VitalsChart
          title="Pulse Rate"
          valueKey="pulseBpm"
          unit="bpm"
          colorClass="stroke-sky-300"
          samples={samples}
        />
      </div>
    </div>
  );
}

export default VitalsTrends;
