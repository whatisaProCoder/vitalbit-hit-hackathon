import { useEffect, useState } from "react";
import { LogIn, UserPlus } from "lucide-react";
import api, { setAuthToken, clearAuthToken } from "../lib/api";

function AuthPanel({ user, onAuthChange, initialMode = "login" }) {
  const safeMode = initialMode === "register" ? "register" : "login";
  const [mode, setMode] = useState(safeMode);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    password: "",
    age: "",
    gender: "",
    address: "",
    postalCode: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setMode(safeMode);
  }, [safeMode]);

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const submit = async () => {
    try {
      setLoading(true);
      setError("");

      if (mode === "register" && String(form.age).trim() === "") {
        setError("Age is required");
        setLoading(false);
        return;
      }

      if (
        mode === "register" &&
        [
          form.name,
          form.password,
          form.gender,
          form.phone,
          form.address,
          form.postalCode,
        ].some((value) => String(value || "").trim() === "")
      ) {
        setError("Please complete all signup profile fields");
        setLoading(false);
        return;
      }

      const endpoint =
        mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const payload =
        mode === "login"
          ? { phone: form.phone.trim(), password: form.password }
          : {
              name: form.name.trim(),
              phone: form.phone.trim(),
              password: form.password,
              age: Number(form.age),
              gender: form.gender,
              address: form.address.trim(),
              postalCode: form.postalCode.trim(),
            };

      const { data } = await api.post(endpoint, payload);
      setAuthToken(data.token);
      onAuthChange(data.user);
      setForm({
        name: "",
        phone: "",
        password: "",
        age: "",
        gender: "",
        address: "",
        postalCode: "",
      });
    } catch (err) {
      const apiError = err.response?.data;
      if (apiError?.details) {
        setError(
          `${apiError.error || "Authentication failed"}: ${apiError.details}`,
        );
      } else {
        setError(apiError?.error || "Authentication failed");
      }
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    clearAuthToken();
    onAuthChange(null);
  };

  return (
    <div className="glass rounded-2xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-xl font-bold">Account</h3>
        {user ? (
          <button
            type="button"
            onClick={logout}
            className="rounded-lg border border-white/20 px-3 py-2 text-sm hover:bg-white/10"
          >
            Logout
          </button>
        ) : (
          <div className="inline-flex rounded-lg border border-white/20 p-1 text-sm">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`rounded-md px-3 py-1 ${mode === "login" ? "bg-sky/30" : ""}`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => setMode("register")}
              className={`rounded-md px-3 py-1 ${mode === "register" ? "bg-sky/30" : ""}`}
            >
              Register
            </button>
          </div>
        )}
      </div>

      {user ? (
        <div className="rounded-xl bg-white/5 p-4">
          <p className="text-slate-300">Logged in as</p>
          <p className="text-lg font-semibold">{user.name}</p>
          <p className="text-sm text-slate-300">Phone: {user.phone}</p>
          {user.age !== undefined && user.age !== null && (
            <p className="text-sm text-slate-300">Age: {user.age}</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {mode === "register" && (
            <div className="grid gap-3 md:grid-cols-2">
              <input
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                placeholder="Full name"
                className="w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 outline-none focus:border-sky"
              />
              <input
                value={form.age}
                onChange={(e) => updateField("age", e.target.value)}
                placeholder="Age"
                type="number"
                min="0"
                max="120"
                className="w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 outline-none focus:border-sky"
              />
              <select
                value={form.gender}
                onChange={(e) => updateField("gender", e.target.value)}
                className="w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-slate-100 outline-none focus:border-sky"
              >
                <option className="bg-slate-900 text-white" value="" disabled>
                  Gender
                </option>
                <option className="bg-slate-900 text-white" value="female">
                  Female
                </option>
                <option className="bg-slate-900 text-white" value="male">
                  Male
                </option>
                <option className="bg-slate-900 text-white" value="non-binary">
                  Non-binary
                </option>
                <option
                  className="bg-slate-900 text-white"
                  value="prefer-not-to-say"
                >
                  Prefer not to say
                </option>
              </select>
              <input
                value={form.phone}
                onChange={(e) => updateField("phone", e.target.value)}
                placeholder="Phone"
                type="tel"
                className="w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 outline-none focus:border-sky"
              />
              <input
                value={form.address}
                onChange={(e) => updateField("address", e.target.value)}
                placeholder="Address"
                className="w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 outline-none focus:border-sky md:col-span-2"
              />
              <input
                value={form.postalCode}
                onChange={(e) => updateField("postalCode", e.target.value)}
                placeholder="Postal code"
                className="w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 outline-none focus:border-sky md:col-span-2"
              />
            </div>
          )}
          {mode === "login" && (
            <input
              value={form.phone}
              onChange={(e) => updateField("phone", e.target.value)}
              placeholder="Phone"
              type="tel"
              className="w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 outline-none focus:border-sky"
            />
          )}
          <input
            value={form.password}
            onChange={(e) => updateField("password", e.target.value)}
            placeholder="Password"
            type="password"
            className="w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 outline-none focus:border-sky"
          />
          {error && <p className="text-sm text-rose-300">{error}</p>}
          <button
            type="button"
            disabled={loading}
            onClick={submit}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-sky px-4 py-2 font-semibold text-white transition hover:bg-sky/90 disabled:opacity-60"
          >
            {mode === "login" ? (
              <LogIn className="h-4 w-4" />
            ) : (
              <UserPlus className="h-4 w-4" />
            )}
            {loading
              ? "Please wait..."
              : mode === "login"
                ? "Login"
                : "Create Account"}
          </button>
        </div>
      )}
    </div>
  );
}

export default AuthPanel;
