import type { ElementType, ReactNode } from "react";

import { Card } from "@/components/ui/card";
import { formatBRL } from "@/lib/finance-data";
import { cn } from "@/lib/utils";

export type StatTone = "success" | "danger" | "warning" | "neutral" | "primary";

const toneStyles: Record<StatTone, { value: string; bubble: string; glow: string }> = {
  success: {
    value: "text-success",
    bubble: "bg-success-soft text-success",
    glow: "from-success/20",
  },
  danger: {
    value: "text-danger",
    bubble: "bg-danger-soft text-danger",
    glow: "from-danger/20",
  },
  warning: {
    value: "text-warning-foreground",
    bubble: "bg-warning-soft text-warning-foreground",
    glow: "from-warning/20",
  },
  neutral: {
    value: "text-foreground",
    bubble: "bg-secondary text-foreground",
    glow: "from-foreground/10",
  },
  primary: {
    value: "text-foreground",
    bubble: "bg-primary text-primary-foreground",
    glow: "from-primary/25",
  },
};

/**
 * Cartão de indicador padrão do RiccOS (KPI).
 * Usado na Visão Geral e nos Relatórios para manter o mesmo visual.
 */
export function StatCard({
  label,
  value,
  hint,
  tone = "neutral",
  icon: Icon,
  className,
  children,
}: {
  label: string;
  value: number | string;
  hint?: string;
  tone?: StatTone;
  icon?: ElementType;
  className?: string;
  children?: ReactNode;
}) {
  const t = toneStyles[tone];
  const display = typeof value === "number" ? formatBRL(value) : value;

  return (
    <Card className={cn("group relative overflow-hidden", className)}>
      {/* brilho suave no canto, na cor do tom */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute -right-10 -top-10 size-32 rounded-full bg-gradient-to-br to-transparent opacity-60 blur-2xl transition-opacity group-hover:opacity-100",
          t.glow,
        )}
      />
      <div className="relative flex items-start justify-between gap-3 p-5">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {label}
          </p>
          <p className={cn("mt-2 text-2xl font-semibold tabular-nums tracking-tight", t.value)}>
            {display}
          </p>
          {hint && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}
          {children}
        </div>
        {Icon && (
          <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", t.bubble)}>
            <Icon className="size-4" />
          </span>
        )}
      </div>
    </Card>
  );
}
