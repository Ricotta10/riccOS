import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Check,
  CheckCircle2,
  Circle,
  Clock,
  Crown,
  Flag,
  Flame,
  Gift,
  History,
  Lock,
  Plus,
  Sparkle,
  Trash2,
  Trophy,
  Wand2,
  XCircle,
  Zap,
} from "lucide-react";

import { PageHeader } from "@/components/riccos/app-shell";
import { useGamification, type SeasonCloseResult } from "@/components/riccos/gamification";
import { FaixaBadge, SeasonRing, faixaStyles } from "@/components/riccos/season-widgets";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { monthNames } from "@/lib/finance-data";
import {
  FAIXA_LABEL,
  FAIXA_THRESHOLDS,
  LEVELS,
  type DbRecompensa,
  type Faixa,
  type Mission,
} from "@/lib/gamification";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/missoes")({
  head: () => ({
    meta: [
      { title: "Missões — RiccOS | Temporada financeira" },
      {
        name: "description",
        content:
          "Missões mensais, pontuação, faixas Bronze/Prata/Ouro, recompensas e prendas para manter a disciplina financeira.",
      },
      { property: "og:title", content: "Missões — RiccOS" },
    ],
  }),
  component: MissionsPage,
});

/* ---------- Helpers de UI ---------- */

const statusMeta = {
  concluida: {
    label: "Concluída",
    icon: CheckCircle2,
    className: "text-success",
    badge: "success" as const,
  },
  em_andamento: {
    label: "Em andamento",
    icon: Clock,
    className: "text-muted-foreground",
    badge: "secondary" as const,
  },
  falhou: {
    label: "Fora da meta",
    icon: XCircle,
    className: "text-danger",
    badge: "destructive" as const,
  },
};

function MissionRow({
  mission,
  locked,
  onToggle,
  onRemove,
}: {
  mission: Mission;
  locked: boolean;
  onToggle?: (() => void) | undefined;
  onRemove?: (() => void) | undefined;
}) {
  const meta = statusMeta[mission.status];
  const Icon = meta.icon;
  const done = mission.status === "concluida";

  return (
    <div
      className={cn(
        "group flex items-start gap-3 rounded-2xl border bg-background/40 p-3.5 transition-colors hover:border-ring/40",
        done && "border-success/25",
      )}
    >
      {mission.kind === "manual" ? (
        <button
          type="button"
          disabled={locked}
          onClick={onToggle}
          aria-label={done ? "Marcar como pendente" : "Marcar como concluída"}
          className={cn(
            "mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border transition-all",
            done
              ? "border-success bg-success text-success-foreground"
              : "border-input bg-card text-transparent hover:border-ring",
            locked && "cursor-not-allowed opacity-60",
          )}
        >
          <Check className="size-3.5" strokeWidth={3} />
        </button>
      ) : (
        <span className={cn("mt-0.5 grid size-6 shrink-0 place-items-center", meta.className)}>
          <Icon className="size-5" />
        </span>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <p
            className={cn(
              "text-sm font-semibold",
              done && mission.kind === "manual" && "line-through decoration-success/60",
            )}
          >
            {mission.titulo}
          </p>
          <span className="inline-flex items-center gap-1 text-xs font-semibold tabular-nums text-primary">
            <Zap className="size-3" /> {mission.pontos} pts
          </span>
        </div>
        {mission.descricao && (
          <p className="mt-0.5 text-xs text-muted-foreground">{mission.descricao}</p>
        )}
        {mission.kind === "auto" && (
          <div className="mt-2.5 flex items-center gap-3">
            <Progress
              value={mission.progresso ?? 0}
              className="h-1.5 flex-1"
              style={
                {
                  "--progress-background":
                    mission.status === "falhou"
                      ? "var(--color-danger)"
                      : mission.status === "concluida"
                        ? "var(--color-success)"
                        : "var(--color-foreground)",
                } as React.CSSProperties
              }
            />
            <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
              {mission.detalhe}
            </span>
          </div>
        )}
      </div>

      {mission.kind === "manual" && onRemove && !locked && (
        <Button
          variant="ghost"
          size="icon-sm"
          className="-mr-1 -mt-1 text-muted-foreground opacity-0 transition-opacity hover:text-danger group-hover:opacity-100 focus-visible:opacity-100"
          onClick={onRemove}
          aria-label="Excluir missão"
        >
          <Trash2 />
        </Button>
      )}
    </div>
  );
}

function RewardRow({
  item,
  onToggle,
  onRemove,
}: {
  item: DbRecompensa;
  onToggle: (v: boolean) => void;
  onRemove: () => void;
}) {
  const isPenalty = item.recompensa_tipo === "prenda";
  return (
    <div
      className={cn(
        "group flex items-center gap-3 rounded-2xl border bg-background/40 p-3.5 transition-colors hover:border-ring/40",
        !item.recompensa_ativa && "opacity-60",
      )}
    >
      <span
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-xl",
          isPenalty ? "bg-danger-soft text-danger" : "bg-primary/10 text-primary",
        )}
      >
        {isPenalty ? <Flag className="size-4" /> : <Gift className="size-4" />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold">{item.recompensa_titulo}</p>
          {!isPenalty && item.recompensa_faixa && <FaixaBadge faixa={item.recompensa_faixa} />}
        </div>
        {item.recompensa_descricao && (
          <p className="mt-0.5 text-xs text-muted-foreground">{item.recompensa_descricao}</p>
        )}
      </div>
      <Switch checked={item.recompensa_ativa} onCheckedChange={onToggle} aria-label="Ativa" />
      <Button
        variant="ghost"
        size="icon-sm"
        className="text-muted-foreground hover:text-danger"
        onClick={onRemove}
        aria-label="Excluir"
      >
        <Trash2 />
      </Button>
    </div>
  );
}

/* ---------- Página ---------- */

function MissionsPage() {
  const g = useGamification();
  const {
    month1,
    year,
    autoMissions,
    manualMissions,
    season,
    closedSeason,
    temporadas,
    catalog,
    level,
    totalXp,
    streak,
    periodOver,
    periodCurrent,
    canClose,
  } = g;

  const [missionOpen, setMissionOpen] = useState(false);
  const [rewardOpen, setRewardOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [pastOpen, setPastOpen] = useState(false);
  const [pastClosed, setPastClosed] = useState<number | null>(null);
  const [result, setResult] = useState<SeasonCloseResult | null>(null);
  const [catalogTab, setCatalogTab] = useState<"recompensa" | "prenda">("recompensa");

  // Formulários
  const [mTitle, setMTitle] = useState("");
  const [mDesc, setMDesc] = useState("");
  const [mPoints, setMPoints] = useState("50");
  const [rTitle, setRTitle] = useState("");
  const [rDesc, setRDesc] = useState("");
  const [rType, setRType] = useState<"recompensa" | "prenda">("recompensa");
  const [rFaixa, setRFaixa] = useState<Exclude<Faixa, "nenhuma">>("bronze");

  const locked = !!closedSeason;
  const s = faixaStyles[season.faixa];

  const rewards = useMemo(
    () => catalog.filter((c) => c.recompensa_tipo === "recompensa"),
    [catalog],
  );
  const penalties = useMemo(() => catalog.filter((c) => c.recompensa_tipo === "prenda"), [catalog]);

  const history = useMemo(
    () =>
      [...temporadas].sort((a, b) =>
        b.temporada_ano !== a.temporada_ano
          ? b.temporada_ano - a.temporada_ano
          : b.temporada_mes - a.temporada_mes,
      ),
    [temporadas],
  );

  const submitMission = async () => {
    if (!mTitle.trim()) return;
    await g.addMission({
      titulo: mTitle.trim(),
      descricao: mDesc.trim(),
      pontos: Number(mPoints) || 50,
    });
    setMTitle("");
    setMDesc("");
    setMPoints("50");
    setMissionOpen(false);
  };

  const submitReward = async () => {
    if (!rTitle.trim()) return;
    await g.addReward({
      recompensa_titulo: rTitle.trim(),
      recompensa_descricao: rDesc.trim() || null,
      recompensa_tipo: rType,
      recompensa_faixa: rType === "recompensa" ? rFaixa : null,
      recompensa_ativa: true,
    });
    setRTitle("");
    setRDesc("");
    setRewardOpen(false);
  };

  const confirmClose = async () => {
    const r = await g.closeSeason();
    setCloseOpen(false);
    if (r) setResult(r);
  };

  const closedReward = g.rewardById(closedSeason?.temporada_recompensa_id);
  const closedPenalty = g.rewardById(closedSeason?.temporada_prenda_id);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        eyebrow="Jogo"
        title="Missões"
        description="Cumpra missões no mês, some pontos e desbloqueie recompensas — ou encare uma prenda."
        showBalance={false}
      />

      {/* ---------- Hero da temporada ---------- */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <Card className="relative overflow-hidden lg:col-span-5">
          <div
            aria-hidden
            className="pointer-events-none absolute -left-16 -top-16 size-56 rounded-full bg-primary/15 blur-3xl"
          />
          <CardContent className="relative flex flex-col items-center gap-5 p-6 text-center sm:flex-row sm:text-left">
            <SeasonRing pct={season.pct} faixa={season.faixa} size={164} stroke={12}>
              <div className="flex flex-col items-center">
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Pontos
                </span>
                <span className={cn("text-3xl font-semibold tabular-nums tracking-tight", s.text)}>
                  {season.points}
                </span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  de {season.maxPoints}
                </span>
              </div>
            </SeasonRing>
            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Temporada · {monthNames[month1 - 1]} / {year}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <FaixaBadge faixa={season.faixa} />
                  {closedSeason ? (
                    <Badge variant="secondary">
                      <Lock className="size-3" /> Encerrada
                    </Badge>
                  ) : periodOver ? (
                    <Badge variant="warning">Aguardando fechamento</Badge>
                  ) : periodCurrent ? (
                    <Badge variant="secondary">Em andamento</Badge>
                  ) : (
                    <Badge variant="secondary">Futura</Badge>
                  )}
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                {closedSeason
                  ? `${season.concluidas} de ${season.total} missões concluídas.`
                  : season.nextFaixa && season.nextFaixa !== "nenhuma"
                    ? `Faltam ${season.toNext} pts para ${FAIXA_LABEL[season.nextFaixa]}.`
                    : "Faixa máxima alcançada. Segure até o fim do mês!"}
              </p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-secondary/70 px-2 py-2">
                  <p className="text-lg font-semibold tabular-nums leading-none">{level.level}</p>
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Nível
                  </p>
                </div>
                <div className="rounded-xl bg-secondary/70 px-2 py-2">
                  <p className="text-lg font-semibold tabular-nums leading-none">{totalXp}</p>
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    XP total
                  </p>
                </div>
                <div className="rounded-xl bg-secondary/70 px-2 py-2">
                  <p className="flex items-center justify-center gap-1 text-lg font-semibold tabular-nums leading-none">
                    <Flame
                      className={cn(
                        "size-4",
                        streak > 0 ? "text-warning" : "text-muted-foreground",
                      )}
                    />
                    {streak}
                  </p>
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Streak
                  </p>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="font-semibold text-foreground">{level.name}</span>
                  <span>
                    {level.next
                      ? `${level.next.xp - totalXp} XP para ${level.next.name}`
                      : "Nível máximo"}
                  </span>
                </div>
                <Progress value={level.progress} className="mt-1.5 h-1.5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-7">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
                <Trophy className="size-4" />
              </span>
              Faixas e fechamento
            </CardTitle>
            <CardDescription className="text-xs">
              A pontuação no fim do mês define a faixa. Abaixo de Bronze, uma prenda é sorteada.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {(["bronze", "prata", "ouro"] as Exclude<Faixa, "nenhuma">[]).map((f) => {
                const need = Math.ceil(FAIXA_THRESHOLDS[f] * season.maxPoints);
                const reached = season.points >= need && season.maxPoints > 0;
                return (
                  <div
                    key={f}
                    className={cn(
                      "rounded-2xl border p-3.5 transition-colors",
                      reached ? "border-primary/40 bg-primary/5" : "bg-background/40",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <FaixaBadge faixa={f} />
                      {reached ? (
                        <CheckCircle2 className="size-4 text-success" />
                      ) : (
                        <Circle className="size-4 text-muted-foreground/50" />
                      )}
                    </div>
                    <p className="mt-2 text-lg font-semibold tabular-nums">
                      {need} <span className="text-xs font-medium text-muted-foreground">pts</span>
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {Math.round(FAIXA_THRESHOLDS[f] * 100)}% do total ·{" "}
                      {rewards.filter((r) => r.recompensa_faixa === f && r.recompensa_ativa).length}{" "}
                      recompensa(s)
                    </p>
                  </div>
                );
              })}
            </div>

            {closedSeason ? (
              <div className="rounded-2xl border bg-secondary/40 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Resultado da temporada
                    </p>
                    <p className="mt-1 text-sm">
                      Você fechou em{" "}
                      <span className={cn("font-semibold", s.text)}>
                        {FAIXA_LABEL[closedSeason.temporada_faixa]}
                      </span>{" "}
                      com {closedSeason.temporada_pontos} de {closedSeason.temporada_pontos_max}{" "}
                      pts.
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setReopenOpen(true)}>
                    Reabrir
                  </Button>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {closedReward && (
                    <div className="flex items-center gap-3 rounded-xl bg-primary/10 p-3">
                      <Gift className="size-5 shrink-0 text-primary" />
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                          Recompensa
                        </p>
                        <p className="truncate text-sm font-semibold">
                          {closedReward.recompensa_titulo}
                        </p>
                      </div>
                    </div>
                  )}
                  {closedPenalty && (
                    <div className="flex items-center gap-3 rounded-xl bg-danger-soft p-3">
                      <Flag className="size-5 shrink-0 text-danger" />
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-danger">
                          Prenda
                        </p>
                        <p className="truncate text-sm font-semibold">
                          {closedPenalty.recompensa_titulo}
                        </p>
                      </div>
                    </div>
                  )}
                  {!closedReward && !closedPenalty && (
                    <p className="text-xs text-muted-foreground sm:col-span-2">
                      Nenhuma recompensa ou prenda cadastrada para esta faixa no momento do
                      fechamento.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3 rounded-2xl border border-dashed p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold">
                    {periodOver
                      ? "O mês terminou. Feche a temporada para registrar a pontuação."
                      : periodCurrent
                        ? "Temporada em andamento."
                        : "Esta temporada ainda não começou."}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {periodOver
                      ? "A faixa sorteia a recompensa (ou a prenda) e soma XP ao seu nível."
                      : periodCurrent
                        ? "Você pode encerrar antes, mas as missões automáticas serão avaliadas como estão hoje."
                        : "Navegue até um mês atual ou passado para fechar."}
                  </p>
                </div>
                <Button
                  onClick={() => setCloseOpen(true)}
                  disabled={!canClose}
                  variant={periodOver ? "default" : "outline"}
                  className="shrink-0"
                >
                  <Trophy /> Fechar temporada
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ---------- Missões ---------- */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
                <Wand2 className="size-4" />
              </span>
              Missões automáticas
            </CardTitle>
            <CardDescription className="text-xs">
              Avaliadas em tempo real a partir dos seus lançamentos e metas.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {(closedSeason ? [] : autoMissions).map((m) => (
              <MissionRow key={m.id} mission={m} locked={locked} />
            ))}
            {closedSeason &&
              closedSeason.temporada_detalhes
                .filter((d) => d.id.startsWith("auto-"))
                .map((d) => (
                  <MissionRow
                    key={d.id}
                    locked
                    mission={{
                      id: d.id,
                      kind: "auto",
                      titulo: d.titulo,
                      descricao: "",
                      pontos: d.pontos,
                      status: d.concluida ? "concluida" : "falhou",
                      progresso: d.concluida ? 100 : 0,
                      detalhe: d.detalhe,
                    }}
                  />
                ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Sparkle className="size-4" />
                </span>
                Missões manuais
              </CardTitle>
              <CardDescription className="mt-1.5 text-xs">
                Desafios que você cria e marca quando concluir.
              </CardDescription>
            </div>
            <Button size="sm" onClick={() => setMissionOpen(true)} disabled={locked}>
              <Plus /> Nova
            </Button>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {(closedSeason
              ? closedSeason.temporada_detalhes
                  .filter((d) => d.id.startsWith("manual-"))
                  .map<Mission>((d) => ({
                    id: d.id,
                    kind: "manual",
                    titulo: d.titulo,
                    descricao: "",
                    pontos: d.pontos,
                    status: d.concluida ? "concluida" : "em_andamento",
                  }))
              : manualMissions
            ).map((m) => (
              <MissionRow
                key={m.id}
                mission={m}
                locked={locked}
                onToggle={m.dbId ? () => g.toggleMission(m.dbId!) : undefined}
                onRemove={m.dbId ? () => g.removeMission(m.dbId!) : undefined}
              />
            ))}
            {manualMissions.length === 0 && !closedSeason && (
              <div className="rounded-2xl border border-dashed p-6 text-center">
                <p className="text-sm font-medium">Nenhuma missão manual neste mês.</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Ex.: “Sem delivery na semana”, “Levar almoço 3x”, “Guardar R$ 300”.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => setMissionOpen(true)}
                >
                  <Plus /> Criar primeira missão
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ---------- Catálogo ---------- */}
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
                <Gift className="size-4" />
              </span>
              Recompensas & prendas
            </CardTitle>
            <CardDescription className="mt-1.5 text-xs">
              Cadastre o que você ganha em cada faixa — e o que paga se ficar abaixo de Bronze.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Tabs value={catalogTab} onValueChange={(v) => setCatalogTab(v as typeof catalogTab)}>
              <TabsList className="h-9">
                <TabsTrigger value="recompensa" className="px-3 text-xs">
                  Recompensas ({rewards.length})
                </TabsTrigger>
                <TabsTrigger value="prenda" className="px-3 text-xs">
                  Prendas ({penalties.length})
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <Button
              size="sm"
              onClick={() => {
                setRType(catalogTab);
                setRewardOpen(true);
              }}
            >
              <Plus /> Nova
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {catalog.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-8 text-center">
              <Gift className="mx-auto size-8 text-primary" />
              <p className="mt-3 text-sm font-semibold">Seu catálogo está vazio.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Comece com um conjunto sugerido (6 recompensas + 4 prendas) e edite à vontade.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Button onClick={() => g.seedCatalog()}>
                  <Wand2 /> Usar catálogo sugerido
                </Button>
                <Button variant="outline" onClick={() => setRewardOpen(true)}>
                  <Plus /> Criar do zero
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
              {(catalogTab === "recompensa" ? rewards : penalties).map((item) => (
                <RewardRow
                  key={item.recompensa_id}
                  item={item}
                  onToggle={(v) => g.updateReward(item.recompensa_id, { recompensa_ativa: v })}
                  onRemove={() => g.removeReward(item.recompensa_id)}
                />
              ))}
              {(catalogTab === "recompensa" ? rewards : penalties).length === 0 && (
                <p className="col-span-full rounded-2xl border border-dashed p-6 text-center text-xs text-muted-foreground">
                  Nada cadastrado nesta aba ainda.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ---------- Histórico ---------- */}
      <Card>
        <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
                <History className="size-4" />
              </span>
              Histórico de temporadas
            </CardTitle>
            <CardDescription className="mt-1.5 text-xs">
              Cada temporada fechada soma XP ao seu nível. Níveis:{" "}
              {LEVELS.map((l) => `${l.name} (${l.xp})`).join(" · ")}.
            </CardDescription>
          </div>
          {g.pastOpenPeriods.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPastOpen(true)}
              className="w-full sm:w-auto"
            >
              <History /> Fechar {g.pastOpenPeriods.length}{" "}
              {g.pastOpenPeriods.length === 1 ? "temporada passada" : "temporadas passadas"}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="rounded-2xl border border-dashed p-6 text-center text-xs text-muted-foreground">
              Nenhuma temporada fechada ainda. A primeira aparece aqui assim que você encerrar um
              mês.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
              {history.map((t) => {
                const rw = g.rewardById(t.temporada_recompensa_id);
                const pn = g.rewardById(t.temporada_prenda_id);
                const st = faixaStyles[t.temporada_faixa];
                return (
                  <div key={t.temporada_id} className="rounded-2xl border bg-background/40 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold">
                        {monthNames[t.temporada_mes - 1]} / {t.temporada_ano}
                      </p>
                      <FaixaBadge faixa={t.temporada_faixa} />
                    </div>
                    <p className={cn("mt-2 text-2xl font-semibold tabular-nums", st.text)}>
                      {t.temporada_pontos}
                      <span className="text-xs font-medium text-muted-foreground">
                        {" "}
                        / {t.temporada_pontos_max} pts
                      </span>
                    </p>
                    <Progress
                      value={
                        t.temporada_pontos_max > 0
                          ? (t.temporada_pontos / t.temporada_pontos_max) * 100
                          : 0
                      }
                      className="mt-2 h-1.5"
                    />
                    {(rw || pn) && (
                      <p className="mt-2.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                        {rw ? (
                          <Gift className="size-3.5 text-primary" />
                        ) : (
                          <Flag className="size-3.5 text-danger" />
                        )}
                        {rw?.recompensa_titulo ?? pn?.recompensa_titulo}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ---------- Dialog: nova missão ---------- */}
      <Dialog open={missionOpen} onOpenChange={setMissionOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova missão manual</DialogTitle>
            <DialogDescription>
              Um desafio para {monthNames[month1 - 1]}. Você marca como concluída quando cumprir.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="m-titulo">Título</Label>
              <Input
                id="m-titulo"
                placeholder="Ex.: Sem delivery na semana"
                value={mTitle}
                onChange={(e) => setMTitle(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="m-desc">Descrição (opcional)</Label>
              <Textarea
                id="m-desc"
                rows={2}
                placeholder="Como você vai saber que cumpriu?"
                value={mDesc}
                onChange={(e) => setMDesc(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Pontos</Label>
              <Select value={mPoints} onValueChange={setMPoints}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["20", "30", "50", "80", "100", "150"].map((p) => (
                    <SelectItem key={p} value={p}>
                      {p} pts
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setMissionOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={submitMission} disabled={!mTitle.trim()}>
              Criar missão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------- Dialog: nova recompensa/prenda ---------- */}
      <Dialog open={rewardOpen} onOpenChange={setRewardOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{rType === "prenda" ? "Nova prenda" : "Nova recompensa"}</DialogTitle>
            <DialogDescription>
              {rType === "prenda"
                ? "Sorteada quando a temporada fecha abaixo de Bronze."
                : "Sorteada entre as recompensas da faixa alcançada."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-1 rounded-2xl bg-secondary p-1">
              {(["recompensa", "prenda"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setRType(t)}
                  className={cn(
                    "flex h-10 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all",
                    rType === t
                      ? t === "prenda"
                        ? "bg-danger text-danger-foreground shadow-soft"
                        : "bg-primary text-primary-foreground shadow-soft"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t === "prenda" ? <Flag className="size-4" /> : <Gift className="size-4" />}
                  {t === "prenda" ? "Prenda" : "Recompensa"}
                </button>
              ))}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="r-titulo">Título</Label>
              <Input
                id="r-titulo"
                placeholder={rType === "prenda" ? "Ex.: 1 semana sem delivery" : "Ex.: Jantar fora"}
                value={rTitle}
                onChange={(e) => setRTitle(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="r-desc">Descrição (opcional)</Label>
              <Textarea
                id="r-desc"
                rows={2}
                value={rDesc}
                onChange={(e) => setRDesc(e.target.value)}
              />
            </div>
            {rType === "recompensa" && (
              <div className="grid gap-2">
                <Label>Faixa mínima</Label>
                <Select value={rFaixa} onValueChange={(v) => setRFaixa(v as typeof rFaixa)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bronze">Bronze</SelectItem>
                    <SelectItem value="prata">Prata</SelectItem>
                    <SelectItem value="ouro">Ouro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRewardOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={submitReward} disabled={!rTitle.trim()}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------- Confirmar fechamento ---------- */}
      <AlertDialog open={closeOpen} onOpenChange={setCloseOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Fechar a temporada de {monthNames[month1 - 1]}?</AlertDialogTitle>
            <AlertDialogDescription>
              Você está com <strong>{season.points}</strong> de {season.maxPoints} pontos — faixa{" "}
              <strong>{FAIXA_LABEL[season.faixa]}</strong>.{" "}
              {season.faixa === "nenhuma"
                ? "Abaixo de Bronze uma prenda será sorteada."
                : "Uma recompensa da faixa será sorteada."}{" "}
              {!periodOver &&
                "O mês ainda não terminou: as missões automáticas serão congeladas como estão agora."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmClose}>Fechar temporada</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ---------- Fechar temporadas passadas ---------- */}
      <AlertDialog open={pastOpen} onOpenChange={setPastOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Fechar temporadas passadas?</AlertDialogTitle>
            <AlertDialogDescription>
              {g.pastOpenPeriods.length} {g.pastOpenPeriods.length === 1 ? "período" : "períodos"}{" "}
              com lançamentos ainda{" "}
              {g.pastOpenPeriods.length === 1 ? "está aberto" : "estão abertos"}:{" "}
              <strong>
                {g.pastOpenPeriods.map((p) => `${monthNames[p.month1 - 1]}/${p.year}`).join(", ")}
              </strong>
              . As missões automáticas serão avaliadas com os dados de cada mês e a pontuação vira
              XP. Fechamento retroativo <strong>não sorteia recompensa nem prenda</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                const n = await g.closePastSeasons();
                setPastOpen(false);
                setPastClosed(n);
              }}
            >
              Fechar todas
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={pastClosed !== null} onOpenChange={(o) => !o && setPastClosed(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {pastClosed === 0
                ? "Nada foi fechado"
                : `${pastClosed} ${pastClosed === 1 ? "temporada fechada" : "temporadas fechadas"}`}
            </DialogTitle>
            <DialogDescription>
              {pastClosed === 0
                ? "Ocorreu um erro ao gravar. Verifique o console e tente novamente."
                : "O histórico e o seu XP foram atualizados. As regras completas (recompensas e prendas) valem a partir das próximas temporadas."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button className="w-full" onClick={() => setPastClosed(null)}>
              Entendi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------- Confirmar reabertura ---------- */}
      <AlertDialog open={reopenOpen} onOpenChange={setReopenOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reabrir esta temporada?</AlertDialogTitle>
            <AlertDialogDescription>
              O resultado registrado (pontos, faixa, recompensa/prenda) será apagado e o XP
              correspondente deixará de contar para o seu nível. As missões voltam a ser avaliadas
              em tempo real.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Manter fechada</AlertDialogCancel>
            <AlertDialogAction
              className="bg-danger text-danger-foreground hover:bg-danger/90"
              onClick={async () => {
                await g.reopenSeason();
                setReopenOpen(false);
              }}
            >
              Reabrir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ---------- Resultado ---------- */}
      <Dialog open={!!result} onOpenChange={(o) => !o && setResult(null)}>
        <DialogContent className="sm:max-w-md">
          {result && (
            <>
              <div className="relative -mx-5 -mt-5 overflow-hidden rounded-t-3xl bg-brand-black p-6 text-center text-brand-snow sm:-mx-6 sm:-mt-6">
                <div
                  aria-hidden
                  className="pointer-events-none absolute left-1/2 top-1/2 size-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-mint/25 blur-3xl"
                />
                <div className="relative">
                  <SeasonRing
                    pct={
                      result.temporada.temporada_pontos_max > 0
                        ? (result.temporada.temporada_pontos /
                            result.temporada.temporada_pontos_max) *
                          100
                        : 0
                    }
                    faixa={result.temporada.temporada_faixa}
                    size={120}
                    stroke={10}
                    className="mx-auto"
                  >
                    {result.temporada.temporada_faixa === "ouro" ? (
                      <Crown className="size-8 text-brand-mint" />
                    ) : (
                      <Trophy className="size-8 text-brand-mint" />
                    )}
                  </SeasonRing>
                  <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-snow/60">
                    Temporada encerrada
                  </p>
                  <h3 className="mt-1 text-2xl font-semibold">
                    {FAIXA_LABEL[result.temporada.temporada_faixa]}
                  </h3>
                  <p className="text-sm text-brand-snow/70">
                    {result.temporada.temporada_pontos} de {result.temporada.temporada_pontos_max}{" "}
                    pontos · +{result.temporada.temporada_pontos} XP
                  </p>
                </div>
              </div>
              <DialogHeader className="sr-only">
                <DialogTitle>Resultado da temporada</DialogTitle>
                <DialogDescription>Recompensa ou prenda sorteada.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 pt-2">
                {result.recompensa && (
                  <div className="flex items-start gap-3 rounded-2xl bg-primary/10 p-4">
                    <Gift className="mt-0.5 size-5 shrink-0 text-primary" />
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                        Sua recompensa
                      </p>
                      <p className="text-base font-semibold">
                        {result.recompensa.recompensa_titulo}
                      </p>
                      {result.recompensa.recompensa_descricao && (
                        <p className="text-xs text-muted-foreground">
                          {result.recompensa.recompensa_descricao}
                        </p>
                      )}
                    </div>
                  </div>
                )}
                {result.prenda && (
                  <div className="flex items-start gap-3 rounded-2xl bg-danger-soft p-4">
                    <Flag className="mt-0.5 size-5 shrink-0 text-danger" />
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-danger">
                        Sua prenda
                      </p>
                      <p className="text-base font-semibold">{result.prenda.recompensa_titulo}</p>
                      {result.prenda.recompensa_descricao && (
                        <p className="text-xs text-muted-foreground">
                          {result.prenda.recompensa_descricao}
                        </p>
                      )}
                    </div>
                  </div>
                )}
                {!result.recompensa && !result.prenda && (
                  <p className="rounded-2xl border border-dashed p-4 text-center text-xs text-muted-foreground">
                    Nenhum item cadastrado para esta faixa. Cadastre recompensas e prendas no
                    catálogo.
                  </p>
                )}
              </div>
              <DialogFooter>
                <Button onClick={() => setResult(null)} className="w-full">
                  Continuar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
