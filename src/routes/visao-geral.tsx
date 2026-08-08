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
            <Progress value={expensePercentage} className="mt-3 h-2" />
          </CardContent>
        </Card>
      )}

      {/* Seção de Gráficos e Categorias Detalhadas */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Gráfico Rosca das Categorias */}
        <Card className="shadow-none lg:col-span-5">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <PieIcon className="size-4 text-primary" /> Distribuição de Gastos
            </CardTitle>
            <CardDescription className="text-xs">
              Proporção de consumo por categoria no mês selecionado.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center pt-0">
            {categoryBreakdown.list.length > 0 ? (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryBreakdown.list}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={3}
                      dataKey="amount"
                    >
                      {categoryBreakdown.list.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => [formatBRL(value), "Gasto"]}
                      contentStyle={{
                        backgroundColor: "var(--color-card)",
                        borderColor: "var(--color-border)",
                        borderRadius: "0.75rem",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-muted-foreground">
                Nenhuma despesa registrada para o gráfico.
              </div>
            )}
            <div className="w-full text-center text-xs text-muted-foreground">
              Total em despesas:{" "}
              <strong className="text-foreground">{formatBRL(categoryBreakdown.totalSpent)}</strong>
            </div>
          </CardContent>
        </Card>

        {/* Lista Detalhada com Acordeão de Subcategorias */}
        <Card className="shadow-none lg:col-span-7">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Layers className="size-4 text-primary" /> Gastos por Categoria & Subcategoria
              </CardTitle>
              <CardDescription className="text-xs">
                Clique na categoria para expandir e ver o detalhamento interno.
              </CardDescription>
            </div>
            {categoryBreakdown.list.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-muted-foreground hover:text-foreground"
                onClick={toggleExpandAll}
              >
                {allExpanded ? "Recolher Todos" : "Expandir Todos"}
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            {categoryBreakdown.list.map((cat) => {
              const isExpanded = !!expandedCategories[cat.name];
              const hasSub = cat.subcategories.length > 0;

              return (
                <div
                  key={cat.name}
                  className="rounded-xl border bg-card p-3.5 transition-colors hover:border-border/80 space-y-2.5"
                >
                  <div
                    className="flex items-center justify-between gap-3 cursor-pointer select-none"
                    onClick={() => toggleCategory(cat.name)}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <span
                        className="size-3 rounded-full shrink-0"
                        style={{ backgroundColor: cat.color }}
                      />
                      <span className="font-semibold text-sm text-foreground truncate">
                        {cat.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ({Math.round(cat.percentage)}%)
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-bold text-sm tabular-nums text-foreground">
                        {formatBRL(cat.amount)}
                      </span>
                      {hasSub && (
                        <span className="text-muted-foreground p-0.5 hover:text-foreground">
                          {isExpanded ? (
                            <ChevronUp className="size-4" />
                          ) : (
                            <ChevronDown className="size-4" />
                          )}
                        </span>
                      )}
                    </div>
                  </div>

                  <Progress
                    value={cat.percentage}
                    className="h-1.5"
                    style={
                      {
                        "--progress-background": cat.color,
                      } as React.CSSProperties
                    }
                  />

                  {/* Detalhamento das Subcategorias em Acordeão */}
                  {isExpanded && hasSub && (
                    <div className="pt-2 border-t border-border/50 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        Subcategorias
                      </span>
                      <div className="space-y-1.5 pl-2">
                        {cat.subcategories.map((sub) => (
                          <div
                            key={sub.name}
                            className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-muted/40 hover:bg-muted/70 transition-colors"
                          >
                            <span className="text-muted-foreground font-medium truncate">
                              {sub.name}
                            </span>
                            <div className="flex items-center gap-2 font-semibold tabular-nums">
                              <span className="text-[11px] text-muted-foreground font-normal">
                                ({Math.round(sub.percentageOfCategory)}%)
                              </span>
                              <span>{formatBRL(sub.amount)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {categoryBreakdown.list.length === 0 && (
              <div className="py-8 text-center text-xs text-muted-foreground">
                Nenhum lançamento de despesa no mês para categorização.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Próximos Vencimentos e Lançamentos Recentes */}
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Lançamentos do Mês</CardTitle>
          <CardDescription className="text-xs">
            Lista rápida de contas pagas e a vencer no mês selecionado.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="pr-6">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {upcoming.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="pl-6 text-xs text-muted-foreground tabular-nums">
                      {formatDate(tx.date)}
                    </TableCell>
                    <TableCell className="font-medium text-sm max-w-48 truncate">
                      {tx.description}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{tx.category}</TableCell>
                    <TableCell className="text-right text-sm font-semibold tabular-nums text-foreground">
                      {formatBRL(tx.amount)}
                    </TableCell>
                    <TableCell className="pr-6">
                      <Badge
                        variant="outline"
                        className={`border-transparent ${
                          tx.status === "pago"
                            ? "bg-success-soft text-success"
                            : "bg-warning-soft text-warning-foreground"
                        }`}
                      >
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
