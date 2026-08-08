import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  Car,
  Heart,
  Home,
  PartyPopper,
  ShoppingBasket,
  Wallet,
} from "lucide-react";

import { PageHeader } from "@/components/riccos/app-shell";
import { useRiccos } from "@/components/riccos/store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBRL, spentByCategory } from "@/lib/finance-data";

export const Route = createFileRoute("/metas")({
  head: () => ({
    meta: [
      { title: "Metas & Tetos — RiccOS | Orçamento por categoria" },
      {
        name: "description",
        content:
          "Defina tetos de gastos por categoria e acompanhe o consumo do orçamento mensal com alertas visuais.",
      },
      { property: "og:title", content: "Metas & Tetos — RiccOS" },
      {
        property: "og:description",
        content: "Controle o orçamento mensal por categoria com barras de progresso e alertas.",
      },
    ],
  }),
  component: GoalsPage,
});

const icons: Record<string, React.ElementType> = {
  Moradia: Home,
  Alimentação: ShoppingBasket,
  Transporte: Car,
  Lazer: PartyPopper,
  Saúde: Heart,
  Educação: BookOpen,
};

function tone(pct: number) {
  if (pct >= 100) return { bar: "bg-danger", text: "text-danger", track: "bg-danger-soft" };
  if (pct >= 76) return { bar: "bg-warning", text: "text-warning-foreground", track: "bg-warning-soft" };
  return { bar: "bg-success", text: "text-success", track: "bg-success-soft" };
}

function GoalsPage() {
  const { monthTransactions, budgets, setBudget } = useRiccos();
  const spent = spentByCategory(monthTransactions);
  const spentOf = (category: string) => spent.find((s) => s.category === category)?.total ?? 0;

  const totalLimit = budgets.reduce((a, b) => a + b.limit, 0);
  const totalSpent = budgets.reduce((a, b) => a + spentOf(b.category), 0);
  const globalPct = totalLimit > 0 ? (totalSpent / totalLimit) * 100 : 0;
  const globalTone = tone(globalPct);

  const [editing, setEditing] = useState<{ category: string; limit: string } | null>(null);

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Metas & Tetos de Gastos"
        description="Defina limites por categoria e acompanhe o consumo do orçamento do mês."
      />

      <Card className="shadow-none">
        <CardHeader className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
          <div className="min-w-0">
            <CardDescription className="flex items-center gap-2 text-xs font-medium tracking-wide uppercase">
              <Wallet className="size-3.5" /> Orçamento global do mês
            </CardDescription>
            <CardTitle className="mt-2 text-2xl font-bold tabular-nums">
              {formatBRL(totalSpent)}{" "}
              <span className="text-base font-medium text-muted-foreground">
                de {formatBRL(totalLimit)}
              </span>
            </CardTitle>
          </div>
          <div className="shrink-0 text-right">
            <p className={`text-2xl font-bold tabular-nums ${globalTone.text}`}>
              {Math.round(globalPct)}%
            </p>
            <p className="text-xs text-muted-foreground">comprometido</p>
          </div>
        </CardHeader>
        <CardContent>
          <div className={`h-2.5 w-full overflow-hidden rounded-full ${globalTone.track}`}>
            <div
              className={`h-full rounded-full transition-all ${globalTone.bar}`}
              style={{ width: `${Math.min(100, globalPct)}%` }}
            />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Restam {formatBRL(Math.max(0, totalLimit - totalSpent))} disponíveis no orçamento total.
          </p>
        </CardContent>
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {budgets.map((budget) => {
          const value = spentOf(budget.category);
          const pct = budget.limit > 0 ? (value / budget.limit) * 100 : 0;
          const t = tone(pct);
          const Icon = icons[budget.category] ?? Wallet;

          return (
            <Card key={budget.category} className="shadow-none">
              <CardHeader className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-secondary">
                    <Icon className="size-4" />
                  </span>
                  <CardTitle className="truncate text-base">{budget.category}</CardTitle>
                </div>
                {pct >= 100 && (
                  <Badge variant="outline" className="shrink-0 border-transparent bg-danger-soft text-danger">
                    <AlertTriangle className="size-3" /> Teto Excedido
                  </Badge>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm">
                  <span className="text-lg font-bold tabular-nums">{formatBRL(value)}</span>
                  <span className="text-muted-foreground"> de {formatBRL(budget.limit)}</span>
                </p>
                <div className={`h-2 w-full overflow-hidden rounded-full ${t.track}`}>
                  <div
                    className={`h-full rounded-full transition-all ${t.bar}`}
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                  <span className={`text-xs font-semibold tabular-nums ${t.text}`}>
                    {Math.round(pct)}% consumido
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="shrink-0"
                    onClick={() => setEditing({ category: budget.category, limit: String(budget.limit) })}
                  >
                    Ajustar Teto
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Ajustar teto — {editing?.category}</DialogTitle>
            <DialogDescription>Defina o limite mensal de gastos desta categoria.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="teto">Novo teto (R$)</Label>
            <Input
              id="teto"
              inputMode="decimal"
              value={editing?.limit ?? ""}
              onChange={(e) => setEditing((prev) => (prev ? { ...prev, limit: e.target.value } : prev))}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (!editing) return;
                setBudget(editing.category, Number(editing.limit.replace(",", ".")) || 0);
                setEditing(null);
              }}
            >
              Salvar teto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
