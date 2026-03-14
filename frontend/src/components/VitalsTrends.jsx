import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivitySquare,
  AlertCircle,
  Camera,
  CheckCircle2,
  Link2,
  QrCode,
  RefreshCcw,
  Smartphone,
  Unplug,
} from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import api from "../lib/api";

function toPoints(samples, valueKey, width, height, pad) {
  if (!samples.length) return { points: [], min: 0, max: 0 };

  const values = samples.map((s) => Number(s[valueKey]));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = samples.map((sample, index) => {
    const ratio = samples.length === 1 ? 0.5 : index / (samples.length - 1);
    const x = pad + ratio * (width - pad * 2);
    const y =
      height -
      pad -
      ((Number(sample[valueKey]) - min) / range) * (height - pad * 2);
    return {
      x,
      y,
      value: Number(sample[valueKey]),
      timestamp: sample.timestamp,
    };
  });

  return { points, min, max };
}

function VitalsChart({ title, valueKey, unit, colorClass, samples }) {
  const width = 680;
  const height = 200;
  const pad = 24;
  const { points, min, max } = useMemo(
    () => toPoints(samples, valueKey, width, height, pad),
    [samples, valueKey],
  );

  if (!samples.length) {
    return <p className="text-sm text-slate-300">No samples available yet.</p>;
  }

  const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
      <div className="mb-2 flex items-center justify-between text-sm">
        <p className="font-semibold text-slate-100">{title}</p>
        <p className="text-slate-300">
          Min {min.toFixed(1)} {unit} | Max {max.toFixed(1)} {unit}
        </p>
      </div>
      <div className="mb-2 text-xs text-slate-300">
        <p>
          X-axis: Time (oldest to latest sample) | Y-axis: {title} ({unit})
        </p>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="h-44 w-full"
      >
        <line
          x1={pad}
          y1={height - pad}
          x2={width - pad}
          y2={height - pad}
          stroke="rgba(255,255,255,0.2)"
        />
        <line
          x1={pad}
          y1={pad}
          x2={pad}
          y2={height - pad}
          stroke="rgba(255,255,255,0.2)"
        />
        <polyline
          points={polyline}
          fill="none"
          className={colorClass}
          strokeWidth="3"
          strokeLinecap="round"
        />
        {points.map((point, index) => (
          <g key={`${valueKey}-${index}`}>
            <circle cx={point.x} cy={point.y} r="3.5" fill="white" />
            <title>{`${new Date(point.timestamp).toLocaleTimeString()} - ${point.value.toFixed(1)} ${unit}`}</title>
          </g>
        ))}
      </svg>
    </div>
  );
}

function VitalsTrends({ user }) {
  const [samples, setSamples] = useState([]);
  const [watchStatus, setWatchStatus] = useState({ connected: false, watch: null });
  const [deviceCode, setDeviceCode] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isScanningQr, setIsScanningQr] = useState(false);
  const [cameraFacingMode, setCameraFacingMode] = useState("environment");
  const [availableCameras, setAvailableCameras] = useState([]);
  const [activeCameraIndex, setActiveCameraIndex] = useState(0);
  const scannerRef = useRef(null);
  const scannerElementId = useMemo(() => "watch-qr-reader", []);
  const hasLiveSamples = samples.length > 0;

  const stopQrScanner = async () => {
    const scanner = scannerRef.current;
    if (!scanner) {
      setIsScanningQr(false);
      return;
    }

    try {
      await scanner.stop();
    } catch {
      // Ignore stop errors when scanner has not fully started.
    }

    try {
      await scanner.clear();
    } catch {
      // Ignore clear errors during teardown.
    }

    scannerRef.current = null;
    setIsScanningQr(false);
  };

  const parseWatchQrPayload = (rawText) => {
    const text = String(rawText || "").trim();
    if (!text) {
      return { deviceCode: "", serialNumber: "" };
    }

    try {
      const parsed = JSON.parse(text);
      return {
        deviceCode: String(parsed.deviceCode || parsed.pairingCode || parsed.code || "").trim(),
        serialNumber: String(parsed.serialNumber || parsed.serial || parsed.sn || "").trim(),
      };
    } catch {
      // Continue to URL/text parsing.
    }

    if (text.startsWith("http://") || text.startsWith("https://") || text.startsWith("vitalbit://")) {
      try {
        const url = new URL(text.replace("vitalbit://", "https://"));
        return {
          deviceCode: String(
            url.searchParams.get("deviceCode") ||
              url.searchParams.get("pairingCode") ||
              url.searchParams.get("code") ||
              "",
          ).trim(),
          serialNumber: String(
            url.searchParams.get("serialNumber") ||
              url.searchParams.get("serial") ||
              url.searchParams.get("sn") ||
              "",
          ).trim(),
        };
      } catch {
        // Fall through to key-value text parsing.
      }
    }

    const parts = text.split(/[;,&\n]/).map((part) => part.trim());
    const keyValues = {};
    for (const part of parts) {
      const [rawKey, ...rawValueParts] = part.split(/[:=]/);
      if (!rawKey || !rawValueParts.length) continue;
      keyValues[rawKey.trim().toLowerCase()] = rawValueParts.join(":").trim();
    }

    return {
      deviceCode: String(
        keyValues.devicecode || keyValues.pairingcode || keyValues.code || "",
      ).trim(),
      serialNumber: String(
        keyValues.serialnumber || keyValues.serial || keyValues.sn || "",
      ).trim(),
    };
  };

  const handleQrScanSuccess = async (decodedText) => {
    const parsed = parseWatchQrPayload(decodedText);
    const nextDeviceCode = parsed.deviceCode || deviceCode;
    const nextSerialNumber = parsed.serialNumber || serialNumber;

    setDeviceCode(nextDeviceCode);
    setSerialNumber(nextSerialNumber);

    await stopQrScanner();

    if (!nextDeviceCode && !nextSerialNumber) {
      setError("QR scanned, but no pairing code or serial number was found.");
      return;
    }

    setSuccess("QR scanned successfully. Watch details filled in.");
    await connectWatch(nextDeviceCode, nextSerialNumber);
  };

  const fetchCameras = async () => {
    try {
      const cameras = await Html5Qrcode.getCameras();
      const safeCameras = Array.isArray(cameras) ? cameras : [];
      setAvailableCameras(safeCameras);
      if (safeCameras.length > 0) {
        const rearIndex = safeCameras.findIndex((cam) =>
          /rear|back|environment/i.test(String(cam.label || "")),
        );
        setActiveCameraIndex(rearIndex >= 0 ? rearIndex : 0);
      }
      return safeCameras;
    } catch {
      setAvailableCameras([]);
      return [];
    }
  };

  const startWithConfig = async (scanner, config) => {
    await scanner.start(
      config,
      {
        fps: 10,
        qrbox: { width: 230, height: 230 },
        aspectRatio: 1,
      },
      (decodedText) => {
        handleQrScanSuccess(decodedText);
      },
      () => {
        // Keep silent on intermittent decode failures.
      },
    );
  };

  const startQrScanner = async (facingMode = cameraFacingMode) => {
    setError("");
    setSuccess("");
    setIsScanningQr(true);

    setTimeout(async () => {
      try {
        const scanner = new Html5Qrcode(scannerElementId);
        scannerRef.current = scanner;

        const cameras = availableCameras.length ? availableCameras : await fetchCameras();

        const attempts = [];

        if (cameras.length > 0) {
          const activeCamera = cameras[activeCameraIndex] || cameras[0];
          if (activeCamera?.id) {
            attempts.push(activeCamera.id);
          }
        }

        attempts.push({ facingMode: { exact: facingMode } });
        attempts.push({ facingMode });

        if (cameras.length > 0) {
          for (const cam of cameras) {
            if (cam?.id && !attempts.includes(cam.id)) {
              attempts.push(cam.id);
            }
          }
        }

        let started = false;
        let lastError = null;
        for (const attempt of attempts) {
          try {
            await startWithConfig(scanner, attempt);
            started = true;
            break;
          } catch (err) {
            lastError = err;
          }
        }

        if (!started) {
          throw lastError || new Error("Unable to access any camera device");
        }
      } catch (scanError) {
        const rawMessage = String(scanError?.message || "").toLowerCase();
        const permissionDenied =
          rawMessage.includes("permission") ||
          rawMessage.includes("notallowed") ||
          rawMessage.includes("denied");
        const insecureContext = rawMessage.includes("secure") || rawMessage.includes("https");

        if (insecureContext) {
          setError("Camera access needs a secure context (HTTPS or localhost).");
        } else if (permissionDenied) {
          setError("Camera permission denied. Allow camera access and retry.");
        } else {
          setError(
            scanError?.message ||
              "Could not start camera QR scanner. Check camera permissions.",
          );
        }
        await stopQrScanner();
      }
    }, 0);
  };

  const flipQrCamera = async () => {
    let nextMode = cameraFacingMode === "environment" ? "user" : "environment";
    let nextIndex = activeCameraIndex;

    if (availableCameras.length > 1) {
      nextIndex = (activeCameraIndex + 1) % availableCameras.length;
      const nextLabel = String(availableCameras[nextIndex]?.label || "").toLowerCase();
      nextMode = /rear|back|environment/.test(nextLabel) ? "environment" : "user";
      setActiveCameraIndex(nextIndex);
    }

    setCameraFacingMode(nextMode);

    if (!isScanningQr) return;

    await stopQrScanner();
    await startQrScanner(nextMode);
  };

  const loadTrendData = async () => {
    const { data } = await api.get("/api/vitals/trends");
    setSamples(Array.isArray(data.samples) ? data.samples : []);
  };

  const loadStatusAndData = async () => {
    if (!user) {
      setWatchStatus({ connected: false, watch: null });
      setSamples([]);
      setError("");
      setSuccess("");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/api/vitals/status");
      setWatchStatus({
        connected: Boolean(data.connected),
        watch: data.watch || null,
      });

      if (data.connected) {
        await loadTrendData();
      } else {
        setSamples([]);
      }
    } catch (err) {
      setError(err.response?.data?.error || "Could not load smart watch status");
      setWatchStatus({ connected: false, watch: null });
      setSamples([]);
    } finally {
      setLoading(false);
    }
  };

  const connectWatch = async (nextDeviceCode = deviceCode, nextSerialNumber = serialNumber) => {
    if (!nextDeviceCode.trim() && !nextSerialNumber.trim()) {
      setError("Enter device code or serial number to connect your smart watch.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const { data } = await api.post("/api/vitals/connect", {
        deviceCode: nextDeviceCode.trim(),
        serialNumber: nextSerialNumber.trim(),
        deviceName: "VitalBit Smart Watch",
      });
      setWatchStatus({ connected: true, watch: data.watch || null });
      setSuccess("Smart watch connected. Waiting for live temperature and pulse samples.");
      await loadTrendData();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to connect smart watch");
    } finally {
      setLoading(false);
    }
  };

  const handleConnectWatch = async () => {
    await connectWatch(deviceCode, serialNumber);
  };

  const handleDisconnectWatch = async () => {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      await api.post("/api/vitals/disconnect");
      setWatchStatus({ connected: false, watch: null });
      setSamples([]);
      setSuccess("Smart watch disconnected.");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to disconnect smart watch");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatusAndData();
  }, [user]);

  useEffect(() => {
    return () => {
      stopQrScanner();
    };
  }, []);

  useEffect(() => {
    fetchCameras();
  }, []);

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-br from-[#071225] via-[#0b1930] to-[#0d213f] p-5 shadow-2xl md:p-6">
      <div className="pointer-events-none absolute -left-20 -top-20 h-48 w-48 rounded-full bg-cyan-400/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -right-20 h-48 w-48 rounded-full bg-emerald-400/15 blur-3xl" />

      <div className="relative">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1">
              <ActivitySquare className="h-4 w-4 text-cyan-200" />
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-cyan-100">
                Vitals Monitoring
              </span>
            </div>
            <h3 className="mt-3 text-2xl font-bold text-white md:text-3xl">
              Temperature and Pulse Trends
            </h3>
            <p className="mt-1 text-sm text-slate-300">
              Pair your watch once and keep your health vitals synced in real time.
            </p>
          </div>

          {user && watchStatus.connected && (
            <button
              type="button"
              onClick={loadStatusAndData}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-300/35 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCcw className="h-4 w-4" />
              Refresh Trends
            </button>
          )}
        </div>

        {!user && (
          <div className="mb-4 rounded-2xl border border-white/15 bg-black/20 p-4 text-sm text-slate-200">
            Login is required to connect your smart watch and view your live vitals history.
          </div>
        )}

        {user && !watchStatus.connected && (
          <div className="mb-5 rounded-2xl border border-cyan-300/30 bg-cyan-400/10 p-4 md:p-5">
            <div className="mb-3 flex flex-wrap items-center gap-2 text-cyan-100">
              <Smartphone className="h-4 w-4" />
              <p className="text-sm font-semibold">
                Connect your VitalBit smart watch to start syncing.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-300">
                  Pairing Code
                </span>
                <input
                  type="text"
                  value={deviceCode}
                  onChange={(e) => setDeviceCode(e.target.value)}
                  placeholder="Enter watch pairing code"
                  className="w-full rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm text-white placeholder:text-slate-400 outline-none transition focus:border-cyan-300/60"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-300">
                  Serial Number
                </span>
                <input
                  type="text"
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                  placeholder="Or enter watch serial number"
                  className="w-full rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm text-white placeholder:text-slate-400 outline-none transition focus:border-cyan-300/60"
                />
              </label>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleConnectWatch}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-xl bg-sky px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Link2 className="h-4 w-4" />
                {loading ? "Connecting..." : "Connect Watch"}
              </button>

              {!isScanningQr ? (
                <button
                  type="button"
                  onClick={startQrScanner}
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/35 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <QrCode className="h-4 w-4" />
                  Scan QR from Watch
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopQrScanner}
                  className="inline-flex items-center gap-2 rounded-xl border border-rose-300/35 bg-rose-400/10 px-4 py-2 text-sm font-semibold text-rose-100 transition hover:bg-rose-400/20"
                >
                  Stop QR Scanner
                </button>
              )}
            </div>

            {isScanningQr && (
              <div className="mt-4 rounded-2xl border border-white/20 bg-black/35 p-3 md:p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs uppercase tracking-[0.14em] text-slate-300">
                    Point your camera at the watch QR code
                  </p>
                  <button
                    type="button"
                    onClick={flipQrCamera}
                    className="inline-flex items-center gap-1 rounded-lg border border-cyan-300/35 bg-cyan-400/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-cyan-100 transition hover:bg-cyan-400/20"
                  >
                    <Camera className="h-3 w-3" />
                    Flip Camera
                  </button>
                </div>
                <p className="mb-3 text-[11px] text-slate-300">
                  Using {cameraFacingMode === "environment" ? "rear" : "front"} camera
                  {availableCameras.length > 1
                    ? ` (${activeCameraIndex + 1}/${availableCameras.length})`
                    : ""}
                </p>
                <div className="relative overflow-hidden rounded-xl border border-cyan-300/20 bg-slate-950/70 p-1">
                  <div id={scannerElementId} className="overflow-hidden rounded-lg" />
                </div>
              </div>
            )}
          </div>
        )}

        {user && watchStatus.connected && (
          <div className="mb-4 rounded-2xl border border-emerald-400/35 bg-emerald-500/10 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 text-sm font-semibold text-emerald-100">
                  <CheckCircle2 className="h-4 w-4" />
                  {watchStatus.watch?.deviceName || "VitalBit Smart Watch"} connected
                </p>
                <p className="mt-1 text-xs text-emerald-200/85">
                  {hasLiveSamples
                    ? "Sync is active. Live temperature and pulse samples are flowing to your dashboard."
                    : "Watch is connected. No live samples received yet."}
                </p>
              </div>
              <button
                type="button"
                onClick={handleDisconnectWatch}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-lg border border-rose-300/40 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-100 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Unplug className="h-3.5 w-3.5" />
                Disconnect Watch
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-3 flex items-start gap-2 rounded-xl border border-rose-300/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-3 flex items-start gap-2 rounded-xl border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
        <VitalsChart
          title="Body Temperature"
          valueKey="temperatureC"
          unit="C"
          colorClass="stroke-rose-300"
          samples={samples}
        />
        <VitalsChart
          title="Pulse Rate"
          valueKey="pulseBpm"
          unit="bpm"
          colorClass="stroke-sky-300"
          samples={samples}
        />
      </div>
      </div>
    </div>
  );
}

export default VitalsTrends;
