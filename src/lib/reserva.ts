import { getTransactionPeriod, type Transaction } from "./finance-data";

/* ============================================================
 * RiccOS · Reserva — "para onde foi a sobra" (cálculos puros)
 * ============================================================
 *
 * Aportes e resgates não são receitas nem despesas: ficam fora das metas, das missões e
 * da sobra. A sobra do período é comparada com o que foi guardado nele (aportes − resgates,
 * agrupados pelo mesmo dia de corte dos lançamentos); o que resta é a sobra "sem destino".
 */

export interface DbReserva {
  reserva_id: string;
  user_id: string;
  reserva_alvo: number | string;
  reserva_saldo_inicial: number | string;
  criado_em?: string;
}

export type MovimentoTipo = "aporte" | "resgate";

export interface DbReservaMovimento {
  movimento_id: string;
  user_id: string;
  movimento_tipo: MovimentoTipo;
  movimento_valor: number | string;
  movimento_data: string;
  movimento_descricao?: string | null;
  criado_em?: string;
}

/** Aporte soma, resgate subtrai. */
export function signedValue(m: DbReservaMovimento) {
  const v = Number(m.movimento_valor) || 0;
  return m.movimento_tipo === "resgate" ? -v : v;
}

export function reservaSaldo(reserva: DbReserva, movimentos: DbReservaMovimento[]) {
  return (
    (Number(reserva.reserva_saldo_inicial) || 0) +
    movimentos.reduce((acc, m) => acc + signedValue(m), 0)
  );
}

/** Quanto foi guardado (líquido) no período month1/year, respeitando o dia de corte. */
export function guardadoNoPeriodo(
  movimentos: DbReservaMovimento[],
  month1: number,
  year: number,
  cutoffDay: number,
) {
  return movimentos
    .filter((m) => {
      const p = getTransactionPeriod(m.movimento_data, cutoffDay);
      return p.month === month1 && p.year === year;
    })
    .reduce((acc, m) => acc + signedValue(m), 0);
}

/**
 * Média de despesas dos últimos `n` períodos anteriores ao informado que tenham lançamentos.
 * Serve para traduzir o saldo da reserva em "meses de gastos cobertos".
 */
export function averageMonthlyExpenses(
  transactions: Transaction[],
  month1: number,
  year: number,
  cutoffDay: number,
  n = 3,
): number | null {
  const currentKey = year * 12 + month1;
  const totals = new Map<number, number>();
  for (const t of transactions) {
    if (t.type !== "despesa" || !t.date) continue;
    const p = getTransactionPeriod(t.date, cutoffDay);
    const key = p.year * 12 + p.month;
    if (key >= currentKey) continue;
    totals.set(key, (totals.get(key) ?? 0) + t.amount);
  }
  const last = [...totals.entries()].sort(([a], [b]) => b - a).slice(0, n);
  if (last.length === 0) return null;
  return last.reduce((acc, [, v]) => acc + v, 0) / last.length;
}
