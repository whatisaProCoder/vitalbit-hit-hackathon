import { useEffect, useState } from "react";
import { Activity, Mic2, MessageSquareText } from "lucide-react";
import api from "../lib/api";

function StatCard({ label, value, icon: Icon }) {
  return (
    <div className="rounded-xl bg-white/5 p-4">
      <div className="mb-2 flex items-center gap-2 text-slate-300">
        <Icon className="h-4 w-4" />
        <span className="text-sm">{label}</span>
      </div>
      <p className="text-2xl font-bold text-mint">{value}</p>
    </div>
  );
}

function DashboardPanel({ user, refreshKey }) {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const run = async () => {
      if (!user) {
        setSummary(null);
        setError("");
        return;
      }
      try {
        setError("");
        const { data } = await api.get("/api/dashboard/summary");
        setSummary(data);
      } catch (err) {
        setError(err.response?.data?.error || "Could not load dashboard");
      }
    };

    run();
  }, [user, refreshKey]);

  return (
    <div className="glass rounded-2xl p-6">
      <h3 className="mb-4 text-xl font-bold">Personal Dashboard</h3>

      {!user && (
        <p className="text-slate-200">
          Login to see your analysis history and trends.
        </p>
      )}
      {error && <p className="text-rose-300">{error}</p>}

      {user && summary && (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <StatCard
              label="Symptom Analyses"
              value={summary.counts.symptomAnalyses}
              icon={Activity}
            />
            <StatCard
              label="Voice Analyses"
              value={summary.counts.voiceAnalyses}
              icon={Mic2}
            />
            <StatCard
              label="Chat Messages"
              value={summary.counts.chatMessages}
              icon={MessageSquareText}
            />
          </div>
          {summary.latestBmi && (
            <div className="rounded-xl bg-white/5 p-4 text-slate-100">
              Latest BMI:{" "}
              <span className="font-bold">
                {Number(summary.latestBmi.metric_value).toFixed(2)}
              </span>
              <span className="ml-2 text-slate-300">
                ({summary.latestBmi.metric_payload?.category || "Unknown"})
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default DashboardPanel;
