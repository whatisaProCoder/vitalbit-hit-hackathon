import { useEffect, useRef, useState } from "react";
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

function HealthChat({ user, onMessage, onVoiceResult, onSymptomResult }) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [voiceProcessing, setVoiceProcessing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [chat, setChat] = useState([]);
  const [micStatus, setMicStatus] = useState("");
  const chatScrollRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const speechRecognitionRef = useRef(null);
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
      setMicStatus(data.warning);
    } else if (data.symptomAnalysis) {
      setMicStatus("Prediction Results updated from voice input.");
    } else {
      setMicStatus(
        "Voice analyzed, but symptoms were not detected in transcript.",
      );
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

  const startMicRecording = async () => {
    if (!user || isRecording || voiceProcessing) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;

      audioChunksRef.current = [];
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

      recorder.onerror = () => {
        setMicStatus("Could not capture audio. Please try again.");
        setIsRecording(false);
      };

      recorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const activeStream = mediaStreamRef.current;

        try {
          setVoiceProcessing(true);
          setMicStatus("Analyzing recording...");
          await analyzeRecordedAudio(blob);
        } catch (error) {
          setMicStatus(
            error.response?.data?.error ||
              "Could not transcribe voice. Please try again.",
          );
          setChat((prev) => [
            ...prev,
            {
              role: "assistant",
              message:
                error.response?.data?.error ||
                "Could not transcribe voice. Please try again.",
            },
          ]);
        } finally {
          setVoiceProcessing(false);
          mediaRecorderRef.current = null;
          mediaStreamRef.current = null;
          audioChunksRef.current = [];
          transcriptHintRef.current = "";
          finalTranscriptRef.current = "";
          interimTranscriptRef.current = "";
          speechRecognitionRef.current = null;
          activeStream?.getTracks().forEach((track) => track.stop());
        }
      };

      recorder.start();
      setIsRecording(true);
      setMicStatus("Recording... click Stop when you are done.");
    } catch {
      setMicStatus("Microphone permission denied or unavailable.");
    }
  };

  const stopMicRecording = () => {
    if (!isRecording) return;

    setIsRecording(false);
    try {
      speechRecognitionRef.current?.stop();
    } catch {
      // no-op
    }
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
  };

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
          disabled={!user || loading || voiceProcessing || isRecording}
          className="rounded-lg border border-white/20 px-3 py-2 disabled:opacity-50"
          title="Start voice recording"
        >
          <Mic className="h-4 w-4" />
        </button>
        {isRecording && (
          <button
            type="button"
            onClick={stopMicRecording}
            className="rounded-lg bg-rose-500 px-3 py-2 text-white hover:bg-rose-600"
            title="Stop recording and analyze"
          >
            <Square className="h-4 w-4" />
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
}

export default HealthChat;
