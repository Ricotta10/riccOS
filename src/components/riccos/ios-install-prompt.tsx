import { useEffect, useState } from "react";
import { Share, PlusSquare, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LogoTile } from "./brand";

export function IosInstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Check if dismissed before
    const dismissed = localStorage.getItem("riccos_ios_pwa_dismissed");
    if (dismissed) {
      return;
    }

    // Detect iOS device
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIos =
      /iphone|ipad|ipod/.test(userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

    // Detect if already installed / running standalone
    const isStandalone =
      (window.navigator as any).standalone === true ||
      window.matchMedia("(display-mode: standalone)").matches;

    if (isIos && !isStandalone) {
      setShowPrompt(true);
    }
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    setShowPrompt(false);
    localStorage.setItem("riccos_ios_pwa_dismissed", "true");
  };

  if (!showPrompt || isDismissed) {
    return null;
  }

  return (
    <div
      className="fixed inset-x-3 z-50 mx-auto max-w-md animate-in fade-in slide-in-from-bottom-4 duration-300"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 6rem)" }}
    >
      <div className="glass relative rounded-3xl p-4 shadow-2xl">
        <button
          onClick={handleDismiss}
          className="absolute right-3 top-3 grid size-8 place-items-center rounded-full bg-secondary text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          aria-label="Fechar"
        >
          <X className="size-4" />
        </button>

        <div className="flex items-start gap-3">
          <LogoTile tone="dark" className="size-11 rounded-2xl" />

          <div className="space-y-2.5 pr-6">
            <div>
              <h3 className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
                Instale o RiccOS no seu iPhone
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary ring-1 ring-primary/20">
                  App
                </span>
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Use o sistema como um app nativo, em tela cheia e com inicialização rápida.
              </p>
            </div>

            <ol className="space-y-1.5 rounded-2xl border bg-background/60 p-2.5 text-xs">
              {[
                <>
                  Toque em <Share className="mx-0.5 inline-block size-3.5 text-primary" />{" "}
                  <strong>Compartilhar</strong> no Safari
                </>,
                <>
                  Selecione <PlusSquare className="mx-0.5 inline-block size-3.5 text-primary" />{" "}
                  <strong>Adicionar à Tela de Início</strong>
                </>,
                <>
                  Toque em <strong>Adicionar</strong> no canto superior direito
                </>,
              ].map((step, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>

            <div className="flex items-center justify-end pt-0.5">
              <Button variant="secondary" size="sm" onClick={handleDismiss}>
                Entendi
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
