import {
  getTransactionPeriod,
  type DbCategory,
  type DbGoal,
  type Transaction,
} from "./finance-data";

/* ============================================================
 * RiccOS · Minigame financeiro — regras e cálculos (puros)
 * ============================================================ */

export type Faixa = "nenhuma" | "bronze" | "prata" | "ouro";
export type MissionStatus = "concluida" | "em_andamento" | "falhou";

/** Linhas do Supabase */
export interface DbMissao {
  missao_id: string;
  user_id?: string;
  missao_titulo: string;
  missao_descricao?: string | null;
  missao_pontos: number;
  missao_mes: number;
  missao_ano: number;
  missao_concluida: boolean;
  missao_concluida_em?: string | null;
  criado_em?: string;
}

export interface DbTemporada {
  temporada_id: string;
  user_id?: string;
  temporada_mes: number;
  temporada_ano: number;
  temporada_pontos: number;
  temporada_pontos_max: number;
  temporada_faixa: Faixa;
  temporada_detalhes: MissionSnapshot[];
  temporada_fechada_em?: string;
}

export interface MissionSnapshot {
  id: string;
  titulo: string;
  pontos: number;
  concluida: boolean;
  detalhe?: string | undefined;
}

/** Missão avaliada (automática ou manual) pronta para exibição */
export interface Mission {
  id: string;
  kind: "auto" | "manual";
  titulo: string;
  descricao: string;
  pontos: number;
  status: MissionStatus;
  /** 0–100, quando faz sentido mostrar barra */
  progresso?: number | undefined;
  /** Texto curto com o dado que justifica o status */
  detalhe?: string | undefined;
  /** Somente manuais */
  dbId?: string | undefined;
}

/* ---------- Constantes de balanceamento ---------- */

export const FAIXA_THRESHOLDS: Record<Exclude<Faixa, "nenhuma">, number> = {
  bronze: 0.45,
  prata: 0.65,
  ouro: 0.85,
};

export const FAIXA_LABEL: Record<Faixa, string> = {
  nenhuma: "Sem faixa",
  bronze: "Bronze",
  prata: "Prata",
  ouro: "Ouro",
};

export const FAIXA_ORDER: Faixa[] = ["nenhuma", "bronze", "prata", "ouro"];

/** XP acumulado necessário para cada nível (índice = nível - 1). */
export const LEVELS = [
  { name: "Iniciante", xp: 0 },
  { name: "Operador", xp: 400 },
  { name: "Analista", xp: 1000 },
  { name: "Estrategista", xp: 1800 },
  { name: "Arquiteto", xp: 2800 },
  { name: "Mestre", xp: 4000 },
  { name: "Lenda", xp: 5500 },
];

export const AUTO_POINTS = {
  saldoPositivo: 100,
  contasEmDia: 100,
  gastarMenos: 80,
  comprometimento: 60,
  registro: 30,
  metaCategoria: 40,
} as const;

/* ---------- Helpers ---------- */

export function faixaFor(points: number, max: number): Faixa {
  if (max <= 0) return "nenhuma";
  const pct = points / max;
  if (pct >= FAIXA_THRESHOLDS.ouro) return "ouro";
  if (pct >= FAIXA_THRESHOLDS.prata) return "prata";
  if (pct >= FAIXA_THRESHOLDS.bronze) return "bronze";
  return "nenhuma";
}

export function levelFor(totalXp: number) {
  let idx = 0;
  LEVELS.forEach((lvl, i) => {
    if (totalXp >= lvl.xp) idx = i;
  });
  const current = LEVELS[idx] ?? LEVELS[0]!;
  const next: (typeof LEVELS)[number] | undefined = LEVELS[idx + 1];
  const progress = next
    ? Math.min(100, Math.round(((totalXp - current.xp) / (next.xp - current.xp)) * 100))
    : 100;
  return { level: idx + 1, name: current.name, xp: totalXp, next, progress };
}

/** Streak: temporadas consecutivas (mais recentes) com faixa >= bronze. */
export function streakFor(temporadas: DbTemporada[]) {
  const sorted = [...temporadas].sort((a, b) =>
    b.temporada_ano !== a.temporada_ano
      ? b.temporada_ano - a.temporada_ano
      : b.temporada_mes - a.temporada_mes,
  );
  let streak = 0;
  for (const t of sorted) {
    if (t.temporada_faixa === "nenhuma") break;
    streak += 1;
  }
  return streak;
}

function normalize(s?: string | null) {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function pct(part: number, total: number) {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((part / total) * 100)));
}

/** Se o período (mês/ano) já terminou em relação a hoje, considerando o dia de corte. */
export function isPeriodOver(month1: number, year: number, cutoffDay: number, today = new Date()) {
  const todayIso = today.toISOString().slice(0, 10);
  const { year: cy, month: cm } = getTransactionPeriod(todayIso, cutoffDay);
  return year < cy || (year === cy && month1 < cm);
}

export function isPeriodCurrent(
  month1: number,
  year: number,
  cutoffDay: number,
  today = new Date(),
) {
  const todayIso = today.toISOString().slice(0, 10);
  const { year: cy, month: cm } = getTransactionPeriod(todayIso, cutoffDay);
  return year === cy && month1 === cm;
}

/* ---------- Missões automáticas ---------- */

export interface AutoMissionInput {
  month1: number;
  year: number;
  cutoffDay: number;
  monthTransactions: Transaction[];
  previousMonthTransactions: Transaction[];
  categories: DbCategory[];
  goals: DbGoal[];
  today?: Date;
}

export function computeAutoMissions(input: AutoMissionInput): Mission[] {
  const {
    month1,
    year,
    cutoffDay,
    monthTransactions,
    previousMonthTransactions,
    categories,
    goals,
    today = new Date(),
  } = input;

  const over = isPeriodOver(month1, year, cutoffDay, today);
  const todayIso = today.toISOString().slice(0, 10);

  const receitas = monthTransactions.filter((t) => t.type === "receita");
  const despesas = monthTransactions.filter((t) => t.type === "despesa");
  const entradas = receitas.reduce((a, t) => a + t.amount, 0);
  const saidas = despesas.reduce((a, t) => a + t.amount, 0);
  const saidasAnterior = previousMonthTransactions
    .filter((t) => t.type === "despesa")
    .reduce((a, t) => a + t.amount, 0);

  const missions: Mission[] = [];

  // 1) Saldo positivo
  {
    const ok = entradas > 0 && entradas >= saidas;
    missions.push({
      id: "auto-saldo",
      kind: "auto",
      titulo: "Fechar o mês no azul",
      descricao: "Receitas maiores ou iguais às despesas do período.",
      pontos: AUTO_POINTS.saldoPositivo,
      status: ok ? "concluida" : over ? "falhou" : "em_andamento",
      progresso: entradas > 0 ? pct(Math.min(saidas, entradas), entradas) : 0,
      detalhe:
        entradas > 0
          ? `Saldo ${(entradas - saidas).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`
          : "Sem receitas lançadas",
    });
  }

  // 2) Contas em dia: nenhuma despesa vencida sem pagamento
  {
    const total = despesas.length;
    const pagas = despesas.filter((t) => t.status === "pago").length;
    const atrasadas = despesas.filter((t) => t.status !== "pago" && t.date <= todayIso).length;
    let status: MissionStatus;
    if (total === 0) status = "em_andamento";
    else if (over) status = pagas === total ? "concluida" : "falhou";
    else if (atrasadas > 0) status = "falhou";
    else status = pagas === total ? "concluida" : "em_andamento";
    missions.push({
      id: "auto-contas",
      kind: "auto",
      titulo: "Contas em dia",
      descricao: "Nenhuma despesa vencida sem pagamento durante o mês.",
      pontos: AUTO_POINTS.contasEmDia,
      status,
      progresso: pct(pagas, total),
      detalhe:
        total === 0
          ? "Sem despesas no mês"
          : atrasadas > 0
            ? `${atrasadas} em atraso · ${pagas}/${total} pagas`
            : `${pagas}/${total} pagas`,
    });
  }

  // 3) Gastar menos que o mês anterior
  {
    const hasPrev = saidasAnterior > 0;
    const ok = hasPrev && saidas < saidasAnterior;
    const diff = hasPrev ? ((saidas - saidasAnterior) / saidasAnterior) * 100 : 0;
    missions.push({
      id: "auto-menos",
      kind: "auto",
      titulo: "Gastar menos que o mês anterior",
      descricao: "Total de despesas abaixo do total do período anterior.",
      pontos: AUTO_POINTS.gastarMenos,
      status: !hasPrev ? "em_andamento" : ok ? "concluida" : "falhou",
      progresso: hasPrev ? pct(saidas, saidasAnterior) : 0,
      detalhe: hasPrev
        ? `${diff >= 0 ? "+" : ""}${diff.toFixed(0)}% vs. anterior`
        : "Sem base de comparação",
    });
  }

  // 4) Comprometimento da renda <= 70%
  {
    const ratio = entradas > 0 ? saidas / entradas : null;
    const ok = ratio !== null && ratio <= 0.7;
    missions.push({
      id: "auto-comprometimento",
      kind: "auto",
      titulo: "Renda comprometida até 70%",
      descricao: "Despesas do mês representam no máximo 70% das receitas.",
      pontos: AUTO_POINTS.comprometimento,
      status: ratio === null ? "em_andamento" : ok ? "concluida" : "falhou",
      progresso: ratio === null ? 0 : pct(ratio * 100, 70),
      detalhe:
        ratio === null ? "Sem receitas lançadas" : `${Math.round(ratio * 100)}% comprometido`,
    });
  }

  // 5) Disciplina de registro: >= 10 lançamentos
  {
    const n = monthTransactions.length;
    const target = 10;
    missions.push({
      id: "auto-registro",
      kind: "auto",
      titulo: "Disciplina de registro",
      descricao: `Registrar pelo menos ${target} lançamentos no mês.`,
      pontos: AUTO_POINTS.registro,
      status: n >= target ? "concluida" : over ? "falhou" : "em_andamento",
      progresso: pct(n, target),
      detalhe: `${n}/${target} lançamentos`,
    });
  }

  // 6) Uma missão por meta de categoria definida no mês
  const monthGoals = goals.filter(
    (g) => g.meta_mes === month1 && g.meta_ano === year && Number(g.meta_valor) > 0,
  );
  for (const g of monthGoals) {
    const cat = categories.find((c) => c.categoria_id === g.categoria_id);
    const catName = cat?.categoria_nome ?? "Categoria";
    const limit = Number(g.meta_valor) || 0;
    const spent = despesas
      .filter((t) => {
        if (t.categoryId && t.categoryId === g.categoria_id) return true;
        return normalize(t.category) === normalize(catName);
      })
      .reduce((a, t) => a + t.amount, 0);
    const within = spent <= limit;
    missions.push({
      id: `auto-meta-${g.categoria_id}`,
      kind: "auto",
      titulo: `Respeitar a meta de ${catName}`,
      descricao: `Manter os gastos de ${catName} dentro do teto definido.`,
      pontos: AUTO_POINTS.metaCategoria,
      status: within ? "concluida" : "falhou",
      progresso: pct(spent, limit),
      detalhe: `${spent.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} de ${limit.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`,
    });
  }

  return missions;
}

/* ---------- Missões manuais ---------- */

export function mapManualMissions(rows: DbMissao[], month1: number, year: number): Mission[] {
  return rows
    .filter((r) => r.missao_mes === month1 && r.missao_ano === year)
    .sort((a, b) => (a.criado_em ?? "").localeCompare(b.criado_em ?? ""))
    .map((r) => ({
      id: `manual-${r.missao_id}`,
      dbId: r.missao_id,
      kind: "manual" as const,
      titulo: r.missao_titulo,
      descricao: r.missao_descricao ?? "",
      pontos: r.missao_pontos,
      status: r.missao_concluida ? ("concluida" as const) : ("em_andamento" as const),
    }));
}

/* ---------- Temporada ---------- */

export interface SeasonSummary {
  points: number;
  maxPoints: number;
  pct: number;
  faixa: Faixa;
  /** pontos que faltam para a próxima faixa (0 se ouro) */
  toNext: number;
  nextFaixa: Faixa | null;
  concluidas: number;
  total: number;
}

export function summarizeSeason(missions: Mission[]): SeasonSummary {
  const maxPoints = missions.reduce((a, m) => a + m.pontos, 0);
  const points = missions.filter((m) => m.status === "concluida").reduce((a, m) => a + m.pontos, 0);
  const faixa = faixaFor(points, maxPoints);
  const idx = FAIXA_ORDER.indexOf(faixa);
  const nextFaixa: Faixa | null = FAIXA_ORDER[idx + 1] ?? null;
  const toNext =
    nextFaixa && nextFaixa !== "nenhuma"
      ? Math.max(0, Math.ceil(FAIXA_THRESHOLDS[nextFaixa] * maxPoints) - points)
      : 0;
  return {
    points,
    maxPoints,
    pct: maxPoints > 0 ? Math.round((points / maxPoints) * 100) : 0,
    faixa,
    toNext,
    nextFaixa,
    concluidas: missions.filter((m) => m.status === "concluida").length,
    total: missions.length,
  };
}

export function snapshotMissions(missions: Mission[]): MissionSnapshot[] {
  return missions.map((m) => ({
    id: m.id,
    titulo: m.titulo,
    pontos: m.pontos,
    concluida: m.status === "concluida",
    detalhe: m.detalhe,
  }));
}
