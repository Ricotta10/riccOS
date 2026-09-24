import type { CSSProperties } from "react";

export type TxType = "receita" | "despesa";
export type TxStatus = "pago" | "pendente";
export type Frequency =
  | { kind: "pontual" }
  | { kind: "recorrente" }
  | { kind: "parcelado"; current: number; total: number };

export interface DbCategory {
  idx?: number;
  categoria_id: string;
  user_id?: string;
  categoria_nome: string;
  categoria_tipo: string;
  categoria_icone?: string;
  categoria_cor?: string;
  criado_em?: string;
}

export interface DbSubcategory {
  idx?: number;
  subcategoria_id: string;
  user_id?: string;
  categoria_id: string;
  subcategoria_nome: string;
  criado_em?: string;
}

export interface DbGoal {
  idx?: number;
  meta_id: string;
  user_id?: string;
  categoria_id: string;
  meta_valor: number | string;
  meta_mes: number;
  meta_ano: number;
  criado_em?: string;
}

export interface DbTransaction {
  idx?: number;
  transacao_id: string;
  user_id?: string;
  categoria_id?: string;
  subcategoria_id?: string;
  transacao_descricao: string;
  transacao_valor: number | string;
  transacao_tipo: string;
  transacao_data_vencimento: string;
  transacao_status: string;
  transacao_frequencia: string;
  transacao_parcela_atual?: number | null;
  transacao_parcela_total?: number | null;
  transacao_parcela_id?: string | null;
  transacao_recorrencia_id?: string | null;
  transacao_data_fim?: string | null;
  transacao_origem?: string | null;
  transacao_revisada?: boolean | null;
  transacao_estabelecimento_original?: string | null;
  criado_em?: string;
}

export interface DbMerchantAlias {
  apelido_id: string;
  user_id?: string;
  apelido_trecho: string;
  apelido_padrao: string;
  apelido_nome: string;
  categoria_id: string | null;
  subcategoria_id: string | null;
  criado_em?: string;
}

/**
 * Normaliza nomes de estabelecimento para comparação: sem acento, minúsculo e só [a-z0-9].
 * Precisa ser idêntica à do workflow n8n "Lançar Compra Wallet" (nó Decidir Ação).
 */
export function normalizeMerchant(s: string | null | undefined) {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export type Transaction = {
  id: string;
  date: string; // ISO yyyy-mm-dd
  description: string;
  category: string;
  subcategory: string;
  categoryId?: string | undefined;
  subcategoryId?: string | undefined;
  parcelaId?: string | undefined;
  recorrenciaId?: string | undefined;
  endDate?: string | undefined;
  type: TxType;
  frequency: Frequency;
  amount: number;
  status: TxStatus;
  userId?: string | undefined;
  /** De onde veio o lançamento; "wallet" = automação da Apple Wallet. */
  origem?: TxOrigem | undefined;
  /** false = lançamento automático aguardando revisão do usuário. */
  revisada?: boolean | undefined;
  /** Nome cru do estabelecimento como veio da Wallet (antes de apelido/IA). */
  estabelecimentoOriginal?: string | undefined;
};

export type TxOrigem = "manual" | "voz" | "wallet";

export function mapDbTransactionToTransaction(
  dbTx: DbTransaction,
  categoriesMap: Map<string, string>,
  subcategoriesMap: Map<string, string>,
): Transaction {
  const typeLower = (dbTx.transacao_tipo ?? "Despesa").toLowerCase();
  const txType: TxType = typeLower === "receita" ? "receita" : "despesa";

  const statusLower = (dbTx.transacao_status ?? "Pendente").toLowerCase();
  const txStatus: TxStatus = statusLower === "pago" ? "pago" : "pendente";

  const freqStr = (dbTx.transacao_frequencia ?? "Pontual").toLowerCase();
  let frequency: Frequency = { kind: "pontual" };
  if (freqStr === "recorrente") {
    frequency = { kind: "recorrente" };
  } else if (freqStr === "parcelado") {
    frequency = {
      kind: "parcelado",
      current: dbTx.transacao_parcela_atual ?? 1,
      total: dbTx.transacao_parcela_total ?? 1,
    };
  }

  const categoryName = dbTx.categoria_id
    ? (categoriesMap.get(dbTx.categoria_id) ?? "Outros")
    : "Outros";

  const subcategoryName = dbTx.subcategoria_id
    ? (subcategoriesMap.get(dbTx.subcategoria_id) ?? "")
    : "";

  return {
    id: dbTx.transacao_id,
    date: dbTx.transacao_data_vencimento || new Date().toISOString().slice(0, 10),
    description: dbTx.transacao_descricao || "",
    category: categoryName,
    subcategory: subcategoryName,
    categoryId: dbTx.categoria_id,
    subcategoryId: dbTx.subcategoria_id,
    parcelaId: dbTx.transacao_parcela_id ?? undefined,
    recorrenciaId: dbTx.transacao_recorrencia_id ?? undefined,
    endDate: dbTx.transacao_data_fim ?? undefined,
    type: txType,
    frequency,
    amount:
      typeof dbTx.transacao_valor === "number"
        ? dbTx.transacao_valor
        : Number(dbTx.transacao_valor) || 0,
    status: txStatus,
    userId: dbTx.user_id,
    origem: (dbTx.transacao_origem as TxOrigem | null) ?? "manual",
    revisada: dbTx.transacao_revisada ?? true,
    estabelecimentoOriginal: dbTx.transacao_estabelecimento_original ?? undefined,
  };
}

export function getTransactionPeriod(
  dateStr: string,
  cutoffDay: number = 1,
): { year: number; month: number } {
  if (!dateStr) return { year: 2026, month: 8 };
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return { year: 2026, month: 8 };

  if (cutoffDay <= 1) {
    return { year: y, month: m };
  }

  if (d > cutoffDay) {
    const nextDate = new Date(y, m - 1 + 1, 1);
    return { year: nextDate.getFullYear(), month: nextDate.getMonth() + 1 };
  }

  return { year: y, month: m };
}

export const categories: Record<string, string[]> = {
  Moradia: ["Aluguel", "Condomínio", "Energia", "Internet"],
  Alimentação: ["Mercado", "Restaurantes", "Delivery"],
  Transporte: ["Combustível", "App de transporte", "Manutenção"],
  Lazer: ["Streaming", "Viagens", "Eventos"],
  Saúde: ["Plano de saúde", "Farmácia", "Academia"],
  Educação: ["Cursos", "Livros"],
  Receitas: ["Salário", "Freelance", "Investimentos"],
};

export const categoryList = Object.keys(categories);

export const monthNames = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Divide o valor total de uma compra em N parcelas, em centavos, para que a soma
 * feche exatamente com o total. Os centavos que sobram vão para as primeiras parcelas
 * (ex.: 100 em 3x → 33,34 + 33,33 + 33,33).
 */
export function splitInstallments(total: number, n: number): number[] {
  const count = Math.max(1, Math.floor(n));
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / count);
  const remainder = cents - base * count;
  return Array.from({ length: count }, (_, i) => (base + (i < remainder ? 1 : 0)) / 100);
}

/**
 * Paleta de gráficos do design system (tokens --chart-1..8 em styles.css).
 * Usa variáveis CSS para acompanhar o tema claro/escuro automaticamente.
 */
export const chartColors = Array.from({ length: 8 }, (_, i) => `var(--chart-${i + 1})`);

/** Estilo padrão do tooltip do Recharts, alinhado aos cards do sistema. */
export const chartTooltipStyle: CSSProperties = {
  backgroundColor: "var(--color-popover)",
  border: "1px solid var(--color-border)",
  borderRadius: "1rem",
  boxShadow: "var(--shadow-soft)",
  color: "var(--color-foreground)",
  fontFamily: "var(--font-sans)",
  fontSize: "0.75rem",
  fontWeight: 600,
  padding: "0.6rem 0.8rem",
};

export function formatDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function summarize(txs: Transaction[]) {
  const entradas = txs.filter((x) => x.type === "receita").reduce((a, b) => a + b.amount, 0);
  const saidas = txs.filter((x) => x.type === "despesa").reduce((a, b) => a + b.amount, 0);
  const pendente = txs
    .filter((x) => x.type === "despesa" && x.status === "pendente")
    .reduce((a, b) => a + b.amount, 0);
  return { entradas, saidas, balanco: entradas - saidas, pendente };
}

export function spentByCategory(txs: Transaction[]) {
  const map = new Map<string, number>();
  for (const tx of txs) {
    if (tx.type !== "despesa") continue;
    map.set(tx.category, (map.get(tx.category) ?? 0) + tx.amount);
  }
  return [...map.entries()]
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);
}

export function frequencyLabel(f: Frequency) {
  if (f.kind === "pontual") return "Pontual";
  if (f.kind === "recorrente") return "Recorrente";
  return `Parcelado ${f.current}/${f.total}`;
}
