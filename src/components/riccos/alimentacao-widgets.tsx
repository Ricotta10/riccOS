import { useState, type CSSProperties } from "react";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ClipboardList,
  Loader2,
  Mic,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Trash2,
  Type,
  UtensilsCrossed,
} from "lucide-react";

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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MOTIVOS,
  MOTIVO_LABEL,
  QUALIDADE_LABEL,
  QUALIDADE_VARIANT,
  formatHour,
  num,
  toDateTimeLocal,
  type DbRefeicao,
  type DbRefeicaoItem,
  type MotivoErro,
  type Qualidade,
} from "@/lib/alimentacao";
import { cn } from "@/lib/utils";
import { STALE_PROCESSING_MS, useAlimentacao } from "./alimentacao-store";

/* ---------- Anel de calorias ---------- */

export function KcalRing({
  consumed,
  target,
  size = 148,
  className,
}: {
  consumed: number;
  target: number | null;
  size?: number;
  className?: string;
}) {
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const ratio = target && target > 0 ? consumed / target : 0;
  const shown = Math.min(1, ratio);
  const over = ratio > 1.1;
  const tone = !target
    ? "text-muted-foreground"
    : over
      ? "text-danger"
      : ratio >= 0.9
        ? "text-success"
        : "text-primary";

  return (
    <div
      className={cn("relative grid place-items-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="stroke-secondary"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - shown)}
          className={cn(
            "stroke-current transition-[stroke-dashoffset] duration-700 ease-out",
            tone,
          )}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-2xl font-semibold tabular-nums tracking-tight">
          {Math.round(consumed).toLocaleString("pt-BR")}
        </span>
        <span className="text-[11px] font-medium text-muted-foreground">
          {target ? `de ${Math.round(target).toLocaleString("pt-BR")} kcal` : "kcal"}
        </span>
      </div>
    </div>
  );
}

/* ---------- Barra de macro ---------- */

export function MacroBar({
  label,
  value,
  target,
  unit = "g",
  highlight = false,
}: {
  label: string;
  value: number;
  target: number | null;
  unit?: string;
  highlight?: boolean;
}) {
  const pct = target && target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0;
  const over = !!target && value > target * 1.15;
  const color = over
    ? "var(--color-danger)"
    : highlight
      ? "var(--color-success)"
      : "var(--color-primary)";
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="font-semibold">{label}</span>
        <span className="tabular-nums text-muted-foreground">
          <span className="font-semibold text-foreground">{Math.round(value)}</span>
          {target ? ` / ${Math.round(target)} ${unit}` : ` ${unit}`}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full transition-[width] duration-700 ease-out"
          style={{ width: `${pct}%`, background: color } as CSSProperties}
        />
      </div>
    </div>
  );
}

/* ---------- Badges ---------- */

export function QualidadeBadge({ qualidade }: { qualidade: Qualidade | null }) {
  if (!qualidade) return null;
  return <Badge variant={QUALIDADE_VARIANT[qualidade]}>{QUALIDADE_LABEL[qualidade]}</Badge>;
}

const origemIcon = { texto: Type, voz: Mic, checkin: ClipboardList } as const;

/* ---------- Sem protocolo ---------- */

export function NoProtocolCard({ className }: { className?: string }) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-accent text-accent-foreground">
          <ClipboardList className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Crie seu protocolo alimentar</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Responda o formulário e o agente monta suas metas de calorias e macros, a rotina de
            refeições e um cardápio base. Sem ele, o app registra mas não sabe o que é “bom” para
            você.
          </p>
        </div>
        <Button asChild>
          <Link to="/alimentacao/protocolo">Responder formulário</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

/* ---------- Card de refeição ---------- */

export function MealCard({ meal }: { meal: DbRefeicao }) {
  const { reprocessarRefeicao, removerRefeicao, atualizarRefeicao } = useAlimentacao();
  const [editing, setEditing] = useState(false);
  const OrigemIcon = origemIcon[meal.refeicao_origem];
  const itens = meal.refeicao_itens ?? [];
  const processing = meal.refeicao_status === "processando";
  const stale = processing && Date.now() - new Date(meal.criado_em).getTime() > STALE_PROCESSING_MS;
  const failed = meal.refeicao_status === "erro" || stale;
  const title = meal.refeicao_descricao || meal.refeicao_texto || "Refeição";

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="flex w-12 shrink-0 flex-col items-center gap-1 pt-0.5">
            <span className="text-sm font-semibold tabular-nums">
              {formatHour(meal.refeicao_em)}
            </span>
            <OrigemIcon
              className="size-3.5 text-muted-foreground"
              aria-label={`Registrado por ${meal.refeicao_origem}`}
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="min-w-0 truncate font-semibold">{title}</p>
              {!processing && !failed && <QualidadeBadge qualidade={meal.refeicao_qualidade} />}
            </div>

            {processing && !stale && (
              <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                Calculando calorias e macros…
              </p>
            )}

            {failed && (
              <div className="mt-2 space-y-2">
                <p className="flex items-center gap-1.5 text-xs text-danger">
                  <AlertTriangle className="size-3.5" />
                  {meal.refeicao_erro ?? "A IA não terminou de processar."}
                </p>
                {meal.refeicao_texto && (
                  <p className="text-xs text-muted-foreground">“{meal.refeicao_texto}”</p>
                )}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => reprocessarRefeicao(meal.refeicao_id)}
                  >
                    <RotateCcw /> Tentar de novo
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removerRefeicao(meal.refeicao_id)}
                  >
                    <Trash2 /> Apagar
                  </Button>
                </div>
              </div>
            )}

            {meal.refeicao_status === "ok" && (
              <>
                {itens.length > 0 && (
                  <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                    {itens.map((it) => (
                      <li key={it.item_id} className="flex justify-between gap-3">
                        <span className="min-w-0 truncate">
                          {formatQty(it)} · {it.item_nome}
                        </span>
                        <span className="shrink-0 tabular-nums">
                          {Math.round(it.item_kcal)} kcal
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-medium tabular-nums text-muted-foreground">
                  <span className="font-semibold text-foreground">
                    {Math.round(meal.refeicao_kcal)} kcal
                  </span>
                  <span>P {Math.round(meal.refeicao_proteina_g)} g</span>
                  <span>C {Math.round(meal.refeicao_carbo_g)} g</span>
                  <span>G {Math.round(meal.refeicao_gordura_g)} g</span>
                </div>
                {meal.refeicao_qualidade_motivo && meal.refeicao_qualidade !== "boa" && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {meal.refeicao_qualidade_motivo}
                  </p>
                )}

                {meal.refeicao_qualidade === "ruim" && (
                  <MotivoPicker
                    value={meal.refeicao_motivo_erro}
                    onChange={(m) =>
                      atualizarRefeicao(meal.refeicao_id, { refeicao_motivo_erro: m })
                    }
                  />
                )}
              </>
            )}
          </div>

          {!processing && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Ações da refeição"
                  className="-mr-1 -mt-1 shrink-0"
                >
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-xl">
                {meal.refeicao_status === "ok" && (
                  <DropdownMenuItem onClick={() => setEditing(true)}>
                    <Pencil /> Editar
                  </DropdownMenuItem>
                )}
                {meal.refeicao_texto && meal.refeicao_origem !== "checkin" && (
                  <DropdownMenuItem onClick={() => reprocessarRefeicao(meal.refeicao_id)}>
                    <RotateCcw /> Recalcular com a IA
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  className="text-danger focus:text-danger"
                  onClick={() => removerRefeicao(meal.refeicao_id)}
                >
                  <Trash2 /> Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardContent>
      {editing && <MealEditDialog meal={meal} onClose={() => setEditing(false)} />}
    </Card>
  );
}

function formatQty(it: DbRefeicaoItem) {
  const q = num(it.item_quantidade);
  const qty = Number.isInteger(q)
    ? String(q)
    : q.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  return `${qty} ${it.item_unidade}`;
}

function MotivoPicker({
  value,
  onChange,
}: {
  value: MotivoErro | null;
  onChange: (m: MotivoErro | null) => void;
}) {
  return (
    <div className="mt-3 rounded-xl border border-danger/20 bg-danger-soft/50 p-3">
      <p className="text-xs font-semibold">
        {value ? "Motivo registrado" : "O que fez sair do plano?"}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {MOTIVOS.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onChange(value === m ? null : m)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors",
              value === m
                ? "border-transparent bg-danger text-danger-foreground"
                : "bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {MOTIVO_LABEL[m]}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------- Edição ---------- */

function MealEditDialog({ meal, onClose }: { meal: DbRefeicao; onClose: () => void }) {
  const { atualizarRefeicao, atualizarQuantidadeItem, removerItem } = useAlimentacao();
  const [em, setEm] = useState(toDateTimeLocal(meal.refeicao_em));
  const [descricao, setDescricao] = useState(meal.refeicao_descricao ?? "");
  const [qualidade, setQualidade] = useState<Qualidade | "none">(meal.refeicao_qualidade ?? "none");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const nextEm = new Date(em);
    const ok = await atualizarRefeicao(meal.refeicao_id, {
      ...(Number.isNaN(nextEm.getTime()) || toDateTimeLocal(meal.refeicao_em) === em
        ? {}
        : { refeicao_em: nextEm.toISOString() }),
      refeicao_descricao: descricao.trim() || meal.refeicao_descricao || "",
      refeicao_qualidade: qualidade === "none" ? null : qualidade,
      ...(qualidade !== "ruim" ? { refeicao_motivo_erro: null } : {}),
    });
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-3xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar refeição</DialogTitle>
          <DialogDescription>
            Ajuste a quantidade de um item e as calorias e macros são recalculadas na proporção.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="meal-em">Horário</Label>
              <Input
                id="meal-em"
                type="datetime-local"
                value={em}
                onChange={(e) => setEm(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Classificação</Label>
              <Select
                value={qualidade}
                onValueChange={(v) => setQualidade(v as Qualidade | "none")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="boa">{QUALIDADE_LABEL.boa}</SelectItem>
                  <SelectItem value="ok">{QUALIDADE_LABEL.ok}</SelectItem>
                  <SelectItem value="ruim">{QUALIDADE_LABEL.ruim}</SelectItem>
                  <SelectItem value="none">Sem classificação</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="meal-desc">Descrição</Label>
            <Input
              id="meal-desc"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Itens</Label>
            {(meal.refeicao_itens ?? []).length === 0 && (
              <p className="text-xs text-muted-foreground">Nenhum item.</p>
            )}
            {(meal.refeicao_itens ?? []).map((it) => (
              <ItemRow
                key={it.item_id}
                item={it}
                onQty={(q) => atualizarQuantidadeItem(it, q)}
                onRemove={() => removerItem(it)}
              />
            ))}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ItemRow({
  item,
  onQty,
  onRemove,
}: {
  item: DbRefeicaoItem;
  onQty: (q: number) => Promise<boolean>;
  onRemove: () => Promise<boolean>;
}) {
  const [qty, setQty] = useState(String(num(item.item_quantidade)).replace(".", ","));
  const [busy, setBusy] = useState(false);

  const commit = async () => {
    const q = Number(qty.replace(",", "."));
    if (!Number.isFinite(q) || q <= 0 || q === num(item.item_quantidade)) return;
    setBusy(true);
    await onQty(q);
    setBusy(false);
  };

  return (
    <div className="flex items-center gap-2 rounded-xl border bg-background/50 p-2">
      <UtensilsCrossed className="ml-1 size-3.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{item.item_nome}</p>
        <p className="text-[11px] tabular-nums text-muted-foreground">
          {Math.round(item.item_kcal)} kcal · P {Math.round(item.item_proteina_g)} · C{" "}
          {Math.round(item.item_carbo_g)} · G {Math.round(item.item_gordura_g)}
        </p>
      </div>
      <Input
        inputMode="decimal"
        value={qty}
        onChange={(e) => setQty(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && commit()}
        className="h-9 w-16 text-center tabular-nums"
        aria-label={`Quantidade de ${item.item_nome}`}
      />
      <span className="w-8 shrink-0 truncate text-xs text-muted-foreground">
        {item.item_unidade}
      </span>
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await onRemove();
          setBusy(false);
        }}
        aria-label={`Remover ${item.item_nome}`}
      >
        {busy ? <Loader2 className="animate-spin" /> : <Trash2 />}
      </Button>
    </div>
  );
}
