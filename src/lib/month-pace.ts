import { differenceInCalendarDays, format } from "date-fns";

import type { DbCategory, DbGoal, Transaction } from "./finance-data";

/* ============================================================
 * RiccOS · Ritmo do mês — projeção de gastos do período (puro)
 * ============================================================
 *
 * Divide as despesas do período em três partes:
 *  - realizado: data até hoje (já saiu);
 *  - agendado: data futura dentro do período (fixos, parcelas e contas já lançadas);
 *  - projeção variável: gastos pontuais até hoje extrapolados para os dias restantes.
 * Projeção = realizado + agendado + projeção variável.
 *
 * O nó "Calcular Alertas" do workflow n8n "Alertas de Metas" replica esta regra — mudar nos dois lugares.
 */

/** Dias mínimos de período decorridos antes de extrapolar os gastos variáveis. */
export const MIN_DAYS_TO_PROJECT = 5;

export type PacePhase = "futuro" | "andamento" | "fechado";
export type PaceCategoryStatus = "estourou" | "risco" | "ok";

export interface PaceCategory {
  categoryId: string;
  name: string;
  limit: number;
  /** Tudo o que está lançado no período (realizado + agendado). */
  spent: number;
  projected: number;
  status: PaceCategoryStatus;
  /** Quanto ainda cabe por dia até o fim do período (só com o período em andamento). */
  dailyAllowance: number | null;
}

export interface MonthPace {
  phase: PacePhase;
  start: Date;
  end: Date;
  totalDays: number;
  elapsedDays: number;
  /** false quando ainda é cedo para extrapolar (projeção = só o que está lançado). */
  projectionReliable: boolean;
  income: number;
  realized: number;
  scheduled: number;
  projected: number;
  projectedBalance: number;
  categories: PaceCategory[];
}

/**
 * Datas (inclusivas) de um período considerando o dia de corte — espelho de
 * `getTransactionPeriod`: com corte 3, o período de outubro vai de 04/09 a 03/10.
 */
export function periodBounds(month1: number, year: number, cutoffDay: number) {
  if (cutoffDay <= 1) {
    return { start: new Date(year, month1 - 1, 1), end: new Date(year, month1, 0) };
  }
  return {
    start: new Date(year, month1 - 2, cutoffDay + 1),
    end: new Date(year, month1 - 1, cutoffDay),
  };
}

function normalize(s?: string | null) {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function sum(txs: Transaction[]) {
  return txs.reduce((acc, t) => acc + t.amount, 0);
}

export interface MonthPaceInput {
  month1: number;
  year: number;
  cutoffDay: number;
  monthTransactions: Transaction[];
  categories: DbCategory[];
  goals: DbGoal[];
  today?: Date;
}

export function computeMonthPace(input: MonthPaceInput): MonthPace {
  const { month1, year, cutoffDay, monthTransactions, categories, goals } = input;
  const today = input.today ?? new Date();
  // Data local (não UTC): à noite no Brasil o toISOString já estaria no dia seguinte.
  const todayIso = format(today, "yyyy-MM-dd");

  const { start, end } = periodBounds(month1, year, cutoffDay);
  const totalDays = differenceInCalendarDays(end, start) + 1;
  const phase: PacePhase =
    todayIso < format(start, "yyyy-MM-dd")
      ? "futuro"
      : todayIso > format(end, "yyyy-MM-dd")
        ? "fechado"
        : "andamento";
  const elapsedDays =
    phase === "futuro"
      ? 0
      : phase === "fechado"
        ? totalDays
        : differenceInCalendarDays(today, start) + 1;
  const remainingDays = totalDays - elapsedDays;
  const projectionReliable = phase === "andamento" && elapsedDays >= MIN_DAYS_TO_PROJECT;
  // Multiplicador que leva o variável de "até hoje" para "período inteiro".
  const variableFactor = projectionReliable ? totalDays / elapsedDays - 1 : 0;

  const project = (txs: Transaction[]) => {
    const realizedTxs = txs.filter((t) => t.date <= todayIso);
    const realized = sum(realizedTxs);
    const scheduled = sum(txs) - realized;
    const variable = sum(realizedTxs.filter((t) => t.frequency.kind === "pontual"));
    return { realized, scheduled, projected: realized + scheduled + variable * variableFactor };
  };

  const despesas = monthTransactions.filter((t) => t.type === "despesa");
  const income = sum(monthTransactions.filter((t) => t.type === "receita"));
  const total = project(despesas);

  const paceCategories: PaceCategory[] = goals
    .filter((g) => g.meta_mes === month1 && g.meta_ano === year && Number(g.meta_valor) > 0)
    .map((g) => {
      const name =
        categories.find((c) => c.categoria_id === g.categoria_id)?.categoria_nome ?? "Categoria";
      const limit = Number(g.meta_valor) || 0;
      // Pelo id quando o lançamento tem categoria; pelo nome só como fallback.
      const catTxs = despesas.filter((t) =>
        t.categoryId
          ? t.categoryId === g.categoria_id
          : normalize(t.category) === normalize(name),
      );
      const { realized, scheduled, projected } = project(catTxs);
      const spent = realized + scheduled;
      const status: PaceCategoryStatus =
        spent > limit ? "estourou" : projected > limit ? "risco" : "ok";
      return {
        categoryId: g.categoria_id,
        name,
        limit,
        spent,
        projected,
        status,
        dailyAllowance:
          phase === "andamento" && remainingDays > 0
            ? Math.max(0, limit - spent) / remainingDays
            : null,
      };
    })
    .sort((a, b) => b.projected / b.limit - a.projected / a.limit);

  return {
    phase,
    start,
    end,
    totalDays,
    elapsedDays,
    projectionReliable,
    income,
    realized: total.realized,
    scheduled: total.scheduled,
    projected: total.projected,
    projectedBalance: income - total.projected,
    categories: paceCategories,
  };
}

/** Último dia do período em formato curto (ex.: "03/10"), para textos da UI. */
export function formatPeriodDay(d: Date) {
  return format(d, "dd/MM");
}
