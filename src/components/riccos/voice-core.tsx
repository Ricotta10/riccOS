import { useEffect, useRef, useState } from "react";
import { AlertTriangle, AudioLines, Check, Loader2, Square } from "lucide-react";

import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { LogoMark } from "./brand";
import { ScoreBadge } from "./season-widgets";

const WEBHOOK_URL =
  "https://n8n.omniautomacoes.com.br/webhook/bca0b9cf-0dd8-4974-bf67-e4f75d4b25a6";

type CoreState = "idle" | "recording" | "processing" | "success" | "error";

const stateTone: Record<CoreState, { ring: string; glow: string; text: string; bar: string }> = {
  idle: {
    ring: "border-primary/40",
    glow: "bg-primary/25",
    text: "text-primary",
    bar: "bg-primary",
  },
  recording: {
    ring: "border-danger/60",
    glow: "bg-danger/30",
    text: "text-danger",
    bar: "bg-danger",
  },
  processing: {
    ring: "border-warning/60",
    glow: "bg-warning/25",
    text: "text-warning-foreground",
    bar: "bg-warning",
  },
  success: {
    ring: "border-success/60",
    glow: "bg-success/30",
    text: "text-success",
    bar: "bg-success",
  },
  error: {
    ring: "border-danger/60",
    glow: "bg-danger/30",
    text: "text-danger",
    bar: "bg-danger",
  },
};

/**
 * Central de comando por voz do RiccOS.
 * Um núcleo holográfico com anéis orbitais: toque para gravar, toque de novo para enviar.
 */
export function VoiceCore() {
  const { user, profile } = useAuth();
  const [state, setState] = useState<CoreState>("idle");
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
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
    } catch (err) {
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
      setTimeout(() => setState("idle"), 4000);
    } catch (err) {
      console.error("Erro ao enviar webhook:", err);
      setState("error");
      setErrorMessage("Erro de conexão ao enviar comando.");
      setTimeout(() => setState("idle"), 4000);
    }
  };

  const handleCoreClick = () => {
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

  const tone = stateTone[state];
  const isBusy = state === "processing";
  const firstName = profile?.user_nome?.split(" ")[0];

  return (
    <div className="relative flex min-h-[calc(100dvh-11rem)] flex-col items-center justify-center overflow-hidden select-none md:min-h-[calc(100dvh-8rem)]">
      <div className="relative z-10 flex flex-col items-center">
        {/* Saudação */}
        <div className="mb-8 flex flex-col items-center gap-3 text-center sm:mb-10">
          <LogoMark className="h-7 text-foreground" />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Central de comando
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
              {firstName ? `Olá, ${firstName}.` : "Olá."}{" "}
              <span className="text-muted-foreground font-normal">O que vamos lançar hoje?</span>
            </h1>
          </div>
        </div>

        {/* Núcleo */}
        <button
          type="button"
          onClick={handleCoreClick}
          disabled={isBusy}
          aria-label={
            state === "recording" ? "Parar gravação e enviar comando" : "Iniciar comando de voz"
          }
          className="group relative grid size-64 place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background disabled:cursor-progress sm:size-80"
        >
          {/* Anel externo tracejado (órbita lenta) */}
          <span
            aria-hidden
            className={cn(
              "absolute inset-0 rounded-full border border-dashed transition-colors duration-500",
              tone.ring,
              state === "processing" ? "animate-orbit-fast" : "animate-orbit",
            )}
          />
          {/* Marcadores de órbita */}
          <span
            aria-hidden
            className={cn(
              "absolute inset-0",
              state === "processing" ? "animate-orbit-fast" : "animate-orbit",
            )}
          >
            <span
              className={cn(
                "absolute left-1/2 top-0 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full",
                tone.bar,
              )}
            />
          </span>

          {/* Anel gradiente cônico (fino) */}
          <span
            aria-hidden
            className={cn(
              "ring-gradient absolute inset-[13%] rounded-full opacity-90 transition-opacity duration-500",
              state === "processing" ? "animate-orbit-fast" : "animate-orbit",
              "[mask:radial-gradient(farthest-side,transparent_calc(100%-3px),black_calc(100%-3px))]",
              "[-webkit-mask:radial-gradient(farthest-side,transparent_calc(100%-3px),black_calc(100%-3px))]",
            )}
          />

          {/* Pulso ao gravar */}
          {state === "recording" && (
            <>
              <span
                aria-hidden
                className="animate-pulse-ring absolute inset-[18%] rounded-full border-2 border-danger/70"
              />
              <span
                aria-hidden
                className="animate-pulse-ring absolute inset-[18%] rounded-full border-2 border-danger/50 [animation-delay:0.8s]"
              />
            </>
          )}

          {/* Esfera central */}
          <span
            className={cn(
              "relative grid size-[58%] place-items-center rounded-full border transition-all duration-500",
              "bg-gradient-to-b from-card to-background shadow-2xl",
              state === "idle" &&
                "border-primary/30 shadow-glow group-hover:scale-[1.03] animate-float",
              state === "recording" &&
                "border-danger/50 scale-105 shadow-[0_0_60px_-10px_var(--color-danger)]",
              state === "processing" && "border-warning/50",
              state === "success" &&
                "border-success/60 shadow-[0_0_60px_-10px_var(--color-success)]",
              state === "error" && "border-danger/50",
            )}
          >
            {/* brilho interno */}
            <span
              aria-hidden
              className={cn(
                "absolute inset-3 rounded-full opacity-40 blur-xl transition-colors duration-500",
                tone.glow,
              )}
            />

            <span className={cn("relative flex flex-col items-center gap-2", tone.text)}>
              {state === "recording" ? (
                <>
                  <Square className="size-9 fill-current" />
                  <span className="text-[10px] font-semibold uppercase tracking-[0.2em]">
                    Enviar
                  </span>
                </>
              ) : state === "processing" ? (
                <Loader2 className="size-11 animate-spin" />
              ) : state === "success" ? (
                <Check className="size-12" strokeWidth={2.5} />
              ) : state === "error" ? (
                <AlertTriangle className="size-11" />
              ) : (
                <>
                  <AudioLines className="size-12 transition-transform duration-300 group-hover:scale-110" />
                  <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Toque para falar
                  </span>
                </>
              )}
            </span>
          </span>
        </button>

        {/* Equalizador */}
        <div className="mt-8 flex h-8 items-end justify-center gap-1.5">
          {state === "recording" &&
            [40, 70, 30, 90, 50, 100, 60, 80, 40, 90, 30].map((h, i) => (
              <span
                key={i}
                className={cn("w-1.5 rounded-full animate-pulse", tone.bar)}
                style={{ height: `${h}%`, animationDuration: `${0.4 + (i % 5) * 0.15}s` }}
              />
            ))}
        </div>

        {/* Status */}
        <div className="mt-4 min-h-16 text-center">
          {state === "idle" && <ScoreBadge />}

          {state === "recording" && (
            <div className="space-y-1">
              <span className="text-4xl font-semibold tabular-nums tracking-wider text-danger">
                {formatTimer(timerSeconds)}
              </span>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Ouvindo · toque no núcleo para enviar
              </p>
            </div>
          )}

          {state === "processing" && (
            <div className="space-y-1">
              <p className="text-base font-semibold text-warning-foreground">
                Processando comando…
              </p>
              <p className="text-xs text-muted-foreground">Transmitindo áudio para a automação.</p>
            </div>
          )}

          {state === "success" && (
            <div className="space-y-1">
              <p className="text-base font-semibold text-success">Comando enviado</p>
              <p className="text-xs text-muted-foreground">
                Sua mensagem foi recebida pelo RiccOS.
              </p>
            </div>
          )}

          {state === "error" && (
            <div className="space-y-1">
              <p className="text-base font-semibold text-danger">
                {errorMessage || "Falha ao gravar"}
              </p>
              <p className="text-xs text-muted-foreground">
                Toque no núcleo para tentar novamente.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
