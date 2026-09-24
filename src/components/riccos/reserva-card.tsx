import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Minus, PiggyBank, Plus, Settings2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/lib/auth";
import { formatCurrencyInput, parseCurrencyToNumber, toCurrencyInput } from "@/lib/currency-input";
import { formatBRL, formatDate } from "@/lib/finance-data";
import { computeMonthPace } from "@/lib/month-pace";
import {
  averageMonthlyExpenses,
  guardadoNoPeriodo,
  reservaSaldo,
  signedValue,
  type DbReserva,
  type DbReservaMovimento,
  type MovimentoTipo,
} from "@/lib/reserva";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { useRiccos } from "./store";

/** Movimentos recentes exibidos no card (o resto fica só no saldo). */
const RECENT_LIMIT = 3;

function useReserva(userId: string | undefined) {
  const [loading, setLoading] = useState(true);
  const [reserva, setReserva] = useState<DbReserva | null>(null);
  const [movimentos, setMovimentos] = useState<DbReservaMovimento[]>([]);

  const refetch = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    const [res, mov] = await Promise.all([
      supabase.from("reservas").select("*").eq("user_id", userId).maybeSingle(),
      supabase
        .from("reserva_movimentos")
        .select("*")
        .eq("user_id", userId)
        .order("movimento_data", { ascending: false })
        .order("criado_em", { ascending: false }),
    ]);
    if (res.error) console.error("Erro ao buscar reserva:", res.error);
    if (mov.error) console.error("Erro ao buscar movimentos da reserva:", mov.error);
    setReserva((res.data as DbReserva | null) ?? null);
    setMovimentos((mov.data as DbReservaMovimento[] | null) ?? []);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  /** Executa a escrita, avisa em caso de erro e recarrega. Resolve true se deu certo. */
  const write = useCallback(
    async (action: string, request: PromiseLike<{ error: unknown }>) => {
      let ok = false;
      try {
        const { error } = await request;
        ok = !error;
        if (error) console.error(`Erro ao ${action}:`, error);
      } catch (err) {
        console.error(`Erro ao ${action}:`, err);
      }
      if (!ok) {
        toast.error(`Não foi possível ${action}.`, {
          description: "Nada foi alterado. Verifique sua conexão e tente de novo.",
        });
        return false;
      }
      await refetch();
      return true;
    },
    [refetch],
  );

  const saveConfig = (alvo: number, saldoInicial: number) =>
    write(
      "salvar a reserva",
      supabase
        .from("reservas")
        .upsert(
          { user_id: userId, reserva_alvo: alvo, reserva_saldo_inicial: saldoInicial },
          { onConflict: "user_id" },
        ),
    );

  const addMovimento = (tipo: MovimentoTipo, valor: number, data: string, descricao: string) =>
    write(
      tipo === "aporte" ? "registrar o aporte" : "registrar o resgate",
      supabase.from("reserva_movimentos").insert({
        user_id: userId,
        movimento_tipo: tipo,
        movimento_valor: valor,
        movimento_data: data,
        movimento_descricao: descricao.trim() || null,
      }),
    );

  const removeMovimento = (id: string) =>
    write(
      "excluir o movimento",
      supabase.from("reserva_movimentos").delete().eq("movimento_id", id),
    );

  return { loading, reserva, movimentos, saveConfig, addMovimento, removeMovimento };
}

export function ReservaCard({ className }: { className?: string }) {
  const { user, profile } = useAuth();
  const { month, year, transactions, monthTransactions, dbCategories, dbGoals } = useRiccos();
  const cutoffDay = profile?.dia_vencimento ?? 3;
  const { loading, reserva, movimentos, saveConfig, addMovimento, removeMovimento } = useReserva(
    user?.id,
  );

  const [configOpen, setConfigOpen] = useState(false);
  const [movimentoTipo, setMovimentoTipo] = useState<MovimentoTipo | null>(null);

  const month1 = month + 1;
  const pace = useMemo(
    () =>
      computeMonthPace({
        month1,
        year,
        cutoffDay,
        monthTransactions,
        categories: dbCategories,
        goals: dbGoals,
      }),
    [month1, year, cutoffDay, monthTransactions, dbCategories, dbGoals],
  );
  const avgExpenses = useMemo(
    () => averageMonthlyExpenses(transactions, month1, year, cutoffDay),
    [transactions, month1, year, cutoffDay],
  );

  if (loading) return null;

  const saldo = reserva ? reservaSaldo(reserva, movimentos) : 0;
  const alvo = reserva ? Number(reserva.reserva_alvo) || 0 : 0;
  const alvoPct = alvo > 0 ? Math.min(100, Math.max(0, (saldo / alvo) * 100)) : 0;
  const mesesCobertos = avgExpenses && avgExpenses > 0 ? saldo / avgExpenses : null;

  const sobra = pace.projectedBalance;
  const guardado = guardadoNoPeriodo(movimentos, month1, year, cutoffDay);
  const semDestino = sobra - guardado;

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
              <PiggyBank className="size-4" />
            </span>
            Reserva
          </CardTitle>
          <CardDescription className="mt-1.5 text-xs">
            Para onde foi a sobra do mês.
          </CardDescription>
        </div>
        {reserva && (
          <div className="flex shrink-0 items-center gap-1.5">
            <Button size="sm" onClick={() => setMovimentoTipo("aporte")}>
              <Plus /> Guardar
            </Button>
            <Button size="sm" variant="outline" onClick={() => setMovimentoTipo("resgate")}>
              <Minus /> <span className="hidden sm:inline">Resgatar</span>
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Configurar reserva"
              onClick={() => setConfigOpen(true)}
            >
              <Settings2 />
            </Button>
          </div>
        )}
      </CardHeader>

      <CardContent>
        {!reserva ? (
          <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed p-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Defina quanto quer ter guardado e quanto já tem. A partir daí, todo mês o app mostra
              quanto da sobra foi para a reserva e quanto ficou sem destino.
            </p>
            <Button className="shrink-0" onClick={() => setConfigOpen(true)}>
              Configurar reserva
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-8">
            {/* Saldo e alvo */}
            <div className="space-y-3">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Guardado
                </span>
                <p className="text-2xl font-semibold tabular-nums">
                  {formatBRL(saldo)}
                  {alvo > 0 && (
                    <span className="text-sm font-medium text-muted-foreground">
                      {" "}
                      / {formatBRL(alvo)}
                    </span>
                  )}
                </p>
              </div>
              {alvo > 0 && (
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-700"
                    style={{ width: `${alvoPct}%` }}
                  />
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                {[
                  mesesCobertos !== null &&
                    `Cobre ≈ ${mesesCobertos.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ${
                      mesesCobertos >= 0.95 && mesesCobertos < 1.05 ? "mês" : "meses"
                    } dos seus gastos`,
                  alvo > 0 &&
                    (saldo >= alvo
                      ? "alvo atingido"
                      : `faltam ${formatBRL(alvo - saldo)} para o alvo`),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>

              {movimentos.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  {movimentos.slice(0, RECENT_LIMIT).map((m) => (
                    <div
                      key={m.movimento_id}
                      className="flex items-center justify-between gap-2 rounded-xl bg-secondary/60 py-1.5 pl-3 pr-1 text-xs"
                    >
                      <span className="min-w-0 truncate text-muted-foreground">
                        <span className="tabular-nums">{formatDate(m.movimento_data)}</span>
                        {" · "}
                        {m.movimento_descricao ||
                          (m.movimento_tipo === "aporte" ? "Aporte" : "Resgate")}
                      </span>
                      <span className="flex shrink-0 items-center gap-1">
                        <span
                          className={cn(
                            "font-semibold tabular-nums",
                            m.movimento_tipo === "aporte" ? "text-success" : "text-danger",
                          )}
                        >
                          {m.movimento_tipo === "aporte" ? "+" : "−"}
                          {formatBRL(Math.abs(signedValue(m)))}
                        </span>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label="Excluir movimento"
                          onClick={() => void removeMovimento(m.movimento_id)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Sobra do período → guardado → sem destino */}
            <SobraFlow
              phase={pace.phase}
              hasIncome={pace.income > 0}
              sobra={sobra}
              guardado={guardado}
              semDestino={semDestino}
            />
          </div>
        )}
      </CardContent>

      <ConfigDialog
        open={configOpen}
        onOpenChange={setConfigOpen}
        reserva={reserva}
        onSave={saveConfig}
      />
      <MovimentoDialog
        tipo={movimentoTipo}
        onOpenChange={(open) => !open && setMovimentoTipo(null)}
        onSave={addMovimento}
      />
    </Card>
  );
}

function SobraFlow({
  phase,
  hasIncome,
  sobra,
  guardado,
  semDestino,
}: {
  phase: "futuro" | "andamento" | "fechado";
  hasIncome: boolean;
  sobra: number;
  guardado: number;
  semDestino: number;
}) {
  const fechado = phase === "fechado";

  let hint: string;
  if (!hasIncome) hint = "Sem receitas lançadas no mês para calcular a sobra.";
  else if (phase === "futuro") hint = "O mês ainda não começou.";
  else if (sobra <= 0) hint = "Mês no vermelho: não há sobra para guardar.";
  else if (semDestino <= 0.005) hint = "Toda a sobra foi para a reserva.";
  else if (fechado) hint = `${formatBRL(semDestino)} sobraram e não foram para a reserva.`;
  else hint = `No ritmo atual, ainda dá para guardar ${formatBRL(semDestino)} este mês.`;

  const rows = [
    { label: fechado ? "Sobra do mês" : "Sobra estimada", value: sobra, show: hasIncome },
    { label: "Guardado no mês", value: guardado, show: true },
    {
      label: "Sem destino",
      value: Math.max(0, semDestino),
      show: hasIncome && phase !== "futuro" && sobra > 0,
      highlight: true,
    },
  ].filter((r) => r.show);

  return (
    <div className="space-y-3 rounded-2xl border bg-background/40 p-4">
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Neste mês
      </span>
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-3 text-sm">
            <span className={cn(r.highlight ? "font-semibold" : "text-muted-foreground")}>
              {r.label}
            </span>
            <span
              className={cn(
                "font-semibold tabular-nums",
                r.highlight && r.value > 0.005 && "text-warning-foreground",
                !r.highlight && r.value < 0 && "text-danger",
              )}
            >
              {formatBRL(r.value)}
            </span>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function ConfigDialog({
  open,
  onOpenChange,
  reserva,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reserva: DbReserva | null;
  onSave: (alvo: number, saldoInicial: number) => Promise<boolean>;
}) {
  const [alvo, setAlvo] = useState("");
  const [saldoInicial, setSaldoInicial] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAlvo(reserva ? toCurrencyInput(Number(reserva.reserva_alvo) || 0) : "");
    setSaldoInicial(reserva ? toCurrencyInput(Number(reserva.reserva_saldo_inicial) || 0) : "");
  }, [open, reserva]);

  const submit = async () => {
    setSaving(true);
    const ok = await onSave(parseCurrencyToNumber(alvo), parseCurrencyToNumber(saldoInicial));
    setSaving(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Reserva</DialogTitle>
          <DialogDescription>
            Quanto você quer ter guardado e quanto já tinha antes de começar a registrar aqui.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <CurrencyField id="reserva-alvo" label="Alvo" value={alvo} onChange={setAlvo} />
          <CurrencyField
            id="reserva-saldo-inicial"
            label="Saldo inicial"
            hint="O que já estava guardado. Os aportes e resgates somam a partir daqui."
            value={saldoInicial}
            onChange={setSaldoInicial}
          />
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} disabled={saving}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MovimentoDialog({
  tipo,
  onOpenChange,
  onSave,
}: {
  tipo: MovimentoTipo | null;
  onOpenChange: (open: boolean) => void;
  onSave: (tipo: MovimentoTipo, valor: number, data: string, descricao: string) => Promise<boolean>;
}) {
  const [valor, setValor] = useState("");
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [descricao, setDescricao] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!tipo) return;
    setValor("");
    setDate(new Date());
    setDescricao("");
  }, [tipo]);

  const numericValor = parseCurrencyToNumber(valor);
  const isAporte = tipo === "aporte";

  const submit = async () => {
    if (!tipo || numericValor <= 0 || !date) return;
    setSaving(true);
    const ok = await onSave(tipo, numericValor, format(date, "yyyy-MM-dd"), descricao);
    setSaving(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={!!tipo} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{isAporte ? "Guardar na reserva" : "Resgatar da reserva"}</DialogTitle>
          <DialogDescription>
            {isAporte
              ? "Registre o valor que você separou. Não conta como despesa."
              : "Registre o valor que saiu da reserva. Não conta como receita."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <CurrencyField id="movimento-valor" label="Valor" value={valor} onChange={setValor} />
          <div className="grid gap-2">
            <Label>Data</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("justify-start font-medium", !date && "text-muted-foreground")}
                >
                  <CalendarIcon />
                  {date ? format(date, "dd/MM/yyyy") : "Selecionar"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  locale={ptBR}
                  className="pointer-events-auto p-3"
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="movimento-descricao">Descrição (opcional)</Label>
            <Input
              id="movimento-descricao"
              placeholder={isAporte ? "Ex.: sobra de setembro" : "Ex.: conserto do carro"}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} disabled={saving || numericValor <= 0 || !date}>
            {isAporte ? "Guardar" : "Resgatar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CurrencyField({
  id,
  label,
  hint,
  value,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
          R$
        </span>
        <Input
          id={id}
          inputMode="numeric"
          placeholder="0,00"
          className="h-12 pl-10 text-lg font-semibold tabular-nums"
          value={value}
          onChange={(e) => onChange(formatCurrencyInput(e.target.value))}
        />
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
