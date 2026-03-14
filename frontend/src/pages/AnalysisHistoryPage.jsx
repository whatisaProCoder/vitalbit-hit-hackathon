import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { jsPDF } from "jspdf";
import {
  Activity,
  ArrowLeft,
  ActivitySquare,
  Mic,
  Search,
  Scale,
  MessageSquare,
} from "lucide-react";
import api from "../lib/api";

function SectionCard({ title, icon: Icon, count, children }) {
  return (
    <section className="rounded-2xl border border-white/15 bg-white/5 p-4 md:p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="inline-flex items-center gap-2">
          <Icon className="h-4 w-4 text-mint" />
          <h2 className="text-lg font-semibold">{title}</h2>
        </div>
        <span className="rounded-full border border-white/20 px-3 py-1 text-xs text-slate-300">
          {count} records
        </span>
      </div>
      {children}
    </section>
  );
}

function parseBackendTimestamp(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const raw = String(value).trim();
  if (!raw) return null;

  const hasTimezone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(raw);
  const normalized = hasTimezone ? raw : `${raw}Z`;
  const parsed = new Date(normalized);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

const CLIENT_TIME_ZONE =
  Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

function formatTime(value) {
  const parsed = parseBackendTimestamp(value);
  if (!parsed) return "Unknown time";
  const datePart = parsed.toLocaleDateString(undefined, {
    timeZone: CLIENT_TIME_ZONE,
  });
  const timePart = parsed.toLocaleTimeString(undefined, {
    timeZone: CLIENT_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  return `${datePart}, ${timePart}`;
}

function formatDate(value) {
  const parsed = parseBackendTimestamp(value);
  if (!parsed) return "Unknown date";
  return parsed.toLocaleDateString(undefined, {
    timeZone: CLIENT_TIME_ZONE,
  });
}

function formatClock(value) {
  const parsed = parseBackendTimestamp(value);
  if (!parsed) return "Unknown time";
  return parsed.toLocaleTimeString(undefined, {
    timeZone: CLIENT_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

function dateKeyForClientTz(value) {
  const parsed = parseBackendTimestamp(value);
  if (!parsed) return "";

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CLIENT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(parsed);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) return "";
  return `${year}-${month}-${day}`;
}

function todayDateKey() {
  return dateKeyForClientTz(new Date());
}

function toPercent(value) {
  const num = Number(value || 0);
  return `${Math.round(num * 100)}%`;
}

function renderSymptomSummary(predictionJson) {
  const predictions = Array.isArray(predictionJson?.predictions)
    ? predictionJson.predictions.slice(0, 3)
    : [];

  if (!predictions.length) {
    return (
      <p className="text-sm text-slate-300">Prediction summary unavailable.</p>
    );
  }

  return (
    <div className="mt-2 space-y-2">
      {predictions.map((entry) => (
        <div key={entry.disease} className="rounded-lg bg-black/20 p-2">
          <div className="mb-1 flex items-center justify-between text-sm">
            <p className="font-semibold capitalize text-slate-100">
              {entry.disease}
            </p>
            <p className="text-slate-200">{toPercent(entry.probability)}</p>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full bg-sky"
              style={{ width: toPercent(entry.probability) }}
            />
          </div>
        </div>
      ))}
      <p className="text-xs text-slate-300">
        Model confidence: {toPercent(predictionJson?.confidence)}
      </p>
    </div>
  );
}

function renderVoiceSummary(predictionJson) {
  if (!predictionJson) {
    return (
      <p className="text-sm text-slate-300">Prediction summary unavailable.</p>
    );
  }

  return (
    <div className="mt-2 rounded-lg bg-black/20 p-3">
      <p className="text-xs uppercase tracking-wide text-slate-300">
        Respiratory risk
      </p>
      <p className="text-lg font-semibold capitalize text-mint">
        {String(predictionJson.risk || "unknown").replaceAll("_", " ")}
      </p>
      <p className="text-sm text-slate-300">
        Confidence: {toPercent(predictionJson.confidence)}
      </p>
    </div>
  );
}

function renderBmiChart(records) {
  if (!records.length) return null;

  const ordered = [...records]
    .map((item) => ({
      id: item.id,
      value: parseFloat(item.metric_value),
      created_at: item.created_at,
    }))
    .filter((item) => Number.isFinite(item.value))
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  if (!ordered.length) {
    return (
      <p className="mb-3 text-sm text-slate-300">
        No valid BMI values available for graph.
      </p>
    );
  }

  const width = 720;
  const height = 220;
  const pad = 26;
  const values = ordered.map((item) => item.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = ordered.map((item, index) => {
    const xRatio = ordered.length === 1 ? 0.5 : index / (ordered.length - 1);
    const x = pad + xRatio * (width - pad * 2);
    const y = height - pad - ((item.value - min) / range) * (height - pad * 2);
    return { ...item, x, y };
  });

  const line = points.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <div className="mb-4 rounded-xl border border-white/10 bg-black/20 p-3">
      <div className="mb-2 flex items-center justify-between text-xs text-slate-300">
        <span>BMI trend over time</span>
        <span>
          Min {min.toFixed(2)} | Max {max.toFixed(2)}
        </span>
      </div>
      <p className="mb-2 text-xs text-slate-300">
        X-axis: Time (oldest to latest entry) | Y-axis: BMI value
      </p>
      {ordered.length === 1 && (
        <p className="mb-2 text-xs text-slate-300">
          Only one submission available. Add more BMI entries to show trend
          progression.
        </p>
      )}
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
          points={line}
          fill="none"
          stroke="url(#bmiGradient)"
          strokeWidth="3"
          strokeLinecap="round"
        />
        {points.map((p) => (
          <g key={p.id}>
            <circle cx={p.x} cy={p.y} r="3.5" fill="#5eead4" />
            <title>{`${formatDate(p.created_at)} - BMI ${p.value.toFixed(2)}`}</title>
          </g>
        ))}
        <defs>
          <linearGradient id="bmiGradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#5eead4" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

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

function renderVitalsChart({ title, valueKey, unit, stroke, samples }) {
  if (!samples.length) {
    return <p className="text-sm text-slate-300">No samples available yet.</p>;
  }

  const width = 720;
  const height = 220;
  const pad = 26;
  const { points, min, max } = toPoints(samples, valueKey, width, height, pad);
  const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
      <div className="mb-2 flex items-center justify-between text-xs text-slate-300">
        <span>{title}</span>
        <span>
          Min {min.toFixed(1)} {unit} | Max {max.toFixed(1)} {unit}
        </span>
      </div>
      <p className="mb-2 text-xs text-slate-300">
        X-axis: Time (oldest to latest sample) | Y-axis: {title} ({unit})
      </p>
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
          stroke={stroke}
          strokeWidth="3"
          strokeLinecap="round"
        />
        {points.map((point, index) => (
          <g key={`${valueKey}-${index}`}>
            <circle cx={point.x} cy={point.y} r="3.5" fill="#ffffff" />
            <title>{`${formatClock(point.timestamp)} - ${point.value.toFixed(1)} ${unit}`}</title>
          </g>
        ))}
      </svg>
    </div>
  );
}

function AnalysisHistoryPage({ user }) {
  const [history, setHistory] = useState({
    symptoms: [],
    voice: [],
    bmi: [],
    chat: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [vitalsSamples, setVitalsSamples] = useState([]);
  const [selectedDay, setSelectedDay] = useState(todayDateKey());
  const [pdfStatus, setPdfStatus] = useState("");

  useEffect(() => {
    const run = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");
        const { data } = await api.get("/api/dashboard/history");
        setHistory({
          symptoms: data.symptoms || [],
          voice: data.voice || [],
          bmi: data.bmi || [],
          chat: data.chat || [],
        });

        try {
          const { data: vitalsData } = await api.get("/api/vitals/mock");
          setVitalsSamples(
            Array.isArray(vitalsData.samples) ? vitalsData.samples : [],
          );
        } catch {
          setVitalsSamples([]);
        }
      } catch (err) {
        setError(
          err.response?.data?.error || "Could not load analysis history",
        );
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [user]);

  const downloadDayPdf = () => {
    if (!selectedDay) {
      setPdfStatus("Please choose a date first.");
      return;
    }

    const isSameDay = (value) => dateKeyForClientTz(value) === selectedDay;

    const daySymptoms = history.symptoms.filter((item) => isSameDay(item.created_at));
    const dayVoice = history.voice.filter((item) => isSameDay(item.created_at));
    const dayBmi = history.bmi.filter((item) => isSameDay(item.created_at));
    const dayChat = history.chat.filter((item) => isSameDay(item.created_at));
    const dayVitals = vitalsSamples.filter((item) => isSameDay(item.timestamp));

    const totalCount =
      daySymptoms.length +
      dayVoice.length +
      dayBmi.length +
      dayChat.length +
      dayVitals.length;

    if (totalCount === 0) {
      setPdfStatus("No analyses found for the selected day.");
      return;
    }

    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginX = 40;
    const maxTextWidth = pageWidth - marginX * 2;
    let y = 44;

    const ensureSpace = (requiredHeight = 22) => {
      if (y + requiredHeight > pageHeight - 36) {
        doc.addPage();
        y = 44;
      }
    };

    const addLine = (text, options = {}) => {
      const { size = 10, indent = 0, bold = false } = options;
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.setFontSize(size);

      const lines = doc.splitTextToSize(
        String(text || ""),
        maxTextWidth - indent,
      );
      const blockHeight = lines.length * (size + 2) + 2;
      ensureSpace(blockHeight);
      doc.text(lines, marginX + indent, y);
      y += blockHeight;
    };

    const addSectionTitle = (title) => {
      ensureSpace(24);
      y += 4;
      addLine(title, { size: 12, bold: true });
    };

    const addEmptySection = () => {
      addLine("No records for this day.", { size: 10, indent: 12 });
    };

    addLine("VitalBit - Daily Analysis Report", { size: 16, bold: true });
    addLine(`Date: ${selectedDay}`, { size: 11 });
    addLine(`Client timezone: ${CLIENT_TIME_ZONE}`, { size: 10 });
    addLine(`Total records: ${totalCount}`, { size: 10 });

    addSectionTitle(`Symptom Analyses (${daySymptoms.length})`);
    if (!daySymptoms.length) {
      addEmptySection();
    } else {
      daySymptoms.forEach((item, index) => {
        addLine(
          `${index + 1}. ${formatTime(item.created_at)} | Symptoms: ${item.symptoms_text}`,
          { indent: 12 },
        );
        const topPrediction = item.prediction_json?.predictions?.[0];
        if (topPrediction) {
          addLine(
            `Top prediction: ${topPrediction.disease} (${toPercent(topPrediction.probability)})`,
            { indent: 24 },
          );
        }
        addLine(
          `Confidence: ${toPercent(item.prediction_json?.confidence)}`,
          { indent: 24 },
        );
      });
    }

    addSectionTitle(`Voice Analyses (${dayVoice.length})`);
    if (!dayVoice.length) {
      addEmptySection();
    } else {
      dayVoice.forEach((item, index) => {
        addLine(`${index + 1}. ${formatTime(item.created_at)}`, { indent: 12 });
        addLine(
          `Risk: ${String(item.prediction_json?.risk || "unknown").replaceAll("_", " ")}`,
          { indent: 24 },
        );
        addLine(
          `Confidence: ${toPercent(item.prediction_json?.confidence)}`,
          { indent: 24 },
        );
      });
    }

    addSectionTitle(`BMI Records (${dayBmi.length})`);
    if (!dayBmi.length) {
      addEmptySection();
    } else {
      dayBmi.forEach((item, index) => {
        addLine(
          `${index + 1}. ${formatTime(item.created_at)} | BMI ${Number(item.metric_value).toFixed(2)} | ${item.metric_payload?.category || "Unknown"}`,
          { indent: 12 },
        );
      });
    }

    addSectionTitle(`Temperature & Pulse Samples (${dayVitals.length})`);
    if (!dayVitals.length) {
      addEmptySection();
    } else {
      dayVitals.forEach((item, index) => {
        addLine(
          `${index + 1}. ${formatTime(item.timestamp)} | Temp ${Number(item.temperatureC).toFixed(1)} | Pulse ${Number(item.pulseBpm).toFixed(0)} bpm`,
          { indent: 12 },
        );
      });
    }

    addSectionTitle(`Chat Records (${dayChat.length})`);
    if (!dayChat.length) {
      addEmptySection();
    } else {
      dayChat.forEach((item, index) => {
        addLine(
          `${index + 1}. ${formatTime(item.created_at)} | ${item.role}`,
          { indent: 12 },
        );
        addLine(item.message, { indent: 24 });
      });
    }

    doc.save(`vitalbit-analysis-${selectedDay}.pdf`);
    setPdfStatus(`Downloaded daily PDF for ${selectedDay}.`);
  };

  return (
    <div className="relative min-h-screen bg-base pb-16 text-white">
      <div className="mx-auto w-[92%] max-w-7xl py-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/15 bg-white/5 px-4 py-3 backdrop-blur md:px-6">
          <div className="inline-flex items-center gap-2">
            <Activity className="h-5 w-5 text-mint" />
            <span className="font-bold tracking-wide">Analysis History</span>
          </div>
          <div className="flex items-center gap-3">
            {user && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-white/15 bg-black/20 px-2 py-2">
                <input
                  type="date"
                  value={selectedDay}
                  onChange={(e) => {
                    setSelectedDay(e.target.value);
                    setPdfStatus("");
                  }}
                  className="rounded-md border border-white/20 bg-white/5 px-2 py-1 text-xs text-white"
                />
                <button
                  type="button"
                  onClick={downloadDayPdf}
                  className="rounded-md bg-mint px-3 py-1 text-xs font-semibold text-black transition hover:opacity-90"
                >
                  Download Day PDF
                </button>
              </div>
            )}
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold hover:bg-white/10"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Link>
          </div>
        </div>

        {!user && (
          <section className="mb-6 rounded-2xl border border-white/15 bg-white/5 p-4">
            <p className="text-slate-200">
              Login required to view your full analysis records till date.
            </p>
            <Link
              to="/auth"
              className="mt-3 inline-flex rounded-lg bg-sky px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky/90"
            >
              Login or Sign Up
            </Link>
          </section>
        )}

        {user && (
          <>
            {!!pdfStatus && (
              <section className="mb-4 rounded-2xl border border-mint/35 bg-mint/10 p-3 text-sm text-mint">
                {pdfStatus}
              </section>
            )}
            <section className="mb-6 rounded-2xl border border-white/15 bg-white/5 p-4 md:p-5">
              <p className="text-sm uppercase tracking-[0.14em] text-slate-300">
                History Timeline
              </p>
              <h1 className="mt-1 text-2xl font-bold md:text-3xl">
                All analyses and results till date
              </h1>
              <p className="mt-2 text-slate-300">
                View every symptom prediction, voice risk report, BMI entry, and
                chat record linked to your account.
              </p>
            </section>

            {loading && (
              <section className="rounded-2xl border border-white/15 bg-white/5 p-4 text-slate-200">
                Loading history...
              </section>
            )}

            {error && (
              <section className="rounded-2xl border border-rose-400/35 bg-rose-500/10 p-4 text-rose-200">
                {error}
              </section>
            )}

            {!loading && !error && (
              <div className="grid gap-4">
                <SectionCard
                  title="Symptom Analyses"
                  icon={Search}
                  count={history.symptoms.length}
                >
                  {history.symptoms.length === 0 && (
                    <p className="text-slate-300">
                      No symptom analysis records yet.
                    </p>
                  )}
                  <div className="space-y-3">
                    {history.symptoms.map((item) => (
                      <article
                        key={item.id}
                        className="rounded-xl bg-white/5 p-3"
                      >
                        <p className="text-sm text-slate-300">
                          {formatTime(item.created_at)}
                        </p>
                        <p className="mt-1 text-slate-100">
                          Symptoms: {item.symptoms_text}
                        </p>
                        {renderSymptomSummary(item.prediction_json)}
                      </article>
                    ))}
                  </div>
                </SectionCard>

                <SectionCard
                  title="Voice Analyses"
                  icon={Mic}
                  count={history.voice.length}
                >
                  {history.voice.length === 0 && (
                    <p className="text-slate-300">
                      No voice analysis records yet.
                    </p>
                  )}
                  <div className="space-y-3">
                    {history.voice.map((item) => (
                      <article
                        key={item.id}
                        className="rounded-xl bg-white/5 p-3"
                      >
                        <p className="text-sm text-slate-300">
                          {formatTime(item.created_at)}
                        </p>
                        <p className="mt-1 text-slate-100">
                          Voice sample submitted
                        </p>
                        {renderVoiceSummary(item.prediction_json)}
                      </article>
                    ))}
                  </div>
                </SectionCard>

                <SectionCard
                  title="BMI Records"
                  icon={Scale}
                  count={history.bmi.length}
                >
                  {history.bmi.length === 0 && (
                    <p className="text-slate-300">No BMI records yet.</p>
                  )}
                  {history.bmi.length > 0 && renderBmiChart(history.bmi)}
                  <div className="space-y-3">
                    {history.bmi.map((item) => (
                      <article
                        key={item.id}
                        className="rounded-xl bg-white/5 p-3"
                      >
                        <p className="text-sm text-slate-300">
                          {formatTime(item.created_at)}
                        </p>
                        <p className="mt-1 text-slate-100">
                          BMI: {Number(item.metric_value).toFixed(2)}
                        </p>
                        <p className="text-sm text-slate-200">
                          Category: {item.metric_payload?.category || "Unknown"}
                        </p>
                      </article>
                    ))}
                  </div>
                </SectionCard>

                <SectionCard
                  title="Temperature & Pulse Trends"
                  icon={ActivitySquare}
                  count={vitalsSamples.length}
                >
                  {vitalsSamples.length === 0 ? (
                    <p className="text-slate-300">
                      No vitals trend samples yet.
                    </p>
                  ) : (
                    <div className="grid gap-4">
                      {renderVitalsChart({
                        title: "Body Temperature",
                        valueKey: "temperatureC",
                        unit: "F",
                        stroke: "#fda4af",
                        samples: vitalsSamples,
                      })}
                      {renderVitalsChart({
                        title: "Pulse Rate",
                        valueKey: "pulseBpm",
                        unit: "bpm",
                        stroke: "#7dd3fc",
                        samples: vitalsSamples,
                      })}
                    </div>
                  )}
                </SectionCard>

                <SectionCard
                  title="Chat Records"
                  icon={MessageSquare}
                  count={history.chat.length}
                >
                  {history.chat.length === 0 && (
                    <p className="text-slate-300">No chat records yet.</p>
                  )}
                  <div className="space-y-3">
                    {history.chat.map((item) => (
                      <article
                        key={item.id}
                        className="rounded-xl bg-white/5 p-3"
                      >
                        <p className="text-sm text-slate-300">
                          {formatTime(item.created_at)}
                        </p>
                        <p className="text-xs uppercase text-slate-400">
                          {item.role}
                        </p>
                        <p className="mt-1 text-slate-100">{item.message}</p>
                      </article>
                    ))}
                  </div>
                </SectionCard>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default AnalysisHistoryPage;
