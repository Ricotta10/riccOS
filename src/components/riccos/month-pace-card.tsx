import { useMemo } from "react";
import { AlertTriangle, CheckCircle2, Gauge } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { formatBRL } from "@/lib/finance-data";
import {
  computeMonthPace,
  formatPeriodDay,
  MIN_DAYS_TO_PROJECT,
  type MonthPace,
} from "@/lib/month-pace";
import { cn } from "@/lib/utils";
import { useRiccos } from "./store";

/** Máximo de metas em atenção listadas no card — o resto vira contagem. */
const MAX_ALERTS = 4;

function headlineLabel(pace: MonthPace) {
  if (pace.phase === "fechado") return "Total gasto";
  if (pace.phase === "futuro") return "Já comprometido";
  return pace.projectionReliable ? "Projeção de gastos" : "Lançado até agora";
}

function periodDescription(pace: MonthPace) {
  if (pace.phase === "fechado") return `Período encerrado em ${formatPeriodDay(pace.end)}.`;
  if (pace.phase === "futuro")
    return `Começa em ${formatPeriodDay(pace.start)}. Considera só o que já está lançado.`;
  return `Dia ${pace.elapsedDays} de ${pace.totalDays} · termina em ${formatPeriodDay(pace.end)}.`;
}

export function MonthPaceCard({ className }: { className?: string }) {
  const { profile } = useAuth();
  const { month, year, monthTransactions, dbCategories, dbGoals } = useRiccos();
  const cutoffDay = profile?.dia_vencimento ?? 3;

  const pace = useMemo(
    () =>
      computeMonthPace({
        month1: month + 1,
        year,
        cutoffDay,
        monthTransactions,
        categories: dbCategories,
        goals: dbGoals,
      }),
    [month, year, cutoffDay, monthTransactions, dbCategories, dbGoals],
  );

  const overIncome = pace.income > 0 && pace.projected > pace.income;
  const scale = Math.max(pace.income, pace.projected, 1);
  const realizedPct = (pace.realized / scale) * 100;
  const upcoming = pace.projected - pace.realized;
  const upcomingPct = (upcoming / scale) * 100;
  const incomePct = pace.income > 0 ? Math.round((pace.projected / pace.income) * 100) : null;

  const alerts = pace.categories.filter((c) => c.status !== "ok");
  const onTrack = pace.categories.length - alerts.length;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
            <Gauge className="size-4" />
          </span>
          Ritmo do mês
        </CardTitle>
        <CardDescription className="text-xs">{periodDescription(pace)}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Projeção geral vs. renda */}
        <div>
          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
            <div className="min-w-0">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {headlineLabel(pace)}
              </span>
              <p className="text-2xl font-semibold tabular-nums">
                {formatBRL(pace.projected)}
                {pace.income > 0 && (
                  <span className="text-sm font-medium text-muted-foreground">
                    {" "}
                    / {formatBRL(pace.income)}
                  </span>
                )}
              </p>
            </div>
            <div className="text-right">
              {pace.income > 0 ? (
                <>
                  <p
                    className={cn(
                      "text-lg font-semibold tabular-nums",
                      pace.projectedBalance >= 0 ? "text-success" : "text-danger",
                    )}
                  >
                    {pace.projectedBalance >= 0 ? "+" : "−"}
                    {formatBRL(Math.abs(pace.projectedBalance))}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {pace.phase === "fechado" ? "sobra do mês" : "sobra estimada"} ·{" "}
                    <span className="tabular-nums">{incomePct}%</span> da renda
                  </p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">Sem receitas lançadas</p>
              )}
            </div>
          </div>

          <div className="mt-4 flex h-2.5 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className={cn(
                "h-full transition-all duration-700",
                overIncome ? "bg-danger" : "bg-primary",
              )}
              style={{ width: `${realizedPct}%` }}
            />
            <div
              className={cn(
                "h-full transition-all duration-700",
                overIncome ? "bg-danger/35" : "bg-primary/35",
              )}
              style={{ width: `${upcomingPct}%` }}
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span
                className={cn("size-2 rounded-full", overIncome ? "bg-danger" : "bg-primary")}
              />
              Já saiu <span className="tabular-nums">{formatBRL(pace.realized)}</span>
            </span>
            {upcoming > 0.005 && (
              <span className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "size-2 rounded-full",
                    overIncome ? "bg-danger/35" : "bg-primary/35",
                  )}
                />
                {pace.projectionReliable ? "Previsto até o fim" : "Agendado"}{" "}
                <span className="tabular-nums">{formatBRL(upcoming)}</span>
              </span>
            )}
          </div>
          {pace.phase === "andamento" && !pace.projectionReliable && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              A estimativa dos gastos variáveis começa no {MIN_DAYS_TO_PROJECT}º dia do período.
            </p>
          )}
        </div>

        {/* Metas que pedem atenção */}
        {pace.categories.length > 0 && (
          <div className="space-y-2 border-t border-border/60 pt-4">
            {alerts.length === 0 ? (
              <p className="flex items-center gap-2 text-sm font-medium">
                <CheckCircle2 className="size-4 text-success" />
                {pace.categories.length === 1
                  ? "A meta do mês está no ritmo."
                  : `As ${pace.categories.length} metas do mês estão no ritmo.`}
              </p>
            ) : (
              <>
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Metas em atenção
                </span>
                {alerts.slice(0, MAX_ALERTS).map((c) => (
                  <div
                    key={c.categoryId}
                    className="flex items-center justify-between gap-3 rounded-2xl border bg-background/40 px-3.5 py-2.5"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold">{c.name}</span>
                        <Badge
                          variant={c.status === "estourou" ? "destructive" : "warning"}
                          className="shrink-0"
                        >
                          <AlertTriangle className="size-3" />
                          {c.status === "estourou" ? "Estourou" : "Em risco"}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                        {c.status === "estourou"
                          ? `${formatBRL(c.spent)} de ${formatBRL(c.limit)}`
                          : `Projeção ${formatBRL(c.projected)} de ${formatBRL(c.limit)}`}
                      </p>
                    </div>
                    <div className="shrink-0 text-right text-xs tabular-nums">
                      {c.status === "estourou" ? (
                        <span className="font-semibold text-danger">
                          +{formatBRL(c.spent - c.limit)}
                        </span>
                      ) : c.dailyAllowance !== null ? (
                        <>
                          <span className="font-semibold">{formatBRL(c.dailyAllowance)}</span>
                          <span className="text-muted-foreground">/dia</span>
                        </>
                      ) : null}
                    </div>
                  </div>
                ))}
                {(alerts.length > MAX_ALERTS || onTrack > 0) && (
                  <p className="text-xs text-muted-foreground">
                    {[
                      alerts.length > MAX_ALERTS && `+${alerts.length - MAX_ALERTS} em atenção`,
                      onTrack > 0 && `${onTrack} ${onTrack === 1 ? "meta" : "metas"} no ritmo`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
