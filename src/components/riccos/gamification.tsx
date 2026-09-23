import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { useAuth } from "@/lib/auth";
import { getTransactionPeriod, type Transaction } from "@/lib/finance-data";
import {
  computeAutoMissions,
  isPeriodCurrent,
  isPeriodOver,
  levelFor,
  mapManualMissions,
  snapshotMissions,
  streakFor,
  summarizeSeason,
  type DbMissao,
  type DbTemporada,
  type Faixa,
  type Mission,
  type SeasonSummary,
} from "@/lib/gamification";
import { supabase } from "@/lib/supabase";
import { useRiccos } from "./store";

export type SeasonCloseResult = {
  temporada: DbTemporada;
};

type Gamification = {
  loading: boolean;
  /** Mês (1–12) e ano da temporada em foco (segue o filtro global) */
  month1: number;
  year: number;
  missions: Mission[];
  autoMissions: Mission[];
  manualMissions: Mission[];
  season: SeasonSummary;
  /** Temporada já fechada para o período em foco (se houver) */
  closedSeason: DbTemporada | null;
  temporadas: DbTemporada[];
  totalXp: number;
  level: ReturnType<typeof levelFor>;
  streak: number;
  periodOver: boolean;
  periodCurrent: boolean;
  canClose: boolean;
  addMission: (input: { titulo: string; descricao?: string; pontos: number }) => Promise<void>;
  toggleMission: (dbId: string) => Promise<void>;
  removeMission: (dbId: string) => Promise<void>;
  closeSeason: () => Promise<SeasonCloseResult | null>;
  reopenSeason: () => Promise<void>;
  /** Períodos já encerrados que têm lançamentos mas ainda não foram fechados */
  pastOpenPeriods: { month1: number; year: number }[];
  /** Fecha todos os períodos passados que têm dados. Retorna quantos fechou. */
  closePastSeasons: () => Promise<number>;
  refetch: () => Promise<void>;
};

const GamificationContext = createContext<Gamification | null>(null);

export function GamificationProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  const { month, year, transactions, monthTransactions, dbCategories, dbGoals } = useRiccos();

  const [missoes, setMissoes] = useState<DbMissao[]>([]);
  const [temporadas, setTemporadas] = useState<DbTemporada[]>([]);
  const [loading, setLoading] = useState(false);

  const month1 = month + 1;
  const cutoffDay = profile?.dia_vencimento ?? 3;

  const refetch = useCallback(async () => {
    if (!user) {
      setMissoes([]);
      setTemporadas([]);
      return;
    }
    setLoading(true);
    try {
      const [m, t] = await Promise.all([
        supabase.from("missoes").select("*"),
        supabase.from("temporadas").select("*"),
      ]);
      if (m.error) console.error("Erro ao buscar missões:", m.error);
      if (t.error) console.error("Erro ao buscar temporadas:", t.error);
      setMissoes((m.data as DbMissao[]) ?? []);
      setTemporadas((t.data as DbTemporada[]) ?? []);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  /* ---------- Cálculos ---------- */

  const previousMonthTransactions = useMemo<Transaction[]>(() => {
    const prevMonth1 = month1 === 1 ? 12 : month1 - 1;
    const prevYear = month1 === 1 ? year - 1 : year;
    return transactions.filter((tx) => {
      if (!tx.date) return false;
      const p = getTransactionPeriod(tx.date, cutoffDay);
      return p.year === prevYear && p.month === prevMonth1;
    });
  }, [transactions, month1, year, cutoffDay]);

  const autoMissions = useMemo(
    () =>
      computeAutoMissions({
        month1,
        year,
        cutoffDay,
        monthTransactions,
        previousMonthTransactions,
        categories: dbCategories,
        goals: dbGoals,
      }),
    [month1, year, cutoffDay, monthTransactions, previousMonthTransactions, dbCategories, dbGoals],
  );

  const manualMissions = useMemo(
    () => mapManualMissions(missoes, month1, year),
    [missoes, month1, year],
  );

  const missions = useMemo(
    () => [...autoMissions, ...manualMissions],
    [autoMissions, manualMissions],
  );

  const closedSeason = useMemo(
    () => temporadas.find((t) => t.temporada_mes === month1 && t.temporada_ano === year) ?? null,
    [temporadas, month1, year],
  );

  const season = useMemo<SeasonSummary>(() => {
    if (closedSeason) {
      // Temporada fechada: usa o snapshot salvo, não recalcula
      const snap = closedSeason.temporada_detalhes ?? [];
      const max = closedSeason.temporada_pontos_max;
      const pts = closedSeason.temporada_pontos;
      return {
        points: pts,
        maxPoints: max,
        pct: max > 0 ? Math.round((pts / max) * 100) : 0,
        faixa: closedSeason.temporada_faixa,
        toNext: 0,
        nextFaixa: null,
        concluidas: snap.filter((s) => s.concluida).length,
        total: snap.length,
      };
    }
    return summarizeSeason(missions);
  }, [missions, closedSeason]);

  const totalXp = useMemo(
    () => temporadas.reduce((a, t) => a + (t.temporada_pontos || 0), 0),
    [temporadas],
  );
  const level = useMemo(() => levelFor(totalXp), [totalXp]);
  const streak = useMemo(() => streakFor(temporadas), [temporadas]);

  const periodOver = isPeriodOver(month1, year, cutoffDay);
  const periodCurrent = isPeriodCurrent(month1, year, cutoffDay);
  const canClose = !closedSeason && (periodOver || periodCurrent);

  /* ---------- Missões manuais ---------- */

  const addMission = useCallback<Gamification["addMission"]>(
    async ({ titulo, descricao, pontos }) => {
      if (!user) return;
      const { data, error } = await supabase
        .from("missoes")
        .insert({
          user_id: user.id,
          missao_titulo: titulo,
          missao_descricao: descricao || null,
          missao_pontos: Math.max(5, Math.min(500, Math.round(pontos))),
          missao_mes: month1,
          missao_ano: year,
        })
        .select()
        .single();
      if (error) {
        console.error("Erro ao criar missão:", error);
        return;
      }
      setMissoes((prev) => [...prev, data as DbMissao]);
    },
    [user, month1, year],
  );

  const toggleMission = useCallback(
    async (dbId: string) => {
      const current = missoes.find((m) => m.missao_id === dbId);
      if (!current) return;
      const next = !current.missao_concluida;
      setMissoes((prev) =>
        prev.map((m) =>
          m.missao_id === dbId
            ? {
                ...m,
                missao_concluida: next,
                missao_concluida_em: next ? new Date().toISOString() : null,
              }
            : m,
        ),
      );
      const { error } = await supabase
        .from("missoes")
        .update({
          missao_concluida: next,
          missao_concluida_em: next ? new Date().toISOString() : null,
        })
        .eq("missao_id", dbId);
      if (error) {
        console.error("Erro ao atualizar missão:", error);
        refetch();
      }
    },
    [missoes, refetch],
  );

  const removeMission = useCallback(
    async (dbId: string) => {
      setMissoes((prev) => prev.filter((m) => m.missao_id !== dbId));
      const { error } = await supabase.from("missoes").delete().eq("missao_id", dbId);
      if (error) {
        console.error("Erro ao remover missão:", error);
        refetch();
      }
    },
    [refetch],
  );

  /* ---------- Temporada ---------- */

  const closeSeason = useCallback(async (): Promise<SeasonCloseResult | null> => {
    if (!user || closedSeason) return null;
    const summary = summarizeSeason(missions);
    const faixa: Faixa = summary.faixa;

    const { data, error } = await supabase
      .from("temporadas")
      .insert({
        user_id: user.id,
        temporada_mes: month1,
        temporada_ano: year,
        temporada_pontos: summary.points,
        temporada_pontos_max: summary.maxPoints,
        temporada_faixa: faixa,
        temporada_detalhes: snapshotMissions(missions),
      })
      .select()
      .single();
    if (error) {
      console.error("Erro ao fechar temporada:", error);
      return null;
    }
    const temporada = data as DbTemporada;
    setTemporadas((prev) => [...prev, temporada]);
    return { temporada };
  }, [user, closedSeason, missions, month1, year]);

  const reopenSeason = useCallback(async () => {
    if (!closedSeason) return;
    setTemporadas((prev) => prev.filter((t) => t.temporada_id !== closedSeason.temporada_id));
    const { error } = await supabase
      .from("temporadas")
      .delete()
      .eq("temporada_id", closedSeason.temporada_id);
    if (error) {
      console.error("Erro ao reabrir temporada:", error);
      refetch();
    }
  }, [closedSeason, refetch]);

  /* ---------- Fechamento retroativo ---------- */

  const periodTransactions = useCallback(
    (m1: number, y: number) =>
      transactions.filter((tx) => {
        if (!tx.date) return false;
        const p = getTransactionPeriod(tx.date, cutoffDay);
        return p.year === y && p.month === m1;
      }),
    [transactions, cutoffDay],
  );

  const pastOpenPeriods = useMemo(() => {
    const found = new Map<string, { month1: number; year: number }>();
    transactions.forEach((tx) => {
      if (!tx.date) return;
      const p = getTransactionPeriod(tx.date, cutoffDay);
      if (!isPeriodOver(p.month, p.year, cutoffDay)) return;
      found.set(`${p.year}-${p.month}`, { month1: p.month, year: p.year });
    });
    return [...found.values()]
      .filter(
        (p) => !temporadas.some((t) => t.temporada_mes === p.month1 && t.temporada_ano === p.year),
      )
      .sort((a, b) => (a.year !== b.year ? a.year - b.year : a.month1 - b.month1));
  }, [transactions, cutoffDay, temporadas]);

  const closePastSeasons = useCallback(async (): Promise<number> => {
    if (!user || pastOpenPeriods.length === 0) return 0;
    const rows = pastOpenPeriods.map((p) => {
      const prevMonth1 = p.month1 === 1 ? 12 : p.month1 - 1;
      const prevYear = p.month1 === 1 ? p.year - 1 : p.year;
      const auto = computeAutoMissions({
        month1: p.month1,
        year: p.year,
        cutoffDay,
        monthTransactions: periodTransactions(p.month1, p.year),
        previousMonthTransactions: periodTransactions(prevMonth1, prevYear),
        categories: dbCategories,
        goals: dbGoals,
      });
      const all = [...auto, ...mapManualMissions(missoes, p.month1, p.year)];
      const s = summarizeSeason(all);
      return {
        user_id: user.id,
        temporada_mes: p.month1,
        temporada_ano: p.year,
        temporada_pontos: s.points,
        temporada_pontos_max: s.maxPoints,
        temporada_faixa: s.faixa,
        temporada_detalhes: snapshotMissions(all),
      };
    });
    const { data, error } = await supabase.from("temporadas").insert(rows).select();
    if (error) {
      console.error("Erro ao fechar temporadas passadas:", error);
      return 0;
    }
    const inserted = (data as DbTemporada[]) ?? [];
    setTemporadas((prev) => [...prev, ...inserted]);
    return inserted.length;
  }, [user, pastOpenPeriods, cutoffDay, periodTransactions, dbCategories, dbGoals, missoes]);

  const value = useMemo<Gamification>(
    () => ({
      loading,
      month1,
      year,
      missions,
      autoMissions,
      manualMissions,
      season,
      closedSeason,
      temporadas,
      totalXp,
      level,
      streak,
      periodOver,
      periodCurrent,
      canClose,
      addMission,
      toggleMission,
      removeMission,
      closeSeason,
      reopenSeason,
      pastOpenPeriods,
      closePastSeasons,
      refetch,
    }),
    [
      loading,
      month1,
      year,
      missions,
      autoMissions,
      manualMissions,
      season,
      closedSeason,
      temporadas,
      totalXp,
      level,
      streak,
      periodOver,
      periodCurrent,
      canClose,
      addMission,
      toggleMission,
      removeMission,
      closeSeason,
      reopenSeason,
      pastOpenPeriods,
      closePastSeasons,
      refetch,
    ],
  );

  return <GamificationContext.Provider value={value}>{children}</GamificationContext.Provider>;
}

export function useGamification() {
  const ctx = useContext(GamificationContext);
  if (!ctx) throw new Error("useGamification deve ser usado dentro de <GamificationProvider>");
  return ctx;
}
