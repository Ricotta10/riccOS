import { useCallback, useEffect, useRef, useState } from "react";

import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import {
  MODELO_PADRAO,
  type DbConversa,
  type DbMensagem,
  type MensagemNaTela,
  type ModeloAgente,
} from "@/lib/agente";

/** Eventos que a Edge Function manda pelo SSE */
type EventoSSE = {
  type?: "start" | "text" | "tool" | "done" | "error";
  conversa_id?: string;
  value?: string;
  name?: string;
  message?: string;
};

const FUNCTION_URL = `${(import.meta.env["VITE_SUPABASE_URL"] as string | undefined)?.replace(/\/+$/, "")}/functions/v1/agente-chat`;

/**
 * Estado do chat do Agente.
 *
 * O envio vai para a Edge Function `agente-chat`, que responde em SSE:
 * o texto chega em pedaços e é montado na tela enquanto o modelo escreve.
 * A gravação no banco é feita pela própria função — aqui só lemos.
 */
export function useAgente() {
  const { user, profile } = useAuth();

  const [conversas, setConversas] = useState<DbConversa[]>([]);
  const [conversaId, setConversaId] = useState<string | null>(null);
  const [mensagens, setMensagens] = useState<MensagemNaTela[]>([]);
  const [modelo, setModelo] = useState<ModeloAgente>(MODELO_PADRAO);
  const [enviando, setEnviando] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  /* ---------- Lista de conversas ---------- */
  const carregarConversas = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("agente_conversas")
      .select("*")
      .eq("user_id", user.id)
      .eq("conversa_arquivada", false)
      .order("atualizado_em", { ascending: false })
      .limit(50);
    if (error) {
      console.error("[agente] erro ao listar conversas:", error);
      return;
    }
    setConversas((data as DbConversa[]) ?? []);
  }, [user]);

  useEffect(() => {
    void carregarConversas();
  }, [carregarConversas]);

  // Modelo preferido do usuário
  useEffect(() => {
    const preferido = profile?.user_modelo_agente as ModeloAgente | undefined;
    if (preferido) setModelo(preferido);
  }, [profile?.user_modelo_agente]);

  /* ---------- Abrir / criar conversa ---------- */
  const abrirConversa = useCallback(
    async (id: string) => {
      if (!user) return;
      setCarregando(true);
      setErro(null);
      setConversaId(id);
      const { data, error } = await supabase
        .from("agente_mensagens")
        .select("*")
        .eq("conversa_id", id)
        .order("criado_em", { ascending: true });
      setCarregando(false);
      if (error) {
        console.error("[agente] erro ao abrir conversa:", error);
        setErro("Não consegui carregar essa conversa.");
        return;
      }
      setMensagens(
        ((data as DbMensagem[]) ?? []).map((m) => ({
          id: m.mensagem_id,
          papel: m.mensagem_papel,
          conteudo: m.mensagem_conteudo,
        })),
      );
      const conversa = conversas.find((c) => c.conversa_id === id);
      if (conversa?.conversa_modelo) setModelo(conversa.conversa_modelo);
    },
    [user, conversas],
  );

  const novaConversa = useCallback(() => {
    setConversaId(null);
    setMensagens([]);
    setErro(null);
  }, []);

  /* ---------- Enviar mensagem (streaming) ---------- */
  const enviar = useCallback(
    async (texto: string) => {
      const mensagem = texto.trim();
      if (!mensagem || enviando) return;

      setErro(null);
      setEnviando(true);

      const idProvisorio = `tmp-${Date.now()}`;
      setMensagens((prev) => [
        ...prev,
        { id: idProvisorio, papel: "user", conteudo: mensagem },
        { id: `${idProvisorio}-resp`, papel: "assistant", conteudo: "", escrevendo: true },
      ]);

      const atualizaResposta = (fn: (m: MensagemNaTela) => MensagemNaTela) =>
        setMensagens((prev) => prev.map((m) => (m.id === `${idProvisorio}-resp` ? fn(m) : m)));

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) throw new Error("Sessão expirada. Entre de novo.");

        const resposta = await fetch(FUNCTION_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ mensagem, conversa_id: conversaId, modelo }),
          signal: controller.signal,
        });

        if (!resposta.ok || !resposta.body) {
          const detalhe = await resposta.text().catch(() => "");
          let msg = `Falha na resposta (${resposta.status}).`;
          try {
            const j = JSON.parse(detalhe);
            if (j.error) msg = j.error;
          } catch {
            /* corpo não era JSON */
          }
          throw new Error(msg);
        }

        const reader = resposta.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let idDaConversa = conversaId;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const partes = buffer.split("\n\n");
          buffer = partes.pop() ?? "";

          for (const parte of partes) {
            const linha = parte.trim();
            if (!linha.startsWith("data:")) continue;
            let evento: EventoSSE;
            try {
              evento = JSON.parse(linha.slice(5).trim());
            } catch {
              continue;
            }

            if (evento.type === "start") {
              idDaConversa = String(evento.conversa_id);
              if (!conversaId) setConversaId(idDaConversa);
            } else if (evento.type === "text") {
              atualizaResposta((m) => ({
                ...m,
                conteudo: m.conteudo + String(evento.value ?? ""),
                consultando: null,
              }));
            } else if (evento.type === "tool") {
              atualizaResposta((m) => ({ ...m, consultando: String(evento.name ?? "") }));
            } else if (evento.type === "error") {
              throw new Error(String(evento.message ?? "Erro no agente."));
            }
          }
        }

        atualizaResposta((m) => ({ ...m, escrevendo: false, consultando: null }));
        void carregarConversas();
      } catch (e) {
        const abortado = e instanceof DOMException && e.name === "AbortError";
        if (abortado) {
          atualizaResposta((m) => ({ ...m, escrevendo: false, consultando: null }));
        } else {
          const msg = e instanceof Error ? e.message : String(e);
          console.error("[agente] erro ao enviar:", e);
          setErro(msg);
          // tira o balão vazio da resposta que não veio
          setMensagens((prev) =>
            prev.filter((m) => !(m.id === `${idProvisorio}-resp` && !m.conteudo)),
          );
        }
      } finally {
        abortRef.current = null;
        setEnviando(false);
      }
    },
    [conversaId, modelo, enviando, carregarConversas],
  );

  const interromper = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  /* ---------- Modelo ---------- */
  const trocarModelo = useCallback(
    async (novo: ModeloAgente) => {
      setModelo(novo);
      if (!user) return;
      // guarda como preferência para as próximas conversas
      const { error } = await supabase
        .from("usuarios")
        .update({ user_modelo_agente: novo })
        .eq("user_id", user.id);
      if (error) console.error("[agente] erro ao salvar modelo:", error);
    },
    [user],
  );

  /* ---------- Excluir ---------- */
  const excluirConversa = useCallback(
    async (id: string) => {
      setConversas((prev) => prev.filter((c) => c.conversa_id !== id));
      if (conversaId === id) novaConversa();
      const { error } = await supabase.from("agente_conversas").delete().eq("conversa_id", id);
      if (error) {
        console.error("[agente] erro ao excluir conversa:", error);
        void carregarConversas();
      }
    },
    [conversaId, novaConversa, carregarConversas],
  );

  return {
    conversas,
    conversaId,
    mensagens,
    modelo,
    enviando,
    carregando,
    erro,
    enviar,
    interromper,
    abrirConversa,
    novaConversa,
    excluirConversa,
    trocarModelo,
    limparErro: () => setErro(null),
  };
}
