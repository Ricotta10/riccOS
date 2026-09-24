import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  Car,
  CheckCircle2,
  Heart,
  Home,
  PartyPopper,
  ShoppingBasket,
  Target,
  Wallet,
} from "lucide-react";

import { PageHeader } from "@/components/riccos/app-shell";
import { useRiccos } from "@/components/riccos/store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { categoryList, formatBRL } from "@/lib/finance-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/metas")({
  head: () => ({
    meta: [
      { title: "Metas — RiccOS | Orçamento por categoria" },
      {
        name: "description",
        content:
          "Defina limites de gastos por categoria para o mês selecionado e acompanhe o consumo em tempo real.",
      },
      { property: "og:title", content: "Metas — RiccOS" },
      {
        property: "og:description",
        content: "Controle o orçamento mensal por categoria com metas sincronizadas.",
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
  if (pct >= 100)
    return {
      bar: "bg-danger",
      text: "text-danger",
      track: "bg-danger-soft",
      glow: "shadow-[0_0_12px_var(--color-danger)]",
    };
  if (pct >= 76)
    return {
      bar: "bg-warning",
      text: "text-warning-foreground",
      track: "bg-warning-soft",
      glow: "shadow-[0_0_12px_var(--color-warning)]",
    };
  return {
    bar: "bg-success",
    text: "text-success",
    track: "bg-success-soft",
    glow: "shadow-[0_0_12px_var(--color-success)]",
  };
}

function formatCurrencyInput(val: string): string {
  const digits = val.replace(/\D/g, "");
  if (!digits) return "";
  const numberValue = Number(digits) / 100;
  return numberValue.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parseCurrencyToNumber(val: string): number {
  if (!val) return 0;
  const clean = val.replace(/\./g, "").replace(",", ".");
  return Number(clean) || 0;
}

function GoalsPage() {
  const { month, year, monthTransactions, dbCategories, dbGoals, setGoal } = useRiccos();
  const [editing, setEditing] = useState<{
    categoryId: string;
    categoryName: string;
    limit: string;
  } | null>(null);

  const currentMonth1Indexed = month + 1;

  // Lista de categorias filtradas (apenas despesas)
  const expenseCategories = useMemo(() => {
    if (dbCategories.length > 0) {
      return dbCategories.filter((c) => c.categoria_tipo?.toLowerCase() !== "receita");
    }
    // Fallback se dbCategories ainda não carregou
    return categoryList
      .filter((c) => c !== "Receitas")
      .map((c) => ({
        categoria_id: c,
        categoria_nome: c,
        categoria_tipo: "Despesa",
      }));
  }, [dbCategories]);

  // Consumo por categoria e metas associadas
  const categoryGoalsList = useMemo(() => {
    const result = expenseCategories.map((cat) => {
      // 1. Meta encontrada na tabela 'metas' do Supabase para o mês/ano ativo
      const matchingGoal = dbGoals.find(
        (g) =>
          g.categoria_id === cat.categoria_id &&
          g.meta_mes === currentMonth1Indexed &&
          g.meta_ano === year,
      );

      const limit = matchingGoal ? Number(matchingGoal.meta_valor) || 0 : 0;

      // 2. Total gasto nesta categoria no mês
      const categoryTxs = monthTransactions.filter((tx) => {
        if (tx.type !== "despesa") return false;
        if (tx.categoryId && cat.categoria_id && tx.categoryId === cat.categoria_id) return true;
        if (
          tx.category &&
          cat.categoria_nome &&
          tx.category.toLowerCase() === cat.categoria_nome.toLowerCase()
        )
          return true;
        // Normalização sem acentos (ex: alimentacao vs alimentação)
        const normTxCat = tx.category
          ?.normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase();
        const normDbCat = cat.categoria_nome
          ?.normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase();
        return normTxCat === normDbCat;
      });

      const spent = categoryTxs.reduce((acc, tx) => acc + tx.amount, 0);
      const pct = limit > 0 ? (spent / limit) * 100 : 0;

      return {
        categoryId: cat.categoria_id,
        categoryName: cat.categoria_nome,
        limit,
        spent,
        pct,
        txCount: categoryTxs.length,
        txs: categoryTxs,
      };
    });

    // Ordenação: primeiro as categorias COM META DEFINIDA (limit > 0)
    const sortedResult = [...result].sort((a, b) => {
      const aHasGoal = a.limit > 0;
      const bHasGoal = b.limit > 0;

      if (aHasGoal && !bHasGoal) return -1;
      if (!aHasGoal && bHasGoal) return 1;

      // Se ambas têm meta, ordena pelo limite (maior primeiro) e depois pelo gasto
      if (aHasGoal && bHasGoal) {
        if (b.limit !== a.limit) return b.limit - a.limit;
        return b.spent - a.spent;
      }

      // Se nenhuma tem meta, ordena por gasto
      if (b.spent !== a.spent) return b.spent - a.spent;
      return a.categoryName.localeCompare(b.categoryName);
    });

    return sortedResult;
  }, [expenseCategories, dbGoals, currentMonth1Indexed, year, monthTransactions]);

  const totalLimit = categoryGoalsList.reduce((acc, item) => acc + item.limit, 0);
  const totalSpent = categoryGoalsList.reduce((acc, item) => acc + item.spent, 0);
  const globalPct = totalLimit > 0 ? (totalSpent / totalLimit) * 100 : 0;
  const globalTone = tone(globalPct);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        eyebrow="Financeiro"
        title="Metas"
        description="Defina e acompanhe limites de gastos por categoria para o mês selecionado."
        showBalance={false}
      />

      {/* Orçamento global */}
      <Card className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-primary/15 blur-3xl"
        />
        <CardHeader className="relative grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              <span className="grid size-7 place-items-center rounded-lg bg-primary/10 text-primary">
                <Target className="size-3.5" />
              </span>
              Orçamento global do mês
            </p>
            <CardTitle className="mt-3 text-2xl font-semibold tabular-nums sm:text-3xl">
              {formatBRL(totalSpent)}{" "}
              <span className="text-base font-medium text-muted-foreground">
                de {formatBRL(totalLimit)}
              </span>
            </CardTitle>
          </div>
          <div className="shrink-0 text-right">
            <p
              className={cn("text-3xl font-semibold tabular-nums tracking-tight", globalTone.text)}
            >
              {Math.round(globalPct)}%
            </p>
            <p className="text-xs text-muted-foreground">comprometido</p>
          </div>
        </CardHeader>
        <CardContent className="relative">
          <div className={cn("h-2.5 w-full overflow-hidden rounded-full", globalTone.track)}>
            <div
              className={cn(
                "h-full rounded-full transition-all duration-700",
                globalTone.bar,
                globalTone.glow,
              )}
              style={{ width: `${Math.min(100, globalPct)}%` }}
            />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {totalLimit > 0
              ? `Restam ${formatBRL(Math.max(0, totalLimit - totalSpent))} disponíveis no orçamento total de metas.`
              : "Nenhuma meta definida para o mês ativo."}
          </p>
        </CardContent>
      </Card>

      {/* Cards por categoria */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {categoryGoalsList.map((item) => {
          const t = tone(item.pct);
          const Icon = icons[item.categoryName] ?? Wallet;
          const hasGoal = item.limit > 0;

          return (
            <Card
              key={item.categoryId}
              className="group flex flex-col justify-between transition-all hover:-translate-y-0.5 hover:border-ring/40"
            >
              <CardHeader className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 pb-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <Icon className="size-4" />
                  </span>
                  <CardTitle className="truncate text-base">{item.categoryName}</CardTitle>
                </div>
                {hasGoal && item.pct >= 100 ? (
                  <Badge variant="destructive" className="shrink-0">
                    <AlertTriangle className="size-3" /> Excedido
                  </Badge>
                ) : hasGoal ? (
                  <Badge variant="success" className="shrink-0">
                    <CheckCircle2 className="size-3" /> Na meta
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="shrink-0 text-muted-foreground">
                    Sem meta
                  </Badge>
                )}
              </CardHeader>

              <CardContent className="space-y-3">
                <p className="text-sm">
                  <span className="text-xl font-semibold tabular-nums">
                    {formatBRL(item.spent)}
                  </span>
                  <span className="text-muted-foreground">
                    {" "}
                    {hasGoal ? `de ${formatBRL(item.limit)}` : "· sem teto definido"}
                  </span>
                </p>

                <div
                  className={cn(
                    "h-2 w-full overflow-hidden rounded-full",
                    hasGoal ? t.track : "bg-secondary",
                  )}
                >
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-700",
                      hasGoal ? t.bar : "bg-muted",
                    )}
                    style={{ width: `${hasGoal ? Math.min(100, item.pct) : 0}%` }}
                  />
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <span
                    className={cn(
                      "text-xs font-semibold tabular-nums",
                      hasGoal ? t.text : "text-muted-foreground",
                    )}
                  >
                    {hasGoal ? `${Math.round(item.pct)}% consumido` : "Defina um teto"}
                  </span>
                  <Button
                    variant={hasGoal ? "secondary" : "default"}
                    size="sm"
                    className="shrink-0"
                    onClick={() =>
                      setEditing({
                        categoryId: item.categoryId,
                        categoryName: item.categoryName,
                        limit: hasGoal
                          ? item.limit.toLocaleString("pt-BR", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })
                          : "",
                      })
                    }
                  >
                    {hasGoal ? "Ajustar" : "Definir meta"}
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
            <DialogTitle>Meta · {editing?.categoryName}</DialogTitle>
            <DialogDescription>
              Defina o valor da meta de gastos para {editing?.categoryName} neste mês.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="teto">Valor da meta (R$)</Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
                R$
              </span>
              <Input
                id="teto"
                inputMode="numeric"
                placeholder="0,00"
                className="h-12 pl-10 text-lg font-semibold tabular-nums"
                value={editing?.limit ?? ""}
                onChange={(e) => {
                  const formatted = formatCurrencyInput(e.target.value);
                  setEditing((prev) => (prev ? { ...prev, limit: formatted } : prev));
                }}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button
              onClick={async () => {
                if (!editing) return;
                const numericVal = parseCurrencyToNumber(editing.limit);
                await setGoal(editing.categoryId, numericVal);
                setEditing(null);
              }}
            >
              Salvar meta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
