import { ExternalLink, MapPin, Navigation } from "lucide-react";

function RecommendedHospitals({ recommendations = [] }) {
  if (!recommendations.length) {
    return (
      <div className="glass rounded-2xl p-6">
        <h3 className="mb-3 text-xl font-bold">Recommended Hospitals</h3>
        <p className="text-slate-200">
          Run symptom analysis to get disease-aware hospital recommendations.
        </p>
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl p-6">
      <h3 className="mb-4 text-xl font-bold">Recommended Hospitals</h3>
      <div className="space-y-3">
        {recommendations.map((hospital, idx) => (
          <article
            key={hospital.id}
            className="rounded-xl border border-white/10 bg-white/5 p-4"
          >
            <div className="mb-2 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-cyan-200">
                  Recommendation #{idx + 1}
                </p>
                <h4 className="text-lg font-semibold">{hospital.name}</h4>
                <p className="text-sm text-slate-300">
                  {hospital.recommendationReason}
                </p>
              </div>
              <span className="rounded-full bg-sky/20 px-3 py-1 text-xs text-sky-100">
                {(hospital.distanceKm || 0).toFixed(1)} km
              </span>
            </div>

            <div className="flex flex-wrap gap-3 text-sm">
              <a
                href={hospital.mapLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-3 py-2 text-slate-100 hover:bg-white/20"
              >
                <MapPin className="h-4 w-4" />
                OpenStreetMap Link
                <ExternalLink className="h-4 w-4" />
              </a>
              <a
                href={hospital.directionsLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-3 py-2 text-slate-100 hover:bg-white/20"
              >
                <Navigation className="h-4 w-4" />
                Get Directions
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

export default RecommendedHospitals;
