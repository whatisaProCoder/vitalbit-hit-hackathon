import { useRef } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import {
  Activity,
  AlertCircle,
  BarChart3,
  BrainCircuit,
  Building2,
  CheckCircle2,
  Github,
  Globe,
  Instagram,
  Linkedin,
  MapPin,
  MessageSquare,
  Mic,
  Monitor,
  LogOut,
  ServerCog,
  Stethoscope,
  Watch,
} from "lucide-react";
import { clearAuthToken } from "../lib/api";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const featureCards = [
  {
    title: "AI Symptom Checker",
    text: "Semantic disease ranking with profile-age aware scoring for better triage relevance.",
    Icon: BrainCircuit,
  },
  {
    title: "Voice Risk Detection",
    text: "Respiratory risk analysis from voice samples with robust transcription fallbacks.",
    Icon: Mic,
  },
  {
    title: "Health Chat Guidance",
    text: "Conversational guidance with symptom extraction and emergency-aware assistant responses.",
    Icon: MessageSquare,
  },
  {
    title: "Local Hospital Discovery",
    text: "Address or GPS-based care center lookup with recommendation ranking by need and distance.",
    Icon: MapPin,
  },
  {
    title: "Smartwatch Ready",
    text: "Vitals trend pipeline is ready for live hardware streams beyond the current mock telemetry.",
    Icon: Watch,
  },
  {
    title: "Personal Health Timeline",
    text: "Unified history of symptom checks, voice analysis, BMI, and chat context for continuity of care.",
    Icon: BarChart3,
  },
];

const showcaseSteps = [
  {
    step: 1,
    title: "User Input",
    text: "Users enter symptoms or upload voice samples through a simple guided interface.",
  },
  {
    step: 2,
    title: "Data Transmission",
    text: "Frontend securely sends data to Node API gateway for orchestration and validation.",
  },
  {
    step: 3,
    title: "AI Analysis",
    text: "FastAPI service runs symptom similarity search and respiratory risk inference.",
  },
  {
    step: 4,
    title: "Risk Prediction",
    text: "The system computes top disease probabilities with confidence scores.",
  },
  {
    step: 5,
    title: "Health Guidance",
    text: "VitalBit presents actionable follow-up steps and nearest hospital options.",
  },
  {
    step: 6,
    title: "Follow-up Tracking",
    text: "User history and metrics are logged for trend review and smarter future guidance.",
  },
];

const flowGridOrder = [0, 1, 2, 3, 4, 5];
const stepArrowMap = {
  1: "→",
  2: "→",
  3: "↓",
  4: "→",
  5: "→",
  6: "✓",
};

const architectureSteps = [
  { title: "Smartwatch", Icon: Watch },
  { title: "Frontend", Icon: Monitor },
  { title: "Backend", Icon: ServerCog },
  { title: "AI Model", Icon: BrainCircuit },
  { title: "Health Prediction", Icon: Stethoscope },
];

function LandingPage({ user }) {
  const rootRef = useRef(null);

  const handleLogout = () => {
    clearAuthToken();
    window.location.assign("/");
  };

  useGSAP(
    () => {
      gsap.from(".hero-title", {
        y: 80,
        opacity: 0,
        duration: 1,
        ease: "power3.out",
      });

      gsap.from(".hero-sub", {
        y: 30,
        opacity: 0,
        delay: 0.25,
        duration: 0.9,
        ease: "power2.out",
      });

      gsap.utils.toArray(".reveal-section").forEach((section) => {
        gsap.from(section, {
          opacity: 0,
          y: 70,
          duration: 0.9,
          ease: "power2.out",
          scrollTrigger: {
            trigger: section,
            start: "top 80%",
          },
        });
      });

      gsap.from(".problem-card", {
        opacity: 0,
        y: 40,
        stagger: 0.2,
        duration: 0.8,
        ease: "power2.out",
        scrollTrigger: {
          trigger: ".problem-grid",
          start: "top 78%",
        },
      });

      gsap.from(".solution-card", {
        opacity: 0,
        y: 32,
        stagger: 0.18,
        duration: 0.75,
        ease: "power2.out",
        scrollTrigger: {
          trigger: ".solution-grid",
          start: "top 80%",
        },
      });

      gsap.set(".story-card", { opacity: 0.2, y: 55, scale: 0.96 });
      gsap.utils.toArray(".story-card").forEach((card, idx) => {
        gsap.to(card, {
          opacity: 1,
          y: 0,
          scale: 1,
          ease: "power2.out",
          scrollTrigger: {
            trigger: card,
            start: "top 82%",
            end: "top 52%",
            scrub: true,
          },
          delay: idx * 0.02,
        });
      });

      gsap.to(".parallax-shape", {
        yPercent: -20,
        ease: "none",
        scrollTrigger: {
          trigger: "body",
          scrub: true,
        },
      });
    },
    { scope: rootRef },
  );

  return (
    <div ref={rootRef} className="relative overflow-hidden bg-base text-white">
      <div className="parallax-shape pointer-events-none absolute left-0 top-0 h-screen w-full bg-hero-radial opacity-70" />

      <header className="relative mx-auto min-h-screen w-[92%] max-w-7xl overflow-hidden py-10">
        <nav className="mb-20 flex items-center justify-between px-1 py-3 md:px-1">
          <div className="inline-flex items-center gap-2">
            <Activity className="h-5 w-5 text-mint" />
            <span className="font-bold tracking-wide">VitalBit</span>
          </div>
        </nav>

        <div className="relative z-10 flex flex-col justify-center py-10">
          <p className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm text-slate-100">
            <Activity className="h-4 w-4 text-mint" />
            VitalBit Health Intelligence
          </p>
          <h1 className="hero-title max-w-4xl text-5xl font-extrabold leading-tight md:text-7xl">
            AI Health Assistant for{" "}
            <span className="gradient-text">Rural Communities</span>
          </h1>
          <p className="hero-sub mt-8 max-w-2xl text-lg text-slate-200 md:text-xl">
            Detect diseases early with symptom intelligence, voice diagnostics,
            personalized guidance, and instant hospital discovery.
          </p>
          <div className="hero-sub mt-10 flex flex-wrap gap-4">
            {user ? (
              <>
                <Link
                  to="/dashboard"
                  className="rounded-xl bg-sky px-6 py-3 font-semibold text-white transition hover:bg-sky/90"
                >
                  Open Dashboard
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/25 px-6 py-3 font-semibold transition hover:bg-white/10"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/auth?mode=register"
                  className="rounded-xl bg-sky px-6 py-3 font-semibold text-white transition hover:bg-sky/90"
                >
                  Register Now
                </Link>
                <Link
                  to="/auth"
                  className="rounded-xl border border-white/25 px-6 py-3 font-semibold"
                >
                  Login
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="reveal-section relative overflow-hidden grid-noise py-24">
        <div className="pointer-events-none absolute -right-10 top-12 h-56 w-56 rounded-full bg-sky/10 blur-3xl" />
        <div className="mx-auto w-[92%] max-w-7xl">
          <h2 className="text-4xl font-bold md:text-5xl">
            The Rural Healthcare Challenge
          </h2>
          <p className="mt-4 max-w-2xl text-slate-200">
            Millions face delayed diagnosis due to distance, limited
            specialists, and low health awareness.
          </p>
          <div className="problem-grid mt-10 grid gap-4 md:grid-cols-3">
            <article className="problem-card glass rounded-2xl p-6">
              <Building2 className="mb-3 h-6 w-6 text-sky" />
              <h3 className="mb-2 text-2xl font-bold">Limited Access</h3>
              <p className="text-slate-200">
                Remote populations struggle to access hospitals in time.
              </p>
            </article>
            <article className="problem-card glass rounded-2xl p-6">
              <AlertCircle className="mb-3 h-6 w-6 text-sky" />
              <h3 className="mb-2 text-2xl font-bold">Doctor Shortages</h3>
              <p className="text-slate-200">
                Few clinicians are available for large rural coverage areas.
              </p>
            </article>
            <article className="problem-card glass rounded-2xl p-6">
              <BarChart3 className="mb-3 h-6 w-6 text-sky" />
              <h3 className="mb-2 text-2xl font-bold">Lack of Awareness</h3>
              <p className="text-slate-200">
                Symptoms are often ignored until disease progression worsens.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="reveal-section relative overflow-hidden py-24">
        <div className="pointer-events-none absolute right-1/3 top-12 h-56 w-56 rounded-full bg-cyan-300/10 blur-3xl" />
        <div className="mx-auto w-[92%] max-w-7xl">
          <h2 className="text-4xl font-bold md:text-5xl">Our Solution</h2>
          <p className="mt-4 max-w-3xl text-slate-200">
            VitalBit blends on-device capture, AI inference, and local care
            discovery into one practical workflow for early intervention.
          </p>
          <div className="solution-grid mt-10 grid gap-4 md:grid-cols-3">
            <article className="solution-card glass rounded-2xl p-6">
              <BrainCircuit className="mb-3 h-6 w-6 text-sky" />
              <h3 className="mb-2 text-2xl font-bold">AI Symptom Analysis</h3>
              <p className="text-slate-200">
                Hybrid semantic and lexical scoring ranks likely conditions with
                calibrated confidence.
              </p>
            </article>
            <article className="solution-card glass rounded-2xl p-6">
              <Mic className="mb-3 h-6 w-6 text-sky" />
              <h3 className="mb-2 text-2xl font-bold">Voice Detection</h3>
              <p className="text-slate-200">
                Voice risk analysis plus resilient speech-to-text fallback helps
                low-literacy and low-connectivity users.
              </p>
            </article>
            <article className="solution-card glass rounded-2xl p-6">
              <Stethoscope className="mb-3 h-6 w-6 text-sky" />
              <h3 className="mb-2 text-2xl font-bold">Actionable Guidance</h3>
              <p className="text-slate-200">
                Conversational care steps, red-flag prompts, and
                nearest-hospital navigation support timely decisions.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="reveal-section relative overflow-hidden py-24">
        <div className="pointer-events-none absolute -left-10 top-16 h-56 w-56 rounded-full bg-mint/10 blur-3xl" />
        <div className="mx-auto w-[92%] max-w-7xl">
          <h2 className="text-4xl font-bold md:text-5xl">
            System Architecture
          </h2>
          <div className="mt-10 grid gap-4 md:grid-cols-5">
            {architectureSteps.map(({ title, Icon }) => (
              <div key={title} className="glass rounded-2xl p-5 text-center">
                <Icon className="mx-auto mb-3 h-7 w-7 text-sky" />
                <p className="text-lg font-semibold">{title}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="story-wrapper relative overflow-hidden bg-gradient-to-b from-[#0a1e33] via-[#0b2238] to-[#102943] py-24">
        <div className="pointer-events-none absolute right-1/2 top-8 h-64 w-64 translate-x-1/2 rounded-full bg-cyan-300/10 blur-3xl" />
        <div className="mx-auto flex w-[92%] max-w-6xl items-center">
          <div className="w-full">
            <h2 className="mb-8 text-4xl font-bold md:text-5xl">
              Feature Section
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              {featureCards.map(({ title, text, Icon }) => (
                <article
                  key={title}
                  className="story-card glass rounded-2xl p-6"
                >
                  <Icon className="mb-3 h-6 w-6 text-cyan-200" />
                  <h3 className="text-2xl font-bold">{title}</h3>
                  <p className="mt-2 text-slate-200">{text}</p>
                </article>
              ))}
            </div>
            <div className="mt-16 md:mt-20">
              <h3 className="mb-4 text-2xl font-bold">Flow Snapshot</h3>
              <div className="grid gap-4 md:grid-cols-3">
                {flowGridOrder.map((index) => {
                  const step = showcaseSteps[index];
                  return (
                    <article
                      key={step.title}
                      className="story-card glass rounded-2xl p-6"
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <span className="rounded-full border border-cyan-200/40 px-2 py-1 text-xs font-semibold text-cyan-200">
                          Step {step.step}
                        </span>
                        <span className="text-xl font-bold text-cyan-200">
                          {stepArrowMap[step.step]}
                        </span>
                      </div>
                      <h4 className="text-xl font-bold">{step.title}</h4>
                      <p className="mt-2 text-slate-200">{step.text}</p>
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="reveal-section relative overflow-hidden py-20">
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-300/10 blur-3xl" />
        <div className="mx-auto w-[92%] max-w-5xl">
          <div className="glass rounded-3xl border border-cyan-200/20 px-6 py-10 text-center md:px-10 md:py-14">
            <p className="text-sm uppercase tracking-[0.2em] text-cyan-200/80">
              Ready To Deploy
            </p>
            <h2 className="mt-4 text-3xl font-bold leading-tight md:text-5xl">
              Bring AI-powered triage to every rural community
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-slate-200">
              Start with symptom analysis, voice diagnostics, and local care
              guidance in one unified platform.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              {user ? (
                <Link
                  to="/dashboard"
                  className="rounded-xl bg-sky px-6 py-3 font-semibold text-white transition hover:bg-sky/90"
                >
                  Open Dashboard
                </Link>
              ) : (
                <>
                  <Link
                    to="/auth?mode=register"
                    className="rounded-xl bg-sky px-6 py-3 font-semibold text-white transition hover:bg-sky/90"
                  >
                    Register Now
                  </Link>
                  <Link
                    to="/auth"
                    className="rounded-xl border border-white/30 bg-white/5 px-6 py-3 font-semibold text-white transition hover:bg-white/10"
                  >
                    Login
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

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
    </div>
  );
}

export default LandingPage;
