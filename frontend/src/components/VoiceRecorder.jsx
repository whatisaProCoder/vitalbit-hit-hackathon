import { useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import api from "../lib/api";

function VoiceRecorder({ onResult, setLoading }) {
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const [isRecording, setIsRecording] = useState(false);

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    chunksRef.current = [];

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };

    recorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      const formData = new FormData();
      formData.append("audio", blob, "voice.webm");

      try {
        setLoading(true);
        const { data } = await api.post("/api/voice/analyze", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        onResult({ type: "voice", data });
      } catch (error) {
        onResult({
          type: "voice",
          data: {
            error: error.response?.data?.error || "Voice analysis failed",
          },
        });
      } finally {
        setLoading(false);
        stream.getTracks().forEach((track) => track.stop());
      }
    };

    mediaRecorderRef.current = recorder;
    recorder.start();
    setIsRecording(true);
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  return (
    <div className="glass rounded-2xl p-6">
      <div className="mb-4 flex items-center gap-2">
        <Mic className="h-5 w-5 text-mint" />
        <h3 className="text-xl font-bold">Voice Health Detection</h3>
      </div>
      <p className="mb-4 text-sm text-slate-200">
        Record a breathing or speech sample to evaluate potential respiratory
        risk.
      </p>
      <button
        type="button"
        onClick={isRecording ? stopRecording : startRecording}
        className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold text-white transition ${
          isRecording
            ? "bg-rose-500 hover:bg-rose-600"
            : "bg-emerald-500 hover:bg-emerald-600"
        }`}
      >
        {isRecording ? (
          <Square className="h-5 w-5" />
        ) : (
          <Mic className="h-5 w-5" />
        )}
        {isRecording ? "Stop & Analyze" : "Start Recording"}
      </button>
    </div>
  );
}

export default VoiceRecorder;
