import { useMemo, useState } from "react";
import { Check, Layers, Pencil, Repeat, Tag, Wallet } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatBRL, formatDate, type Transaction } from "@/lib/finance-data";
import { AliasDialog, useMerchantAliases } from "./merchant-aliases";
import { useRiccos } from "./store";

const INSTALLMENT_OPTIONS = Array.from({ length: 23 }, (_, i) => i + 2); // 2x a 24x

/**
 * Fila de compras lançadas automaticamente pela Apple Wallet que ainda não foram
 * revisadas. A Wallet só informa o valor cheio, então aqui o usuário confirma,
 * transforma em parcelas ou em gasto fixo.
 */
export function WalletReview({ onEdit }: { onEdit: (tx: Transaction) => void }) {
  const { transactions, markReviewed, convertToInstallments, convertToRecurring } = useRiccos();
  const [installmentTarget, setInstallmentTarget] = useState<Transaction | null>(null);
  const [installments, setInstallments] = useState("2");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [aliasTarget, setAliasTarget] = useState<Transaction | null>(null);
  const { saveAlias } = useMerchantAliases();

  const pending = useMemo(
    () =>
      transactions
        .filter((tx) => tx.origem === "wallet" && tx.revisada === false)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [transactions],
  );

  if (pending.length === 0) return null;

  const run = async (id: string, action: () => Promise<unknown>) => {
    setBusyId(id);
    try {
      await action();
    } finally {
      setBusyId(null);
    }
  };

  const confirmInstallments = async () => {
    if (!installmentTarget) return;
    const target = installmentTarget;
    setInstallmentTarget(null);
    await run(target.id, () => convertToInstallments(target.id, Number(installments)));
  };

  const total = Number(installments);

  return (
    <Card>
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground">
            <Wallet className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold">Compras da Wallet para revisar</p>
              <Badge variant="warning">{pending.length}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Lançadas automaticamente com o valor cheio. Confirme ou ajuste se foi parcelado ou é
              um gasto fixo.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {pending.map((tx) => {
            const busy = busyId === tx.id;
            return (
              <div
                key={tx.id}
                className="rounded-xl border bg-secondary/40 p-3 sm:flex sm:items-center sm:gap-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-sm font-semibold">{tx.description}</p>
                    <span className="shrink-0 text-sm font-semibold tabular-nums sm:hidden">
                      − {formatBRL(tx.amount)}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    <span className="tabular-nums">{formatDate(tx.date)}</span> · {tx.category}
                    {tx.subcategory ? ` · ${tx.subcategory}` : ""}
                  </p>
                  {tx.estabelecimentoOriginal && tx.estabelecimentoOriginal !== tx.description && (
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      Na Wallet: {tx.estabelecimentoOriginal}
                    </p>
                  )}
                </div>
                <span className="hidden shrink-0 text-sm font-semibold tabular-nums sm:block">
                  − {formatBRL(tx.amount)}
                </span>
                <div className="mt-3 grid grid-cols-5 gap-1.5 sm:mt-0 sm:flex sm:shrink-0">
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() => run(tx.id, () => markReviewed(tx.id))}
                    title="Está certo"
                  >
                    <Check /> <span className="hidden sm:inline">OK</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => {
                      setInstallments("2");
                      setInstallmentTarget(tx);
                    }}
                    title="Foi parcelado"
                  >
                    <Layers /> <span className="hidden sm:inline">Parcelado</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => run(tx.id, () => convertToRecurring(tx.id))}
                    title="É um gasto fixo"
                  >
                    <Repeat /> <span className="hidden sm:inline">Fixo</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy || !tx.estabelecimentoOriginal}
                    onClick={() => setAliasTarget(tx)}
                    title="Apelidar este estabelecimento"
                  >
                    <Tag /> <span className="hidden sm:inline">Apelidar</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => onEdit(tx)}
                    title="Editar"
                  >
                    <Pencil /> <span className="hidden sm:inline">Editar</span>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>

      <Dialog
        open={installmentTarget !== null}
        onOpenChange={(o) => !o && setInstallmentTarget(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Em quantas vezes?</DialogTitle>
            <DialogDescription>
              {installmentTarget?.description} ·{" "}
              <span className="tabular-nums">{formatBRL(installmentTarget?.amount ?? 0)}</span>
            </DialogDescription>
          </DialogHeader>
          <Select value={installments} onValueChange={setInstallments}>
            <SelectTrigger className="h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INSTALLMENT_OPTIONS.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}x
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Vão entrar {total} parcelas de{" "}
            <span className="font-semibold text-foreground tabular-nums">
              {formatBRL(Math.round(((installmentTarget?.amount ?? 0) / total) * 100) / 100)}
            </span>
            , uma por mês a partir da data da compra.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setInstallmentTarget(null)}>
              Cancelar
            </Button>
            <Button onClick={confirmInstallments}>Parcelar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AliasDialog
        open={aliasTarget !== null}
        onOpenChange={(o) => !o && setAliasTarget(null)}
        fromTx={aliasTarget}
        onSave={saveAlias}
      />
    </Card>
  );
}
