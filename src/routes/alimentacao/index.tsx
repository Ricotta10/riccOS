import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Loader2,
  Send,
} from "lucide-react";

import { PageHeader, PushToggle } from "@/components/riccos/app-shell";
import { useAlimentacao } from "@/components/riccos/alimentacao-store";
import {
  KcalRing,
  MacroBar,
  MealCard,
  NoProtocolCard,
} from "@/components/riccos/alimentacao-widgets";
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
import { Textarea } from "@/components/ui/textarea";
import {
  PROTEIN_HIT_RATIO,
  addDaysKey,
  diasRestantes,
  formatDayLabel,
  localDateKey,
  parseDateKey,
  sumMeals,
  toDateTimeLocal,
  type PlanoOpcao,
} from "@/lib/alimentacao";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/alimentacao/")({
  head: () => ({
    meta: [
      { title: "Diário alimentar — RiccOS" },
      {
        name: "description",
        content:
          "Registre o que comeu e acompanhe calorias e macros do dia contra o seu protocolo.",
      },
    ],
  }),
  component: DiarioPage,
});

/** Horário padrão ao registrar num dia que não é hoje. */
function defaultTimeFor(day: string) {
  const today = localDateKey(new Date());
  if (day === today) return new Date();
  const d = parseDateKey(day);
  d.setHours(12, 0, 0, 0);
  return d;
}

function DiarioPage() {
  const { refeicoes, metas, protocoloAtivo, loaded } = useAlimentacao();
  const today = localDateKey(new Date());
  const [day, setDay] = useState(today);

  const dayMeals = useMemo(
    () =>
      refeicoes
        .filter((r) => localDateKey(r.refeicao_em) === day)
        .sort((a, b) => a.refeicao_em.localeCompare(b.refeicao_em)),
    [refeicoes, day],
  );
  const totals = useMemo(
    () => sumMeals(dayMeals.filter((m) => m.refeicao_status === "ok")),
    [dayMeals],
  );

  const restantes = diasRestantes(protocoloAtivo);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Alimentação"
        title="Diário alimentar"
        description="Conte o que comeu, do seu jeito. A IA calcula calorias e macros."
        showPeriodFilter={false}
      >
        <PushToggle />
      </PageHeader>

      {loaded && !protocoloAtivo && <NoProtocolCard className="mb-4" />}
      {protocoloAtivo && restantes !== null && restantes <= 7 && (
        <Card className="mb-4 border-warning/30 bg-warning-soft">
          <CardContent className="flex flex-col gap-3 p-4 text-warning-foreground sm:flex-row sm:items-center">
            <CalendarClock className="size-5 shrink-0" />
            <p className="flex-1 text-sm font-medium">
              {restantes <= 0
                ? "Seu protocolo venceu. Atualize o formulário para o agente montar o próximo."
                : `Seu protocolo vence em ${restantes} ${restantes === 1 ? "dia" : "dias"}. Já dá para responder o novo formulário.`}
            </p>
            <Button asChild size="sm" variant="outline">
              <Link to="/alimentacao/protocolo">Atualizar protocolo</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Navegação de dias */}
      <div className="mb-4 flex items-center justify-between gap-2 rounded-2xl border bg-card p-1.5 shadow-soft sm:max-w-sm">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setDay(addDaysKey(day, -1))}
          aria-label="Dia anterior"
        >
          <ChevronLeft />
        </Button>
        <button
          type="button"
          onClick={() => setDay(today)}
          className="flex-1 text-center text-sm font-semibold"
          title="Voltar para hoje"
        >
          {formatDayLabel(day, today)}
          {day !== today && (
            <span className="ml-1.5 font-medium text-muted-foreground">
              · {parseDateKey(day).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
            </span>
          )}
        </button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setDay(addDaysKey(day, 1))}
          disabled={day >= today}
          aria-label="Próximo dia"
        >
          <ChevronRight />
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* Resumo do dia */}
          <Card>
            <CardContent className="flex flex-col items-center gap-6 p-5 sm:flex-row sm:items-center sm:p-6">
              <KcalRing consumed={totals.kcal} target={metas?.kcal ?? null} />
              <div className="w-full flex-1 space-y-3.5">
                <MacroBar
                  label="Proteína"
                  value={totals.proteina_g}
                  target={metas?.proteina_g ?? null}
                  highlight={!!metas && totals.proteina_g >= metas.proteina_g * PROTEIN_HIT_RATIO}
                />
                <MacroBar
                  label="Carboidrato"
                  value={totals.carbo_g}
                  target={metas?.carbo_g ?? null}
                />
                <MacroBar
                  label="Gordura"
                  value={totals.gordura_g}
                  target={metas?.gordura_g ?? null}
                />
                {metas && (
                  <p className="text-xs text-muted-foreground">
                    <Remaining
                      kcal={metas.kcal - totals.kcal}
                      proteina={metas.proteina_g - totals.proteina_g}
                    />
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <RegisterCard day={day} />

          {/* Refeições */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Refeições
              </h2>
              <span className="text-xs text-muted-foreground">
                {dayMeals.length} {dayMeals.length === 1 ? "registro" : "registros"}
              </span>
            </div>
            {dayMeals.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center text-sm text-muted-foreground">
                  Nada registrado {day === today ? "hoje" : "neste dia"} ainda. Fale na Central
                  (“comi dois pães com manteiga agora”) ou escreva aqui em cima.
                </CardContent>
              </Card>
            ) : (
              dayMeals.map((m) => <MealCard key={m.refeicao_id} meal={m} />)
            )}
          </div>
        </div>

        <div className="space-y-4">
          <CheckinCard day={day} />
        </div>
      </div>
    </div>
  );
}

function Remaining({ kcal, proteina }: { kcal: number; proteina: number }) {
  const parts: string[] = [];
  if (proteina > 0) parts.push(`faltam ${Math.round(proteina)} g de proteína`);
  else parts.push("proteína do dia batida");
  if (kcal >= 0) parts.push(`${Math.round(kcal).toLocaleString("pt-BR")} kcal disponíveis`);
  else parts.push(`${Math.round(-kcal).toLocaleString("pt-BR")} kcal acima da meta`);
  const text = parts.join(" · ");
  return <>{text.charAt(0).toUpperCase() + text.slice(1)}.</>;
}

function RegisterCard({ day }: { day: string }) {
  const { registrarRefeicao } = useAlimentacao();
  const today = localDateKey(new Date());
  const [texto, setTexto] = useState("");
  const [customTime, setCustomTime] = useState(false);
  const [em, setEm] = useState(() => toDateTimeLocal(defaultTimeFor(day)));
  const [sending, setSending] = useState(false);

  // Num dia passado o horário é sempre explícito.
  const explicit = customTime || day !== today;
  const [lastDay, setLastDay] = useState(day);
  if (lastDay !== day) {
    setLastDay(day);
    setEm(toDateTimeLocal(defaultTimeFor(day)));
  }

  const submit = async () => {
    if (!texto.trim()) return;
    setSending(true);
    const when = explicit ? new Date(em) : null;
    const ok = await registrarRefeicao(texto, when && !Number.isNaN(when.getTime()) ? when : null);
    setSending(false);
    if (ok) {
      setTexto("");
      setCustomTime(false);
    }
  };

  return (
    <Card>
      <CardContent className="space-y-3 p-4 sm:p-5">
        <Label htmlFor="refeicao-texto" className="text-sm font-semibold">
          O que você comeu?
        </Label>
        <Textarea
          id="refeicao-texto"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void submit();
          }}
          placeholder="Ex.: 2 pães franceses com manteiga e um café com leite"
          rows={2}
          className="resize-none"
        />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {explicit ? (
            <Input
              type="datetime-local"
              value={em}
              onChange={(e) => setEm(e.target.value)}
              className="sm:w-56"
              aria-label="Horário da refeição"
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                setEm(toDateTimeLocal(new Date()));
                setCustomTime(true);
              }}
              className="flex h-10 items-center gap-1.5 rounded-xl px-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <CalendarClock className="size-4" />
              Agora · mudar horário
            </button>
          )}
          <Button className="sm:ml-auto" onClick={submit} disabled={sending || !texto.trim()}>
            {sending ? <Loader2 className="animate-spin" /> : <Send />}
            Registrar
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Pode citar o horário no texto (“ontem no almoço…”) que a IA entende.
        </p>
      </CardContent>
    </Card>
  );
}

function CheckinCard({ day }: { day: string }) {
  const { protocoloAtivo, checkin } = useAlimentacao();
  const [picked, setPicked] = useState<{ refeicao: string; opcao: PlanoOpcao } | null>(null);
  const [em, setEm] = useState("");
  const [saving, setSaving] = useState(false);
  const cardapio = protocoloAtivo?.protocolo_plano?.cardapio ?? [];

  if (!protocoloAtivo || cardapio.length === 0) return null;

  const open = (refeicao: string, opcao: PlanoOpcao) => {
    setPicked({ refeicao, opcao });
    setEm(toDateTimeLocal(defaultTimeFor(day)));
  };

  const confirm = async () => {
    if (!picked) return;
    setSaving(true);
    const when = new Date(em);
    const ok = await checkin(
      picked.opcao,
      picked.refeicao,
      Number.isNaN(when.getTime()) ? new Date() : when,
    );
    setSaving(false);
    if (ok) setPicked(null);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardCheck className="size-4" /> Check-in rápido
        </CardTitle>
        <CardDescription>Comeu uma opção do cardápio? Um toque e está registrado.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        {cardapio.map((grupo) => (
          <div key={grupo.refeicao} className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {grupo.refeicao}
            </p>
            <div className="space-y-1.5">
              {grupo.opcoes.map((op) => (
                <button
                  key={op.nome}
                  type="button"
                  onClick={() => open(grupo.refeicao, op)}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-xl border bg-background/50 px-3 py-2 text-left transition-colors",
                    "hover:border-ring/60 hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  <span className="min-w-0 truncate text-sm font-medium">{op.nome}</span>
                  <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                    {Math.round(op.kcal)} kcal · P {Math.round(op.proteina_g)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </CardContent>

      <Dialog open={!!picked} onOpenChange={(o) => !o && setPicked(null)}>
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{picked?.opcao.nome}</DialogTitle>
            <DialogDescription>
              {picked?.refeicao} · registra exatamente o que está no cardápio.
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-1 text-sm">
            {picked?.opcao.itens.map((it) => (
              <li key={it.nome} className="flex justify-between gap-3">
                <span className="min-w-0 truncate">
                  {it.quantidade} {it.unidade} · {it.nome}
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {Math.round(it.kcal)} kcal
                </span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="secondary">{Math.round(picked?.opcao.kcal ?? 0)} kcal</Badge>
            <Badge variant="secondary">P {Math.round(picked?.opcao.proteina_g ?? 0)} g</Badge>
            <Badge variant="secondary">C {Math.round(picked?.opcao.carbo_g ?? 0)} g</Badge>
            <Badge variant="secondary">G {Math.round(picked?.opcao.gordura_g ?? 0)} g</Badge>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="checkin-em">Horário</Label>
            <Input
              id="checkin-em"
              type="datetime-local"
              value={em}
              onChange={(e) => setEm(e.target.value)}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPicked(null)}>
              Cancelar
            </Button>
            <Button onClick={confirm} disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
