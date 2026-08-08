import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Layers,
  PieChart as PieIcon,
} from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { PageHeader } from "@/components/riccos/app-shell";
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
import { formatBRL, formatDate, summarize } from "@/lib/finance-data";

export const Route = createFileRoute("/")({
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

const chartColors = [
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

function SummaryCard({
  label,
  value,
  hint,
  tone,
  icon: Icon,
}: {
  label: string;
  value: number;
  hint: string;
  tone: "success" | "danger" | "warning" | "neutral";
  icon: React.ElementType;
}) {
  const toneClass =
    tone === "success"
      ? "text-success"
      : tone === "danger"
        ? "text-danger"
        : tone === "warning"
          ? "text-warning font-semibold"
          : "text-foreground";
  const bubble =
    tone === "success"
      ? "bg-success-soft text-success"
      : tone === "danger"
        ? "bg-danger-soft text-danger"
        : tone === "warning"
          ? "bg-warning-soft text-warning"
          : "bg-secondary text-secondary-foreground";

  return (
    <Card className="shadow-none">
      <CardHeader className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 pb-2">
        <div className="min-w-0">
          <CardDescription className="truncate text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </CardDescription>
          <CardTitle className={`mt-2 text-2xl font-bold tabular-nums ${toneClass}`}>
            {formatBRL(value)}
          </CardTitle>
        </div>
        <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${bubble}`}>
          <Icon className="size-4" />
        </span>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

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
          color: chartColors[index % chartColors.length],
        };
      })
      .sort((a, b) => b.amount - a.amount);

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

  const expensePercentage = entradas > 0 ? Math.min(Math.round((saidas / entradas) * 100), 100) : 0;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Visão Geral"
        description="Resumo consolidado do mês selecionado, com foco em leitura rápida."
        showBalance={false}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Entradas (Receitas)"
          value={entradas}
          tone="success"
          icon={ArrowUpRight}
          hint="Receitas lançadas no mês"
        />
        <SummaryCard
          label="Saídas (Despesas)"
          value={saidas}
          tone="danger"
          icon={ArrowDownRight}
          hint="Despesas totais no mês"
        />
        <SummaryCard
          label="Total Pendente"
          value={pendente}
          tone="warning"
          icon={Clock}
          hint="Contas a vencer no mês"
        />
        <SummaryCard
          label="Total Pago"
          value={pago}
          tone="success"
          icon={CheckCircle2}
          hint="Despesas já liquidadas"
        />
      </div>

      {entradas > 0 && (
        <Card className="shadow-none">
          <CardContent className="p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Comprometimento da Renda
                </span>
                <p className="text-sm font-medium">
                  {expensePercentage}% das receitas do mês estão comprometidas com despesas.
                </p>
              </div>
              <span className="text-lg font-bold tabular-nums">
                {formatBRL(saidas)} / {formatBRL(entradas)}
              </span>
            </div>
            <Progress value={expensePercentage} className="mt-3 h-2.5" />
          </CardContent>
        </Card>
      )}

      {/* Gastos por Categoria e Subcategoria */}
      <Card className="shadow-none">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Layers className="size-5 text-primary" />
              <span>Gastos por Categoria e Subcategoria</span>
            </CardTitle>
            <CardDescription className="mt-1">
              Distribuição do consumo e detalhamento das subcategorias do mês
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
            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-5">
              {/* Lista Detalhada Expandível */}
              <div className="space-y-3 lg:col-span-3">
                {categoryBreakdown.list.map((item) => {
                  const isExpanded = !!expandedCategories[item.name];

                  return (
                    <div
                      key={item.name}
                      className="rounded-xl border bg-card p-3.5 space-y-2.5 transition-all"
                    >
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

                      <Progress value={item.percentage} className="h-2" />

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

              {/* Donut Chart Lateral */}
              <div className="lg:col-span-2 flex flex-col items-center justify-center rounded-xl border bg-card p-6">
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryBreakdown.list}
                        dataKey="amount"
                        nameKey="name"
                        innerRadius={62}
                        outerRadius={100}
                        paddingAngle={3}
                        stroke="var(--card)"
                        strokeWidth={2}
                      >
                        {categoryBreakdown.list.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v: number) => formatBRL(v)}
                        contentStyle={{
                          borderRadius: 12,
                          border: "1px solid var(--border)",
                          background: "var(--popover)",
                          fontSize: 12,
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-2 text-center">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Total de Despesas
                  </span>
                  <p className="text-2xl font-bold tabular-nums text-danger mt-0.5">
                    {formatBRL(categoryBreakdown.totalSpent)}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-48 flex-col items-center justify-center text-center">
              <PieIcon className="mb-2 size-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                Nenhuma despesa registrada para o mês selecionado.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Vencimentos do Mês */}
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle>Vencimentos do Mês</CardTitle>
          <CardDescription>Lançamentos de despesas do período</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Categoria / Subcategoria</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="pr-6 text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {upcoming.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="pl-6 text-xs text-muted-foreground tabular-nums">
                      {formatDate(tx.date)}
                    </TableCell>
                    <TableCell className="max-w-44 truncate text-sm font-medium">
                      {tx.description}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{tx.category}</span>
                      {tx.subcategory && <span className="ml-1 text-muted-foreground">({tx.subcategory})</span>}
                    </TableCell>
                    <TableCell className="text-right text-sm font-semibold tabular-nums">
                      {formatBRL(tx.amount)}
                    </TableCell>
                    <TableCell className="pr-6 text-right">
                      <Badge
                        variant="outline"
                        className={
                          tx.status === "pago"
                            ? "border-transparent bg-success-soft text-success font-semibold"
                            : "border-transparent bg-warning-soft text-warning-foreground font-semibold"
                        }
                      >
                        {tx.status === "pago" ? "Pago" : "Pendente"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {upcoming.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-sm text-muted-foreground">
                      Nenhum vencimento registrado para este mês.
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
