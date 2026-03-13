import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Mic, Send, Square } from "lucide-react";
import api from "../lib/api";

function renderInlineFormatting(text, keyPrefix) {
  const content = String(text || "");
  const parts = content.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);

  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      const boldText = part.slice(2, -2);
      return (
        <strong
          key={`${keyPrefix}-b-${index}`}
          className="font-semibold text-white"
        >
          {boldText}
        </strong>
      );
    }

    return <span key={`${keyPrefix}-t-${index}`}>{part}</span>;
  });
}

function renderFormattedMessage(message) {
  const lines = String(message || "")
    .replace(/\r\n/g, "\n")
    .split("\n");

  const blocks = [];
  let paragraphBuffer = [];

  const flushParagraph = () => {
    if (!paragraphBuffer.length) return;
    blocks.push({ type: "paragraph", text: paragraphBuffer.join(" ").trim() });
    paragraphBuffer = [];
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) {
      flushParagraph();
      continue;
    }

    if (/^[*-]\s+/.test(line)) {
      flushParagraph();
      const items = [line.replace(/^[*-]\s+/, "").trim()];
      while (i + 1 < lines.length && /^[*-]\s+/.test(lines[i + 1].trim())) {
        i += 1;
        items.push(
          lines[i]
            .trim()
            .replace(/^[*-]\s+/, "")
            .trim(),
        );
      }
      blocks.push({ type: "list", items });
      continue;
    }

    paragraphBuffer.push(line);
  }

  flushParagraph();

  return blocks.map((block, index) => {
    if (block.type === "list") {
      return (
        <ul
          key={`list-${index}`}
          className="ml-4 list-disc space-y-1 text-slate-100"
        >
          {block.items.map((item, itemIndex) => (
            <li key={`item-${index}-${itemIndex}`}>
              {renderInlineFormatting(item, `li-${index}-${itemIndex}`)}
            </li>
          ))}
        </ul>
      );
    }

    return (
      <p key={`p-${index}`} className="text-slate-100">
        {renderInlineFormatting(block.text, `p-${index}`)}
      </p>
    );
  });
}

const HealthChat = forwardRef(function HealthChat(
  {
    user,
    onMessage,
    onVoiceResult,
    onSymptomResult,
    autoStartRecordingSignal,
    chatOpen = true,
  },
  ref,
) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [voiceProcessing, setVoiceProcessing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [chat, setChat] = useState([]);
  const [micStatus, setMicStatus] = useState("");
  const chatScrollRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const speechRecognitionRef = useRef(null);
  const startRequestedRef = useRef(false);
  const stopRequestedRef = useRef(false);
  const lastAutoStartSignalRef = useRef(0);
  const transcriptHintRef = useRef("");
  const finalTranscriptRef = useRef("");
  const interimTranscriptRef = useRef("");

  useEffect(() => {
    const loadHistory = async () => {
      if (!user) {
        setChat([]);
        return;
      }

      try {
        const { data } = await api.get("/api/chat/history");
        setChat(Array.isArray(data.messages) ? data.messages : []);
      } catch {
        setChat([]);
      }
    };

    loadHistory();
  }, [user]);

  useEffect(() => {
    const chatBox = chatScrollRef.current;
    if (!chatBox) return;
    chatBox.scrollTop = chatBox.scrollHeight;
  }, [chat, loading, voiceProcessing]);

  const sendMessage = async (messageText) => {
    if (!messageText.trim() || !user || loading || voiceProcessing) return;

    try {
      setLoading(true);
      const localUserMessage = { role: "user", message: messageText };
      setChat((prev) => [...prev, localUserMessage]);

      const { data } = await api.post("/api/chat/message", {
        message: messageText,
      });
      setChat((prev) => [...prev, data.reply]);

      if (data.symptomAnalysis) {
        onSymptomResult?.({ type: "symptom", data: data.symptomAnalysis });
      }

      onMessage?.(data);
    } catch (error) {
      setChat((prev) => [
        ...prev,
        {
          role: "assistant",
          message:
            error.response?.data?.details ||
            error.response?.data?.error ||
            "Chat service is temporarily unavailable.",
        },
      ]);
    } finally {
      setLoading(false);
      setInput("");
    }
  };

  const analyzeRecordedAudio = async (blob) => {
    const form = new FormData();
    form.append("audio", blob, "chat-voice.webm");
    if (transcriptHintRef.current.trim()) {
      form.append("transcriptHint", transcriptHintRef.current.trim());
    }

    const { data } = await api.post("/api/chat/voice-to-text", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    const transcriptText = String(data.transcript || "").trim();
    setInput(transcriptText);

    if (data.voiceAnalysis) {
      onVoiceResult?.({ type: "voice", data: data.voiceAnalysis });
    }

    if (data.symptomAnalysis) {
      onSymptomResult?.({ type: "symptom", data: data.symptomAnalysis });
    }

    if (data.warning) {
      setMicStatus(
        "Voice captured, but transcript is unavailable right now. Showing voice-risk results.",
      );
    } else if (data.symptomAnalysis) {
      setMicStatus("Prediction Results updated from voice input.");
    } else if (data.voiceAnalysis?.risk) {
      setMicStatus("Voice risk analyzed successfully.");
    } else {
      setMicStatus(
        "Voice analyzed, but symptoms were not detected in transcript.",
      );
    }

    if (!transcriptText && data.voiceAnalysis?.risk) {
      const risk = String(data.voiceAnalysis.risk || "unknown")
        .replace(/_/g, " ")
        .toLowerCase();
      const confidence = Math.round(
        (Number(data.voiceAnalysis.confidence || 0) || 0) * 100,
      );

      setChat((prev) => [
        ...prev,
        {
          role: "assistant",
          message: `Voice risk result: **${risk}** (${confidence}% confidence). Speech transcript is unavailable right now. You can still continue with manual symptom text for deeper guidance.`,
        },
      ]);
    }

    if (transcriptText) {
      setLoading(true);
      const localUserMessage = { role: "user", message: transcriptText };
      setChat((prev) => [...prev, localUserMessage]);

      try {
        const { data: chatData } = await api.post("/api/chat/message", {
          message: transcriptText,
        });

        setChat((prev) => [...prev, chatData.reply]);

        if (chatData.symptomAnalysis) {
          onSymptomResult?.({
            type: "symptom",
            data: chatData.symptomAnalysis,
          });
        }

        onMessage?.(chatData);
      } catch {
        setChat((prev) => [
          ...prev,
          {
            role: "assistant",
            message:
              "Voice transcript captured, but chat reply is temporarily unavailable.",
          },
        ]);
      } finally {
        setLoading(false);
      }
    }

    onMessage?.({ source: "voice-combined", data });
  };

  const startMicRecording = useCallback(async () => {
    if (!user) {
      setMicStatus("Please login to use voice chat.");
      return;
    }
    if (
      isRecording ||
      voiceProcessing ||
      isStopping ||
      startRequestedRef.current
    )
      return;

    startRequestedRef.current = true;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;

      audioChunksRef.current = [];
      stopRequestedRef.current = false;
      transcriptHintRef.current = "";
      finalTranscriptRef.current = "";
      interimTranscriptRef.current = "";
      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;

      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.lang = "en-US";
        recognition.interimResults = true;
        recognition.continuous = true;

        recognition.onresult = (event) => {
          let finalChunk = "";
          let interimChunk = "";
          for (let i = event.resultIndex; i < event.results.length; i += 1) {
            if (event.results[i].isFinal) {
              finalChunk += event.results[i][0]?.transcript || "";
            } else {
              interimChunk += event.results[i][0]?.transcript || "";
            }
          }

          if (finalChunk.trim()) {
            finalTranscriptRef.current =
              `${finalTranscriptRef.current} ${finalChunk}`.trim();
          }

          interimTranscriptRef.current = interimChunk.trim();
          transcriptHintRef.current =
            `${finalTranscriptRef.current} ${interimTranscriptRef.current}`.trim();
        };

        recognition.onerror = () => {};

        try {
          recognition.start();
          speechRecognitionRef.current = recognition;
        } catch {
          speechRecognitionRef.current = null;
        }
      }

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstart = () => {
        setIsRecording(true);
        setIsStopping(false);
        startRequestedRef.current = false;
      };

      recorder.onerror = () => {
        setMicStatus("Could not capture audio. Please try again.");
        setIsRecording(false);
        setIsStopping(false);
        startRequestedRef.current = false;
      };

      recorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const activeStream = mediaStreamRef.current;

        try {
          if (!blob.size) {
            setMicStatus("No audio captured. Please try recording again.");
            return;
          }

          setVoiceProcessing(true);
          setMicStatus("Analyzing recording...");
          await analyzeRecordedAudio(blob);
        } catch (error) {
          setMicStatus(
            error.response?.data?.error || "Could not process voice.",
          );
          setChat((prev) => [
            ...prev,
            {
              role: "assistant",
              message:
                error.response?.data?.error ||
                "Could not process voice at this moment. Please try again.",
            },
          ]);
        } finally {
          setVoiceProcessing(false);
          setIsRecording(false);
          setIsStopping(false);
          startRequestedRef.current = false;
          mediaRecorderRef.current = null;
          mediaStreamRef.current = null;
          audioChunksRef.current = [];
          transcriptHintRef.current = "";
          finalTranscriptRef.current = "";
          interimTranscriptRef.current = "";
          speechRecognitionRef.current = null;
          stopRequestedRef.current = false;
          activeStream?.getTracks().forEach((track) => track.stop());
        }
      };

      recorder.start();
      setMicStatus("Recording... click Stop when you are done.");
    } catch {
      startRequestedRef.current = false;
      setMicStatus("Microphone permission denied or unavailable.");
    }
  }, [
    isRecording,
    isStopping,
    onMessage,
    onSymptomResult,
    onVoiceResult,
    user,
    voiceProcessing,
  ]);

  const stopMicRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      setIsRecording(false);
      setIsStopping(false);
      stopRequestedRef.current = false;
      startRequestedRef.current = false;
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      return;
    }
    if (stopRequestedRef.current) return;

    stopRequestedRef.current = true;
    setIsStopping(true);
    setIsRecording(false);
    setMicStatus("Stopping recording...");
    try {
      speechRecognitionRef.current?.stop();
    } catch {
      // no-op
    }

    try {
      recorder.requestData();
    } catch {
      // no-op
    }

    try {
      recorder.stop();
    } catch {
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      setIsRecording(false);
      setIsStopping(false);
      startRequestedRef.current = false;
      stopRequestedRef.current = false;
      return;
    }

    // Ensure mic hardware is released immediately on first click.
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      startVoiceCapture: () => {
        startMicRecording();
      },
    }),
    [startMicRecording],
  );

  useEffect(() => {
    if (!autoStartRecordingSignal || !chatOpen) return;
    if (autoStartRecordingSignal === lastAutoStartSignalRef.current) return;

    lastAutoStartSignalRef.current = autoStartRecordingSignal;
    startMicRecording();
  }, [autoStartRecordingSignal, chatOpen]);

  useEffect(() => {
    if (chatOpen) return;
    stopMicRecording();
  }, [chatOpen, stopMicRecording]);

  useEffect(
    () => () => {
      if (mediaRecorderRef.current?.state !== "inactive") {
        mediaRecorderRef.current?.stop();
      }
      try {
        speechRecognitionRef.current?.stop();
      } catch {
        // no-op
      }
      startRequestedRef.current = false;
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  return (
    <div className="glass rounded-2xl p-6">
      <h3 className="mb-4 text-xl font-bold">
        Health Chatbot + Combined Voice Analysis
      </h3>

      {!user && (
        <p className="mb-3 text-slate-200">Login required for chat tracking.</p>
      )}

      <div
        ref={chatScrollRef}
        className="mb-3 h-72 md:h-80 space-y-2 overflow-y-auto rounded-xl bg-white/5 p-3"
      >
        {chat.length === 0 && (
          <p className="text-slate-300">Start by describing your symptoms.</p>
        )}
        {chat.map((msg, idx) => (
          <div
            key={`${msg.role}-${idx}`}
            className="rounded-lg bg-white/10 p-2 text-sm"
          >
            <p className="mb-1 text-xs uppercase text-slate-300">{msg.role}</p>
            <div className="space-y-2">
              {renderFormattedMessage(msg.message)}
            </div>
          </div>
        ))}
        {loading && (
          <div className="rounded-lg bg-white/10 p-2 text-sm">
            <p className="mb-1 text-xs uppercase text-slate-300">assistant</p>
            <p className="animate-pulse text-slate-100">
              VitalBit is typing...
            </p>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMessage(input);
            }
          }}
          placeholder="I have fever, cough and chest tightness..."
          className="w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 outline-none focus:border-sky"
        />
        <button
          type="button"
          onClick={startMicRecording}
          disabled={
            !user || loading || voiceProcessing || isRecording || isStopping
          }
          className="rounded-lg border border-white/20 px-3 py-2 disabled:opacity-50"
          title="Start voice recording"
        >
          <Mic className="h-4 w-4" />
        </button>
        {isRecording && (
          <button
            type="button"
            onClick={stopMicRecording}
            disabled={isStopping}
            className="rounded-lg bg-rose-500 px-3 py-2 text-white hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
            title="Stop recording and analyze"
          >
            {isStopping ? "Stopping..." : <Square className="h-4 w-4" />}
          </button>
        )}
        <button
          type="button"
          onClick={() => sendMessage(input)}
          disabled={!user || loading || voiceProcessing}
          className="rounded-lg bg-sky px-3 py-2 text-white transition hover:bg-sky/90 disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
      {micStatus && <p className="mt-2 text-xs text-slate-300">{micStatus}</p>}
    </div>
  );
});

export default HealthChat;
