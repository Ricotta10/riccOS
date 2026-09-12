import { cn } from "@/lib/utils";

/**
 * Marca RR do RiccOS.
 * Renderizada via CSS mask (`/logo-mask.png`), então herda a cor do texto:
 * use `text-primary`, `text-brand-mint`, `text-foreground` etc. para tingir.
 */
export function LogoMark({ className }: { className?: string }) {
  return <span aria-hidden className={cn("logo-mark h-6", className)} />;
}

/** Marca dentro de um "tile" arredondado — usado em headers, login e nav. */
export function LogoTile({
  className,
  markClassName,
  tone = "dark",
}: {
  className?: string;
  markClassName?: string;
  /** dark = tile preto com marca mint · light = tile mint com marca preta · glass = translúcido */
  tone?: "dark" | "light" | "glass";
}) {
  const toneClass =
    tone === "dark"
      ? "bg-brand-black text-brand-mint ring-1 ring-brand-snow/10"
      : tone === "light"
        ? "bg-brand-mint text-brand-black"
        : "bg-primary/10 text-primary ring-1 ring-primary/20";
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-2xl shadow-soft",
        toneClass,
        className,
      )}
    >
      <LogoMark className={cn("h-[46%]", markClassName)} />
    </span>
  );
}

/** Wordmark tipográfico "RiccOS" em Poppins. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-semibold tracking-tight leading-none", className)}>
      Ricc<span className="text-primary">OS</span>
    </span>
  );
}
