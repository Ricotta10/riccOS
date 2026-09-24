import { getTransactionPeriod, type Transaction } from "./finance-data";
import { computeMonthPace } from "./month-pace";

/* ============================================================
 * RiccOS · Projeção futura realista (puro)
 * ============================================================
 *
 * Os meses futuros só têm lançados os fixos e as parcelas; os gastos variáveis
 * (compras pontuais) ainda não existem. Para não mostrar meses artificialmente baratos:
 *  - período atual: mesma projeção do card "Ritmo do mês";
 *  - períodos seguintes: tudo o que já está lançado + mediana dos variáveis dos últimos
 *    períodos fechados que tiveram receita (período sem receita = mês incompleto, ex.: o
 *    primeiro mês de uso do app). Mediana, e não média, para um mês atípico (ex.: o de renda
 *    extra) não puxar a projeção inteira.
 */

/** Quantos períodos fechados entram na mediana dos variáveis. */
export const VARIABLE_BASE_PERIODS = 3;

export interface ProjectionRow {
  key: string; // "YYYY-MM"
  year: number;
  month1: number;
  isCurrent: boolean;
  /** Tudo o que já está lançado no período (fixos, parcelas, contas agendadas). */
  committed: number;
  /** Estimativa de gastos variáveis ainda não lançados. */
  estimatedVariable: number;
  total: number;
  income: number;
  balance: number;
}

export interface FutureProjection {
  rows: ProjectionRow[];
  /** Mediana mensal de variáveis usada nos meses seguintes (null = sem histórico). */
  variableMedian: number | null;
  /** Períodos usados na mediana, do mais antigo para o mais recente. */
  basePeriods: { year: number; month1: number }[];
  /** Soma da sobra só dos meses com receita lançada (sem receita não há sobra a prever). */
  totalBalance: number;
  /** Quantos meses entram em `totalBalance`. */
  monthsWithIncome: number;
}

function key(year: number, month1: number) {
  return `${year}-${String(month1).padStart(2, "0")}`;
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function shift(year: number, month1: number, delta: number) {
  const d = new Date(year, month1 - 1 + delta, 1);
  return { year: d.getFullYear(), month1: d.getMonth() + 1 };
}

export function computeFutureProjection(input: {
  transactions: Transaction[];
  cutoffDay: number;
  current: { year: number; month1: number };
  months?: number;
  today?: Date;
}): FutureProjection {
  const { transactions, cutoffDay, current, months = 6, today } = input;
  const currentKey = key(current.year, current.month1);

  // Agrupa por período (dia de corte) uma vez só.
  const byPeriod = new Map<string, Transaction[]>();
  for (const t of transactions) {
    if (!t.date) continue;
    const p = getTransactionPeriod(t.date, cutoffDay);
    const k = key(p.year, p.month);
    const list = byPeriod.get(k);
    if (list) list.push(t);
    else byPeriod.set(k, [t]);
  }
  const sumOf = (txs: Transaction[], pred: (t: Transaction) => boolean) =>
    txs.filter(pred).reduce((acc, t) => acc + t.amount, 0);
  const isVariable = (t: Transaction) => t.type === "despesa" && t.frequency.kind === "pontual";

  // Base dos variáveis: últimos períodos fechados com receita lançada.
  const base = [...byPeriod.entries()]
    .filter(([k, txs]) => k < currentKey && txs.some((t) => t.type === "receita"))
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-VARIABLE_BASE_PERIODS);
  const variableMedian =
    base.length > 0 ? median(base.map(([, txs]) => sumOf(txs, isVariable))) : null;
  const basePeriods = base.map(([k]) => {
    const [y, m] = k.split("-").map(Number);
    return { year: y!, month1: m! };
  });

  const rows: ProjectionRow[] = Array.from({ length: months }, (_, i) => {
    const { year, month1 } = shift(current.year, current.month1, i);
    const k = key(year, month1);
    const txs = byPeriod.get(k) ?? [];
    const income = sumOf(txs, (t) => t.type === "receita");
    const committed = sumOf(txs, (t) => t.type === "despesa");

    let estimatedVariable: number;
    if (i === 0) {
      const pace = computeMonthPace({
        month1,
        year,
        cutoffDay,
        monthTransactions: txs,
        categories: [],
        goals: [],
        ...(today ? { today } : {}),
      });
      estimatedVariable = pace.projected - committed;
    } else {
      // O que já foi lançado de pontual no mês (ex.: uma conta agendada) conta como parte da mediana.
      const launchedVariable = sumOf(txs, isVariable);
      estimatedVariable = Math.max(0, (variableMedian ?? 0) - launchedVariable);
    }

    const total = committed + estimatedVariable;
    return {
      key: k,
      year,
      month1,
      isCurrent: i === 0,
      committed,
      estimatedVariable,
      total,
      income,
      balance: income - total,
    };
  });

  return {
    rows,
    variableMedian,
    basePeriods,
    totalBalance: rows.filter((r) => r.income > 0).reduce((acc, r) => acc + r.balance, 0),
    monthsWithIncome: rows.filter((r) => r.income > 0).length,
  };
}
