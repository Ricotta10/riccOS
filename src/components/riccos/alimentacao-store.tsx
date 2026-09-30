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
import { subDays } from "date-fns";
import { toast } from "sonner";

import { useAuth } from "@/lib/auth";
import {
  PROTOCOLO_WEBHOOK_URL,
  REFEICAO_WEBHOOK_URL,
  metasDoProtocolo,
  num,
  scaleItem,
  type DbMedida,
  type DbProtocolo,
  type DbRefeicao,
  type DbRefeicaoItem,
  type DbRelatorio,
  type Metas,
  type MotivoErro,
  type PlanoOpcao,
  type ProtocoloRespostas,
  type Qualidade,
} from "@/lib/alimentacao";
import { supabase } from "@/lib/supabase";

/** Histórico carregado no app (relatórios e missões usam no máximo ~90 dias). */
const HISTORY_DAYS = 180;
/** Depois disso uma refeição "processando" é considerada travada (mostra "tentar de novo"). */
export const STALE_PROCESSING_MS = 3 * 60 * 1000;

type MedidaInput = Omit<DbMedida, "medida_id" | "user_id" | "criado_em">;

type AlimentacaoStore = {
  loading: boolean;
  loaded: boolean;
  protocolos: DbProtocolo[];
  protocoloAtivo: DbProtocolo | null;
  /** Protocolo sendo gerado agora (se houver) */
  protocoloGerando: DbProtocolo | null;
  metas: Metas | null;
  refeicoes: DbRefeicao[];
  medidas: DbMedida[];
  relatorios: DbRelatorio[];
  registrarRefeicao: (texto: string, em: Date | null) => Promise<boolean>;
  checkin: (opcao: PlanoOpcao, refeicaoNome: string, em: Date) => Promise<boolean>;
  reprocessarRefeicao: (id: string) => Promise<boolean>;
  atualizarRefeicao: (
    id: string,
    patch: Partial<{
      refeicao_em: string;
      refeicao_descricao: string;
      refeicao_qualidade: Qualidade | null;
      refeicao_motivo_erro: MotivoErro | null;
    }>,
  ) => Promise<boolean>;
  removerRefeicao: (id: string) => Promise<boolean>;
  atualizarQuantidadeItem: (item: DbRefeicaoItem, quantidade: number) => Promise<boolean>;
  removerItem: (item: DbRefeicaoItem) => Promise<boolean>;
  salvarMedida: (m: MedidaInput) => Promise<boolean>;
  removerMedida: (id: string) => Promise<boolean>;
  gerarProtocolo: (respostas: ProtocoloRespostas) => Promise<boolean>;
  refetch: () => Promise<void>;
};

const Ctx = createContext<AlimentacaoStore | null>(null);

async function persist(action: string, request: PromiseLike<{ error: unknown }>) {
  try {
    const { error } = await request;
    if (!error) return true;
    console.error(`Erro ao ${action}:`, error);
  } catch (err) {
    console.error(`Erro ao ${action}:`, err);
  }
  toast.error(`Não foi possível ${action}.`, {
    description: "Verifique sua conexão e tente de novo.",
  });
  return false;
}

/** Marca uma refeição como erro quando o n8n não conseguiu processar. */
function marcarErroRefeicao(id: string, mensagem: string) {
  return supabase
    .from("refeicoes")
    .update({ refeicao_status: "erro", refeicao_erro: mensagem })
    .eq("refeicao_id", id)
    .eq("refeicao_status", "processando");
}

/** Dispara o workflow do n8n. Não bloqueia a tela: o resultado chega pelo polling. */
function callWebhook(url: string, body: Record<string, unknown>) {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
    .then((res) => res.ok)
    .catch((err) => {
      console.error("[alimentação] falha ao chamar o n8n:", err);
      return false;
    });
}

function normalizeRefeicao(r: DbRefeicao): DbRefeicao {
  return {
    ...r,
    refeicao_kcal: num(r.refeicao_kcal),
    refeicao_proteina_g: num(r.refeicao_proteina_g),
    refeicao_carbo_g: num(r.refeicao_carbo_g),
    refeicao_gordura_g: num(r.refeicao_gordura_g),
    refeicao_itens: (r.refeicao_itens ?? [])
      .map((i) => ({
        ...i,
        item_quantidade: num(i.item_quantidade),
        item_gramas: i.item_gramas == null ? null : num(i.item_gramas),
        item_kcal: num(i.item_kcal),
        item_proteina_g: num(i.item_proteina_g),
        item_carbo_g: num(i.item_carbo_g),
        item_gordura_g: num(i.item_gordura_g),
      }))
      .sort((a, b) => a.item_ordem - b.item_ordem),
  };
}

function normalizeMedida(m: DbMedida): DbMedida {
  const out = { ...m } as Record<string, unknown>;
  for (const [k, v] of Object.entries(m)) {
    if (
      k.startsWith("medida_") &&
      k !== "medida_data" &&
      k !== "medida_observacao" &&
      k !== "medida_id"
    ) {
      out[k] = v == null ? null : num(v);
    }
  }
  return out as unknown as DbMedida;
}

export function AlimentacaoProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [protocolos, setProtocolos] = useState<DbProtocolo[]>([]);
  const [refeicoes, setRefeicoes] = useState<DbRefeicao[]>([]);
  const [medidas, setMedidas] = useState<DbMedida[]>([]);
  const [relatorios, setRelatorios] = useState<DbRelatorio[]>([]);

  const refetch = useCallback(async () => {
    if (!user) {
      setProtocolos([]);
      setRefeicoes([]);
      setMedidas([]);
      setRelatorios([]);
      return;
    }
    setLoading(true);
    try {
      const desde = subDays(new Date(), HISTORY_DAYS).toISOString();
      const [p, r, m, rel] = await Promise.all([
        supabase
          .from("alimentacao_protocolos")
          .select("*")
          .eq("user_id", user.id)
          .order("criado_em", { ascending: false }),
        supabase
          .from("refeicoes")
          .select("*, refeicao_itens(*)")
          .eq("user_id", user.id)
          .gte("refeicao_em", desde)
          .order("refeicao_em", { ascending: false }),
        supabase
          .from("medidas_corporais")
          .select("*")
          .eq("user_id", user.id)
          .order("medida_data", { ascending: false }),
        supabase
          .from("alimentacao_relatorios")
          .select("*")
          .eq("user_id", user.id)
          .order("relatorio_semana_inicio", { ascending: false })
          .limit(12),
      ]);
      if (p.error) console.error("Erro ao buscar protocolos:", p.error);
      if (r.error) console.error("Erro ao buscar refeições:", r.error);
      if (m.error) console.error("Erro ao buscar medidas:", m.error);
      if (rel.error) console.error("Erro ao buscar relatórios:", rel.error);
      if (!p.error) setProtocolos((p.data as DbProtocolo[]) ?? []);
      if (!r.error) setRefeicoes(((r.data as DbRefeicao[]) ?? []).map(normalizeRefeicao));
      if (!m.error) setMedidas(((m.data as DbMedida[]) ?? []).map(normalizeMedida));
      if (!rel.error) setRelatorios((rel.data as DbRelatorio[]) ?? []);
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const protocoloAtivo = useMemo(
    () => protocolos.find((p) => p.protocolo_status === "ativo") ?? null,
    [protocolos],
  );
  const protocoloGerando = useMemo(
    () =>
      protocolos.find(
        (p) =>
          p.protocolo_status === "gerando" &&
          Date.now() - new Date(p.criado_em).getTime() < 15 * 60 * 1000,
      ) ?? null,
    [protocolos],
  );
  const metas = useMemo(() => metasDoProtocolo(protocoloAtivo), [protocoloAtivo]);

  /* ---------- Polling enquanto a IA trabalha ---------- */

  const hasPending = useMemo(
    () =>
      !!protocoloGerando ||
      refeicoes.some(
        (r) =>
          r.refeicao_status === "processando" &&
          Date.now() - new Date(r.criado_em).getTime() < STALE_PROCESSING_MS,
      ),
    [protocoloGerando, refeicoes],
  );

  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  useEffect(() => {
    if (!hasPending) return;
    const id = setInterval(() => void refetchRef.current(), 4000);
    return () => clearInterval(id);
  }, [hasPending]);

  // Refeições que chegam pela voz (Central) aparecem ao voltar para o app.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void refetchRef.current();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  /* ---------- Refeições ---------- */

  const registrarRefeicao = useCallback<AlimentacaoStore["registrarRefeicao"]>(
    async (texto, em) => {
      if (!user) return false;
      const { data, error } = await supabase
        .from("refeicoes")
        .insert({
          user_id: user.id,
          refeicao_texto: texto.trim(),
          refeicao_origem: "texto",
          refeicao_status: "processando",
          refeicao_em: (em ?? new Date()).toISOString(),
          refeicao_hora_definida: em !== null,
          protocolo_id: protocoloAtivo?.protocolo_id ?? null,
        })
        .select("*, refeicao_itens(*)")
        .single();
      if (error || !data) {
        console.error("Erro ao registrar refeição:", error);
        toast.error("Não foi possível registrar a refeição.", {
          description: "Verifique sua conexão e tente de novo.",
        });
        return false;
      }
      const row = normalizeRefeicao(data as DbRefeicao);
      setRefeicoes((prev) => [row, ...prev]);
      void callWebhook(REFEICAO_WEBHOOK_URL, { refeicao_id: row.refeicao_id }).then(async (ok) => {
        if (!ok) {
          await marcarErroRefeicao(row.refeicao_id, "A IA não respondeu.");
          toast.error("A IA não respondeu agora.", {
            description: "O texto ficou salvo — toque em “tentar de novo” no card.",
          });
        }
        void refetchRef.current();
      });
      return true;
    },
    [user, protocoloAtivo],
  );

  const reprocessarRefeicao = useCallback(async (id: string) => {
    const ok = await persist(
      "reenviar a refeição",
      supabase
        .from("refeicoes")
        .update({
          refeicao_status: "processando",
          refeicao_erro: null,
          criado_em: new Date().toISOString(),
        })
        .eq("refeicao_id", id),
    );
    if (!ok) return false;
    setRefeicoes((prev) =>
      prev.map((r) =>
        r.refeicao_id === id
          ? { ...r, refeicao_status: "processando", criado_em: new Date().toISOString() }
          : r,
      ),
    );
    void callWebhook(REFEICAO_WEBHOOK_URL, { refeicao_id: id }).then(async (ok) => {
      if (!ok) {
        await marcarErroRefeicao(id, "A IA não respondeu.");
        toast.error("A IA não respondeu de novo.", {
          description: "Tente mais tarde ou apague e registre outra vez.",
        });
      }
      void refetchRef.current();
    });
    return true;
  }, []);

  const checkin = useCallback<AlimentacaoStore["checkin"]>(
    async (opcao, refeicaoNome, em) => {
      if (!user) return false;
      const refeicaoId = crypto.randomUUID();
      const ok = await persist(
        "registrar o check-in",
        supabase.from("refeicoes").insert({
          refeicao_id: refeicaoId,
          user_id: user.id,
          refeicao_texto: `${refeicaoNome}: ${opcao.nome}`,
          refeicao_descricao: opcao.nome,
          refeicao_origem: "checkin",
          refeicao_status: "ok",
          refeicao_em: em.toISOString(),
          refeicao_hora_definida: true,
          refeicao_qualidade: "boa",
          refeicao_qualidade_motivo: "Refeição do cardápio do protocolo.",
          protocolo_id: protocoloAtivo?.protocolo_id ?? null,
        }),
      );
      if (!ok) return false;
      if (opcao.itens.length > 0) {
        const itensOk = await persist(
          "salvar os itens do check-in",
          supabase.from("refeicao_itens").insert(
            opcao.itens.map((it, i) => ({
              refeicao_id: refeicaoId,
              user_id: user.id,
              item_nome: it.nome,
              item_quantidade: num(it.quantidade) || 1,
              item_unidade: it.unidade || "un",
              item_gramas: it.gramas ?? null,
              item_kcal: num(it.kcal),
              item_proteina_g: num(it.proteina_g),
              item_carbo_g: num(it.carbo_g),
              item_gordura_g: num(it.gordura_g),
              item_ordem: i,
            })),
          ),
        );
        if (!itensOk) {
          await supabase.from("refeicoes").delete().eq("refeicao_id", refeicaoId);
          return false;
        }
      }
      await refetch();
      return true;
    },
    [user, protocoloAtivo, refetch],
  );

  const atualizarRefeicao = useCallback<AlimentacaoStore["atualizarRefeicao"]>(
    async (id, patch) => {
      const snapshot = refeicoes;
      setRefeicoes((prev) => prev.map((r) => (r.refeicao_id === id ? { ...r, ...patch } : r)));
      const dbPatch: Record<string, unknown> = { ...patch };
      if (patch.refeicao_em) dbPatch["refeicao_hora_definida"] = true;
      const ok = await persist(
        "atualizar a refeição",
        supabase.from("refeicoes").update(dbPatch).eq("refeicao_id", id),
      );
      if (!ok) setRefeicoes(snapshot);
      return ok;
    },
    [refeicoes],
  );

  const removerRefeicao = useCallback(
    async (id: string) => {
      const snapshot = refeicoes;
      setRefeicoes((prev) => prev.filter((r) => r.refeicao_id !== id));
      const ok = await persist(
        "excluir a refeição",
        supabase.from("refeicoes").delete().eq("refeicao_id", id),
      );
      if (!ok) setRefeicoes(snapshot);
      return ok;
    },
    [refeicoes],
  );

  const atualizarQuantidadeItem = useCallback(
    async (item: DbRefeicaoItem, quantidade: number) => {
      const scaled = scaleItem(item, quantidade);
      const ok = await persist(
        "atualizar o item",
        supabase
          .from("refeicao_itens")
          .update({
            item_quantidade: scaled.item_quantidade,
            item_gramas: scaled.item_gramas,
            item_kcal: scaled.item_kcal,
            item_proteina_g: scaled.item_proteina_g,
            item_carbo_g: scaled.item_carbo_g,
            item_gordura_g: scaled.item_gordura_g,
          })
          .eq("item_id", item.item_id),
      );
      if (ok) await refetch();
      return ok;
    },
    [refetch],
  );

  const removerItem = useCallback(
    async (item: DbRefeicaoItem) => {
      const ok = await persist(
        "remover o item",
        supabase.from("refeicao_itens").delete().eq("item_id", item.item_id),
      );
      if (ok) await refetch();
      return ok;
    },
    [refetch],
  );

  /* ---------- Medidas ---------- */

  const salvarMedida = useCallback(
    async (m: MedidaInput) => {
      if (!user) return false;
      const ok = await persist(
        "salvar a medição",
        supabase.from("medidas_corporais").insert({ ...m, user_id: user.id }),
      );
      if (ok) await refetch();
      return ok;
    },
    [user, refetch],
  );

  const removerMedida = useCallback(async (id: string) => {
    const ok = await persist(
      "excluir a medição",
      supabase.from("medidas_corporais").delete().eq("medida_id", id),
    );
    if (ok) setMedidas((prev) => prev.filter((m) => m.medida_id !== id));
    return ok;
  }, []);

  /* ---------- Protocolo ---------- */

  const gerarProtocolo = useCallback(
    async (respostas: ProtocoloRespostas) => {
      if (!user) return false;
      const { data, error } = await supabase
        .from("alimentacao_protocolos")
        .insert({ user_id: user.id, protocolo_status: "gerando", protocolo_respostas: respostas })
        .select()
        .single();
      if (error || !data) {
        console.error("Erro ao criar protocolo:", error);
        toast.error("Não foi possível enviar o formulário.", {
          description: "Verifique sua conexão e tente de novo.",
        });
        return false;
      }
      const row = data as DbProtocolo;
      setProtocolos((prev) => [row, ...prev]);

      // A pesagem do formulário também entra no histórico do Corpo.
      const d = respostas.dados;
      if (d.peso_kg || d.bf_pct || d.massa_muscular_kg || d.cintura_cm) {
        await supabase.from("medidas_corporais").insert({
          user_id: user.id,
          medida_peso_kg: d.peso_kg,
          medida_bf_pct: d.bf_pct,
          medida_massa_muscular_kg: d.massa_muscular_kg,
          medida_cintura_cm: d.cintura_cm,
          medida_observacao: "Registrada no formulário do protocolo",
        });
      }

      void callWebhook(PROTOCOLO_WEBHOOK_URL, { protocolo_id: row.protocolo_id }).then((ok) => {
        if (!ok) {
          toast.error("O agente não respondeu agora.", {
            description: "Suas respostas ficaram salvas. Tente gerar de novo em alguns minutos.",
          });
          void supabase
            .from("alimentacao_protocolos")
            .update({ protocolo_status: "erro", protocolo_erro: "O n8n não respondeu." })
            .eq("protocolo_id", row.protocolo_id)
            .then(() => refetchRef.current());
        } else {
          void refetchRef.current();
        }
      });
      return true;
    },
    [user],
  );

  const value = useMemo<AlimentacaoStore>(
    () => ({
      loading,
      loaded,
      protocolos,
      protocoloAtivo,
      protocoloGerando,
      metas,
      refeicoes,
      medidas,
      relatorios,
      registrarRefeicao,
      checkin,
      reprocessarRefeicao,
      atualizarRefeicao,
      removerRefeicao,
      atualizarQuantidadeItem,
      removerItem,
      salvarMedida,
      removerMedida,
      gerarProtocolo,
      refetch,
    }),
    [
      loading,
      loaded,
      protocolos,
      protocoloAtivo,
      protocoloGerando,
      metas,
      refeicoes,
      medidas,
      relatorios,
      registrarRefeicao,
      checkin,
      reprocessarRefeicao,
      atualizarRefeicao,
      removerRefeicao,
      atualizarQuantidadeItem,
      removerItem,
      salvarMedida,
      removerMedida,
      gerarProtocolo,
      refetch,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAlimentacao() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAlimentacao deve ser usado dentro de <AlimentacaoProvider>");
  return ctx;
}
