import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Bot, CheckCircle2, Cpu, Sparkles, Square } from "lucide-react";

import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RiccOS — Central AI" },
      { name: "description", content: "Assistente por voz futurista RiccOS." },
    ],
  }),
  component: RiccOSFuturisticRobotPage,
});

const WEBHOOK_URL =
  "https://n8n.omniautomacoes.com.br/webhook/bca0b9cf-0dd8-4974-bf67-e4f75d4b25a6";

type RobotState = "idle" | "recording" | "processing" | "success" | "error";

function RiccOSFuturisticRobotPage() {
  const { user, profile } = useAuth();
  const [state, setState] = useState<RobotState>("idle");
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startTimer = () => {
    setTimerSeconds(0);
    timerIntervalRef.current = setInterval(() => {
      setTimerSeconds((prev) => prev + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  };

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const startRecording = async () => {
    setErrorMessage(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      let mimeType = "audio/webm";
      if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
        mimeType = "audio/webm;codecs=opus";
      } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
        mimeType = "audio/mp4";
      }

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stopTimer();
        stopStream();
        await sendAudioToWebhook();
      };

      mediaRecorder.start(200);
      setState("recording");
      startTimer();
    } catch (err: any) {
      console.error("Erro ao acessar microfone:", err);
      setState("error");
      setErrorMessage("Permissão de microfone não concedida.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
      setState("processing");
    }
  };

  const sendAudioToWebhook = async () => {
    try {
      const rawBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
      const mp3File = new File([rawBlob], "comando_voz.mp3", { type: "audio/mp3" });

      const formData = new FormData();
      formData.append("file", mp3File, "comando_voz.mp3");
      formData.append("user_id", user?.id || "");
      formData.append("user_name", profile?.user_nome || "Usuário RiccOS");
      formData.append("duration_seconds", String(timerSeconds));
      formData.append("created_at", new Date().toISOString());

      const response = await fetch(WEBHOOK_URL, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Status ${response.status}`);
      }

      setState("success");
      setTimeout(() => {
        setState("idle");
      }, 4000);
    } catch (err: any) {
      console.error("Erro ao enviar webhook:", err);
      setState("error");
      setErrorMessage("Erro de conexão ao enviar comando.");
      setTimeout(() => {
        setState("idle");
      }, 4000);
    }
  };

  const handleRobotClick = () => {
    if (state === "idle" || state === "success" || state === "error") {
      startRecording();
    } else if (state === "recording") {
      stopRecording();
    }
  };

  useEffect(() => {
    return () => {
      stopTimer();
      stopStream();
    };
  }, []);

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex min-h-[calc(100vh-6rem)] flex-col items-center justify-center relative overflow-hidden select-none">
      {/* GLOW DE FUNDO FUTURISTA */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div
          className={`size-[500px] rounded-full blur-3xl transition-all duration-700 opacity-20 ${
            state === "recording"
              ? "bg-red-500 scale-125 opacity-40"
              : state === "processing"
                ? "bg-amber-400 scale-110 opacity-30"
                : state === "success"
                  ? "bg-emerald-500 scale-110 opacity-30"
                  : "bg-indigo-500 hover:scale-105"
          }`}
        />
      </div>

      {/* CONTAINER DO ROBÔ */}
      <div className="relative z-10 flex flex-col items-center justify-center">
        {/* NÚCLEO DO ROBÔ FUTURISTA COM ANÉIS HOLOGRÁFICOS */}
        <div className="relative flex items-center justify-center cursor-pointer group" onClick={handleRobotClick}>
          {/* Anel Externo Rotação 1 */}
          <div
            className={`absolute size-64 sm:size-80 rounded-full border border-dashed transition-all duration-700 ${
              state === "recording"
                ? "border-red-500/60 animate-[spin_4s_linear_infinite]"
                : state === "processing"
                  ? "border-amber-400/80 animate-[spin_2s_linear_infinite]"
                  : state === "success"
                    ? "border-emerald-500/60"
                    : "border-cyan-500/30 group-hover:border-cyan-400/60 animate-[spin_12s_linear_infinite]"
            }`}
          />

          {/* Anel Intermediário Pulsação */}
          <div
            className={`absolute size-52 sm:size-64 rounded-full border transition-all duration-500 ${
              state === "recording"
                ? "border-red-500/80 animate-ping"
                : state === "processing"
                  ? "border-amber-400/60 animate-pulse"
                  : state === "success"
                    ? "border-emerald-400/60"
                    : "border-indigo-500/30 group-hover:scale-110"
            }`}
          />

          {/* Anel Interno Neon */}
          <div
            className={`absolute size-40 sm:size-52 rounded-full border-2 transition-all duration-500 ${
              state === "recording"
                ? "border-red-500 shadow-[0_0_40px_rgba(239,68,68,0.6)]"
                : state === "processing"
                  ? "border-amber-400 shadow-[0_0_40px_rgba(251,191,36,0.6)]"
                  : state === "success"
                    ? "border-emerald-400 shadow-[0_0_40px_rgba(52,211,153,0.6)]"
                    : "border-cyan-400/50 shadow-[0_0_30px_rgba(34,211,238,0.3)] group-hover:shadow-[0_0_50px_rgba(34,211,238,0.5)]"
            }`}
          />

          {/* ESFERA CENTRAL DO ROBÔ COM ANIMAÇÃO DE LEVITAÇÃO */}
          <div
            className={`relative z-20 flex size-32 sm:size-40 items-center justify-center rounded-full transition-all duration-500 shadow-2xl backdrop-blur-xl ${
              state === "recording"
                ? "bg-gradient-to-br from-red-600 to-rose-900 text-white scale-110 ring-4 ring-red-500/40"
                : state === "processing"
                  ? "bg-gradient-to-br from-amber-500 to-yellow-700 text-white scale-105"
                  : state === "success"
                    ? "bg-gradient-to-br from-emerald-500 to-teal-800 text-white scale-105"
                    : "bg-gradient-to-br from-indigo-900 via-slate-900 to-cyan-950 text-cyan-400 animate-[bounce_4s_ease-in-out_infinite] group-hover:scale-105"
            }`}
          >
            {state === "recording" ? (
              <div className="flex flex-col items-center gap-1">
                <Square className="size-10 fill-current animate-pulse text-white" />
                <span className="text-[10px] font-bold tracking-widest uppercase text-white/90">
                  Parar
                </span>
              </div>
            ) : state === "processing" ? (
              <div className="flex flex-col items-center gap-1">
                <Cpu className="size-12 animate-spin text-white" />
              </div>
            ) : state === "success" ? (
              <div className="flex flex-col items-center gap-1">
                <CheckCircle2 className="size-12 text-white animate-bounce" />
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1 group-hover:scale-110 transition-transform">
                <Bot className="size-12 sm:size-14 text-cyan-300 drop-shadow-[0_0_15px_rgba(34,211,238,0.8)]" />
                <Sparkles className="size-4 text-cyan-400 animate-pulse" />
              </div>
            )}
          </div>
        </div>

        {/* BARRAS DE ONDA SONORA EQUALIZADOR QUANDO GRAVANDO */}
        {state === "recording" && (
          <div className="mt-8 flex items-center justify-center gap-1.5 h-8">
            {[40, 70, 30, 90, 50, 100, 60, 80, 40, 90, 30].map((h, i) => (
              <div
                key={i}
                className="w-1.5 rounded-full bg-red-500 animate-pulse"
                style={{
                  height: `${h}%`,
                  animationDuration: `${0.4 + (i % 5) * 0.15}s`,
                }}
              />
            ))}
          </div>
        )}

        {/* CRONÔMETRO OU MENSAGEM DE STATUS FUTURISTA */}
        <div className="mt-8 text-center space-y-2">
          {state === "recording" && (
            <div className="space-y-1">
              <span className="text-4xl font-mono font-extrabold tracking-widest text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]">
                {formatTimer(timerSeconds)}
              </span>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Ouvindo comando de voz... Clique no robô para enviar
              </p>
            </div>
          )}

          {state === "idle" && (
            <div className="space-y-1">
              <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center justify-center gap-2">
                <span>RiccOS AI</span>
                <span className="inline-block size-2 rounded-full bg-cyan-400 animate-ping" />
              </h2>
              <p className="text-sm font-medium text-muted-foreground">
                Clique no robô para iniciar o comando por voz
              </p>
            </div>
          )}

          {state === "processing" && (
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-amber-400 tracking-wide animate-pulse">
                Processando Comando...
              </h2>
              <p className="text-xs text-muted-foreground">
                Enviando áudio MP3 para o Webhook N8N
              </p>
            </div>
          )}

          {state === "success" && (
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-emerald-400 tracking-wide">
                Comando Enviado com Sucesso!
              </h2>
              <p className="text-xs text-muted-foreground">
                Sua mensagem de voz foi transmitida ao RiccOS.
              </p>
            </div>
          )}

          {state === "error" && (
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-red-500 tracking-wide">
                {errorMessage || "Falha ao gravar"}
              </h2>
              <p className="text-xs text-muted-foreground">
                Clique no robô para tentar novamente.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
