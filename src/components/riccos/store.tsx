import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { addMonths, format } from "date-fns";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import {
  getTransactionPeriod,
  mapDbTransactionToTransaction,
  splitInstallments,
  type DbCategory,
  type DbGoal,
  type DbSubcategory,
  type DbTransaction,
  type Transaction,
  type TxStatus,
} from "@/lib/finance-data";
import { supabase } from "@/lib/supabase";

type Store = {
  month: number;
  year: number;
  setMonth: (m: number) => void;
  nextMonth: () => void;
  prevMonth: () => void;
  transactions: Transaction[];
  monthTransactions: Transaction[];
  dbCategories: DbCategory[];
  dbSubcategories: DbSubcategory[];
  dbGoals: DbGoal[];
  loading: boolean;
  // As mutações resolvem `true` quando o banco confirmou e `false` quando falhou
  // (o usuário já foi avisado por toast e a tela voltou ao estado anterior).
  addTransaction: (tx: Omit<Transaction, "id">) => Promise<boolean>;
  updateTransaction: (id: string, patch: Partial<Transaction>) => Promise<boolean>;
  removeTransaction: (id: string) => Promise<boolean>;
  toggleStatus: (id: string) => Promise<boolean>;
  markReviewed: (id: string) => Promise<boolean>;
  convertToInstallments: (id: string, total: number) => Promise<boolean>;
  convertToRecurring: (id: string) => Promise<boolean>;
  setGoal: (categoryId: string, limit: number) => Promise<boolean>;
  refetchData: () => Promise<void>;
};

const StoreContext = createContext<Store | null>(null);

/**
 * O supabase-js não lança exceção em erro de banco: devolve `{ error }`. Este helper
 * checa esse retorno (e falhas de rede), avisa o usuário e diz se a operação deu certo.
 */
async function persist(
  action: string,
  request: PromiseLike<{ error: unknown }>,
): Promise<boolean> {
  try {
    const { error } = await request;
    if (!error) return true;
    console.error(`Erro ao ${action}:`, error);
  } catch (err) {
    console.error(`Erro ao ${action}:`, err);
  }
  toast.error(`Não foi possível ${action}.`, {
    description: "Nada foi alterado. Verifique sua conexão e tente de novo.",
  });
  return false;
}

export function RiccosProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  const nextMonthDate = useMemo(() => addMonths(new Date(), 1), []);
  const [month, setMonth] = useState(nextMonthDate.getMonth()); // Mês seguinte (0-indexed)
  const [year, setYear] = useState(nextMonthDate.getFullYear());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [dbCategories, setDbCategories] = useState<DbCategory[]>([]);
  const [dbSubcategories, setDbSubcategories] = useState<DbSubcategory[]>([]);
  const [dbGoals, setDbGoals] = useState<DbGoal[]>([]);
  const [loading, setLoading] = useState(false);

  // Espelho da lista atual, para as mutações tirarem um snapshot e desfazerem a
  // atualização otimista se o banco recusar (sem depender de `transactions` nos deps).
  const transactionsRef = useRef(transactions);
  transactionsRef.current = transactions;

  const applyOptimistic = useCallback(
    async (
      action: string,
      update: (prev: Transaction[]) => Transaction[],
      request: () => PromiseLike<{ error: unknown }>,
    ) => {
      const snapshot = transactionsRef.current;
      setTransactions(update);
      const ok = await persist(action, request());
      if (!ok) setTransactions(snapshot);
      return ok;
    },
    [],
  );

  const refetchData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch categorias
      const { data: catData, error: catErr } = await supabase.from("categorias").select("*");
      if (catErr) console.error("Erro ao buscar categorias:", catErr);
      const fetchedCategories = (catData as DbCategory[]) || [];
      setDbCategories(fetchedCategories);

      const catMap = new Map<string, string>();
      fetchedCategories.forEach((c) => catMap.set(c.categoria_id, c.categoria_nome));

      // 2. Fetch subcategorias
      const { data: subData, error: subErr } = await supabase.from("subcategorias").select("*");
      if (subErr) console.error("Erro ao buscar subcategorias:", subErr);
      const fetchedSubcategories = (subData as DbSubcategory[]) || [];
      setDbSubcategories(fetchedSubcategories);

      const subMap = new Map<string, string>();
      fetchedSubcategories.forEach((s) => subMap.set(s.subcategoria_id, s.subcategoria_nome));

      // 3. Fetch transacoes
      const { data: txData, error: txError } = await supabase
        .from("transacoes")
        .select("*")
        .order("transacao_data_vencimento", { ascending: false });

      if (txError) {
        console.error("Erro ao buscar transacoes no Supabase:", txError);
      } else if (txData) {
        const mapped = (txData as DbTransaction[]).map((t) =>
          mapDbTransactionToTransaction(t, catMap, subMap),
        );
        setTransactions(mapped);
      }

      // 4. Fetch metas
      const { data: goalData, error: goalErr } = await supabase.from("metas").select("*");
      if (goalErr) console.error("Erro ao buscar metas no Supabase:", goalErr);
      setDbGoals((goalData as DbGoal[]) || []);
    } catch (err) {
      console.error("Erro ao buscar dados no Supabase:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetchData();
  }, [user, refetchData]);

  const addTransaction = useCallback(
    async (tx: Omit<Transaction, "id">) => {
      const isRecorrente = tx.frequency.kind === "recorrente";
      const isParcelado = tx.frequency.kind === "parcelado";

      if (isRecorrente) {
        const grupoRecorrenciaId = crypto.randomUUID();
        const dataFimStr = tx.endDate ?? null;
        const initialDate = new Date(`${tx.date}T12:00:00`);
        const horizonN = 12; // 12 meses de projeção padrão

        const rowsToInsert: Record<string, unknown>[] = [];
        const localTxsToInsert: Transaction[] = [];

        for (let i = 0; i < horizonN; i++) {
          const newId = crypto.randomUUID();
          const installmentDate = addMonths(initialDate, i);
          const formattedDate = format(installmentDate, "yyyy-MM-dd");

          // Condição de parada por Data Fim
          if (dataFimStr && formattedDate > dataFimStr) {
            break;
          }

          const installmentStatus: TxStatus = i === 0 ? tx.status : "pendente";

          rowsToInsert.push({
            transacao_id: newId,
            user_id: user?.id ?? tx.userId,
            categoria_id: tx.categoryId,
            subcategoria_id: tx.subcategoryId,
            transacao_descricao: tx.description,
            transacao_valor: tx.amount,
            transacao_tipo: tx.type === "receita" ? "Receita" : "Despesa",
            transacao_data_vencimento: formattedDate,
            transacao_status: installmentStatus === "pago" ? "Pago" : "Pendente",
            transacao_frequencia: "Recorrente",
            transacao_recorrencia_id: grupoRecorrenciaId,
            transacao_data_fim: dataFimStr,
            transacao_parcela_atual: null,
            transacao_parcela_total: null,
            transacao_parcela_id: null,
            transacao_origem: tx.origem ?? "manual",
            transacao_estabelecimento_original: tx.estabelecimentoOriginal ?? null,
            transacao_chave_externa: i === 0 ? (tx.chaveExterna ?? null) : null,
          });

          localTxsToInsert.push({
            ...tx,
            id: newId,
            date: formattedDate,
            status: installmentStatus,
            recorrenciaId: grupoRecorrenciaId,
            endDate: dataFimStr ?? undefined,
            frequency: { kind: "recorrente" },
          });
        }

        const ok = await applyOptimistic(
          "salvar o lançamento recorrente",
          (prev) => [...localTxsToInsert, ...prev],
          () => supabase.from("transacoes").insert(rowsToInsert),
        );
        if (ok) await refetchData();
        return ok;
      } else if (tx.frequency.kind === "parcelado" && tx.frequency.total > 1) {
        // Em compra parcelada, tx.amount é o valor TOTAL da compra: cada parcela recebe a sua fração.
        const grupoParcelaId = crypto.randomUUID();
        const pAtual = tx.frequency.current;
        const totalN = tx.frequency.total;
        const baseDate = new Date(`${tx.date}T12:00:00`);
        const installmentAmounts = splitInstallments(tx.amount, totalN);

        const rowsToInsert: Record<string, unknown>[] = [];
        const localTxsToInsert: Transaction[] = [];

        for (let i = 1; i <= totalN; i++) {
          const newId = crypto.randomUUID();
          const monthOffset = i - pAtual;
          const installmentDate = addMonths(baseDate, monthOffset);
          const formattedDate = format(installmentDate, "yyyy-MM-dd");

          let installmentStatus: TxStatus;
          if (i < pAtual) {
            installmentStatus = "pago";
          } else if (i === pAtual) {
            installmentStatus = tx.status;
          } else {
            installmentStatus = "pendente";
          }

          rowsToInsert.push({
            transacao_id: newId,
            user_id: user?.id ?? tx.userId,
            categoria_id: tx.categoryId,
            subcategoria_id: tx.subcategoryId,
            transacao_descricao: tx.description,
            transacao_valor: installmentAmounts[i - 1] ?? 0,
            transacao_tipo: tx.type === "receita" ? "Receita" : "Despesa",
            transacao_data_vencimento: formattedDate,
            transacao_status: installmentStatus === "pago" ? "Pago" : "Pendente",
            transacao_frequencia: "Parcelado",
            transacao_parcela_atual: i,
            transacao_parcela_total: totalN,
            transacao_parcela_id: grupoParcelaId,
            transacao_recorrencia_id: null,
            transacao_data_fim: null,
            transacao_origem: tx.origem ?? "manual",
            transacao_estabelecimento_original: tx.estabelecimentoOriginal ?? null,
            transacao_chave_externa: i === pAtual ? (tx.chaveExterna ?? null) : null,
          });

          localTxsToInsert.push({
            ...tx,
            id: newId,
            amount: installmentAmounts[i - 1] ?? 0,
            date: formattedDate,
            status: installmentStatus,
            parcelaId: grupoParcelaId,
            frequency: { kind: "parcelado", current: i, total: totalN },
          });
        }

        const ok = await applyOptimistic(
          "salvar as parcelas",
          (prev) => [...localTxsToInsert, ...prev],
          () => supabase.from("transacoes").insert(rowsToInsert),
        );
        if (ok) await refetchData();
        return ok;
      } else {
        const newId = crypto.randomUUID();
        const grupoParcelaId = isParcelado ? (tx.parcelaId ?? crypto.randomUUID()) : null;

        const dbPayload = {
          transacao_id: newId,
          user_id: user?.id ?? tx.userId,
          categoria_id: tx.categoryId,
          subcategoria_id: tx.subcategoryId,
          transacao_descricao: tx.description,
          transacao_valor: tx.amount,
          transacao_tipo: tx.type === "receita" ? "Receita" : "Despesa",
          transacao_data_vencimento: tx.date,
          transacao_status: tx.status === "pago" ? "Pago" : "Pendente",
          transacao_frequencia: "Pontual",
          transacao_parcela_atual: null,
          transacao_parcela_total: null,
          transacao_parcela_id: null,
          transacao_recorrencia_id: null,
          transacao_data_fim: null,
          transacao_origem: tx.origem ?? "manual",
          transacao_estabelecimento_original: tx.estabelecimentoOriginal ?? null,
          transacao_chave_externa: tx.chaveExterna ?? null,
        };

        const localTx: Transaction = { ...tx, id: newId, parcelaId: grupoParcelaId ?? undefined };
        const ok = await applyOptimistic(
          "salvar o lançamento",
          (prev) => [localTx, ...prev],
          () => supabase.from("transacoes").insert([dbPayload]),
        );
        if (ok) await refetchData();
        return ok;
      }
    },
    [user, refetchData, applyOptimistic],
  );

  const updateTransaction = useCallback(
    async (id: string, patch: Partial<Transaction>) => {
      const dbPatch: Record<string, any> = {};
      if (patch.description !== undefined) dbPatch["transacao_descricao"] = patch.description;
      if (patch.amount !== undefined) dbPatch["transacao_valor"] = patch.amount;
      if (patch.date !== undefined) dbPatch["transacao_data_vencimento"] = patch.date;
      if (patch.type !== undefined) dbPatch["transacao_tipo"] = patch.type === "receita" ? "Receita" : "Despesa";
      if (patch.status !== undefined) dbPatch["transacao_status"] = patch.status === "pago" ? "Pago" : "Pendente";
      if (patch.categoryId !== undefined) dbPatch["categoria_id"] = patch.categoryId;
      if (patch.subcategoryId !== undefined) dbPatch["subcategoria_id"] = patch.subcategoryId;
      if (patch.endDate !== undefined) dbPatch["transacao_data_fim"] = patch.endDate ?? null;
      if (patch.frequency !== undefined) {
        if (patch.frequency.kind === "parcelado") {
          dbPatch["transacao_frequencia"] = "Parcelado";
          dbPatch["transacao_parcela_atual"] = patch.frequency.current;
          dbPatch["transacao_parcela_total"] = patch.frequency.total;
          // Mantém o grupo da compra ao editar uma parcela; só cria um novo se ainda não houver.
          const existingParcelaId = transactionsRef.current.find((t) => t.id === id)?.parcelaId;
          dbPatch["transacao_parcela_id"] =
            patch.parcelaId ?? existingParcelaId ?? crypto.randomUUID();
          dbPatch["transacao_recorrencia_id"] = null;
        } else if (patch.frequency.kind === "recorrente") {
          dbPatch["transacao_frequencia"] = "Recorrente";
          dbPatch["transacao_parcela_atual"] = null;
          dbPatch["transacao_parcela_total"] = null;
          dbPatch["transacao_parcela_id"] = null;
          const existingRecorrenciaId = transactionsRef.current.find(
            (t) => t.id === id,
          )?.recorrenciaId;
          dbPatch["transacao_recorrencia_id"] =
            patch.recorrenciaId ?? existingRecorrenciaId ?? crypto.randomUUID();
        } else {
          dbPatch["transacao_frequencia"] = "Pontual";
          dbPatch["transacao_parcela_atual"] = null;
          dbPatch["transacao_parcela_total"] = null;
          dbPatch["transacao_parcela_id"] = null;
          dbPatch["transacao_recorrencia_id"] = null;
        }
      }

      const ok = await applyOptimistic(
        "atualizar o lançamento",
        (prev) => prev.map((tx) => (tx.id === id ? { ...tx, ...patch } : tx)),
        () => supabase.from("transacoes").update(dbPatch).eq("transacao_id", id),
      );
      if (ok) await refetchData();
      return ok;
    },
    [refetchData, applyOptimistic],
  );

  const removeTransaction = useCallback(
    async (id: string) => {
      const ok = await applyOptimistic(
        "excluir o lançamento",
        (prev) => prev.filter((tx) => tx.id !== id),
        () => supabase.from("transacoes").delete().eq("transacao_id", id),
      );
      if (ok) await refetchData();
      return ok;
    },
    [refetchData, applyOptimistic],
  );

  const toggleStatus = useCallback(
    async (id: string) => {
      const current = transactionsRef.current.find((t) => t.id === id);
      if (!current) return false;
      const nextStatus = current.status === "pago" ? "pendente" : "pago";

      const ok = await applyOptimistic(
        "alterar o status",
        (prev) => prev.map((tx) => (tx.id === id ? { ...tx, status: nextStatus } : tx)),
        () =>
          supabase
            .from("transacoes")
            .update({ transacao_status: nextStatus === "pago" ? "Pago" : "Pendente" })
            .eq("transacao_id", id),
      );
      if (ok) await refetchData();
      return ok;
    },
    [refetchData, applyOptimistic],
  );

  const markReviewed = useCallback(
    async (id: string) => {
      const ok = await applyOptimistic(
        "marcar como revisado",
        (prev) => prev.map((tx) => (tx.id === id ? { ...tx, revisada: true } : tx)),
        () =>
          supabase.from("transacoes").update({ transacao_revisada: true }).eq("transacao_id", id),
      );
      if (ok) await refetchData();
      return ok;
    },
    [refetchData, applyOptimistic],
  );

  // Recria um lançamento automático em outro formato (parcelas ou fixo) e remove o original.
  // O nome original da Wallet e a chave de dedupe vão para a nova linha "atual"; como a chave é
  // única, ela sai do original antes do insert e volta para ele se o insert falhar.
  // O original só é removido se as novas linhas foram gravadas — senão a compra se perderia.
  const replaceTransaction = useCallback(
    async (id: string, frequency: Transaction["frequency"]) => {
      const original = transactionsRef.current.find((t) => t.id === id);
      if (!original) return false;
      const { id: _id, ...rest } = original;
      const chave = original.chaveExterna;

      const setChave = async (value: string | null) => {
        const { error } = await supabase
          .from("transacoes")
          .update({ transacao_chave_externa: value })
          .eq("transacao_id", id);
        if (error) console.error("Erro ao mover a chave externa:", error);
        return !error;
      };

      if (chave && !(await setChave(null))) return false;
      const created = await addTransaction({ ...rest, frequency, revisada: true });
      if (!created) {
        if (chave) await setChave(chave);
        return false;
      }
      return removeTransaction(id);
    },
    [addTransaction, removeTransaction],
  );

  const convertToInstallments = useCallback(
    async (id: string, total: number) =>
      total >= 2 && replaceTransaction(id, { kind: "parcelado", current: 1, total }),
    [replaceTransaction],
  );

  // Converte um lançamento automático em gasto fixo, projetando os próximos meses.
  const convertToRecurring = useCallback(
    async (id: string) => replaceTransaction(id, { kind: "recorrente" }),
    [replaceTransaction],
  );

  const setGoal = useCallback(
    async (categoryId: string, limit: number) => {
      const metaMes = month + 1;
      const metaAno = year;

      const existingGoal = dbGoals.find(
        (g) => g.categoria_id === categoryId && g.meta_mes === metaMes && g.meta_ano === metaAno,
      );

      const ok = await persist(
        "salvar a meta",
        existingGoal
          ? supabase
              .from("metas")
              .update({ meta_valor: limit })
              .eq("meta_id", existingGoal.meta_id)
          : supabase.from("metas").insert([
              {
                meta_id: crypto.randomUUID(),
                user_id: user?.id,
                categoria_id: categoryId,
                meta_valor: limit,
                meta_mes: metaMes,
                meta_ano: metaAno,
              },
            ]),
      );
      if (ok) await refetchData();
      return ok;
    },
    [month, year, dbGoals, user, refetchData],
  );

  const value = useMemo<Store>(() => {
    const shift = (delta: number) => {
      const total = month + delta;
      const nextYear = year + Math.floor(total / 12);
      const nextMonthIdx = ((total % 12) + 12) % 12;
      setMonth(nextMonthIdx);
      setYear(nextYear);
    };

    const cutoffDay = profile?.dia_vencimento ?? 3;
    const targetYear = year;
    const targetMonth1Indexed = month + 1;

    const monthTransactions = transactions.filter((tx) => {
      if (!tx.date) return false;
      const { year: periodYear, month: periodMonth } = getTransactionPeriod(tx.date, cutoffDay);
      return periodYear === targetYear && periodMonth === targetMonth1Indexed;
    });

    return {
      month,
      year,
      setMonth,
      nextMonth: () => shift(1),
      prevMonth: () => shift(-1),
      transactions,
      monthTransactions,
      dbCategories,
      dbSubcategories,
      dbGoals,
      loading,
      addTransaction,
      updateTransaction,
      removeTransaction,
      toggleStatus,
      markReviewed,
      convertToInstallments,
      convertToRecurring,
      setGoal,
      refetchData,
    };
  }, [
    month,
    year,
    profile,
    transactions,
    dbCategories,
    dbSubcategories,
    dbGoals,
    loading,
    addTransaction,
    updateTransaction,
    removeTransaction,
    toggleStatus,
    markReviewed,
    convertToInstallments,
    convertToRecurring,
    setGoal,
    refetchData,
  ]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useRiccos() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useRiccos must be used inside RiccosProvider");
  return ctx;
}
