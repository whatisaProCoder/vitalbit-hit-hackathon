import { useEffect } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const defaultCenter = [22.5726, 88.3639];

const recommendedIcon = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-orange.png",
  iconRetinaUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function RecenterMap({ center }) {
  const map = useMap();

  useEffect(() => {
    if (
      Array.isArray(center) &&
      center.length === 2 &&
      Number.isFinite(center[0]) &&
      Number.isFinite(center[1])
    ) {
      map.setView(center, map.getZoom());
    }
  }, [center, map]);

  return null;
}

function HospitalMap({
  hospitals = [],
  center = defaultCenter,
  recommendedHospitalIds = [],
  userLocation = null,
  onGetMyLocation,
  isLocating = false,
}) {
  const recommendedSet = new Set(recommendedHospitalIds);

  return (
    <div className="glass rounded-2xl p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-xl font-bold">Nearby Hospitals & Clinics</h3>
        <button
          type="button"
          onClick={onGetMyLocation}
          disabled={isLocating}
          className="rounded-lg border border-white/20 px-3 py-2 text-xs font-semibold hover:bg-white/10 disabled:opacity-60"
        >
          {isLocating ? "Locating..." : "Get My Location"}
        </button>
      </div>
      <div className="h-[340px] overflow-hidden rounded-xl border border-white/10">
        <MapContainer center={center} zoom={12} className="h-full w-full">
          <RecenterMap center={center} />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {Array.isArray(userLocation) && userLocation.length === 2 && (
            <Marker position={userLocation}>
              <Popup>
                <strong>You are here</strong>
              </Popup>
            </Marker>
          )}
          {hospitals.map((hospital) => {
            const isRecommended = recommendedSet.has(hospital.id);
            return (
              <Marker
                key={hospital.id}
                position={[hospital.lat, hospital.lon]}
                {...(isRecommended ? { icon: recommendedIcon } : {})}
              >
                <Popup>
                  <strong>{hospital.name}</strong>
                  <br />
                  Contact: {hospital.contact || "Unavailable"}
                  {isRecommended ? (
                    <>
                      <br />
                      <span>Recommended for your prediction</span>
                    </>
                  ) : null}
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
}

export default HospitalMap;
