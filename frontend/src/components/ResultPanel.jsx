import { MapPinned, Zap } from "lucide-react";

function ResultPanel({ result, loading }) {
  const openMapsForTest = (testName, whereList = []) => {
    const locationHint = Array.isArray(whereList) && whereList.length
      ? whereList[0]
      : "diagnostic center";
    const query = `${testName} ${locationHint} near me`;
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
    window.open(mapsUrl, "_blank", "noopener,noreferrer");
  };

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
              {!!item.recommendedTests?.length && (
                <div className="mt-3 space-y-2 rounded-lg border border-white/10 bg-black/20 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">
                    Suggested Tests
                  </p>
                  {item.recommendedTests.map((testItem) => (
                    <div key={`${item.disease}-${testItem.test}`} className="rounded-md bg-white/5 p-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-slate-100">{testItem.test}</p>
                        {!testItem.doctorApprovalRequired && (
                          <button
                            type="button"
                            onClick={() =>
                              openMapsForTest(
                                testItem.test,
                                testItem.whereWithoutDoctorApproval,
                              )
                            }
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-emerald-300/40 bg-emerald-500/10 text-emerald-200 transition hover:bg-emerald-500/20"
                            title="Find top nearby centers on Google Maps"
                            aria-label={`Find centers for ${testItem.test} on Google Maps`}
                          >
                            <MapPinned className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                      {testItem.doctorApprovalRequired ? (
                        <p className="mt-1 text-xs text-amber-300">
                          Doctor approval is needed before this test.
                        </p>
                      ) : (
                        <>
                          <p className="mt-1 text-xs text-emerald-300">
                            No doctor approval required.
                          </p>
                          {!!testItem.whereWithoutDoctorApproval?.length && (
                            <p className="mt-1 text-xs text-slate-300">
                              Available at: {testItem.whereWithoutDoctorApproval.join(", ")}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          <p className="text-sm text-slate-300">
            Confidence: {Math.round((result.data.confidence || 0) * 100)}%
          </p>
          {!!result.data.testsRequiringDoctorApproval?.length && (
            <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-100">
              <p className="font-semibold">Doctor approval required for:</p>
              <p>
                {result.data.testsRequiringDoctorApproval
                  .map((testItem) => testItem.test)
                  .join(", ")}
              </p>
            </div>
          )}
          {!!result.data.testsWithoutDoctorApproval?.length && (
            <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">
              <p className="font-semibold">Tests available without doctor approval:</p>
              <p>
                {result.data.testsWithoutDoctorApproval
                  .map((testItem) => testItem.test)
                  .join(", ")}
              </p>
            </div>
          )}
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
