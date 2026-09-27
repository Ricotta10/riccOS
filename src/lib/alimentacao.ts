/* ============================================================
 * RiccOS · Alimentação — tipos e cálculos (puros)
 *
 * A análise semanal (`computeDailyStats` / `summarizeDays`) é espelhada no nó
 * `Calcular Semana` do workflow n8n "Alimentação - Relatório Semanal":
 * mudar nos dois lugares.
 * ============================================================ */

export const REFEICAO_WEBHOOK_URL =
  "https://n8n.omniautomacoes.com.br/webhook/riccos-alimentacao-refeicao";
export const PROTOCOLO_WEBHOOK_URL =
  "https://n8n.omniautomacoes.com.br/webhook/riccos-alimentacao-protocolo";

/** Registros com menos que isso de intervalo contam como a mesma refeição. */
export const MEAL_GAP_MINUTES = 90;
/** Proteína "batida" = pelo menos 90% da meta do dia. */
export const PROTEIN_HIT_RATIO = 0.9;
/** Calorias "na faixa" = até 10% acima ou abaixo da meta. */
export const KCAL_TOLERANCE = 0.1;
/** Validade de um protocolo, em dias. */
export const PROTOCOLO_DIAS = 60;

export type Qualidade = "boa" | "ok" | "ruim";
export type RefeicaoOrigem = "texto" | "voz" | "checkin";
export type RefeicaoStatus = "processando" | "ok" | "erro";
export type MotivoErro =
  "fome" | "ansiedade" | "falta_tempo" | "social" | "sem_opcao" | "vontade" | "outro";
export type ProtocoloStatus = "gerando" | "ativo" | "erro" | "substituido";

export const QUALIDADE_LABEL: Record<Qualidade, string> = {
  boa: "Saudável",
  ok: "Ok",
  ruim: "Fora do plano",
};

export const QUALIDADE_VARIANT: Record<Qualidade, "success" | "warning" | "destructive"> = {
  boa: "success",
  ok: "warning",
  ruim: "destructive",
};

export const MOTIVO_LABEL: Record<MotivoErro, string> = {
  fome: "Fome",
  ansiedade: "Ansiedade",
  falta_tempo: "Falta de tempo",
  social: "Social",
  sem_opcao: "Sem opção em casa",
  vontade: "Vontade",
  outro: "Outro",
};

export const MOTIVOS = Object.keys(MOTIVO_LABEL) as MotivoErro[];

export const WEEKDAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/* ---------- Linhas do Supabase ---------- */

export interface DbRefeicaoItem {
  item_id: string;
  refeicao_id: string;
  user_id?: string;
  item_nome: string;
  item_quantidade: number;
  item_unidade: string;
  item_gramas: number | null;
  item_kcal: number;
  item_proteina_g: number;
  item_carbo_g: number;
  item_gordura_g: number;
  item_ordem: number;
}

export interface DbRefeicao {
  refeicao_id: string;
  user_id?: string;
  protocolo_id: string | null;
  refeicao_em: string;
  refeicao_texto: string | null;
  refeicao_descricao: string | null;
  refeicao_origem: RefeicaoOrigem;
  refeicao_status: RefeicaoStatus;
  refeicao_hora_definida: boolean;
  refeicao_qualidade: Qualidade | null;
  refeicao_qualidade_motivo: string | null;
  refeicao_motivo_erro: MotivoErro | null;
  refeicao_kcal: number;
  refeicao_proteina_g: number;
  refeicao_carbo_g: number;
  refeicao_gordura_g: number;
  refeicao_erro: string | null;
  criado_em: string;
  refeicao_itens?: DbRefeicaoItem[];
}

export interface PlanoItem {
  nome: string;
  quantidade: number;
  unidade: string;
  gramas?: number | null;
  kcal: number;
  proteina_g: number;
  carbo_g: number;
  gordura_g: number;
}

export interface PlanoOpcao {
  nome: string;
  itens: PlanoItem[];
  kcal: number;
  proteina_g: number;
  carbo_g: number;
  gordura_g: number;
}

export interface Plano {
  resumo?: string;
  calculos?: { tmb?: number; get?: number; estrategia?: string; explicacao?: string };
  metas: {
    kcal: number;
    proteina_g: number;
    carbo_g: number;
    gordura_g: number;
    agua_ml?: number;
    fibras_g?: number;
  };
  rotina?: {
    refeicoes_min?: number;
    intervalo_max_h?: number;
    janelas?: { nome: string; horario: string; foco?: string }[];
  };
  cardapio?: { refeicao: string; opcoes: PlanoOpcao[] }[];
  criterios?: Partial<Record<Qualidade, string>>;
  orientacoes?: string[];
  evitar?: string[];
  home_office?: string[];
}

/** Respostas do formulário do protocolo (gravadas em `protocolo_respostas`). */
export interface ProtocoloRespostas {
  dados: {
    sexo: "masculino" | "feminino";
    idade: number | null;
    altura_cm: number | null;
    peso_kg: number | null;
    bf_pct: number | null;
    massa_muscular_kg: number | null;
    cintura_cm: number | null;
  };
  objetivo: {
    descricao: string;
    peso_meta_kg: number | null;
    bf_meta_pct: number | null;
  };
  rotina: {
    hora_acordar: string;
    hora_dormir: string;
    trabalho: "home_office" | "hibrido" | "presencial";
    atividade: "sedentario" | "leve" | "moderado" | "intenso";
    atividade_descricao: string;
  };
  alimentacao: {
    refeicoes_hoje: number | null;
    cozinha: "sim" | "as_vezes" | "nao";
    agua_litros: number | null;
    preferencias: string;
    nao_gosta: string;
    restricoes: string;
    suplementos: string;
    alcool: string;
  };
  habitos: {
    dia_tipico: string;
    dificuldades: string;
    observacoes: string;
  };
}

export interface DbProtocolo {
  protocolo_id: string;
  user_id?: string;
  protocolo_status: ProtocoloStatus;
  protocolo_respostas: ProtocoloRespostas;
  protocolo_plano: Plano | null;
  protocolo_kcal: number | null;
  protocolo_proteina_g: number | null;
  protocolo_carbo_g: number | null;
  protocolo_gordura_g: number | null;
  protocolo_agua_ml: number | null;
  protocolo_refeicoes_min: number | null;
  protocolo_intervalo_max_h: number | null;
  protocolo_hora_acordar: string | null;
  protocolo_hora_dormir: string | null;
  protocolo_inicio: string | null;
  protocolo_fim: string | null;
  protocolo_erro: string | null;
  criado_em: string;
}

export interface DbMedida {
  medida_id: string;
  user_id?: string;
  medida_data: string;
  medida_peso_kg: number | null;
  medida_bf_pct: number | null;
  medida_massa_muscular_kg: number | null;
  medida_cintura_cm: number | null;
  medida_abdomen_cm: number | null;
  medida_quadril_cm: number | null;
  medida_peito_cm: number | null;
  medida_braco_cm: number | null;
  medida_coxa_cm: number | null;
  medida_observacao: string | null;
  criado_em?: string;
}

export interface RelatorioAnalise {
  resumo?: string;
  acertos?: string[];
  erros?: string[];
  ajustes?: string[];
}

export interface DbRelatorio {
  relatorio_id: string;
  relatorio_semana_inicio: string;
  relatorio_semana_fim: string;
  relatorio_metricas: PeriodSummary & { anterior?: PeriodSummary | null };
  relatorio_analise: RelatorioAnalise;
  criado_em: string;
}

export interface Metas {
  kcal: number;
  proteina_g: number;
  carbo_g: number;
  gordura_g: number;
}

/* ---------- Helpers numéricos / datas ---------- */

export const num = (v: unknown) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const round1 = (v: number) => Math.round(v * 10) / 10;

const pad = (n: number) => String(n).padStart(2, "0");

/** Data local (YYYY-MM-DD) de um instante. */
export function localDateKey(d: Date | string) {
  const date = typeof d === "string" ? new Date(d) : d;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseDateKey(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export function addDaysKey(key: string, n: number) {
  const d = parseDateKey(key);
  d.setDate(d.getDate() + n);
  return localDateKey(d);
}

/** Lista de datas (YYYY-MM-DD) de `start` até `end`, inclusive. */
export function dateRange(start: string, end: string) {
  const out: string[] = [];
  for (let k = start; k <= end; k = addDaysKey(k, 1)) out.push(k);
  return out;
}

/** Segunda-feira (YYYY-MM-DD) da semana que contém `key`. */
export function weekStart(key: string) {
  const d = parseDateKey(key);
  const dow = (d.getDay() + 6) % 7; // 0 = segunda
  d.setDate(d.getDate() - dow);
  return localDateKey(d);
}

export function formatHour(iso: string) {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatDayLabel(key: string, today = localDateKey(new Date())) {
  if (key === today) return "Hoje";
  if (key === addDaysKey(today, -1)) return "Ontem";
  const d = parseDateKey(key);
  return `${WEEKDAY_SHORT[d.getDay()]}, ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
}

/** Valor para `<input type="datetime-local">` a partir de um instante. */
export function toDateTimeLocal(d: Date | string) {
  const date = typeof d === "string" ? new Date(d) : d;
  return `${localDateKey(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatKcal(v: number) {
  return `${Math.round(v).toLocaleString("pt-BR")} kcal`;
}

export function formatG(v: number) {
  return `${Math.round(v)} g`;
}

/* ---------- Protocolo ---------- */

export function metasDoProtocolo(p: DbProtocolo | null | undefined): Metas | null {
  if (!p || !p.protocolo_kcal) return null;
  return {
    kcal: num(p.protocolo_kcal),
    proteina_g: num(p.protocolo_proteina_g),
    carbo_g: num(p.protocolo_carbo_g),
    gordura_g: num(p.protocolo_gordura_g),
  };
}

/** Dias até o fim do protocolo (negativo = vencido). */
export function diasRestantes(p: DbProtocolo | null | undefined, today = localDateKey(new Date())) {
  if (!p?.protocolo_fim) return null;
  const diff = parseDateKey(p.protocolo_fim).getTime() - parseDateKey(today).getTime();
  return Math.round(diff / 86400000);
}

/* ---------- Itens ---------- */

/** Recalcula um item proporcionalmente à nova quantidade. */
export function scaleItem<
  T extends Pick<
    DbRefeicaoItem,
    | "item_quantidade"
    | "item_gramas"
    | "item_kcal"
    | "item_proteina_g"
    | "item_carbo_g"
    | "item_gordura_g"
  >,
>(item: T, quantidade: number): T {
  const old = num(item.item_quantidade);
  if (old <= 0 || quantidade <= 0) return { ...item, item_quantidade: quantidade };
  const r = quantidade / old;
  return {
    ...item,
    item_quantidade: quantidade,
    item_gramas: item.item_gramas == null ? null : round1(num(item.item_gramas) * r),
    item_kcal: round1(num(item.item_kcal) * r),
    item_proteina_g: round1(num(item.item_proteina_g) * r),
    item_carbo_g: round1(num(item.item_carbo_g) * r),
    item_gordura_g: round1(num(item.item_gordura_g) * r),
  };
}

/* ---------- Análise por dia ---------- */

export interface DayTotals {
  kcal: number;
  proteina_g: number;
  carbo_g: number;
  gordura_g: number;
}

export function sumMeals(
  meals: Pick<
    DbRefeicao,
    "refeicao_kcal" | "refeicao_proteina_g" | "refeicao_carbo_g" | "refeicao_gordura_g"
  >[],
): DayTotals {
  return meals.reduce(
    (a, m) => ({
      kcal: a.kcal + num(m.refeicao_kcal),
      proteina_g: a.proteina_g + num(m.refeicao_proteina_g),
      carbo_g: a.carbo_g + num(m.refeicao_carbo_g),
      gordura_g: a.gordura_g + num(m.refeicao_gordura_g),
    }),
    { kcal: 0, proteina_g: 0, carbo_g: 0, gordura_g: 0 },
  );
}

/** Quantas refeições distintas há numa lista de horários (registros próximos se juntam). */
export function countMeals(isoTimes: string[], gapMinutes = MEAL_GAP_MINUTES) {
  const times = isoTimes.map((t) => new Date(t).getTime()).sort((a, b) => a - b);
  let count = 0;
  let last = -Infinity;
  for (const t of times) {
    if (t - last > gapMinutes * 60000) count += 1;
    last = t;
  }
  return count;
}

export interface DayStat extends DayTotals {
  date: string;
  registros: number;
  refeicoes: number;
  /** Refeições abaixo do mínimo do protocolo (só em dias com registro e já encerrados). */
  puladas: number;
  semRegistro: boolean;
  completo: boolean;
  bateuProteina: boolean;
  kcalNaFaixa: boolean;
}

export function computeDailyStats(
  meals: DbRefeicao[],
  days: string[],
  metas: Metas | null,
  refeicoesMin: number,
  today = localDateKey(new Date()),
): DayStat[] {
  const byDay = new Map<string, DbRefeicao[]>();
  for (const m of meals) {
    if (m.refeicao_status !== "ok") continue;
    const k = localDateKey(m.refeicao_em);
    const list = byDay.get(k);
    if (list) list.push(m);
    else byDay.set(k, [m]);
  }
  return days.map((date) => {
    const list = byDay.get(date) ?? [];
    const totals = sumMeals(list);
    const refeicoes = countMeals(list.map((m) => m.refeicao_em));
    const completo = date < today;
    return {
      date,
      ...totals,
      registros: list.length,
      refeicoes,
      puladas: completo && list.length > 0 ? Math.max(0, refeicoesMin - refeicoes) : 0,
      semRegistro: list.length === 0,
      completo,
      bateuProteina:
        !!metas &&
        metas.proteina_g > 0 &&
        totals.proteina_g >= metas.proteina_g * PROTEIN_HIT_RATIO,
      kcalNaFaixa:
        !!metas &&
        metas.kcal > 0 &&
        list.length > 0 &&
        Math.abs(totals.kcal - metas.kcal) <= metas.kcal * KCAL_TOLERANCE,
    };
  });
}

export type Periodo = "manha" | "tarde" | "noite" | "madrugada";

export const PERIODO_LABEL: Record<Periodo, string> = {
  manha: "Manhã",
  tarde: "Tarde",
  noite: "Noite",
  madrugada: "Madrugada",
};

export function periodoDoDia(iso: string): Periodo {
  const h = new Date(iso).getHours();
  if (h >= 5 && h < 11) return "manha";
  if (h >= 11 && h < 17) return "tarde";
  if (h >= 17 && h < 22) return "noite";
  return "madrugada";
}

export interface PeriodSummary {
  dias: number;
  diasCompletos: number;
  diasComRegistro: number;
  diasSemRegistro: number;
  refeicoesPuladas: number;
  mediaKcal: number;
  mediaProteina: number;
  mediaCarbo: number;
  mediaGordura: number;
  diasProteina: number;
  diasKcalFaixa: number;
  qualidade: Record<Qualidade, number>;
  motivos: Partial<Record<MotivoErro, number>>;
  ruinsSemMotivo: number;
  ruinsPorDiaSemana: number[];
  ruinsPorPeriodo: Record<Periodo, number>;
}

/** Consolida um período (dias + refeições). As médias usam só os dias com registro. */
export function summarizeDays(stats: DayStat[], meals: DbRefeicao[]): PeriodSummary {
  const comRegistro = stats.filter((d) => d.registros > 0);
  const n = comRegistro.length || 1;
  const daySet = new Set(stats.map((d) => d.date));
  const inRange = meals.filter(
    (m) => m.refeicao_status === "ok" && daySet.has(localDateKey(m.refeicao_em)),
  );

  const qualidade: Record<Qualidade, number> = { boa: 0, ok: 0, ruim: 0 };
  const motivos: Partial<Record<MotivoErro, number>> = {};
  const ruinsPorDiaSemana = [0, 0, 0, 0, 0, 0, 0];
  const ruinsPorPeriodo: Record<Periodo, number> = { manha: 0, tarde: 0, noite: 0, madrugada: 0 };
  let ruinsSemMotivo = 0;

  for (const m of inRange) {
    if (!m.refeicao_qualidade) continue;
    qualidade[m.refeicao_qualidade] += 1;
    if (m.refeicao_qualidade !== "ruim") continue;
    ruinsPorDiaSemana[new Date(m.refeicao_em).getDay()]! += 1;
    ruinsPorPeriodo[periodoDoDia(m.refeicao_em)] += 1;
    if (m.refeicao_motivo_erro) {
      motivos[m.refeicao_motivo_erro] = (motivos[m.refeicao_motivo_erro] ?? 0) + 1;
    } else {
      ruinsSemMotivo += 1;
    }
  }

  const sum = (f: (d: DayStat) => number) => comRegistro.reduce((a, d) => a + f(d), 0);
  const completos = stats.filter((d) => d.completo);

  return {
    dias: stats.length,
    diasCompletos: completos.length,
    diasComRegistro: comRegistro.length,
    diasSemRegistro: completos.filter((d) => d.semRegistro).length,
    refeicoesPuladas: stats.reduce((a, d) => a + d.puladas, 0),
    mediaKcal: Math.round(sum((d) => d.kcal) / n),
    mediaProteina: Math.round(sum((d) => d.proteina_g) / n),
    mediaCarbo: Math.round(sum((d) => d.carbo_g) / n),
    mediaGordura: Math.round(sum((d) => d.gordura_g) / n),
    diasProteina: stats.filter((d) => d.bateuProteina).length,
    diasKcalFaixa: stats.filter((d) => d.kcalNaFaixa).length,
    qualidade,
    motivos,
    ruinsSemMotivo,
    ruinsPorDiaSemana,
    ruinsPorPeriodo,
  };
}

/** % de refeições classificadas como saudáveis. */
export function pctBoas(q: Record<Qualidade, number>) {
  const total = q.boa + q.ok + q.ruim;
  return total > 0 ? Math.round((q.boa / total) * 100) : 0;
}
