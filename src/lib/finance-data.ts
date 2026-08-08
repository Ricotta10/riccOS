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
  criado_em?: string;
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
};

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
    ? categoriesMap.get(dbTx.categoria_id) ?? "Outros"
    : "Outros";

  const subcategoryName = dbTx.subcategoria_id
    ? subcategoriesMap.get(dbTx.subcategoria_id) ?? ""
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
    amount: typeof dbTx.transacao_valor === "number" ? dbTx.transacao_valor : Number(dbTx.transacao_valor) || 0,
    status: txStatus,
    userId: dbTx.user_id,
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

export function formatDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

const t = (
  id: string,
  date: string,
  description: string,
  category: string,
  subcategory: string,
  type: TxType,
  amount: number,
  status: TxStatus,
  frequency: Frequency = { kind: "pontual" },
): Transaction => ({
  id,
  date,
  description,
  category,
  subcategory,
  type,
  amount,
  status,
  frequency,
});

export const initialTransactions: Transaction[] = [
  t("1", "2026-08-05", "Salário Agosto", "Receitas", "Salário", "receita", 12400, "pago", {
    kind: "recorrente",
  }),
  t(
    "2",
    "2026-08-12",
    "Projeto freelance — landing page",
    "Receitas",
    "Freelance",
    "receita",
    3200,
    "pago",
  ),
  t(
    "3",
    "2026-08-28",
    "Dividendos carteira",
    "Receitas",
    "Investimentos",
    "receita",
    640.35,
    "pendente",
    { kind: "recorrente" },
  ),
  t("4", "2026-08-05", "Aluguel apartamento", "Moradia", "Aluguel", "despesa", 3200, "pago", {
    kind: "recorrente",
  }),
  t("5", "2026-08-10", "Condomínio", "Moradia", "Condomínio", "despesa", 780, "pago", {
    kind: "recorrente",
  }),
  t("6", "2026-08-18", "Energia elétrica", "Moradia", "Energia", "despesa", 312.45, "pendente", {
    kind: "recorrente",
  }),
  t("7", "2026-08-20", "Internet fibra", "Moradia", "Internet", "despesa", 129.9, "pendente", {
    kind: "recorrente",
  }),
  t("8", "2026-08-08", "Mercado semanal", "Alimentação", "Mercado", "despesa", 620.4, "pago"),
  t("9", "2026-08-15", "Mercado semanal", "Alimentação", "Mercado", "despesa", 548.9, "pago"),
  t(
    "10",
    "2026-08-22",
    "Jantar aniversário",
    "Alimentação",
    "Restaurantes",
    "despesa",
    289,
    "pendente",
  ),
  t("11", "2026-08-06", "Combustível", "Transporte", "Combustível", "despesa", 380, "pago"),
  t("12", "2026-08-14", "Revisão do carro", "Transporte", "Manutenção", "despesa", 890, "pago", {
    kind: "parcelado",
    current: 2,
    total: 4,
  }),
  t("13", "2026-08-03", "Assinaturas streaming", "Lazer", "Streaming", "despesa", 89.7, "pago", {
    kind: "recorrente",
  }),
  t("14", "2026-08-25", "Show — ingressos", "Lazer", "Eventos", "despesa", 420, "pendente", {
    kind: "parcelado",
    current: 1,
    total: 3,
  }),
  t("15", "2026-08-02", "Plano de saúde", "Saúde", "Plano de saúde", "despesa", 640, "pago", {
    kind: "recorrente",
  }),
  t("16", "2026-08-09", "Academia", "Saúde", "Academia", "despesa", 149, "pago", {
    kind: "recorrente",
  }),
  t("17", "2026-08-27", "Farmácia", "Saúde", "Farmácia", "despesa", 132.6, "pendente"),
  t(
    "18",
    "2026-08-16",
    "Curso de design de produto",
    "Educação",
    "Cursos",
    "despesa",
    297,
    "pago",
    { kind: "parcelado", current: 3, total: 12 },
  ),
  t("19", "2026-08-30", "Aula de inglês", "Educação", "Cursos", "despesa", 380, "pendente", {
    kind: "recorrente",
  }),
  t(
    "20",
    "2026-08-24",
    "App de transporte",
    "Transporte",
    "App de transporte",
    "despesa",
    176.3,
    "pendente",
  ),
];

export const budgets: { category: string; limit: number }[] = [
  { category: "Moradia", limit: 4600 },
  { category: "Alimentação", limit: 1800 },
  { category: "Transporte", limit: 1200 },
  { category: "Lazer", limit: 600 },
  { category: "Saúde", limit: 1000 },
  { category: "Educação", limit: 600 },
];

export const monthlyHistory = [
  { label: "Mar/26", receitas: 13800, despesas: 10450 },
  { label: "Abr/26", receitas: 14200, despesas: 11980 },
  { label: "Mai/26", receitas: 13950, despesas: 9840 },
  { label: "Jun/26", receitas: 15600, despesas: 12310 },
  { label: "Jul/26", receitas: 14100, despesas: 13020 },
  { label: "Ago/26", receitas: 16240.35, despesas: 9279.25 },
];

export const futureProjection = [
  { label: "Set/26", committed: 7420.6 },
  { label: "Out/26", committed: 6980.2 },
  { label: "Nov/26", committed: 6510.9 },
  { label: "Dez/26", committed: 7140.5 },
];

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
