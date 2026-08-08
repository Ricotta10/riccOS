import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  ChevronDown,
  ChevronUp,
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

import { PageHeader } from "@/components/riccos/app-shell";
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
import { formatBRL } from "@/lib/finance-data";

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
  "3m": { label: "Últimos 3 meses", months: 3 },
  "6m": { label: "Últimos 6 meses", months: 6 },
  ano: { label: "Ano Atual", months: 12 },
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

const CATEGORY_COLORS = [
  "#6366F1",
  "#EC4899",
  "#10B981",
  "#F59E0B",
  "#8B5CF6",
  "#3B82F6",
  "#EF4444",
  "#14B8A6",
  "#F97316",
  "#06B6D4",
];

function formatMonthYearLabel(ymStr: string) {
  const [y, m] = ymStr.split("-").map(Number);
  if (!y || !m) return ymStr;
  return `${monthNamesShort[m - 1]}/${y.toString().slice(-2)}`;
}

function ReportsPage() {
  const { transactions } = useRiccos();
  const [range, setRange] = useState<keyof typeof ranges>("6m");
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  // Agrupamento de todas as transações por mês (YYYY-MM)
  const monthlyAggregated = useMemo(() => {
    const map = new Map<string, { key: string; label: string; receitas: number; despesas: number }>();

    transactions.forEach((tx) => {
      if (!tx.date) return;
      const ym = tx.date.slice(0, 7);
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
  }, [transactions]);

  // Filtrar histórico conforme range selecionado
  const historyData = useMemo(() => {
    const numMonths = ranges[range].months;
    const sliced = monthlyAggregated.slice(-numMonths);

    return sliced.map((row, i) => {
      const net = row.receitas - row.despesas;
      const previous = sliced[i - 1];
      const prevNet = previous ? previous.receitas - previous.despesas : null;
      const variation =
        prevNet !== null && prevNet !== 0 ? ((net - prevNet) / Math.abs(prevNet)) * 100 : null;
      return { ...row, net, variation };
    });
  }, [monthlyAggregated, range]);

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
      const ym = tx.date.slice(0, 7);
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
      .map(([name, obj], index) => {
        const percentage = totalSpent > 0 ? (obj.total / totalSpent) * 100 : 0;
        const subcategories = Array.from(obj.subMap.entries())
          .map(([subName, subAmount]) => ({
            name: subName,
            amount: subAmount,
            percentageOfCategory: obj.total > 0 ? (subAmount / obj.total) * 100 : 0,
          }))
          .sort((a, b) => b.amount - a.amount);

        return {
          name,
          amount: obj.total,
          percentage,
          subcategories,
          color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
        };
      })
      .sort((a, b) => b.amount - a.amount);

    return { list, totalSpent };
  }, [transactions, historyData]);

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

  // Projeção Futura (Próximos Meses a partir de hoje)
  const futureProjection = useMemo(() => {
    const nowStr = new Date().toISOString().slice(0, 7); // "YYYY-MM"
    const map = new Map<string, { label: string; committed: number; count: number }>();

    transactions.forEach((tx) => {
      if (tx.type !== "despesa" || !tx.date) return;
      const ym = tx.date.slice(0, 7);
      if (ym < nowStr) return;

      if (!map.has(ym)) {
        map.set(ym, {
          label: formatMonthYearLabel(ym),
          committed: 0,
          count: 0,
        });
      }
      const item = map.get(ym)!;
      item.committed += tx.amount;
      item.count += 1;
    });

    const sorted = Array.from(map.entries())
      .sort(([k1], [k2]) => k1.localeCompare(k2))
      .slice(0, 6)
      .map(([, val]) => val);

    const totalCommitted = sorted.reduce((acc, item) => acc + item.committed, 0);

    return { list: sorted, totalCommitted };
  }, [transactions]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Relatórios & Histórico"
        description="Análise comparativa de meses anteriores e projeção de compromissos futuros."
        showBalance={false}
        showPeriodFilter={false}
      />

      <div className="flex items-center justify-between w-full">
        <Tabs value={range} onValueChange={(v) => setRange(v as keyof typeof ranges)} className="w-full sm:w-auto">
          <TabsList className="bg-muted/60 p-1 grid grid-cols-3 w-full sm:w-auto h-11 sm:h-10">
            {Object.entries(ranges).map(([key, value]) => (
              <TabsTrigger key={key} value={key} className="text-xs font-semibold px-2">
                {key === "3m" ? "3 Meses" : key === "6m" ? "6 Meses" : "Ano"}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* KPI Cards de Resumo */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-none">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-muted-foreground">
                Receitas do Período
              </span>
              <div className="rounded-lg bg-success/10 p-2 text-success">
                <ArrowUpRight className="size-4" />
              </div>
            </div>
            <p className="mt-3 text-2xl font-bold tabular-nums text-success">
              {formatBRL(periodMetrics.totalReceitas)}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-muted-foreground">
                Despesas do Período
              </span>
              <div className="rounded-lg bg-danger/10 p-2 text-danger">
                <ArrowDownRight className="size-4" />
              </div>
            </div>
            <p className="mt-3 text-2xl font-bold tabular-nums text-danger">
              {formatBRL(periodMetrics.totalDespesas)}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-muted-foreground">
                Resultado Líquido
              </span>
              <div
                className={`rounded-lg p-2 ${periodMetrics.resultado >= 0 ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}
              >
                <Wallet className="size-4" />
              </div>
            </div>
            <p
              className={`mt-3 text-2xl font-bold tabular-nums ${periodMetrics.resultado >= 0 ? "text-success" : "text-danger"}`}
            >
              {formatBRL(periodMetrics.resultado)}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-muted-foreground">
                Média Mensal Despesas
              </span>
              <div className="rounded-lg bg-accent p-2 text-muted-foreground">
                <Calendar className="size-4" />
              </div>
            </div>
            <p className="mt-3 text-2xl font-bold tabular-nums">
              {formatBRL(periodMetrics.mediaMensalDespesas)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico principal: Receitas vs Despesas */}
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle>Receitas vs. Despesas</CardTitle>
          <CardDescription>Evolução mês a mês no período selecionado</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={historyData} barGap={6}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  fontSize={12}
                  tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
                />
                <Tooltip
                  formatter={(v: number) => formatBRL(v)}
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    background: "var(--popover)",
                    fontSize: 12,
                  }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Bar
                  dataKey="receitas"
                  name="Receitas"
                  fill="var(--chart-1)"
                  radius={[6, 6, 0, 0]}
                />
                <Bar
                  dataKey="despesas"
                  name="Despesas"
                  fill="var(--chart-2)"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Tabela de Histórico Mensal Consolidado */}
        <Card className="shadow-none lg:col-span-3">
          <CardHeader>
            <CardTitle>Histórico Consolidado Mensal</CardTitle>
            <CardDescription>
              Resultado líquido e variação em relação ao mês anterior
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Mês/Ano</TableHead>
                    <TableHead className="text-right">Receitas</TableHead>
                    <TableHead className="text-right">Despesas</TableHead>
                    <TableHead className="text-right">Resultado</TableHead>
                    <TableHead className="pr-6 text-right">Variação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historyData.map((row) => (
                    <TableRow key={row.key}>
                      <TableCell className="pl-6 text-sm font-medium">{row.label}</TableCell>
                      <TableCell className="text-right text-sm font-medium tabular-nums text-success">
                        {formatBRL(row.receitas)}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium tabular-nums text-danger">
                        {formatBRL(row.despesas)}
                      </TableCell>
                      <TableCell
                        className={`text-right text-sm font-bold tabular-nums ${
                          row.net >= 0 ? "text-success" : "text-danger"
                        }`}
                      >
                        {formatBRL(row.net)}
                      </TableCell>
                      <TableCell className="pr-6 text-right">
                        {row.variation === null ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          <span
                            className={`inline-flex items-center gap-1 text-xs font-semibold tabular-nums ${
                              row.variation >= 0 ? "text-success" : "text-danger"
                            }`}
                          >
                            {row.variation >= 0 ? (
                              <TrendingUp className="size-3.5" />
                            ) : (
                              <TrendingDown className="size-3.5" />
                            )}
                            {row.variation.toFixed(1)}%
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {historyData.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-sm text-muted-foreground">
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
        <Card className="shadow-none lg:col-span-2">
          <CardHeader>
            <CardTitle>Projeção Futura</CardTitle>
            <CardDescription>Compromissos recorrentes e parcelas vincendas</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl bg-secondary p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Total comprometido
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums">
                {formatBRL(futureProjection.totalCommitted)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Próximos {futureProjection.list.length} meses projetados
              </p>
            </div>
            <div className="space-y-1">
              {futureProjection.list.map((item) => (
                <div
                  key={item.label}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-accent"
                >
                  <span className="truncate text-sm font-medium">{item.label}</span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">
                    {formatBRL(item.committed)}
                  </span>
                </div>
              ))}
              {futureProjection.list.length === 0 && (
                <p className="py-4 text-center text-xs text-muted-foreground">
                  Sem projeções de gastos para os próximos meses.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* NOVA SESSÃO: Distribuição de Gastos por Categoria e Subcategoria */}
      <Card className="shadow-none">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Layers className="size-5 text-primary" />
              <span>Distribuição por Categoria e Subcategoria</span>
            </CardTitle>
            <CardDescription className="mt-1">
              Clique em uma categoria para destrinchar suas subcategorias no período de {ranges[range].label.toLowerCase()}
            </CardDescription>
          </div>
          {categoryBreakdown.list.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={toggleExpandAll}
              className="w-full sm:w-auto text-xs font-semibold"
            >
              {allExpanded ? "Recolher Todas" : "Expandir Subcategorias"}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {categoryBreakdown.list.length > 0 ? (
            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
              <div className="space-y-4 lg:col-span-2">
                {categoryBreakdown.list.map((item) => {
                  const isExpanded = !!expandedCategories[item.name];

                  return (
                    <div
                      key={item.name}
                      className="rounded-xl border bg-card p-3.5 space-y-2.5 transition-all"
                    >
                      {/* Cabecalho da Categoria */}
                      <button
                        type="button"
                        onClick={() => toggleCategory(item.name)}
                        className="w-full flex items-center justify-between text-left group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className="size-3 rounded-full shrink-0"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
                            {item.name}
                          </span>
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-secondary text-muted-foreground shrink-0">
                            {item.subcategories.length} {item.subcategories.length === 1 ? "subcategoria" : "subcategorias"}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <span className="text-xs text-muted-foreground mr-2 font-medium">
                              {item.percentage.toFixed(1)}%
                            </span>
                            <span className="font-bold text-sm tabular-nums">
                              {formatBRL(item.amount)}
                            </span>
                          </div>
                          <div className="p-1 rounded-lg hover:bg-accent text-muted-foreground">
                            {isExpanded ? (
                              <ChevronUp className="size-4" />
                            ) : (
                              <ChevronDown className="size-4" />
                            )}
                          </div>
                        </div>
                      </button>

                      {/* Barra de Progresso da Categoria */}
                      <Progress value={item.percentage} className="h-2" />

                      {/* Subcategorias Detalhadas (Expandível) */}
                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t space-y-2">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                            Detalhamento de {item.name}
                          </p>
                          <div className="space-y-2">
                            {item.subcategories.map((sub) => (
                              <div
                                key={sub.name}
                                className="rounded-lg bg-secondary/50 p-2.5 space-y-1.5"
                              >
                                <div className="flex items-center justify-between text-xs">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="size-1.5 rounded-full bg-muted-foreground/60 shrink-0" />
                                    <span className="font-medium text-foreground truncate">
                                      {sub.name}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2.5 tabular-nums shrink-0">
                                    <span className="text-[11px] font-semibold text-muted-foreground">
                                      {sub.percentageOfCategory.toFixed(1)}% da categoria
                                    </span>
                                    <span className="font-bold text-xs text-foreground">
                                      {formatBRL(sub.amount)}
                                    </span>
                                  </div>
                                </div>
                                <Progress value={sub.percentageOfCategory} className="h-1.5 bg-background" />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Card Resumo Lateral */}
              <div className="sticky top-6 flex flex-col items-center justify-center rounded-xl border bg-secondary/40 p-6 text-center">
                <PieIcon className="mb-2 size-8 text-primary" />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Total de Despesas no Período
                </span>
                <span className="mt-1 text-2xl font-bold tabular-nums text-danger">
                  {formatBRL(categoryBreakdown.totalSpent)}
                </span>
                <span className="mt-2 text-xs text-muted-foreground">
                  Distribuídas em {categoryBreakdown.list.length} categorias e{" "}
                  {categoryBreakdown.list.reduce((acc, c) => acc + c.subcategories.length, 0)} subcategorias
                </span>
              </div>
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhuma despesa registrada no período selecionado.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
