import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, ArrowLeft, Save } from "lucide-react";
import api, { setAuthToken } from "../lib/api";

const initialForm = {
  name: "",
  age: "",
  gender: "",
  phone: "",
  address: "",
  postalCode: "",
  language: "en",
};

function ProfilePage({ user, onUserChange }) {
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const loadProfile = async () => {
      if (!user) {
        setForm(initialForm);
        return;
      }

      try {
        setLoading(true);
        setError("");
        const { data } = await api.get("/api/auth/me");
        setForm({
          name: data.name || "",
          age: data.age ?? "",
          gender: data.gender || "",
          phone: data.phone || "",
          address: data.address || "",
          postalCode: data.postalCode || "",
          language: data.language || "en",
        });
      } catch (err) {
        setError(err.response?.data?.error || "Could not load profile");
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [user]);

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const saveProfile = async () => {
    try {
      setSaving(true);
      setError("");
      setMessage("");

      if (String(form.age).trim() === "") {
        setError("Age is required");
        setSaving(false);
        return;
      }

      const payload = {
        name: form.name,
        age: Number(form.age),
        gender: form.gender || null,
        phone: form.phone || null,
        address: form.address || null,
        postalCode: form.postalCode || null,
        language: form.language || "en",
      };

      const { data } = await api.put("/api/auth/me", payload);
      if (data.token) {
        setAuthToken(data.token);
      }
      onUserChange?.(data.user);
      setMessage("Profile updated successfully.");
    } catch (err) {
      setError(err.response?.data?.error || "Could not update profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-base pb-16 text-white">
      <div className="mx-auto w-[92%] max-w-5xl py-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/15 bg-white/5 px-4 py-3 backdrop-blur md:px-6">
          <div className="inline-flex items-center gap-2">
            <Activity className="h-5 w-5 text-mint" />
            <span className="font-bold tracking-wide">Profile Settings</span>
          </div>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
        </div>

        {!user && (
          <section className="rounded-2xl border border-white/15 bg-white/5 p-4">
            <p className="text-slate-200">Login required to edit profile.</p>
            <Link
              to="/auth"
              className="mt-3 inline-flex rounded-lg bg-sky px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky/90"
            >
              Login
            </Link>
          </section>
        )}

        {user && (
          <section className="rounded-2xl border border-white/15 bg-white/5 p-4 md:p-6">
            {loading ? (
              <p className="text-slate-200">Loading profile...</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  value={form.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  placeholder="Full name"
                  className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 outline-none focus:border-sky"
                />
                <input
                  value={form.age}
                  onChange={(e) => updateField("age", e.target.value)}
                  placeholder="Age"
                  type="number"
                  min="0"
                  max="120"
                  className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 outline-none focus:border-sky"
                />
                <select
                  value={form.gender}
                  onChange={(e) => updateField("gender", e.target.value)}
                  className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-slate-100 outline-none focus:border-sky"
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
                  <option
                    className="bg-slate-900 text-white"
                    value="non-binary"
                  >
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
                  className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 outline-none focus:border-sky"
                />
                <input
                  value={form.address}
                  onChange={(e) => updateField("address", e.target.value)}
                  placeholder="Address"
                  className="md:col-span-2 rounded-lg border border-white/20 bg-white/5 px-3 py-2 outline-none focus:border-sky"
                />
                <input
                  value={form.postalCode}
                  onChange={(e) => updateField("postalCode", e.target.value)}
                  placeholder="Postal code"
                  className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 outline-none focus:border-sky md:col-span-2"
                />
              </div>
            )}

            {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}
            {message && <p className="mt-3 text-sm text-mint">{message}</p>}

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={saveProfile}
                disabled={loading || saving}
                className="inline-flex items-center gap-2 rounded-lg bg-sky px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky/90 disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {saving ? "Saving..." : "Save Profile"}
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

export default ProfilePage;
