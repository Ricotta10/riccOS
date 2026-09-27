import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Beef,
  CalendarX,
  CheckCircle2,
  Flame,
  Lightbulb,
  Salad,
  SkipForward,
  TrendingUp,
  XCircle,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { PageHeader } from "@/components/riccos/app-shell";
import { useAlimentacao } from "@/components/riccos/alimentacao-store";
import { NoProtocolCard } from "@/components/riccos/alimentacao-widgets";
import { StatCard } from "@/components/riccos/stat-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  MOTIVOS,
  MOTIVO_LABEL,
  PERIODO_LABEL,
  WEEKDAY_SHORT,
  addDaysKey,
  computeDailyStats,
  dateRange,
  localDateKey,
  pctBoas,
  summarizeDays,
  type DbRelatorio,
  type Periodo,
} from "@/lib/alimentacao";
import { chartColors, chartTooltipStyle, formatDate } from "@/lib/finance-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/alimentacao/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatórios de alimentação — RiccOS" },
      {
        name: "description",
        content: "Consistência, calorias, proteína e onde você mais sai do plano.",
      },
    ],
  }),
  component: RelatoriosAlimentacao,
});

const RANGES = [
  { days: 7, label: "7 dias" },
  { days: 30, label: "30 dias" },
  { days: 90, label: "90 dias" },
] as const;

function RelatoriosAlimentacao() {
  const { refeicoes, metas, protocoloAtivo, relatorios, loaded } = useAlimentacao();
  const [range, setRange] = useState<number>(7);
  const today = localDateKey(new Date());
  const minRef = protocoloAtivo?.protocolo_refeicoes_min ?? 3;

  const days = useMemo(() => dateRange(addDaysKey(today, -(range - 1)), today), [today, range]);
  const stats = useMemo(
    () => computeDailyStats(refeicoes, days, metas, minRef, today),
    [refeicoes, days, metas, minRef, today],
  );
  const s = useMemo(() => summarizeDays(stats, refeicoes), [stats, refeicoes]);

  const chartData = stats.map((d) => ({
    dia:
      range <= 7
        ? WEEKDAY_SHORT[new Date(`${d.date}T12:00:00`).getDay()]
        : formatDate(d.date).slice(0, 5),
    kcal: Math.round(d.kcal),
    proteina: Math.round(d.proteina_g),
    vazio: d.registros === 0,
  }));

  const totalQ = s.qualidade.boa + s.qualidade.ok + s.qualidade.ruim;
  const totalRuins = s.qualidade.ruim;
  const motivosList = MOTIVOS.map((m) => ({ motivo: m, n: s.motivos[m] ?? 0 }))
    .filter((m) => m.n > 0)
    .sort((a, b) => b.n - a.n);
  // Semana começando na segunda para leitura mais natural.
  const weekdayData = [1, 2, 3, 4, 5, 6, 0].map((i) => ({
    dia: WEEKDAY_SHORT[i],
    ruins: s.ruinsPorDiaSemana[i] ?? 0,
  }));
  const periodoData = (Object.keys(PERIODO_LABEL) as Periodo[]).map((p) => ({
    periodo: PERIODO_LABEL[p],
    ruins: s.ruinsPorPeriodo[p],
  }));

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Alimentação"
        title="Relatórios"
        description="Consistência, metas batidas e onde você mais sai do plano."
        showPeriodFilter={false}
      >
        <div className="flex h-11 w-full gap-1 rounded-xl border bg-card p-1 shadow-soft sm:h-10 sm:w-auto">
          {RANGES.map((r) => (
            <button
              key={r.days}
              type="button"
              onClick={() => setRange(r.days)}
              className={cn(
                "flex-1 rounded-lg px-3 text-xs font-semibold transition-colors sm:flex-none",
                range === r.days
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </PageHeader>

      {loaded && !protocoloAtivo && <NoProtocolCard className="mb-4" />}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="Média de calorias"
          value={`${s.mediaKcal.toLocaleString("pt-BR")}`}
          hint={
            metas ? `meta ${metas.kcal.toLocaleString("pt-BR")} kcal` : "kcal por dia registrado"
          }
          icon={Flame}
        />
        <StatCard
          label="Média de proteína"
          value={`${s.mediaProteina} g`}
          hint={metas ? `meta ${metas.proteina_g} g` : "por dia registrado"}
          tone={metas && s.mediaProteina >= metas.proteina_g * 0.9 ? "success" : "neutral"}
          icon={Beef}
        />
        <StatCard
          label="Proteína batida"
          value={`${s.diasProteina}/${s.dias}`}
          hint="dias com ≥ 90% da meta"
          tone={s.dias > 0 && s.diasProteina / s.dias >= 0.7 ? "success" : "neutral"}
          icon={CheckCircle2}
        />
        <StatCard
          label="Refeições saudáveis"
          value={`${pctBoas(s.qualidade)}%`}
          hint={`${s.qualidade.boa} de ${totalQ} classificadas`}
          tone={pctBoas(s.qualidade) >= 70 ? "success" : totalQ > 0 ? "warning" : "neutral"}
          icon={Salad}
        />
        <StatCard
          label="Refeições puladas"
          value={String(s.refeicoesPuladas)}
          hint={`mínimo de ${minRef} por dia`}
          tone={s.refeicoesPuladas > 0 ? "danger" : "neutral"}
          icon={SkipForward}
        />
        <StatCard
          label="Dias sem registro"
          value={String(s.diasSemRegistro)}
          hint={`de ${s.diasCompletos} dias encerrados`}
          tone={s.diasSemRegistro > 0 ? "warning" : "neutral"}
          icon={CalendarX}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <DailyChart
          title="Calorias por dia"
          data={chartData}
          dataKey="kcal"
          target={metas?.kcal ?? null}
          unit="kcal"
          color={chartColors[0]!}
        />
        <DailyChart
          title="Proteína por dia"
          data={chartData}
          dataKey="proteina"
          target={metas?.proteina_g ?? null}
          unit="g"
          color={chartColors[1]!}
        />
      </div>

      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Onde você erra
      </h2>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Motivos</CardTitle>
            <CardDescription>
              {totalRuins === 0
                ? "Nenhuma refeição fora do plano no período."
                : `${totalRuins} ${totalRuins === 1 ? "refeição" : "refeições"} fora do plano`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5 pt-0">
            {motivosList.map(({ motivo, n }) => (
              <div key={motivo} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold">{MOTIVO_LABEL[motivo]}</span>
                  <span className="tabular-nums text-muted-foreground">{n}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-danger"
                    style={{ width: `${(n / totalRuins) * 100}%` }}
                  />
                </div>
              </div>
            ))}
            {s.ruinsSemMotivo > 0 && (
              <p className="text-xs text-muted-foreground">
                {s.ruinsSemMotivo} sem motivo informado — marque no Diário para o relatório ficar
                mais útil.
              </p>
            )}
          </CardContent>
        </Card>
        <SmallBars title="Por dia da semana" data={weekdayData} xKey="dia" />
        <SmallBars title="Por horário" data={periodoData} xKey="periodo" />
      </div>

      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Análises semanais
      </h2>
      {relatorios.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Toda segunda de manhã o agente analisa a semana anterior e a análise aparece aqui (e no
            seu iPhone, por push).
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {relatorios.map((r) => (
            <WeeklyReportCard key={r.relatorio_id} r={r} />
          ))}
        </div>
      )}
    </div>
  );
}

function DailyChart({
  title,
  data,
  dataKey,
  target,
  unit,
  color,
}: {
  title: string;
  data: { dia: string | undefined; vazio: boolean }[];
  dataKey: string;
  target: number | null;
  unit: string;
  color: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-base">{title}</CardTitle>
        {target ? (
          <CardDescription>
            Linha tracejada = meta de {target.toLocaleString("pt-BR")} {unit}
          </CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className="h-60 pt-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis
              dataKey="dia"
              tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={8}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
              axisLine={false}
              tickLine={false}
              width={48}
            />
            <Tooltip
              contentStyle={chartTooltipStyle}
              cursor={{ fill: "var(--color-secondary)" }}
              formatter={(v: number) => [
                `${v.toLocaleString("pt-BR")} ${unit}`,
                title.split(" ")[0],
              ]}
            />
            {target ? (
              <ReferenceLine
                y={target}
                stroke="var(--color-success)"
                strokeDasharray="5 4"
                strokeWidth={1.5}
              />
            ) : null}
            <Bar dataKey={dataKey} radius={[6, 6, 0, 0]} maxBarSize={36}>
              {data.map((d, i) => (
                <Cell key={i} fill={color} fillOpacity={d.vazio ? 0.25 : 1} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function SmallBars({
  title,
  data,
  xKey,
}: {
  title: string;
  data: Record<string, unknown>[];
  xKey: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>Refeições fora do plano</CardDescription>
      </CardHeader>
      <CardContent className="h-44 pt-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, left: -28, bottom: 0 }}>
            <XAxis
              dataKey={xKey}
              tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={chartTooltipStyle}
              cursor={{ fill: "var(--color-secondary)" }}
              formatter={(v: number) => [v, "Fora do plano"]}
            />
            <Bar dataKey="ruins" fill="var(--color-danger)" radius={[6, 6, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function WeeklyReportCard({ r }: { r: DbRelatorio }) {
  const m = r.relatorio_metricas;
  const a = r.relatorio_analise ?? {};
  const blocks: {
    title: string;
    items?: string[] | undefined;
    icon: typeof CheckCircle2;
    tone: string;
  }[] = [
    { title: "Acertos", items: a.acertos, icon: CheckCircle2, tone: "text-success" },
    { title: "Erros", items: a.erros, icon: XCircle, tone: "text-danger" },
    {
      title: "Ajustes para a semana",
      items: a.ajustes,
      icon: Lightbulb,
      tone: "text-warning-foreground",
    },
  ];
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="size-4" />
            Semana {formatDate(r.relatorio_semana_inicio).slice(0, 5)} –{" "}
            {formatDate(r.relatorio_semana_fim).slice(0, 5)}
          </CardTitle>
          {m && (
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="secondary">{m.mediaKcal?.toLocaleString("pt-BR")} kcal/dia</Badge>
              <Badge variant="secondary">P {m.mediaProteina} g/dia</Badge>
              <Badge variant={m.refeicoesPuladas > 0 ? "destructive" : "success"}>
                {m.refeicoesPuladas} puladas
              </Badge>
              {m.qualidade && <Badge variant="secondary">{pctBoas(m.qualidade)}% saudáveis</Badge>}
            </div>
          )}
        </div>
        {a.resumo && <CardDescription className="pt-1 leading-relaxed">{a.resumo}</CardDescription>}
      </CardHeader>
      <CardContent className="grid gap-4 pt-0 md:grid-cols-3">
        {blocks.map((b) =>
          b.items && b.items.length > 0 ? (
            <div key={b.title}>
              <p
                className={cn(
                  "mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em]",
                  b.tone,
                )}
              >
                <b.icon className="size-3.5" /> {b.title}
              </p>
              <ul className="space-y-1.5 text-sm">
                {b.items.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          ) : null,
        )}
      </CardContent>
    </Card>
  );
}
