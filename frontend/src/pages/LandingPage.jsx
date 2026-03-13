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
  Monitor,
  ServerCog,
  Stethoscope,
  Watch,
} from "lucide-react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const showcaseSteps = [
  {
    title: "User Input",
    text: "Users enter symptoms or upload voice samples through a simple guided interface.",
  },
  {
    title: "Data Transmission",
    text: "Frontend securely sends data to Node API gateway for orchestration and validation.",
  },
  {
    title: "AI Analysis",
    text: "FastAPI service runs symptom similarity search and respiratory risk inference.",
  },
  {
    title: "Risk Prediction",
    text: "The system computes top disease probabilities with confidence scores.",
  },
  {
    title: "Health Guidance",
    text: "VitalBit presents actionable follow-up steps and nearest hospital options.",
  },
];

const architectureSteps = [
  { title: "Smartwatch", Icon: Watch },
  { title: "Frontend", Icon: Monitor },
  { title: "Backend", Icon: ServerCog },
  { title: "AI Model", Icon: BrainCircuit },
  { title: "Health Prediction", Icon: Stethoscope },
];

function LandingPage({ user }) {
  const rootRef = useRef(null);

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
            <Link
              to="/auth"
              className="rounded-xl bg-sky px-6 py-3 font-semibold text-white transition hover:bg-sky/90"
            >
              {user ? "Open Dashboard" : "Login"}
            </Link>
            <Link
              to="/auth?mode=register"
              className="rounded-xl border border-white/25 px-6 py-3 font-semibold"
            >
              Sign Up
            </Link>
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
              Feature Storytelling
            </h2>
            <div className="grid gap-4">
              {showcaseSteps.map((step) => (
                <article
                  key={step.title}
                  className="story-card glass rounded-2xl p-6"
                >
                  <h3 className="text-2xl font-bold">{step.title}</h3>
                  <p className="mt-2 text-slate-200">{step.text}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 bg-[#050b14] py-10">
        <div className="mx-auto flex w-[92%] max-w-7xl flex-col justify-between gap-5 md:flex-row md:items-center">
          <div>
            <h4 className="text-xl font-bold">VitalBit</h4>
            <p className="text-slate-300">
              AI-powered early disease detection for rural communities.
            </p>
          </div>
          <div className="text-slate-300">
            <p className="mb-1">Team: VitalBit Hackathon Crew</p>
            <p>
              Stack: React, GSAP, Node, PostgreSQL, FastAPI, PyTorch, Librosa
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-mint/30 px-4 py-2 text-sm text-mint">
            <CheckCircle2 className="h-4 w-4" />
            Production-ready prototype
          </div>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
