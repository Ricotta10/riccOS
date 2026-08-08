import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { addMonths, format } from "date-fns";
import { useAuth } from "@/lib/auth";
import {
  budgets as initialBudgets,
  getTransactionPeriod,
  initialTransactions,
  mapDbTransactionToTransaction,
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
  addTransaction: (tx: Omit<Transaction, "id">) => Promise<void>;
  updateTransaction: (id: string, patch: Partial<Transaction>) => Promise<void>;
  removeTransaction: (id: string) => Promise<void>;
  toggleStatus: (id: string) => Promise<void>;
  setGoal: (categoryId: string, limit: number) => Promise<void>;
  budgets: { category: string; limit: number }[];
  setBudget: (category: string, limit: number) => void;
  refetchData: () => Promise<void>;
};

const StoreContext = createContext<Store | null>(null);

export function RiccosProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  const nextMonthDate = useMemo(() => addMonths(new Date(), 1), []);
  const [month, setMonth] = useState(nextMonthDate.getMonth()); // Mês seguinte (0-indexed)
  const [year, setYear] = useState(nextMonthDate.getFullYear());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [dbCategories, setDbCategories] = useState<DbCategory[]>([]);
  const [dbSubcategories, setDbSubcategories] = useState<DbSubcategory[]>([]);
  const [dbGoals, setDbGoals] = useState<DbGoal[]>([]);
  const [budgets, setBudgets] = useState(initialBudgets);
  const [loading, setLoading] = useState(false);

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

        const rowsToInsert = [];
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

        setTransactions((prev) => [...localTxsToInsert, ...prev]);

        try {
          await supabase.from("transacoes").insert(rowsToInsert);
          await refetchData();
        } catch (err) {
          console.error("Erro ao inserir lote de transações recorrentes:", err);
        }
      } else if (tx.frequency.kind === "parcelado" && tx.frequency.total > 1) {
        const grupoParcelaId = crypto.randomUUID();
        const pAtual = tx.frequency.current;
        const totalN = tx.frequency.total;
        const baseDate = new Date(`${tx.date}T12:00:00`);

        const rowsToInsert = [];
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
            transacao_valor: tx.amount,
            transacao_tipo: tx.type === "receita" ? "Receita" : "Despesa",
            transacao_data_vencimento: formattedDate,
            transacao_status: installmentStatus === "pago" ? "Pago" : "Pendente",
            transacao_frequencia: "Parcelado",
            transacao_parcela_atual: i,
            transacao_parcela_total: totalN,
            transacao_parcela_id: grupoParcelaId,
            transacao_recorrencia_id: null,
            transacao_data_fim: null,
          });

          localTxsToInsert.push({
            ...tx,
            id: newId,
            date: formattedDate,
            status: installmentStatus,
            parcelaId: grupoParcelaId,
            frequency: { kind: "parcelado", current: i, total: totalN },
          });
        }

        setTransactions((prev) => [...localTxsToInsert, ...prev]);

        try {
          await supabase.from("transacoes").insert(rowsToInsert);
          await refetchData();
        } catch (err) {
          console.error("Erro ao inserir lote de parcelas:", err);
        }
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
        };

        const localTx: Transaction = { ...tx, id: newId, parcelaId: grupoParcelaId ?? undefined };
        setTransactions((prev) => [localTx, ...prev]);

        try {
          await supabase.from("transacoes").insert([dbPayload]);
          await refetchData();
        } catch (err) {
          console.error("Erro ao inserir transação:", err);
        }
      }
    },
    [user, refetchData],
  );

  const updateTransaction = useCallback(
    async (id: string, patch: Partial<Transaction>) => {
      setTransactions((prev) => prev.map((tx) => (tx.id === id ? { ...tx, ...patch } : tx)));

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
          dbPatch["transacao_parcela_id"] = patch.parcelaId ?? crypto.randomUUID();
          dbPatch["transacao_recorrencia_id"] = null;
        } else if (patch.frequency.kind === "recorrente") {
          dbPatch["transacao_frequencia"] = "Recorrente";
          dbPatch["transacao_parcela_atual"] = null;
          dbPatch["transacao_parcela_total"] = null;
          dbPatch["transacao_parcela_id"] = null;
          dbPatch["transacao_recorrencia_id"] = patch.recorrenciaId ?? crypto.randomUUID();
        } else {
          dbPatch["transacao_frequencia"] = "Pontual";
          dbPatch["transacao_parcela_atual"] = null;
          dbPatch["transacao_parcela_total"] = null;
          dbPatch["transacao_parcela_id"] = null;
          dbPatch["transacao_recorrencia_id"] = null;
        }
      }

      try {
        await supabase.from("transacoes").update(dbPatch).eq("transacao_id", id);
        await refetchData();
      } catch (err) {
        console.error("Erro ao atualizar transação:", err);
      }
    },
    [refetchData],
  );

  const removeTransaction = useCallback(
    async (id: string) => {
      setTransactions((prev) => prev.filter((tx) => tx.id !== id));
      try {
        await supabase.from("transacoes").delete().eq("transacao_id", id);
        await refetchData();
      } catch (err) {
        console.error("Erro ao deletar transação:", err);
      }
    },
    [refetchData],
  );

  const toggleStatus = useCallback(
    async (id: string) => {
      const current = transactions.find((t) => t.id === id);
      if (!current) return;
      const nextStatus = current.status === "pago" ? "pendente" : "pago";

      setTransactions((prev) =>
        prev.map((tx) => (tx.id === id ? { ...tx, status: nextStatus } : tx)),
      );

      try {
        await supabase
          .from("transacoes")
          .update({ transacao_status: nextStatus === "pago" ? "Pago" : "Pendente" })
          .eq("transacao_id", id);
        await refetchData();
      } catch (err) {
        console.error("Erro ao alternar status:", err);
      }
    },
    [transactions, refetchData],
  );

  const setGoal = useCallback(
    async (categoryId: string, limit: number) => {
      const metaMes = month + 1;
      const metaAno = year;

      const existingGoal = dbGoals.find(
        (g) => g.categoria_id === categoryId && g.meta_mes === metaMes && g.meta_ano === metaAno,
      );

      try {
        if (existingGoal) {
          await supabase
            .from("metas")
            .update({ meta_valor: limit })
            .eq("meta_id", existingGoal.meta_id);
        } else {
          const newId = crypto.randomUUID();
          await supabase.from("metas").insert([
            {
              meta_id: newId,
              user_id: user?.id,
              categoria_id: categoryId,
              meta_valor: limit,
              meta_mes: metaMes,
              meta_ano: metaAno,
            },
          ]);
        }
        await refetchData();
      } catch (err) {
        console.error("Erro ao salvar meta no Supabase:", err);
      }
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

    console.group(`[RiccOS Store] Período Ativo: ${targetMonth1Indexed}/${targetYear} (Mês index: ${month})`);
    console.log(`📌 Dia de Vencimento (Corte): Dia ${cutoffDay}`);
    console.log(`📊 Total de Transações no Banco: ${transactions.length}`);
    console.log(`💳 Transações Puxadas no Mês (${monthTransactions.length}):`, monthTransactions.map(t => ({
      descricao: t.description,
      valor: t.amount,
      tipo: t.type,
      dataVencimento: t.date,
      categoria: t.category,
      status: t.status,
      periodoCalculado: getTransactionPeriod(t.date, cutoffDay)
    })));
    console.groupEnd();

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
      setGoal,
      budgets,
      setBudget: (category, limit) =>
        setBudgets((prev) => prev.map((b) => (b.category === category ? { ...b, limit } : b))),
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
    setGoal,
    budgets,
    refetchData,
  ]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useRiccos() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useRiccos must be used inside RiccosProvider");
  return ctx;
}
