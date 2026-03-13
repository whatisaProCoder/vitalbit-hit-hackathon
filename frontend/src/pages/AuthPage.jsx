import { useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Activity, ArrowLeft } from "lucide-react";
import AuthPanel from "../components/AuthPanel";

function AuthPage({ user, onAuthChange }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get("mode") === "register" ? "register" : "login";

  useEffect(() => {
    if (user) {
      navigate("/dashboard", { replace: true });
    }
  }, [user, navigate]);

  return (
    <div className="relative min-h-screen bg-base text-white">
      <div className="parallax-shape pointer-events-none absolute left-0 top-0 h-screen w-full bg-hero-radial opacity-70" />
      <div className="relative mx-auto w-[92%] max-w-5xl py-8">
        <div className="mb-10 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2">
            <Activity className="h-5 w-5 text-mint" />
            <span className="font-bold tracking-wide">VitalBit</span>
          </div>
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Landing
          </Link>
        </div>

        <div
          className={`mx-auto ${mode === "register" ? "max-w-3xl" : "max-w-xl"}`}
        >
          <h1 className="mb-3 text-4xl font-extrabold md:text-5xl">
            {mode === "register" ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mb-8 text-slate-200">
            {mode === "register"
              ? "Sign up to unlock personal tracking, BMI history, and AI health chat logs."
              : "Log in to continue to your health dashboard and recent analysis activity."}
          </p>
          <AuthPanel
            user={user}
            initialMode={mode}
            onAuthChange={(nextUser) => {
              onAuthChange(nextUser);
              navigate("/dashboard");
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default AuthPage;
