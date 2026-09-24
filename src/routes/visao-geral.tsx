import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  Clock,
  Layers,
  PieChart as PieIcon,
} from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { PageHeader } from "@/components/riccos/app-shell";
import { InsightsCard } from "@/components/riccos/insights-card";
import { MonthPaceCard } from "@/components/riccos/month-pace-card";
import { ReservaCard } from "@/components/riccos/reserva-card";
import { ScoreCard } from "@/components/riccos/season-widgets";
import { StatCard } from "@/components/riccos/stat-card";
import { useRiccos } from "@/components/riccos/store";
import { Badge } from "@/components/ui/badge";
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
import {
  chartColors,
  chartTooltipStyle,
  formatBRL,
  formatDate,
  summarize,
} from "@/lib/finance-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/visao-geral")({
  head: () => ({
    meta: [
      { title: "Visão Geral — RiccOS | Gestão financeira pessoal" },
      {
        name: "description",
        content:
          "Painel do RiccOS com entradas, saídas, balanço, pendências e gastos por categoria do mês.",
      },
      { property: "og:title", content: "Visão Geral — RiccOS" },
      {
        property: "og:description",
        content: "Leia rapidamente entradas, saídas, balanço e vencimentos do mês no RiccOS.",
      },
    ],
  }),
  component: Overview,
});

function Overview() {
  const { monthTransactions } = useRiccos();
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  const { entradas, saidas, pendente, pago } = useMemo(() => {
    const summary = summarize(monthTransactions);
    const totalPago = monthTransactions
      .filter((tx) => tx.type === "despesa" && tx.status === "pago")
      .reduce((acc, tx) => acc + tx.amount, 0);

    return {
      ...summary,
      pago: totalPago,
    };
  }, [monthTransactions]);

  // Agrupamento por Categoria e Subcategoria do Mês Ativo
  const categoryBreakdown = useMemo(() => {
    const catMap = new Map<string, { total: number; subMap: Map<string, number> }>();

    monthTransactions.forEach((tx) => {
      if (tx.type !== "despesa") return;

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
  }, [monthTransactions]);

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

  const upcoming = useMemo(() => {
    return monthTransactions
      .filter((tx) => tx.type === "despesa")
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === "pendente" ? -1 : 1;
        return a.date.localeCompare(b.date);
      })
      .slice(0, 10);
  }, [monthTransactions]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        eyebrow="Financeiro"
        title="Visão Geral"
        description="Resumo consolidado do mês selecionado, com foco em leitura rápida."
        showBalance={false}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Entradas"
          value={entradas}
          tone="success"
          icon={ArrowUpRight}
          hint="Receitas lançadas no mês"
        />
        <StatCard
          label="Saídas"
          value={saidas}
          tone="danger"
          icon={ArrowDownRight}
          hint="Despesas totais no mês"
        />
        <StatCard
          label="Pendente"
          value={pendente}
          tone="warning"
          icon={Clock}
          hint="Contas a vencer no mês"
        />
        <StatCard
          label="Pago"
          value={pago}
          tone="primary"
          icon={CheckCircle2}
          hint="Despesas já liquidadas"
        />
      </div>

      <InsightsCard />

      {/*
        Duas colunas: a esquerda (temporada, ritmo e rosca) define a altura do bloco; no desktop
        o card de categorias ocupa exatamente essa altura e rola por dentro — assim os cards
        fecham alinhados, sem sobrar espaço vazio em nenhum lado.
      */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="flex flex-col gap-6 lg:col-span-5">
          <ScoreCard />
          <MonthPaceCard />

          {/* Gráfico Rosca das Categorias */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
                  <PieIcon className="size-4" />
                </span>
                Distribuição de gastos
              </CardTitle>
              <CardDescription className="text-xs">
                Proporção de consumo por categoria no mês selecionado.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center pt-0">
              {categoryBreakdown.list.length > 0 ? (
                <div className="relative h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryBreakdown.list}
                        cx="50%"
                        cy="50%"
                        innerRadius={68}
                        outerRadius={96}
                        paddingAngle={3}
                        cornerRadius={6}
                        dataKey="amount"
                        stroke="none"
                      >
                        {categoryBreakdown.list.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => [formatBRL(value), "Gasto"]}
                        contentStyle={chartTooltipStyle}
                        itemStyle={{ color: "var(--color-foreground)" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Total
                    </span>
                    <span className="text-lg font-semibold tabular-nums">
                      {formatBRL(categoryBreakdown.totalSpent)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  Nenhuma despesa registrada para o gráfico.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Lista Detalhada com Acordeão de Subcategorias */}
        <div className="lg:relative lg:col-span-7">
          <Card className="flex flex-col lg:absolute lg:inset-0">
            <CardHeader className="flex shrink-0 flex-row items-start justify-between gap-3 space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Layers className="size-4" />
                  </span>
                  Categorias & subcategorias
                </CardTitle>
                <CardDescription className="mt-1.5 text-xs">
                  Toque na categoria para ver o detalhamento interno.
                </CardDescription>
              </div>
              {categoryBreakdown.list.length > 0 && (
                <Button variant="ghost" size="sm" onClick={toggleExpandAll}>
                  {allExpanded ? "Recolher" : "Expandir"}
                </Button>
              )}
            </CardHeader>
            <CardContent className="min-h-0 flex-1 space-y-2.5 overflow-y-auto">
              {categoryBreakdown.list.map((cat) => {
                const isExpanded = !!expandedCategories[cat.name];
                const hasSub = cat.subcategories.length > 0;

                return (
                  <div
                    key={cat.name}
                    className="rounded-2xl border bg-background/40 p-3.5 transition-colors hover:border-ring/40"
                  >
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-3 text-left"
                      onClick={() => toggleCategory(cat.name)}
                      aria-expanded={isExpanded}
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-2.5">
                        <span
                          className="size-2.5 shrink-0 rounded-full shadow-[0_0_8px_currentColor]"
                          style={{ backgroundColor: cat.color, color: cat.color }}
                        />
                        <span className="truncate text-sm font-semibold">{cat.name}</span>
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {Math.round(cat.percentage)}%
                        </span>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-sm font-semibold tabular-nums">
                          {formatBRL(cat.amount)}
                        </span>
                        {hasSub && (
                          <ChevronDown
                            className={cn(
                              "size-4 text-muted-foreground transition-transform duration-300",
                              isExpanded && "rotate-180",
                            )}
                          />
                        )}
                      </div>
                    </button>

                    <Progress
                      value={cat.percentage}
                      className="mt-3 h-1.5"
                      style={{ "--progress-background": cat.color } as React.CSSProperties}
                    />

                    {isExpanded && hasSub && (
                      <div className="mt-3 space-y-1.5 border-t border-border/60 pt-3 animate-in fade-in slide-in-from-top-1 duration-200">
                        {cat.subcategories.map((sub) => (
                          <div
                            key={sub.name}
                            className="flex items-center justify-between rounded-xl bg-secondary/60 px-3 py-2 text-xs transition-colors hover:bg-secondary"
                          >
                            <span className="truncate font-medium text-muted-foreground">
                              {sub.name}
                            </span>
                            <div className="flex items-center gap-2 tabular-nums">
                              <span className="text-[11px] text-muted-foreground">
                                {Math.round(sub.percentageOfCategory)}%
                              </span>
                              <span className="font-semibold">{formatBRL(sub.amount)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {categoryBreakdown.list.length === 0 && (
                <div className="rounded-2xl border border-dashed py-10 text-center text-xs text-muted-foreground">
                  Nenhum lançamento de despesa no mês para categorização.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <ReservaCard />

      {/* Lançamentos do mês */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lançamentos do mês</CardTitle>
          <CardDescription className="text-xs">
            Lista rápida de contas pagas e a vencer no mês selecionado.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 sm:p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-5 sm:pl-6">Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="hidden lg:table-cell">Categoria</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="pr-5 text-right sm:pr-6">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {upcoming.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="pl-5 text-xs tabular-nums text-muted-foreground sm:pl-6">
                      {formatDate(tx.date)}
                    </TableCell>
                    <TableCell className="max-w-48 truncate text-sm font-medium">
                      {tx.description}
                    </TableCell>
                    <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">
                      {tx.category}
                    </TableCell>
                    <TableCell className="text-right text-sm font-semibold tabular-nums">
                      {formatBRL(tx.amount)}
                    </TableCell>
                    <TableCell className="pr-5 text-right sm:pr-6">
                      <Badge variant={tx.status === "pago" ? "success" : "warning"}>
                        {tx.status === "pago" ? "Pago" : "Pendente"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {upcoming.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="py-12 text-center text-xs text-muted-foreground"
                    >
                      Nenhum lançamento registrado no mês.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
