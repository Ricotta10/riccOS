import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  ChevronDown,
  Layers,
  PieChart as PieIcon,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/riccos/app-shell";
import { StatCard } from "@/components/riccos/stat-card";
import { useRiccos } from "@/components/riccos/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  chartColors,
  chartTooltipStyle,
  formatBRL,
  getTransactionPeriod,
} from "@/lib/finance-data";
import { computeFutureProjection } from "@/lib/future-projection";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatórios — RiccOS | Histórico e projeções" },
      {
        name: "description",
        content:
          "Compare receitas e despesas mês a mês, veja o histórico consolidado e a projeção de gastos futuros.",
      },
      { property: "og:title", content: "Relatórios — RiccOS" },
      {
        property: "og:description",
        content: "Análise comparativa mensal e projeção de compromissos futuros no RiccOS.",
      },
    ],
  }),
  component: ReportsPage,
});

const ranges = {
  "3m": { label: "Últimos 3 meses", short: "3 meses", months: 3 },
  "6m": { label: "Últimos 6 meses", short: "6 meses", months: 6 },
  ano: { label: "Ano atual", short: "Ano", months: 12 },
};

const monthNamesShort = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

/** Eixo Y compacto: 500 → "500", 1500 → "1,5k", 3000 → "3k". */
function formatAxisValue(v: number) {
  if (Math.abs(v) < 1000) return String(v);
  const k = v / 1000;
  return `${Number.isInteger(k) ? k : k.toFixed(1).replace(".", ",")}k`;
}

function formatMonthYearLabel(ymStr: string) {
  const [y, m] = ymStr.split("-").map(Number);
  if (!y || !m) return ymStr;
  return `${monthNamesShort[m - 1]}/${y.toString().slice(-2)}`;
}

/** Chave "YYYY-MM" de um período (mês 1-indexado; aceita deslocamento fora de 1–12). */
function periodKey(year: number, month1: number) {
  const d = new Date(year, month1 - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Período (ciclo financeiro) a que a transação pertence, respeitando o dia de corte —
 * a mesma regra da Visão Geral e das Missões, para os números baterem entre as telas.
 */
function txPeriodKey(date: string, cutoffDay: number) {
  const { year, month } = getTransactionPeriod(date, cutoffDay);
  return periodKey(year, month);
}

/**
 * Chaves da janela selecionada, sempre terminando no período atual.
 * Sem a âncora, meses futuros (parcelas e recorrências já lançadas) entrariam no
 * lugar dos recentes — "3 meses" mostrava 2027 em vez dos últimos 3.
 */
function buildMonthWindow(
  range: keyof typeof ranges,
  anchor: { year: number; month1: number },
): string[] {
  // "Ano atual": de janeiro até o período corrente
  if (range === "ano") {
    return Array.from({ length: anchor.month1 }, (_, i) => periodKey(anchor.year, i + 1));
  }

  const n = ranges[range].months;
  return Array.from({ length: n }, (_, i) => periodKey(anchor.year, anchor.month1 - (n - 1 - i)));
}

function ReportsPage() {
  const { transactions } = useRiccos();
  const { profile } = useAuth();
  const [range, setRange] = useState<keyof typeof ranges>("6m");
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  const cutoffDay = profile?.dia_vencimento ?? 3;

  // Período (ciclo) corrente — âncora de todas as janelas desta página
  const currentPeriod = useMemo(() => {
    const { year, month } = getTransactionPeriod(new Date().toISOString().slice(0, 10), cutoffDay);
    return { year, month1: month };
  }, [cutoffDay]);

  // Agrupamento de todas as transações por período (YYYY-MM, com dia de corte)
  const monthlyAggregated = useMemo(() => {
    const map = new Map<
      string,
      { key: string; label: string; receitas: number; despesas: number }
    >();

    transactions.forEach((tx) => {
      if (!tx.date) return;
      const ym = txPeriodKey(tx.date, cutoffDay);
      if (!map.has(ym)) {
        map.set(ym, {
          key: ym,
          label: formatMonthYearLabel(ym),
          receitas: 0,
          despesas: 0,
        });
      }
      const item = map.get(ym)!;
      if (tx.type === "receita") {
        item.receitas += tx.amount;
      } else {
        item.despesas += tx.amount;
      }
    });

    return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
  }, [transactions, cutoffDay]);

  // Histórico da janela selecionada (meses sem lançamento entram zerados)
  const historyData = useMemo(() => {
    const byKey = new Map(monthlyAggregated.map((row) => [row.key, row]));
    const sliced = buildMonthWindow(range, currentPeriod).map(
      (key) =>
        byKey.get(key) ?? { key, label: formatMonthYearLabel(key), receitas: 0, despesas: 0 },
    );

    return sliced.map((row, i) => {
      const net = row.receitas - row.despesas;
      const previous = sliced[i - 1];
      const prevNet = previous ? previous.receitas - previous.despesas : null;
      const variation =
        prevNet !== null && prevNet !== 0 ? ((net - prevNet) / Math.abs(prevNet)) * 100 : null;
      return { ...row, net, variation };
    });
  }, [monthlyAggregated, range, currentPeriod]);

  // Métricas do período selecionado
  const periodMetrics = useMemo(() => {
    const totalReceitas = historyData.reduce((acc, r) => acc + r.receitas, 0);
    const totalDespesas = historyData.reduce((acc, r) => acc + r.despesas, 0);
    const resultado = totalReceitas - totalDespesas;
    const mediaMensalDespesas = historyData.length > 0 ? totalDespesas / historyData.length : 0;

    return { totalReceitas, totalDespesas, resultado, mediaMensalDespesas };
  }, [historyData]);

  // Gastos por Categoria e Subcategoria no Período Selecionado
  const categoryBreakdown = useMemo(() => {
    const selectedMonthsKeys = new Set(historyData.map((h) => h.key));
    const catMap = new Map<string, { total: number; subMap: Map<string, number> }>();

    transactions.forEach((tx) => {
      if (tx.type !== "despesa" || !tx.date) return;
      const ym = txPeriodKey(tx.date, cutoffDay);
      if (!selectedMonthsKeys.has(ym)) return;

      const cat = tx.category || "Outros";
      const sub = tx.subcategory?.trim() || "Geral";

      if (!catMap.has(cat)) {
        catMap.set(cat, { total: 0, subMap: new Map() });
      }
      const catObj = catMap.get(cat)!;
      catObj.total += tx.amount;
      catObj.subMap.set(sub, (catObj.subMap.get(sub) || 0) + tx.amount);
    });

    const totalSpent = Array.from(catMap.values()).reduce((a, b) => a + b.total, 0);

    const list = Array.from(catMap.entries())
      .map(([name, obj]) => {
        const percentage = totalSpent > 0 ? (obj.total / totalSpent) * 100 : 0;
        const subcategories = Array.from(obj.subMap.entries())
          .map(([subName, subAmount]) => ({
            name: subName,
            amount: subAmount,
            percentageOfCategory: obj.total > 0 ? (subAmount / obj.total) * 100 : 0,
          }))
          .sort((a, b) => b.amount - a.amount);

        return { name, amount: obj.total, percentage, subcategories };
      })
      .sort((a, b) => b.amount - a.amount)
      .map((item, index) => ({ ...item, color: chartColors[index % chartColors.length] }));

    return { list, totalSpent };
  }, [transactions, historyData, cutoffDay]);

  const toggleCategory = (categoryName: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [categoryName]: !prev[categoryName],
    }));
  };

  const allExpanded = useMemo(() => {
    if (categoryBreakdown.list.length === 0) return false;
    return categoryBreakdown.list.every((item) => expandedCategories[item.name]);
  }, [categoryBreakdown, expandedCategories]);

  const toggleExpandAll = () => {
    const nextState: Record<string, boolean> = {};
    const shouldExpand = !allExpanded;
    categoryBreakdown.list.forEach((item) => {
      nextState[item.name] = shouldExpand;
    });
    setExpandedCategories(nextState);
  };

  // Projeção futura: lançado + estimativa de variáveis (ver src/lib/future-projection.ts)
  const futureProjection = useMemo(
    () => computeFutureProjection({ transactions, cutoffDay, current: currentPeriod }),
    [transactions, cutoffDay, currentPeriod],
  );
  // Escala comum das barras: o maior entre gasto previsto e renda de todos os meses.
  const projectionScale = Math.max(
    1,
    ...futureProjection.rows.map((r) => Math.max(r.total, r.income)),
  );
  const projectionBase = futureProjection.basePeriods
    .map((p) => monthNamesShort[p.month1 - 1]?.toLowerCase())
    .join(", ");

  const totalSubcategories = categoryBreakdown.list.reduce(
    (acc, c) => acc + c.subcategories.length,
    0,
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        eyebrow="Financeiro"
        title="Relatórios"
        description="Análise comparativa de meses anteriores e projeção de compromissos futuros."
        showBalance={false}
        showPeriodFilter={false}
      >
        <Tabs
          value={range}
          onValueChange={(v) => setRange(v as keyof typeof ranges)}
          className="w-full sm:w-auto"
        >
          <TabsList className="grid h-11 w-full grid-cols-3 sm:h-10 sm:w-auto">
            {Object.entries(ranges).map(([key, value]) => (
              <TabsTrigger key={key} value={key} className="px-4 text-xs">
                {value.short}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </PageHeader>

      {/* KPI Cards de Resumo */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Receitas do período"
          value={periodMetrics.totalReceitas}
          tone="success"
          icon={ArrowUpRight}
        />
        <StatCard
          label="Despesas do período"
          value={periodMetrics.totalDespesas}
          tone="danger"
          icon={ArrowDownRight}
        />
        <StatCard
          label="Resultado líquido"
          value={periodMetrics.resultado}
          tone={periodMetrics.resultado >= 0 ? "success" : "danger"}
          icon={Wallet}
        />
        <StatCard
          label="Média mensal de despesas"
          value={periodMetrics.mediaMensalDespesas}
          tone="neutral"
          icon={Calendar}
        />
      </div>

      {/* Gráfico principal: Receitas vs Despesas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Receitas vs. despesas</CardTitle>
          <CardDescription className="text-xs">
            Evolução mês a mês · {ranges[range].label.toLowerCase()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-72 w-full sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={historyData} barGap={6} barCategoryGap="28%">
                <CartesianGrid
                  vertical={false}
                  stroke="var(--color-border)"
                  strokeDasharray="4 4"
                />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  tick={{ fill: "var(--color-muted-foreground)" }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  width={36}
                  tick={{ fill: "var(--color-muted-foreground)" }}
                  tickFormatter={formatAxisValue}
                />
                <Tooltip
                  formatter={(v: number) => formatBRL(v)}
                  cursor={{ fill: "var(--color-accent)", opacity: 0.5 }}
                  contentStyle={chartTooltipStyle}
                  itemStyle={{ color: "var(--color-foreground)" }}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
                />
                <Bar
                  dataKey="receitas"
                  name="Receitas"
                  fill="var(--color-success)"
                  radius={[8, 8, 4, 4]}
                  maxBarSize={36}
                />
                <Bar
                  dataKey="despesas"
                  name="Despesas"
                  fill="var(--color-chart-4)"
                  radius={[8, 8, 4, 4]}
                  maxBarSize={36}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Tabela de Histórico Mensal Consolidado */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Histórico consolidado</CardTitle>
            <CardDescription className="text-xs">
              Resultado líquido e variação em relação ao mês anterior
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 sm:p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-5 sm:pl-6">Mês</TableHead>
                    <TableHead className="text-right">Receitas</TableHead>
                    <TableHead className="text-right">Despesas</TableHead>
                    <TableHead className="text-right">Resultado</TableHead>
                    <TableHead className="pr-5 text-right sm:pr-6">Variação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historyData.map((row) => (
                    <TableRow key={row.key}>
                      <TableCell className="pl-5 text-sm font-semibold sm:pl-6">
                        {row.label}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium tabular-nums text-success">
                        {formatBRL(row.receitas)}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium tabular-nums text-danger">
                        {formatBRL(row.despesas)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right text-sm font-semibold tabular-nums",
                          row.net >= 0 ? "text-success" : "text-danger",
                        )}
                      >
                        {formatBRL(row.net)}
                      </TableCell>
                      <TableCell className="pr-5 text-right sm:pr-6">
                        {row.variation === null ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
                              row.variation >= 0
                                ? "bg-success-soft text-success"
                                : "bg-danger-soft text-danger",
                            )}
                          >
                            {row.variation >= 0 ? (
                              <TrendingUp className="size-3" />
                            ) : (
                              <TrendingDown className="size-3" />
                            )}
                            {row.variation.toFixed(1)}%
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {historyData.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="h-24 text-center text-sm text-muted-foreground"
                      >
                        Nenhum dado encontrado para o período selecionado.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Projeção Futura de Compromissos */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Projeção futura</CardTitle>
            <CardDescription className="text-xs">
              Fixos e parcelas já lançados + estimativa dos seus gastos variáveis.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative overflow-hidden rounded-2xl bg-primary p-4 text-primary-foreground">
              <div
                aria-hidden
                className="pointer-events-none absolute -right-8 -top-8 size-32 rounded-full bg-brand-snow/10 blur-2xl"
              />
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] opacity-80">
                Sobra prevista · {futureProjection.monthsWithIncome}{" "}
                {futureProjection.monthsWithIncome === 1 ? "mês" : "meses"}
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {futureProjection.totalBalance < 0 ? "−" : "+"}
                {formatBRL(Math.abs(futureProjection.totalBalance))}
              </p>
              <p className="mt-1 text-xs opacity-80">
                {futureProjection.variableMedian !== null
                  ? `Variáveis estimados em ~${formatBRL(futureProjection.variableMedian)}/mês (mediana de ${projectionBase}).`
                  : "Ainda sem um mês completo de histórico: considera só o que já está lançado."}
              </p>
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1 px-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-primary" /> Lançado
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-primary/35" /> Variáveis estimados
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-0.5 rounded-full bg-foreground/60" /> Renda
              </span>
            </div>

            <div className="space-y-1.5">
              {futureProjection.rows.map((row) => (
                <div
                  key={row.key}
                  className="rounded-xl px-3 py-2.5 transition-colors hover:bg-accent/60"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      {formatMonthYearLabel(row.key)}
                      {row.isCurrent && (
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                          atual
                        </span>
                      )}
                    </span>
                    {row.income > 0 ? (
                      <span
                        className={cn(
                          "text-sm font-semibold tabular-nums",
                          row.balance >= 0 ? "text-success" : "text-danger",
                        )}
                      >
                        {row.balance < 0 ? "−" : "+"}
                        {formatBRL(Math.abs(row.balance))}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">sem receita lançada</span>
                    )}
                  </div>
                  <div className="relative mt-2 flex h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full bg-primary"
                      style={{ width: `${(row.committed / projectionScale) * 100}%` }}
                    />
                    <div
                      className="h-full bg-primary/35"
                      style={{ width: `${(row.estimatedVariable / projectionScale) * 100}%` }}
                    />
                    {row.income > 0 && (
                      <div
                        aria-hidden
                        className="absolute inset-y-0 w-0.5 bg-foreground/60"
                        style={{ left: `${Math.min(99.5, (row.income / projectionScale) * 100)}%` }}
                      />
                    )}
                  </div>
                  <p className="mt-1.5 text-[11px] tabular-nums text-muted-foreground">
                    Gastos ~{formatBRL(row.total)}
                    {row.income > 0 && ` de ${formatBRL(row.income)}`}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Distribuição de Gastos por Categoria e Subcategoria */}
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
                <Layers className="size-4" />
              </span>
              Categorias & subcategorias
            </CardTitle>
            <CardDescription className="mt-1.5 text-xs">
              Toque em uma categoria para detalhar · {ranges[range].label.toLowerCase()}
            </CardDescription>
          </div>
          {categoryBreakdown.list.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={toggleExpandAll}
              className="w-full sm:w-auto"
            >
              {allExpanded ? "Recolher todas" : "Expandir todas"}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {categoryBreakdown.list.length > 0 ? (
            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
              <div className="space-y-2.5 lg:col-span-2">
                {categoryBreakdown.list.map((item) => {
                  const isExpanded = !!expandedCategories[item.name];

                  return (
                    <div
                      key={item.name}
                      className="rounded-2xl border bg-background/40 p-3.5 transition-colors hover:border-ring/40"
                    >
                      <button
                        type="button"
                        onClick={() => toggleCategory(item.name)}
                        aria-expanded={isExpanded}
                        className="group flex w-full items-center justify-between gap-3 text-left"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span
                            className="size-2.5 shrink-0 rounded-full shadow-[0_0_8px_currentColor]"
                            style={{ backgroundColor: item.color, color: item.color }}
                          />
                          <span className="truncate text-sm font-semibold">{item.name}</span>
                          <span className="hidden shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground sm:inline">
                            {item.subcategories.length}{" "}
                            {item.subcategories.length === 1 ? "subcategoria" : "subcategorias"}
                          </span>
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          <div className="text-right">
                            <span className="mr-2 text-xs tabular-nums text-muted-foreground">
                              {item.percentage.toFixed(1)}%
                            </span>
                            <span className="text-sm font-semibold tabular-nums">
                              {formatBRL(item.amount)}
                            </span>
                          </div>
                          <ChevronDown
                            className={cn(
                              "size-4 text-muted-foreground transition-transform duration-300",
                              isExpanded && "rotate-180",
                            )}
                          />
                        </div>
                      </button>

                      <Progress
                        value={item.percentage}
                        className="mt-3 h-1.5"
                        style={{ "--progress-background": item.color } as React.CSSProperties}
                      />

                      {isExpanded && (
                        <div className="mt-3 space-y-2 border-t border-border/60 pt-3 animate-in fade-in slide-in-from-top-1 duration-200">
                          {item.subcategories.map((sub) => (
                            <div key={sub.name} className="rounded-xl bg-secondary/60 p-3">
                              <div className="flex items-center justify-between gap-2 text-xs">
                                <span className="truncate font-medium">{sub.name}</span>
                                <div className="flex shrink-0 items-center gap-2 tabular-nums">
                                  <span className="text-[11px] text-muted-foreground">
                                    {sub.percentageOfCategory.toFixed(1)}%
                                  </span>
                                  <span className="font-semibold">{formatBRL(sub.amount)}</span>
                                </div>
                              </div>
                              <Progress
                                value={sub.percentageOfCategory}
                                className="mt-2 h-1 bg-background"
                                style={
                                  { "--progress-background": item.color } as React.CSSProperties
                                }
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Resumo lateral */}
              <div className="relative overflow-hidden rounded-2xl border bg-secondary/40 p-6 text-center lg:sticky lg:top-6">
                <div
                  aria-hidden
                  className="pointer-events-none absolute -left-10 -top-10 size-40 rounded-full bg-primary/15 blur-3xl"
                />
                <span className="relative mx-auto grid size-12 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-glow">
                  <PieIcon className="size-5" />
                </span>
                <p className="relative mt-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Total de despesas no período
                </p>
                <p className="relative mt-1 text-2xl font-semibold tabular-nums">
                  {formatBRL(categoryBreakdown.totalSpent)}
                </p>
                <p className="relative mt-2 text-xs text-muted-foreground">
                  Distribuídas em {categoryBreakdown.list.length} categorias e {totalSubcategories}{" "}
                  subcategorias
                </p>
              </div>
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed py-10 text-center text-sm text-muted-foreground">
              Nenhuma despesa registrada no período selecionado.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
