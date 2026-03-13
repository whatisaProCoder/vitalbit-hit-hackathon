import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, ArrowLeft, LogOut } from "lucide-react";
import DashboardPanel from "../components/DashboardPanel";
import SymptomChecker from "../components/SymptomChecker";
import ResultPanel from "../components/ResultPanel";
import BmiTracker from "../components/BmiTracker";
import HealthChat from "../components/HealthChat";
import VitalsTrends from "../components/VitalsTrends";
import HospitalMap from "../components/HospitalMap";
import RecommendedHospitals from "../components/RecommendedHospitals";
import api, { clearAuthToken } from "../lib/api";

const defaultCenter = [22.5726, 88.3639];

const careProfiles = {
  flu: {
    label: "General Medicine",
    keywords: ["general", "community", "clinic", "medicine"],
  },
  covid: {
    label: "Pulmonary & Infectious Care",
    keywords: ["respiratory", "pulmonary", "infectious", "chest"],
  },
  asthma: {
    label: "Pulmonology",
    keywords: ["pulmonary", "chest", "respiratory", "lung"],
  },
  tuberculosis: {
    label: "Infectious Disease",
    keywords: ["infectious", "tb", "chest", "pulmonary"],
  },
  malaria: {
    label: "Infectious Disease",
    keywords: ["infectious", "fever", "medicine"],
  },
  dengue: {
    label: "Emergency & Internal Medicine",
    keywords: ["emergency", "medicine", "critical"],
  },
  pneumonia: {
    label: "Pulmonary / Critical Care",
    keywords: ["pulmonary", "critical", "respiratory", "chest"],
  },
  bronchitis: {
    label: "Pulmonary Care",
    keywords: ["pulmonary", "respiratory", "chest"],
  },
  anemia: {
    label: "Internal Medicine",
    keywords: ["medicine", "hematology", "internal"],
  },
  dehydration: {
    label: "General / Emergency Care",
    keywords: ["emergency", "general", "clinic"],
  },
};

const toRad = (value) => (value * Math.PI) / 180;
const distanceKm = (lat1, lon1, lat2, lon2) => {
  const r = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return r * c;
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function DashboardPage({ user }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [hospitals, setHospitals] = useState([]);
  const [mapCenter, setMapCenter] = useState(defaultCenter);
  const [userLocation, setUserLocation] = useState(null);
  const [isLocating, setIsLocating] = useState(false);
  const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0);
  const resultPanelRef = useRef(null);

  const triggerDashboardRefresh = () => {
    setDashboardRefreshKey((prev) => prev + 1);
  };

  const scrollToResultPanel = useCallback(() => {
    requestAnimationFrame(() => {
      resultPanelRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }, []);

  const fetchHospitalsByCoords = useCallback(async (lat, lon) => {
    try {
      const { data } = await api.get("/api/hospitals", {
        params: { lat, lon },
      });
      setHospitals(data.hospitals || []);
      if (data.center?.lat && data.center?.lon) {
        setMapCenter([Number(data.center.lat), Number(data.center.lon)]);
      } else {
        setMapCenter([lat, lon]);
      }
    } catch {
      setHospitals([]);
      setMapCenter([lat, lon]);
    }
  }, []);

  const fetchHospitalsByAddress = useCallback(async (address) => {
    try {
      const { data } = await api.get("/api/hospitals", {
        params: { address },
      });
      setHospitals(data.hospitals || []);
      if (data.center?.lat && data.center?.lon) {
        setMapCenter([Number(data.center.lat), Number(data.center.lon)]);
      }
    } catch {
      setHospitals([]);
    }
  }, []);

  const handleGetMyLocation = useCallback(() => {
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        setUserLocation([lat, lon]);
        fetchHospitalsByCoords(lat, lon).finally(() => setIsLocating(false));
      },
      () => {
        setIsLocating(false);
      },
    );
  }, [fetchHospitalsByCoords]);

  useEffect(() => {
    if (user?.address) {
      fetchHospitalsByAddress(user.address);
      return;
    }

    fetchHospitalsByCoords(defaultCenter[0], defaultCenter[1]);
  }, [user, fetchHospitalsByAddress, fetchHospitalsByCoords]);

  const recommendedHospitals = useMemo(() => {
    if (!hospitals.length || !result?.data) return [];

    const predictions =
      result.type === "symptom" && Array.isArray(result.data.predictions)
        ? result.data.predictions
        : [];

    const topDisease = predictions[0]?.disease;
    const diseaseProfile = careProfiles[topDisease] || {
      label: "General Healthcare",
      keywords: ["hospital", "clinic", "medical"],
    };

    return hospitals
      .map((hospital) => {
        const dist = distanceKm(
          mapCenter[0],
          mapCenter[1],
          hospital.lat,
          hospital.lon,
        );
        const proximityScore = 1 / (1 + dist);
        const name = String(hospital.name || "").toLowerCase();
        const keywordHits = diseaseProfile.keywords.filter((kw) =>
          name.includes(kw),
        ).length;
        const keywordScore = diseaseProfile.keywords.length
          ? keywordHits / diseaseProfile.keywords.length
          : 0;

        const score = 0.65 * proximityScore + 0.35 * keywordScore;
        return {
          ...hospital,
          distanceKm: dist,
          rankScore: score,
          recommendationReason: `Recommended for ${diseaseProfile.label} support based on prediction trend.`,
          mapLink: `https://www.openstreetmap.org/?mlat=${hospital.lat}&mlon=${hospital.lon}#map=16/${hospital.lat}/${hospital.lon}`,
          directionsLink: `https://www.google.com/maps/search/?api=1&query=${hospital.lat},${hospital.lon}`,
        };
      })
      .sort((a, b) => b.rankScore - a.rankScore)
      .slice(0, 3)
      .map((item) => ({
        ...item,
        distanceKm: clamp(item.distanceKm, 0, 999),
      }));
  }, [hospitals, mapCenter, result]);

  const recommendedIds = useMemo(
    () => recommendedHospitals.map((item) => item.id),
    [recommendedHospitals],
  );

  const handleLogout = () => {
    clearAuthToken();
    window.location.assign("/");
  };

  return (
    <div className="relative min-h-screen bg-base pb-16 text-white">
      <div className="mx-auto w-[92%] max-w-7xl py-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/15 bg-white/5 px-4 py-3 backdrop-blur md:px-6">
          <div className="inline-flex items-center gap-2">
            <Activity className="h-5 w-5 text-mint" />
            <span className="font-bold tracking-wide">VitalBit Dashboard</span>
          </div>
          <div className="flex items-center gap-3">
            {user && (
              <Link
                to="/profile"
                className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold hover:bg-white/10"
              >
                Profile Settings
              </Link>
            )}
            <Link
              to="/analysis-history"
              className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold hover:bg-white/10"
            >
              All Analysis Results
            </Link>
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold hover:bg-white/10"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Landing
            </Link>
            {user && (
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold hover:bg-white/10"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            )}
          </div>
        </div>

        <section className="mb-6 rounded-2xl border border-white/15 bg-white/5 p-4 md:p-5">
          <p className="text-sm uppercase tracking-[0.14em] text-slate-300">
            Welcome
          </p>
          <h1 className="mt-1 text-2xl font-bold text-white md:text-3xl">
            {user?.name
              ? `Welcome, ${user.name}`
              : "Welcome to your health dashboard"}
          </h1>
          <p className="mt-2 text-slate-300">
            Track symptom analysis, voice diagnostics, BMI, and care
            recommendations in one place.
          </p>
        </section>

        {!user && (
          <section className="mb-6 rounded-2xl border border-white/15 bg-white/5 p-4">
            <p className="text-slate-200">
              You are browsing as a guest. Log in to save BMI, chat history, and
              analysis tracking.
            </p>
            <Link
              to="/auth"
              className="mt-3 inline-flex rounded-lg bg-sky px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky/90"
            >
              Login or Sign Up
            </Link>
          </section>
        )}

        <section className="mb-6">
          <DashboardPanel user={user} refreshKey={dashboardRefreshKey} />
        </section>

        <section id="demo" className="mb-6 grid gap-4">
          <SymptomChecker
            onResult={(next) => {
              setResult(next);
              triggerDashboardRefresh();
              scrollToResultPanel();
            }}
            setLoading={setLoading}
          />
          <HealthChat
            user={user}
            onMessage={triggerDashboardRefresh}
            onVoiceResult={(next) => {
              setResult(next);
              triggerDashboardRefresh();
            }}
            onSymptomResult={(next) => {
              setResult(next);
              triggerDashboardRefresh();
            }}
          />
          <div ref={resultPanelRef} className="scroll-mt-24 md:scroll-mt-28">
            <ResultPanel result={result} loading={loading} />
          </div>
          <BmiTracker user={user} onBmiRecorded={triggerDashboardRefresh} />
          <VitalsTrends />
        </section>

        <section className="grid gap-4">
          <HospitalMap
            hospitals={hospitals}
            center={mapCenter}
            recommendedHospitalIds={recommendedIds}
            userLocation={userLocation}
            onGetMyLocation={handleGetMyLocation}
            isLocating={isLocating}
          />
          <RecommendedHospitals recommendations={recommendedHospitals} />
        </section>
      </div>
    </div>
  );
}

export default DashboardPage;
