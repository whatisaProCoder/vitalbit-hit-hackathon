import { Zap } from "lucide-react";

function ResultPanel({ result, loading }) {
  return (
    <div className="glass rounded-2xl p-6">
      <div className="mb-3 flex items-center gap-2">
        <Zap className="h-5 w-5 text-yellow-300" />
        <h3 className="text-xl font-bold">Prediction Results</h3>
      </div>

      {loading && (
        <p className="text-cyan-200">Analyzing with VitalBit AI models...</p>
      )}

      {!loading && !result && (
        <p className="text-slate-200">
          Run symptom analysis or voice diagnostics to view predictions.
        </p>
      )}

      {!loading && result?.data?.error && (
        <p className="text-rose-300">{result.data.error}</p>
      )}

      {!loading && result?.type === "symptom" && result?.data?.predictions && (
        <div className="space-y-3">
          {result.data.predictions.map((item) => (
            <div key={item.disease} className="rounded-xl bg-white/5 p-3">
              <div className="mb-1 flex items-center justify-between">
                <p className="font-semibold capitalize">{item.disease}</p>
                <p className="text-sm text-slate-300">
                  {Math.round(item.probability * 100)}%
                </p>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full bg-sky"
                  style={{ width: `${Math.round(item.probability * 100)}%` }}
                />
              </div>
            </div>
          ))}
          <p className="text-sm text-slate-300">
            Confidence: {Math.round((result.data.confidence || 0) * 100)}%
          </p>
        </div>
      )}

      {!loading && result?.type === "voice" && result?.data?.risk && (
        <div className="rounded-xl bg-white/5 p-4">
          <p className="mb-1 text-sm uppercase tracking-wide text-slate-300">
            Respiratory Risk
          </p>
          <p className="text-2xl font-bold capitalize text-mint">
            {result.data.risk.replace("_", " ")}
          </p>
          <p className="mt-2 text-slate-200">
            Confidence: {Math.round((result.data.confidence || 0) * 100)}%
          </p>
        </div>
      )}
    </div>
  );
}

export default ResultPanel;
