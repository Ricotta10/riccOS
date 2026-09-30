import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Droplets,
  Flame,
  Home,
  Loader2,
  RefreshCw,
  ShoppingCart,
  Sparkles,
  XCircle,
} from "lucide-react";

import { PageHeader, PushToggle } from "@/components/riccos/app-shell";
import { useAlimentacao } from "@/components/riccos/alimentacao-store";
import { StatCard } from "@/components/riccos/stat-card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import {
  PROTOCOLO_DIAS,
  QUALIDADE_LABEL,
  diasRestantes,
  formatDayLabel,
  type DbMedida,
  type DbProtocolo,
  type ProtocoloRespostas,
  type Qualidade,
} from "@/lib/alimentacao";
import { formatDate } from "@/lib/finance-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/alimentacao/protocolo")({
  head: () => ({
    meta: [
      { title: "Protocolo alimentar — RiccOS" },
      {
        name: "description",
        content: "Formulário e protocolo alimentar gerado pelo agente de IA do RiccOS.",
      },
    ],
  }),
  component: ProtocoloPage,
});

function ProtocoloPage() {
  const { protocoloAtivo, protocoloGerando, protocolos, loaded } = useAlimentacao();
  const [formOpen, setFormOpen] = useState(false);
  const ultimoErro = protocolos[0]?.protocolo_status === "erro" ? protocolos[0] : null;

  const showForm = formOpen || (loaded && !protocoloAtivo && !protocoloGerando);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow="Alimentação"
        title="Protocolo alimentar"
        description={`Suas metas, rotina e cardápio, gerados pelo agente a cada ${PROTOCOLO_DIAS} dias.`}
        showPeriodFilter={false}
      >
        <div className="flex gap-2">
          {protocoloAtivo && !formOpen && !protocoloGerando && (
            <Button
              variant="outline"
              className="h-11 flex-1 sm:h-10"
              onClick={() => setFormOpen(true)}
            >
              <RefreshCw /> Atualizar protocolo
            </Button>
          )}
          <PushToggle />
        </div>
      </PageHeader>

      {!loaded && (
        <div className="grid place-items-center py-20 text-muted-foreground">
          <Loader2 className="size-6 animate-spin" />
        </div>
      )}

      {protocoloGerando && <GeneratingCard />}

      {ultimoErro && !protocoloGerando && (
        <Card className="mb-4 border-danger/30 bg-danger-soft">
          <CardContent className="flex items-start gap-3 p-4 text-danger">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p className="text-sm">
              A última geração falhou
              {ultimoErro.protocolo_erro ? ` (${ultimoErro.protocolo_erro})` : ""}. Suas respostas
              ficaram salvas: é só enviar o formulário de novo.
            </p>
          </CardContent>
        </Card>
      )}

      {showForm && !protocoloGerando && (
        <ProtocoloForm
          onDone={() => setFormOpen(false)}
          onCancel={protocoloAtivo ? () => setFormOpen(false) : undefined}
        />
      )}

      {protocoloAtivo && !showForm && <PlanoView protocolo={protocoloAtivo} />}

      {!showForm && <HistoryCard />}
    </div>
  );
}

function GeneratingCard() {
  return (
    <Card className="mb-4 overflow-hidden">
      <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
        <div className="relative grid size-16 place-items-center">
          <span className="animate-orbit absolute inset-0 rounded-full border border-dashed border-primary/40" />
          <Sparkles className="size-6" />
        </div>
        <div>
          <p className="font-semibold">O agente está montando seu protocolo</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Calculando gasto energético, metas de macros, rotina e cardápio. Leva cerca de um minuto
            — pode sair da tela que você recebe um push quando ficar pronto.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/* ============================================================
 * Plano ativo
 * ============================================================ */

const QUALIDADE_ICON: Record<Qualidade, ReactNode> = {
  boa: <CheckCircle2 className="size-4 text-success" />,
  ok: <AlertTriangle className="size-4 text-warning-foreground" />,
  ruim: <XCircle className="size-4 text-danger" />,
};

function PlanoView({ protocolo }: { protocolo: DbProtocolo }) {
  const plano = protocolo.protocolo_plano;
  const restantes = diasRestantes(protocolo) ?? 0;
  const decorridos = Math.max(0, Math.min(PROTOCOLO_DIAS, PROTOCOLO_DIAS - restantes));
  if (!plano) return null;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-4 p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="success">Ativo</Badge>
            {protocolo.protocolo_inicio && protocolo.protocolo_fim && (
              <span className="text-xs text-muted-foreground">
                {formatDate(protocolo.protocolo_inicio)} → {formatDate(protocolo.protocolo_fim)}
              </span>
            )}
            <span
              className={cn(
                "ml-auto flex items-center gap-1.5 text-xs font-semibold",
                restantes <= 7 ? "text-warning-foreground" : "text-muted-foreground",
              )}
            >
              <CalendarClock className="size-3.5" />
              {restantes > 0 ? `${restantes} dias restantes` : "Vencido — atualize o formulário"}
            </span>
          </div>
          <Progress value={(decorridos / PROTOCOLO_DIAS) * 100} />
          {plano.resumo && <p className="text-sm leading-relaxed">{plano.resumo}</p>}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Calorias / dia"
          value={`${plano.metas.kcal.toLocaleString("pt-BR")} kcal`}
          tone="primary"
          icon={Flame}
        />
        <StatCard
          label="Proteína"
          value={`${Math.round(plano.metas.proteina_g)} g`}
          tone="success"
        />
        <StatCard label="Carboidrato" value={`${Math.round(plano.metas.carbo_g)} g`} />
        <StatCard label="Gordura" value={`${Math.round(plano.metas.gordura_g)} g`} />
      </div>

      {plano.cardapio && plano.cardapio.length > 0 && (
        <Card className="border-transparent bg-accent text-accent-foreground">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
            <ShoppingCart className="size-5 shrink-0" />
            <p className="flex-1 text-sm font-medium">
              A lista de compras da semana já está pronta, montada a partir deste cardápio.
            </p>
            <Button asChild size="sm">
              <Link to="/alimentacao/compras">Ver lista de compras</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Rotina</CardTitle>
            <CardDescription>
              Mínimo de {protocolo.protocolo_refeicoes_min ?? plano.rotina?.refeicoes_min ?? 3}{" "}
              refeições por dia · lembrete após{" "}
              {Number(protocolo.protocolo_intervalo_max_h ?? plano.rotina?.intervalo_max_h ?? 4)} h
              sem registro
              {plano.metas.agua_ml
                ? ` · ${(plano.metas.agua_ml / 1000).toLocaleString("pt-BR")} L de água`
                : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {(plano.rotina?.janelas ?? []).map((j) => (
              <div
                key={j.nome}
                className="flex items-start justify-between gap-3 rounded-xl border bg-background/50 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{j.nome}</p>
                  {j.foco && <p className="text-xs text-muted-foreground">{j.foco}</p>}
                </div>
                <span className="shrink-0 text-xs font-semibold tabular-nums">{j.horario}</span>
              </div>
            ))}
            {plano.metas.agua_ml ? (
              <p className="flex items-center gap-1.5 pt-1 text-xs text-muted-foreground">
                <Droplets className="size-3.5" /> Água:{" "}
                {plano.metas.agua_ml.toLocaleString("pt-BR")} ml por dia
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Como cada refeição é classificada</CardTitle>
            <CardDescription>
              A IA usa estes critérios ao registrar o que você comeu.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5 pt-0">
            {(["boa", "ok", "ruim"] as Qualidade[]).map((q) =>
              plano.criterios?.[q] ? (
                <div key={q} className="flex gap-2.5">
                  <span className="mt-0.5">{QUALIDADE_ICON[q]}</span>
                  <div>
                    <p className="text-sm font-semibold">{QUALIDADE_LABEL[q]}</p>
                    <p className="text-xs text-muted-foreground">{plano.criterios[q]}</p>
                  </div>
                </div>
              ) : null,
            )}
          </CardContent>
        </Card>
      </div>

      {plano.cardapio && plano.cardapio.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Cardápio base</CardTitle>
            <CardDescription>
              Opções para cada momento do dia. No Diário, um toque registra a opção inteira.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <Accordion type="multiple" className="w-full">
              {plano.cardapio.map((g) => (
                <AccordionItem key={g.refeicao} value={g.refeicao}>
                  <AccordionTrigger className="text-sm font-semibold">
                    {g.refeicao}
                    <span className="ml-auto mr-2 text-xs font-medium text-muted-foreground">
                      {g.opcoes.length} {g.opcoes.length === 1 ? "opção" : "opções"}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-2">
                    {g.opcoes.map((op) => (
                      <div key={op.nome} className="rounded-xl border bg-background/50 p-3">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <p className="text-sm font-semibold">{op.nome}</p>
                          <p className="text-[11px] font-medium tabular-nums text-muted-foreground">
                            {Math.round(op.kcal)} kcal · P {Math.round(op.proteina_g)} · C{" "}
                            {Math.round(op.carbo_g)} · G {Math.round(op.gordura_g)}
                          </p>
                        </div>
                        <ul className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
                          {op.itens.map((it) => (
                            <li key={it.nome}>
                              {it.quantidade} {it.unidade} · {it.nome}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <ListCard title="Orientações" items={plano.orientacoes} />
        <ListCard title="Evitar" items={plano.evitar} />
        <ListCard
          title={
            protocolo.protocolo_respostas?.rotina?.trabalho === "home_office"
              ? "No home office"
              : "Na rotina de trabalho"
          }
          items={plano.home_office}
          icon={<Home className="size-4" />}
        />
      </div>

      {plano.calculos?.explicacao && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Como o agente chegou nesses números</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0 text-sm text-muted-foreground">
            {(plano.calculos.tmb || plano.calculos.get) && (
              <div className="flex flex-wrap gap-1.5">
                {plano.calculos.tmb ? (
                  <Badge variant="secondary">TMB {Math.round(plano.calculos.tmb)} kcal</Badge>
                ) : null}
                {plano.calculos.get ? (
                  <Badge variant="secondary">
                    Gasto total {Math.round(plano.calculos.get)} kcal
                  </Badge>
                ) : null}
                {plano.calculos.estrategia ? (
                  <Badge variant="secondary">{plano.calculos.estrategia}</Badge>
                ) : null}
              </div>
            )}
            <p className="leading-relaxed">{plano.calculos.explicacao}</p>
            <p className="text-xs">
              Estimativas geradas por IA a partir das suas respostas — não substituem acompanhamento
              de nutricionista.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ListCard({
  title,
  items,
  icon,
}: {
  title: string;
  items?: string[] | undefined;
  icon?: ReactNode;
}) {
  if (!items || items.length === 0) return null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <ul className="space-y-1.5 text-sm">
          {items.map((t) => (
            <li key={t} className="flex gap-2">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-brand-sage" />
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function HistoryCard() {
  const { protocolos } = useAlimentacao();
  const antigos = protocolos.filter((p) => p.protocolo_status === "substituido");
  if (antigos.length === 0) return null;
  return (
    <Card className="mt-4">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardList className="size-4" /> Protocolos anteriores
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        {antigos.map((p) => (
          <div
            key={p.protocolo_id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm"
          >
            <span className="font-medium">
              {p.protocolo_inicio
                ? formatDate(p.protocolo_inicio)
                : formatDayLabel(p.criado_em.slice(0, 10))}
              {p.protocolo_fim ? ` → ${formatDate(p.protocolo_fim)}` : ""}
            </span>
            <span className="text-xs tabular-nums text-muted-foreground">
              {p.protocolo_kcal} kcal · P {p.protocolo_proteina_g} · C {p.protocolo_carbo_g} · G{" "}
              {p.protocolo_gordura_g}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/* ============================================================
 * Formulário
 * ============================================================ */

const emptyRespostas: ProtocoloRespostas = {
  dados: {
    sexo: "masculino",
    idade: null,
    altura_cm: null,
    peso_kg: null,
    bf_pct: null,
    massa_muscular_kg: null,
    cintura_cm: null,
  },
  objetivo: {
    // Vazio: cada usuário escreve o próprio objetivo (o exemplo fica no placeholder).
    descricao: "",
    peso_meta_kg: null,
    bf_meta_pct: null,
  },
  rotina: {
    hora_acordar: "07:00",
    hora_dormir: "23:00",
    trabalho: "home_office",
    atividade: "leve",
    atividade_descricao: "",
  },
  alimentacao: {
    refeicoes_hoje: null,
    cozinha: "as_vezes",
    agua_litros: null,
    preferencias: "",
    nao_gosta: "",
    restricoes: "",
    suplementos: "",
    alcool: "",
  },
  habitos: { dia_tipico: "", dificuldades: "", observacoes: "" },
};

/** Parte das respostas anteriores e da última pesagem para não redigitar tudo. */
function initialRespostas(
  ultimo: DbProtocolo | undefined,
  medida: DbMedida | undefined,
): ProtocoloRespostas {
  const base: ProtocoloRespostas = ultimo?.protocolo_respostas
    ? {
        dados: { ...emptyRespostas.dados, ...ultimo.protocolo_respostas.dados },
        objetivo: { ...emptyRespostas.objetivo, ...ultimo.protocolo_respostas.objetivo },
        rotina: { ...emptyRespostas.rotina, ...ultimo.protocolo_respostas.rotina },
        alimentacao: { ...emptyRespostas.alimentacao, ...ultimo.protocolo_respostas.alimentacao },
        habitos: { ...emptyRespostas.habitos, ...ultimo.protocolo_respostas.habitos },
      }
    : structuredClone(emptyRespostas);
  if (medida) {
    base.dados.peso_kg = medida.medida_peso_kg ?? base.dados.peso_kg;
    base.dados.bf_pct = medida.medida_bf_pct ?? base.dados.bf_pct;
    base.dados.massa_muscular_kg = medida.medida_massa_muscular_kg ?? base.dados.massa_muscular_kg;
    base.dados.cintura_cm = medida.medida_cintura_cm ?? base.dados.cintura_cm;
  }
  return base;
}

function ProtocoloForm({
  onDone,
  onCancel,
}: {
  onDone: () => void;
  onCancel?: (() => void) | undefined;
}) {
  const { protocolos, medidas, gerarProtocolo } = useAlimentacao();
  const ultimo = protocolos.find((p) => p.protocolo_status !== "gerando");
  const [r, setR] = useState<ProtocoloRespostas>(() => initialRespostas(ultimo, medidas[0]));
  const [sending, setSending] = useState(false);

  const set = <S extends keyof ProtocoloRespostas>(
    section: S,
    patch: Partial<ProtocoloRespostas[S]>,
  ) => setR((prev) => ({ ...prev, [section]: { ...prev[section], ...patch } }));

  const missing = useMemo(() => {
    const m: string[] = [];
    if (!r.dados.idade) m.push("idade");
    if (!r.dados.altura_cm) m.push("altura");
    if (!r.dados.peso_kg) m.push("peso");
    if (!r.objetivo.descricao.trim()) m.push("objetivo");
    return m;
  }, [r]);

  const submit = async () => {
    if (missing.length) return;
    setSending(true);
    const ok = await gerarProtocolo(r);
    setSending(false);
    if (ok) onDone();
  };

  return (
    <div className="space-y-4">
      <Card className="border-transparent bg-brand-black text-brand-snow dark">
        <CardContent className="flex items-start gap-3 p-5">
          <Sparkles className="mt-0.5 size-5 shrink-0 text-brand-mint" />
          <p className="text-sm leading-relaxed text-brand-snow/80">
            Responda com calma e com detalhes: quanto mais o agente souber da sua rotina e do que te
            atrapalha, mais realista fica o protocolo. Ele vale por {PROTOCOLO_DIAS} dias; perto do
            fim o RiccOS avisa para você atualizar.
          </p>
        </CardContent>
      </Card>

      <Section title="Corpo hoje" description="Use os números da sua balança de bioimpedância.">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Sexo">
            <Select
              value={r.dados.sexo}
              onValueChange={(v) => set("dados", { sexo: v as "masculino" | "feminino" })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="masculino">Masculino</SelectItem>
                <SelectItem value="feminino">Feminino</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <NumField
            label="Idade"
            suffix="anos"
            value={r.dados.idade}
            onChange={(v) => set("dados", { idade: v })}
          />
          <NumField
            label="Altura"
            suffix="cm"
            value={r.dados.altura_cm}
            onChange={(v) => set("dados", { altura_cm: v })}
          />
          <NumField
            label="Peso"
            suffix="kg"
            value={r.dados.peso_kg}
            onChange={(v) => set("dados", { peso_kg: v })}
          />
          <NumField
            label="Gordura (BF)"
            suffix="%"
            value={r.dados.bf_pct}
            onChange={(v) => set("dados", { bf_pct: v })}
          />
          <NumField
            label="Massa muscular"
            suffix="kg"
            value={r.dados.massa_muscular_kg}
            onChange={(v) => set("dados", { massa_muscular_kg: v })}
          />
          <NumField
            label="Cintura"
            suffix="cm"
            value={r.dados.cintura_cm}
            onChange={(v) => set("dados", { cintura_cm: v })}
          />
        </div>
      </Section>

      <Section title="Objetivo">
        <Field label="O que você quer alcançar?">
          <Textarea
            rows={3}
            value={r.objetivo.descricao}
            placeholder="Ex.: comer melhor, perder gordura e ganhar massa muscular sem dieta radical"
            onChange={(e) => set("objetivo", { descricao: e.target.value })}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3 sm:max-w-md">
          <NumField
            label="Peso desejado"
            suffix="kg"
            value={r.objetivo.peso_meta_kg}
            onChange={(v) => set("objetivo", { peso_meta_kg: v })}
            optional
          />
          <NumField
            label="BF desejado"
            suffix="%"
            value={r.objetivo.bf_meta_pct}
            onChange={(v) => set("objetivo", { bf_meta_pct: v })}
            optional
          />
        </div>
      </Section>

      <Section
        title="Rotina"
        description="O horário acordado define quando os lembretes podem chegar."
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Acordo às">
            <Input
              type="time"
              value={r.rotina.hora_acordar}
              onChange={(e) => set("rotina", { hora_acordar: e.target.value })}
            />
          </Field>
          <Field label="Durmo às">
            <Input
              type="time"
              value={r.rotina.hora_dormir}
              onChange={(e) => set("rotina", { hora_dormir: e.target.value })}
            />
          </Field>
          <Field label="Trabalho">
            <Select
              value={r.rotina.trabalho}
              onValueChange={(v) =>
                set("rotina", { trabalho: v as ProtocoloRespostas["rotina"]["trabalho"] })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="home_office">Home office</SelectItem>
                <SelectItem value="hibrido">Híbrido</SelectItem>
                <SelectItem value="presencial">Presencial</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Atividade física">
            <Select
              value={r.rotina.atividade}
              onValueChange={(v) =>
                set("rotina", { atividade: v as ProtocoloRespostas["rotina"]["atividade"] })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sedentario">Sedentário</SelectItem>
                <SelectItem value="leve">Leve (1–2x/sem)</SelectItem>
                <SelectItem value="moderado">Moderado (3–4x/sem)</SelectItem>
                <SelectItem value="intenso">Intenso (5x+/sem)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
        <Field label="Que atividades você faz hoje?" optional>
          <Textarea
            rows={2}
            placeholder="Ex.: musculação 3x por semana à noite, caminhada no fim de semana"
            value={r.rotina.atividade_descricao}
            onChange={(e) => set("rotina", { atividade_descricao: e.target.value })}
          />
        </Field>
      </Section>

      <Section title="Alimentação atual">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <NumField
            label="Refeições por dia hoje"
            value={r.alimentacao.refeicoes_hoje}
            onChange={(v) => set("alimentacao", { refeicoes_hoje: v })}
          />
          <NumField
            label="Água por dia"
            suffix="L"
            value={r.alimentacao.agua_litros}
            onChange={(v) => set("alimentacao", { agua_litros: v })}
          />
          <Field label="Você cozinha?">
            <Select
              value={r.alimentacao.cozinha}
              onValueChange={(v) =>
                set("alimentacao", { cozinha: v as ProtocoloRespostas["alimentacao"]["cozinha"] })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sim">Sim, sempre</SelectItem>
                <SelectItem value="as_vezes">Às vezes</SelectItem>
                <SelectItem value="nao">Quase nunca</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            label="Comidas que você gosta"
            value={r.alimentacao.preferencias}
            onChange={(v) => set("alimentacao", { preferencias: v })}
          />
          <TextField
            label="Comidas que não gosta"
            value={r.alimentacao.nao_gosta}
            onChange={(v) => set("alimentacao", { nao_gosta: v })}
            optional
          />
          <TextField
            label="Restrições, alergias ou intolerâncias"
            value={r.alimentacao.restricoes}
            onChange={(v) => set("alimentacao", { restricoes: v })}
            optional
          />
          <TextField
            label="Suplementos que usa"
            value={r.alimentacao.suplementos}
            onChange={(v) => set("alimentacao", { suplementos: v })}
            optional
          />
          <TextField
            label="Álcool (frequência)"
            value={r.alimentacao.alcool}
            onChange={(v) => set("alimentacao", { alcool: v })}
            optional
          />
        </div>
      </Section>

      <Section
        title="Hábitos e dificuldades"
        description="É aqui que o agente entende onde você costuma errar."
      >
        <TextField
          label="Como é um dia típico de alimentação hoje?"
          placeholder="Do café da manhã até a última coisa que come antes de dormir"
          value={r.habitos.dia_tipico}
          onChange={(v) => set("habitos", { dia_tipico: v })}
          rows={3}
        />
        <TextField
          label="Onde você sente que mais erra?"
          placeholder="Ex.: pulo o café, belisco à tarde, peço delivery à noite por preguiça"
          value={r.habitos.dificuldades}
          onChange={(v) => set("habitos", { dificuldades: v })}
          rows={3}
        />
        <TextField
          label="Mais alguma coisa?"
          value={r.habitos.observacoes}
          onChange={(v) => set("habitos", { observacoes: v })}
          optional
        />
      </Section>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
        {missing.length > 0 && (
          <p className="text-xs text-muted-foreground sm:mr-auto">
            Falta preencher: {missing.join(", ")}.
          </p>
        )}
        {onCancel && (
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button size="lg" onClick={submit} disabled={sending || missing.length > 0}>
          {sending ? <Loader2 className="animate-spin" /> : <Sparkles />}
          Gerar protocolo
        </Button>
      </div>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-3 pt-0">{children}</CardContent>
    </Card>
  );
}

function Field({
  label,
  optional,
  children,
}: {
  label: string;
  optional?: boolean | undefined;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">
        {label}
        {optional && <span className="ml-1 font-normal text-muted-foreground">(opcional)</span>}
      </Label>
      {children}
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
  suffix,
  optional,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  suffix?: string;
  optional?: boolean;
}) {
  const [text, setText] = useState(value == null ? "" : String(value).replace(".", ","));
  return (
    <Field label={label} optional={optional}>
      <div className="relative">
        <Input
          inputMode="decimal"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            const n = Number(e.target.value.replace(",", "."));
            onChange(e.target.value.trim() === "" || !Number.isFinite(n) ? null : n);
          }}
          className={cn("tabular-nums", suffix && "pr-11")}
        />
        {suffix && (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
    </Field>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  optional,
  rows = 2,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  optional?: boolean;
  rows?: number;
}) {
  return (
    <Field label={label} optional={optional}>
      <Textarea
        rows={rows}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}
