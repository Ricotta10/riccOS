import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatBRL, futureProjection, monthlyHistory } from "@/lib/finance-data";

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

function ReportsPage() {
  const [range, setRange] = useState<keyof typeof ranges>("6m");
  const data = monthlyHistory.slice(-ranges[range].months);

  const history = data.map((row, i) => {
    const net = row.receitas - row.despesas;
    const prev = i > 0 ? data[i - 1].receitas - data[i - 1].despesas : null;
    const variation = prev && prev !== 0 ? ((net - prev) / Math.abs(prev)) * 100 : null;
    return { ...row, net, variation };
  });

  const totalCommitted = futureProjection.reduce((a, b) => a + b.committed, 0);

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Relatórios & Histórico"
        description="Análise comparativa de meses anteriores e projeção de compromissos futuros."
      />

      <Tabs value={range} onValueChange={(v) => setRange(v as keyof typeof ranges)} className="mb-6">
        <TabsList>
          {Object.entries(ranges).map(([key, value]) => (
            <TabsTrigger key={key} value={key}>
              {value.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle>Receitas vs. Despesas</CardTitle>
          <CardDescription>Evolução mês a mês no período selecionado</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} barGap={6}>
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
                <Bar dataKey="receitas" name="Receitas" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="despesas" name="Despesas" fill="var(--chart-2)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="shadow-none lg:col-span-3">
          <CardHeader>
            <CardTitle>Histórico Consolidado Mensal</CardTitle>
            <CardDescription>Resultado líquido e variação em relação ao mês anterior</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
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
                  {history.map((row) => (
                    <TableRow key={row.label}>
                      <TableCell className="pl-6 text-sm font-medium">{row.label}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums text-success">
                        {formatBRL(row.receitas)}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums text-danger">
                        {formatBRL(row.despesas)}
                      </TableCell>
                      <TableCell
                        className={`text-right text-sm font-semibold tabular-nums ${
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
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-none lg:col-span-2">
          <CardHeader>
            <CardTitle>Projeção Futura</CardTitle>
            <CardDescription>Compromissos recorrentes e parcelas vincendas</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl bg-secondary p-4">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Total comprometido
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{formatBRL(totalCommitted)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Próximos {futureProjection.length} meses
              </p>
            </div>
            <div className="space-y-1">
              {futureProjection.map((item) => (
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
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
