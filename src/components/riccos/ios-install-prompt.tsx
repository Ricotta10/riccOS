import { useEffect, useState } from "react";
import { Share, PlusSquare, X, Smartphone, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

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
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="relative rounded-2xl border border-border/60 bg-card/95 p-4 shadow-2xl backdrop-blur-xl">
        <button
          onClick={handleDismiss}
          className="absolute right-3 top-3 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label="Fechar"
        >
          <X className="size-4" />
        </button>

        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Smartphone className="size-6 text-emerald-400" />
          </div>

          <div className="space-y-2 pr-6">
            <div>
              <h3 className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                Instale o RiccOS no seu iPhone
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                  App PWA
                </span>
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Use o sistema como um app nativo, sem barra de navegação do Safari e com inicialização rápida.
              </p>
            </div>

            <div className="space-y-1.5 pt-1 text-xs text-foreground/90 bg-muted/40 p-2.5 rounded-lg border border-border/40">
              <div className="flex items-center gap-2">
                <span className="flex size-5 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-primary">
                  1
                </span>
                <span>Toque no botão <Share className="inline-block size-3.5 mx-0.5 text-blue-400" /> <strong>Compartilhar</strong> no Safari</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex size-5 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-primary">
                  2
                </span>
                <span>Selecione <PlusSquare className="inline-block size-3.5 mx-0.5 text-emerald-400" /> <strong>Adicionar à Tela de Início</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex size-5 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-primary">
                  3
                </span>
                <span>Toque em <strong>Adicionar</strong> no canto superior direito</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground hover:text-foreground"
                onClick={handleDismiss}
              >
                Entendi
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
