import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Crown, Flame, Trophy } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { FAIXA_LABEL, FAIXA_THRESHOLDS, type Faixa } from "@/lib/gamification";
import { cn } from "@/lib/utils";
import { useGamification } from "./gamification";

/* ---------- Faixa ---------- */

export const faixaStyles: Record<Faixa, { badge: string; ring: string; text: string }> = {
  nenhuma: {
    badge: "bg-secondary text-muted-foreground",
    ring: "stroke-muted-foreground",
    text: "text-muted-foreground",
  },
  bronze: {
    badge: "bg-warning-soft text-warning-foreground",
    ring: "stroke-warning",
    text: "text-warning-foreground",
  },
  prata: {
    badge: "bg-foreground/10 text-foreground",
    ring: "stroke-foreground",
    text: "text-foreground",
  },
  ouro: {
    badge: "bg-primary text-primary-foreground shadow-glow",
    ring: "stroke-primary",
    text: "text-primary",
  },
};

export function FaixaBadge({ faixa, className }: { faixa: Faixa; className?: string }) {
  return (
    <Badge className={cn("border-transparent", faixaStyles[faixa].badge, className)}>
      {faixa === "ouro" && <Crown className="size-3" />}
      {FAIXA_LABEL[faixa]}
    </Badge>
  );
}

/* ---------- Anel de progresso da temporada ---------- */

export function SeasonRing({
  pct,
  faixa,
  size = 168,
  stroke = 12,
  children,
  className,
}: {
  pct: number;
  faixa: Faixa;
  size?: number;
  stroke?: number;
  children?: React.ReactNode;
  className?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));
  const dash = (clamped / 100) * c;

  // Marcadores das faixas (bronze / prata / ouro)
  const markers = (Object.keys(FAIXA_THRESHOLDS) as Exclude<Faixa, "nenhuma">[]).map((k) => ({
    key: k,
    angle: FAIXA_THRESHOLDS[k] * 360 - 90,
  }));

  return (
    <div
      className={cn("relative grid place-items-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          className="stroke-secondary"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          className={cn(
            "transition-[stroke-dasharray] duration-700 ease-out",
            faixaStyles[faixa].ring,
          )}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
        />
      </svg>
      {/* Marcadores */}
      {markers.map((m) => {
        const rad = (m.angle * Math.PI) / 180;
        const x = size / 2 + r * Math.cos(rad);
        const y = size / 2 + r * Math.sin(rad);
        return (
          <span
            key={m.key}
            title={FAIXA_LABEL[m.key]}
            className="absolute size-2 rounded-full bg-background ring-2 ring-foreground/40"
            style={{ left: x - 4, top: y - 4 }}
          />
        );
      })}
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}

/* ---------- Card compacto (Visão Geral) ---------- */

export function ScoreCard({ className }: { className?: string }) {
  const { season, level, streak, closedSeason, loading } = useGamification();
  const s = faixaStyles[season.faixa];

  return (
    <Card className={cn("group relative overflow-hidden", className)}>
      <div
        aria-hidden
        className="pointer-events-none absolute -right-12 -top-12 size-40 rounded-full bg-primary/15 blur-3xl transition-opacity group-hover:opacity-100"
      />
      <Link
        to="/missoes"
        className="relative flex items-center gap-4 p-5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <SeasonRing pct={season.pct} faixa={season.faixa} size={84} stroke={8}>
          <Trophy className={cn("size-5", s.text)} />
        </SeasonRing>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Temporada
            </p>
            {closedSeason && (
              <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                Encerrada
              </span>
            )}
          </div>
          <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">
            {loading ? "—" : season.points}
            <span className="text-sm font-medium text-muted-foreground">
              {" "}
              / {season.maxPoints} pts
            </span>
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <FaixaBadge faixa={season.faixa} />
            <span className="text-xs text-muted-foreground">
              Nível {level.level} · {level.name}
            </span>
            {streak > 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Flame className="size-3 text-warning" /> {streak}
              </span>
            )}
          </div>
        </div>
        <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground" />
      </Link>
    </Card>
  );
}

/* ---------- Selo discreto (Central de comando) ---------- */

export function ScoreBadge({ className }: { className?: string }) {
  const { season, level, loading } = useGamification();
  if (loading) return null;
  return (
    <Link
      to="/missoes"
      className={cn(
        "glass inline-flex items-center gap-2.5 rounded-full py-1.5 pl-1.5 pr-4 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground",
        className,
      )}
    >
      <span className="grid size-7 place-items-center rounded-full bg-primary text-primary-foreground">
        <Trophy className="size-3.5" />
      </span>
      <span>
        Nível {level.level} · <span className="text-foreground">{level.name}</span>
      </span>
      <span className="size-1 rounded-full bg-border" />
      <span className="tabular-nums">
        <span className="text-foreground">{season.points}</span>/{season.maxPoints} pts
      </span>
      <FaixaBadge faixa={season.faixa} className="ml-0.5 px-2 py-0 text-[10px]" />
    </Link>
  );
}
