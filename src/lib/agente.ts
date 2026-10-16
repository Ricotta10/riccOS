/* ============================================================
 * RiccOS · Agente — tipos e constantes do chat
 * A chamada à API da Claude acontece na Edge Function `agente-chat`;
 * aqui fica só o que o app precisa saber.
 * ========================================================== */

export type ModeloAgente = "claude-opus-5-5" | "claude-sonnet-5-5" | "claude-haiku-5-5";

export const MODELO_PADRAO: ModeloAgente = "claude-opus-5-5";

export const MODELOS: {
  id: ModeloAgente;
  nome: string;
  resumo: string;
  /** Custo por milhão de tokens, só para orientar a escolha */
  preco: string;
}[] = [
  {
    id: "claude-opus-5-5",
    nome: "Opus 5.5",
    resumo: "O mais capaz. Melhor para análise e conselho.",
    preco: "US$ 4 / 20 por M tokens",
  },
  {
    id: "claude-sonnet-5-5",
    nome: "Sonnet 5.5",
    resumo: "Equilíbrio entre qualidade e custo.",
    preco: "US$ 2 / 10 por M tokens",
  },
  {
    id: "claude-haiku-5-5",
    nome: "Haiku 5.5",
    resumo: "Rápido e barato, para perguntas diretas.",
    preco: "US$ 0,10 / 0,50 por M tokens",
  },
];

export function nomeDoModelo(id?: string | null) {
  return MODELOS.find((m) => m.id === id)?.nome ?? "Opus 5.5";
}

/** Linhas do Supabase */
export interface DbConversa {
  conversa_id: string;
  user_id?: string;
  conversa_titulo: string;
  conversa_modelo: ModeloAgente;
  conversa_arquivada: boolean;
  criado_em: string;
  atualizado_em: string;
}

export interface DbMensagem {
  mensagem_id: string;
  conversa_id: string;
  user_id?: string;
  mensagem_papel: "user" | "assistant";
  mensagem_conteudo: string;
  mensagem_modelo?: string | null;
  mensagem_tokens_entrada?: number | null;
  mensagem_tokens_saida?: number | null;
  criado_em: string;
}

/** Mensagem exibida na tela (pode ainda estar sendo escrita) */
export type MensagemNaTela = {
  id: string;
  papel: "user" | "assistant";
  conteudo: string;
  /** true enquanto o texto está chegando por streaming */
  escrevendo?: boolean;
  /** nome da consulta que o agente está rodando agora */
  consultando?: string | null;
};

/** Sugestões iniciais — conversa vazia precisa de um empurrão */
export const SUGESTOES = [
  "Qual é o meu custo fixo mensal?",
  "Onde eu mais erro? O que devo mudar?",
  "Quanto é razoável eu gastar por mês?",
  "Como foi meu mês comparado com os anteriores?",
];

/** Agrupa conversas por faixa de tempo, para a lista lateral */
export function agruparPorPeriodo(conversas: DbConversa[]) {
  const hoje = new Date();
  const inicioDoDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).getTime();
  const seteDias = inicioDoDia - 6 * 864e5;

  const grupos: { titulo: string; itens: DbConversa[] }[] = [
    { titulo: "Hoje", itens: [] },
    { titulo: "Últimos 7 dias", itens: [] },
    { titulo: "Antes", itens: [] },
  ];

  for (const c of conversas) {
    const t = new Date(c.atualizado_em).getTime();
    if (t >= inicioDoDia) grupos[0]!.itens.push(c);
    else if (t >= seteDias) grupos[1]!.itens.push(c);
    else grupos[2]!.itens.push(c);
  }

  return grupos.filter((g) => g.itens.length > 0);
}
