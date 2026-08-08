import { createFileRoute } from "@tanstack/react-router";
import { ArrowDownRight, ArrowUpRight, Clock, Scale } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { PageHeader } from "@/components/riccos/app-shell";
import { useRiccos } from "@/components/riccos/store";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatBRL, formatDate, spentByCategory, summarize } from "@/lib/finance-data";

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
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
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
  tone: "success" | "danger" | "neutral";
  icon: React.ElementType;
}) {
  const toneClass =
    tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : "text-foreground";
  const bubble =
    tone === "success"
      ? "bg-success-soft text-success"
      : tone === "danger"
        ? "bg-danger-soft text-danger"
        : "bg-secondary text-secondary-foreground";

  return (
    <Card className="gap-0 shadow-none">
      <CardHeader className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
        <div className="min-w-0">
          <CardDescription className="truncate text-xs font-medium tracking-wide uppercase">
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
  const { entradas, saidas, balanco, pendente } = summarize(monthTransactions);
  const byCategory = spentByCategory(monthTransactions);
  const top5 = byCategory.slice(0, 5);
  const upcoming = monthTransactions
    .filter((tx) => tx.type === "despesa")
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === "pendente" ? -1 : 1;
      return a.date.localeCompare(b.date);
    })
    .slice(0, 7);

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Visão Geral"
        description="Resumo consolidado do mês selecionado, com foco em leitura rápida."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Entradas" value={entradas} tone="success" icon={ArrowUpRight} hint="Receitas lançadas no mês" />
        <SummaryCard label="Saídas" value={saidas} tone="danger" icon={ArrowDownRight} hint="Despesas lançadas no mês" />
        <SummaryCard
          label="Balanço"
          value={balanco}
          tone={balanco >= 0 ? "success" : "danger"}
          icon={Scale}
          hint="Resultado líquido do período"
        />
        <SummaryCard label="Pendente" value={pendente} tone="neutral" icon={Clock} hint="Contas a vencer até o fim do mês" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="shadow-none lg:col-span-3">
          <CardHeader>
            <CardTitle>Gastos por Categoria</CardTitle>
            <CardDescription>Distribuição das despesas do mês</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={byCategory}
                    dataKey="total"
                    nameKey="category"
                    innerRadius={62}
                    outerRadius={100}
                    paddingAngle={2}
                    stroke="var(--card)"
                    strokeWidth={2}
                  >
                    {byCategory.map((entry, i) => (
                      <Cell key={entry.category} fill={chartColors[i % chartColors.length]} />
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

            <div className="mt-4 space-y-1 border-t pt-4">
              <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Top 5 categorias
              </p>
              {top5.map((item, i) => (
                <div
                  key={item.category}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-2 py-2 hover:bg-accent"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ background: chartColors[i % chartColors.length] }}
                    />
                    <span className="truncate text-sm font-medium">{item.category}</span>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="text-sm font-semibold tabular-nums">{formatBRL(item.total)}</span>
                    <span className="ml-2 text-xs text-muted-foreground tabular-nums">
                      {saidas > 0 ? Math.round((item.total / saidas) * 100) : 0}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-none lg:col-span-2">
          <CardHeader>
            <CardTitle>Próximos Vencimentos</CardTitle>
            <CardDescription>Lançamentos ordenados por data</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Data</TableHead>
                  <TableHead>Descrição</TableHead>
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
                    <TableCell className="max-w-40 truncate text-sm font-medium">
                      {tx.description}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {formatBRL(tx.amount)}
                    </TableCell>
                    <TableCell className="pr-6 text-right">
                      <Badge
                        variant="outline"
                        className={
                          tx.status === "pago"
                            ? "border-transparent bg-success-soft text-success"
                            : "border-transparent bg-warning-soft text-warning-foreground"
                        }
                      >
                        {tx.status === "pago" ? "Pago" : "Pendente"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
