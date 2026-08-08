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
import { categoryList, formatBRL } from "@/lib/finance-data";

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
  if (pct >= 100) return { bar: "bg-danger", text: "text-danger", track: "bg-danger-soft" };
  if (pct >= 76)
    return { bar: "bg-warning", text: "text-warning-foreground", track: "bg-warning-soft" };
  return { bar: "bg-success", text: "text-success", track: "bg-success-soft" };
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
  const [editing, setEditing] = useState<{ categoryId: string; categoryName: string; limit: string } | null>(null);

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
        if (tx.category && cat.categoria_nome && tx.category.toLowerCase() === cat.categoria_nome.toLowerCase()) return true;
        // Normalização sem acentos (ex: alimentacao vs alimentação)
        const normTxCat = tx.category?.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        const normDbCat = cat.categoria_nome?.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
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

    // LOG DEDICADO PARA A CATEGORIA DE ALIMENTAÇÃO
    const alimentacaoData = sortedResult.find(r => 
      r.categoryName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes("alimenta")
    );

    console.group(`🍎 [TESTE ALIMENTAÇÃO] Período: ${currentMonth1Indexed}/${year}`);
    console.log(`📌 Objeto da Categoria Alimentação:`, alimentacaoData);
    if (alimentacaoData) {
      console.log(`💰 Total Gasto Calculado na Categoria: R$ ${alimentacaoData.spent.toFixed(2)}`);
      console.log(`🎯 Meta do Mês (${currentMonth1Indexed}/${year}): R$ ${alimentacaoData.limit.toFixed(2)}`);
      console.log(`📋 Lista de Transações de Alimentação neste Mês (${alimentacaoData.txCount}):`, alimentacaoData.txs.map(t => ({
        descricao: t.description,
        valor: t.amount,
        dataVencimento: t.date,
        status: t.status,
        frequencia: t.frequency
      })));
    } else {
      console.warn("⚠️ Categoria de Alimentação não foi encontrada na lista de categorias do banco.");
    }
    console.groupEnd();

    return sortedResult;
  }, [expenseCategories, dbGoals, currentMonth1Indexed, year, monthTransactions]);

  const totalLimit = categoryGoalsList.reduce((acc, item) => acc + item.limit, 0);
  const totalSpent = categoryGoalsList.reduce((acc, item) => acc + item.spent, 0);
  const globalPct = totalLimit > 0 ? (totalSpent / totalLimit) * 100 : 0;
  const globalTone = tone(globalPct);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Metas"
        description="Defina e acompanhe limites de gastos por categoria para o mês selecionado."
        showBalance={false}
      />

      <Card className="shadow-none">
        <CardHeader className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
          <div className="min-w-0">
            <CardDescription className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Target className="size-4" /> Orçamento global de metas do mês
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
            {totalLimit > 0
              ? `Restam ${formatBRL(Math.max(0, totalLimit - totalSpent))} disponíveis no orçamento total de metas.`
              : "Nenhuma meta definida para o mês ativo."}
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {categoryGoalsList.map((item) => {
          const t = tone(item.pct);
          const Icon = icons[item.categoryName] ?? Wallet;

          return (
            <Card key={item.categoryId} className="shadow-none flex flex-col justify-between">
              <CardHeader className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-secondary">
                    <Icon className="size-4" />
                  </span>
                  <CardTitle className="truncate text-base">{item.categoryName}</CardTitle>
                </div>
                {item.limit > 0 && item.pct >= 100 ? (
                  <Badge
                    variant="outline"
                    className="shrink-0 border-transparent bg-danger-soft text-danger"
                  >
                    <AlertTriangle className="size-3 mr-1" /> Teto Excedido
                  </Badge>
                ) : item.limit > 0 && item.pct < 100 ? (
                  <Badge
                    variant="outline"
                    className="shrink-0 border-transparent bg-success-soft text-success"
                  >
                    <CheckCircle2 className="size-3 mr-1" /> Dentro da Meta
                  </Badge>
                ) : (
                  <Badge variant="outline" className="shrink-0 text-muted-foreground">
                    Sem Meta
                  </Badge>
                )}
              </CardHeader>

              <CardContent className="space-y-3">
                <p className="text-sm">
                  <span className="text-lg font-bold tabular-nums">{formatBRL(item.spent)}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    de {item.limit > 0 ? formatBRL(item.limit) : "Sem limite"}
                  </span>
                </p>

                <div className={`h-2 w-full overflow-hidden rounded-full ${t.track}`}>
                  <div
                    className={`h-full rounded-full transition-all ${item.limit > 0 ? t.bar : "bg-muted"}`}
                    style={{ width: `${item.limit > 0 ? Math.min(100, item.pct) : 0}%` }}
                  />
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className={`text-xs font-semibold tabular-nums ${item.limit > 0 ? t.text : "text-muted-foreground"}`}>
                    {item.limit > 0 ? `${Math.round(item.pct)}% consumido` : "Sem meta definida"}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="shrink-0 text-xs font-semibold"
                    onClick={() =>
                      setEditing({
                        categoryId: item.categoryId,
                        categoryName: item.categoryName,
                        limit: item.limit > 0 ? item.limit.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "",
                      })
                    }
                  >
                    {item.limit > 0 ? "Ajustar Meta" : "Definir Meta"}
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
            <DialogTitle>Meta — {editing?.categoryName}</DialogTitle>
            <DialogDescription>
              Defina o valor da meta de gastos para {editing?.categoryName} neste mês.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="teto">Valor da Meta (R$)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
                R$
              </span>
              <Input
                id="teto"
                inputMode="numeric"
                placeholder="0,00"
                className="pl-9 font-medium"
                value={editing?.limit ?? ""}
                onChange={(e) => {
                  const formatted = formatCurrencyInput(e.target.value);
                  setEditing((prev) => (prev ? { ...prev, limit: formatted } : prev));
                }}
              />
            </div>
          </div>
          <DialogFooter>
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
              Salvar Meta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
