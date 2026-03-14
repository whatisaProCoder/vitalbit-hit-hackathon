import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  Github,
  Globe,
  Instagram,
  Linkedin,
  LogOut,
  MessageCircle,
  X,
} from "lucide-react";
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
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [voiceAutoStartSignal, setVoiceAutoStartSignal] = useState(0);
  const resultPanelRef = useRef(null);
  const healthChatRef = useRef(null);

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

  const mergeChatAnalysisResult = useCallback((partial) => {
    setResult((previous) => {
      const previousData = previous?.type === "chat-combined" ? previous.data : {};
      return {
        type: "chat-combined",
        data: {
          ...previousData,
          ...partial,
        },
      };
    });
    scrollToResultPanel();
  }, [scrollToResultPanel]);

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
    <div className="aurora-bg relative min-h-screen bg-base text-white">
      <div className="mx-auto w-[92%] max-w-7xl py-8">
        <div className="premium-nav mb-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3 md:px-6">
          <div className="inline-flex items-center gap-2">
            <Activity className="h-5 w-5 text-mint" />
            <span className="font-bold tracking-wide">VitalBit Dashboard</span>
          </div>
          <div className="flex items-center gap-3">
            {user && (
              <Link
                to="/profile"
                className="btn-ghost inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold"
              >
                Profile Settings
              </Link>
            )}
            <Link
              to="/analysis-history"
              className="btn-ghost inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold"
            >
              All Analysis Results
            </Link>
            <Link
              to="/"
              className="btn-ghost inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Landing
            </Link>
            {user && (
              <button
                type="button"
                onClick={handleLogout}
                className="btn-ghost inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            )}
          </div>
        </div>

        <section className="surface-card mb-6 rounded-2xl p-4 md:p-5">
          <p className="section-kicker w-fit">
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
          <section className="surface-card mb-6 rounded-2xl p-4">
            <p className="text-slate-200">
              You are browsing as a guest. Log in to save BMI, chat history, and
              analysis tracking.
            </p>
            <Link
              to="/auth"
              className="btn-primary mt-3 inline-flex rounded-lg px-4 py-2 text-sm font-semibold text-white transition"
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
          <section className="rounded-2xl border border-cyan-200/25 bg-[#0b2742]/80 p-5 md:p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-cyan-200/80">
                  Voice Analysis
                </p>
                <h3 className="mt-1 text-xl font-bold text-white md:text-2xl">
                  Get Health Analysis Using Voice
                </h3>
                <p className="mt-2 max-w-2xl text-slate-300">
                  Open the assistant, record your voice, and get respiratory
                  risk insights plus transcript-based symptom guidance.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!user) {
                    window.location.assign("/auth");
                    return;
                  }

                  const alreadyOpen = isChatOpen;
                  setIsChatOpen(true);

                  if (alreadyOpen && healthChatRef.current?.startVoiceCapture) {
                    healthChatRef.current.startVoiceCapture();
                  } else {
                    setVoiceAutoStartSignal((prev) => prev + 1);
                  }
                }}
                className="btn-primary inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 font-semibold text-white transition"
              >
                <MessageCircle className="h-5 w-5" />
                {user ? "Open Voice Chat" : "Login to Use Voice Chat"}
              </button>
            </div>
          </section>
          <div ref={resultPanelRef} className="scroll-mt-24 md:scroll-mt-28">
            <ResultPanel result={result} loading={loading} />
          </div>
          <BmiTracker user={user} onBmiRecorded={triggerDashboardRefresh} />
          <VitalsTrends user={user} />
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

      <footer className="border-t border-white/10 bg-[#050b14] py-16 md:py-20">
        <div className="mx-auto flex w-[92%] max-w-7xl flex-col gap-10 md:flex-row md:items-start md:gap-20">
          <div className="md:w-[32%]">
            <h4 className="text-2xl font-bold">VitalBit</h4>
            <p className="mt-2 text-slate-300 md:whitespace-nowrap">
              AI-powered early disease detection for rural communities.
            </p>
            <p className="mt-3 text-slate-300">
              Website:{" "}
              <a
                className="underline decoration-white/30 underline-offset-4 hover:text-white"
                href="/"
                target="_blank"
                rel="noreferrer"
              >
                www.vitalbit.com
              </a>
            </p>
            <p className="mt-1 text-slate-300">
              Address: Sector V, Kolkata, West Bengal 700091, India
            </p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-mint/30 px-4 py-2 text-sm text-mint">
              <CheckCircle2 className="h-4 w-4" />
              Production-ready prototype
            </div>
          </div>
          <div className="text-slate-300 md:flex-1">
            <p className="mb-2 text-xs uppercase tracking-[0.18em] text-cyan-200/80">
              Team Info
            </p>
            <p className="mb-1 text-lg font-semibold text-white">
              Team VitalBit
            </p>
            <p className="mt-2">
              Focus: AI triage, voice diagnostics, rural care accessibility.
            </p>
          </div>
          <div className="text-slate-300 md:w-[22%]">
            <p className="mb-2 text-xs uppercase tracking-[0.18em] text-cyan-200/80">
              Socials
            </p>
            <div className="grid gap-2 text-sm">
              <a
                href="#"
                className="inline-flex items-center gap-2 hover:text-white"
              >
                <Linkedin className="h-4 w-4" />
                LinkedIn
              </a>
              <a
                href="#"
                className="inline-flex items-center gap-2 hover:text-white"
              >
                <Globe className="h-4 w-4" />X
              </a>
              <a
                href="#"
                className="inline-flex items-center gap-2 hover:text-white"
              >
                <Github className="h-4 w-4" />
                GitHub
              </a>
              <a
                href="#"
                className="inline-flex items-center gap-2 hover:text-white"
              >
                <Instagram className="h-4 w-4" />
                Instagram
              </a>
            </div>
          </div>
        </div>
      </footer>

      <div className="fixed bottom-6 right-6 z-[1200] flex flex-col items-end gap-3">
        {isChatOpen && (
          <div className="w-[min(92vw,430px)] overflow-hidden rounded-2xl border border-white/20 bg-[#081426]/95 shadow-2xl backdrop-blur transition-all duration-200">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <p className="text-sm font-semibold text-cyan-100">
                VitalBit Chat
              </p>
              <button
                type="button"
                onClick={() => setIsChatOpen(false)}
                className="rounded-md border border-white/20 p-1 text-slate-200 hover:bg-white/10"
                title="Close chat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[78vh] overflow-y-auto p-3">
              <HealthChat
                ref={healthChatRef}
                user={user}
                onMessage={triggerDashboardRefresh}
                onVoiceResult={(next) => {
                  mergeChatAnalysisResult({ voiceAnalysis: next?.data || null });
                  triggerDashboardRefresh();
                }}
                onSymptomResult={(next) => {
                  mergeChatAnalysisResult({ symptomAnalysis: next?.data || null });
                  triggerDashboardRefresh();
                }}
                autoStartRecordingSignal={voiceAutoStartSignal}
                chatOpen={isChatOpen}
              />
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => setIsChatOpen((prev) => !prev)}
          className="btn-primary inline-flex items-center gap-2 rounded-full px-5 py-3 font-semibold text-white shadow-lg transition"
        >
          <MessageCircle className="h-5 w-5" />
          {isChatOpen ? "Close Chat" : "Open Chat"}
        </button>
      </div>
    </div>
  );
}

export default DashboardPage;
