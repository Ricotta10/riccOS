import type { Plano, PlanoItem } from "./alimentacao";

/* ============================================================
 * RiccOS · Lista de compras semanal (pura)
 *
 * Sai do cardápio do protocolo: para cada refeição do dia, considera que as opções
 * se revezam ao longo da semana (cada opção entra em dias/nº de opções). Soma os itens
 * iguais, converte o peso de pronto para o de compra (arroz cozido → arroz cru) e agrupa
 * por seção do mercado.
 * ============================================================ */

export type Secao =
  "proteinas" | "hortifruti" | "laticinios" | "mercearia" | "padaria" | "suplementos" | "outros";

export const SECAO_LABEL: Record<Secao, string> = {
  proteinas: "Carnes, ovos e peixes",
  hortifruti: "Hortifrúti",
  laticinios: "Laticínios",
  mercearia: "Mercearia",
  padaria: "Padaria",
  suplementos: "Suplementos",
  outros: "Outros",
};

export const SECAO_ORDER: Secao[] = [
  "hortifruti",
  "proteinas",
  "laticinios",
  "mercearia",
  "padaria",
  "suplementos",
  "outros",
];

export interface ItemCompra {
  key: string;
  nome: string;
  secao: Secao;
  /** Quantidade para comprar, já formatada ("1,2 kg", "14 ovos", "2 L") */
  quantidade: string;
  /** Em quantas refeições da semana o item aparece */
  vezes: number;
}

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/** Palavras de preparo que não mudam o que se compra. */
const PREPARO =
  /\b(cozid[oa]s?|grelhad[oa]s?|assad[oa]s?|refogad[oa]s?|mexid[oa]s?|cozid[oa]s? no vapor|no vapor|frit[oa]s?|picad[oa]s?|em cubos|em rodelas|desfiad[oa]s?|amassad[oa]s?|fatiad[oa]s?|ralad[oa]s?|temperad[oa]s?|caseir[oa]s?|light|natural)\b/g;

const COZIDO = /\b(cozid[oa]s?|grelhad[oa]s?|assad[oa]s?|refogad[oa]s?|desfiad[oa]s?|no vapor)\b/;

/**
 * Fator peso pronto → peso de compra. Grãos e massas incham ao cozinhar (compra-se menos);
 * carnes perdem água (compra-se mais).
 */
const FATOR_COZIDO: { re: RegExp; fator: number }[] = [
  { re: /\barroz\b/, fator: 0.4 },
  { re: /\b(feijao|lentilha|grao de bico|ervilha seca)\b/, fator: 0.45 },
  { re: /\b(macarrao|massa|espaguete|penne|talharim)\b/, fator: 0.45 },
  { re: /\bquinoa\b/, fator: 0.35 },
  {
    re: /\b(frango|peito|file|carne|patinho|alcatra|coxao|musculo|acem|patinho moido|carne moida|porco|lombo|peixe|tilapia|salmao|merluza)\b/,
    fator: 1.3,
  },
];

const SECOES: { secao: Secao; re: RegExp }[] = [
  { secao: "suplementos", re: /\b(whey|creatina|albumina|hipercalorico|multivitaminico|omega)\b/ },
  {
    secao: "proteinas",
    re: /\b(frango|peito|file|carne|patinho|alcatra|coxao|musculo|acem|moida|porco|lombo|peixe|tilapia|salmao|merluza|atum|sardinha|camarao|ovos?|clara|presunto|peito de peru|linguica|hamburguer)\b/,
  },
  {
    secao: "laticinios",
    re: /\b(leite|iogurte|queijo|requeijao|manteiga|cottage|ricota|coalhada|kefir|creme de leite|mussarela|muçarela)\b/,
  },
  {
    secao: "padaria",
    re: /\b(pao|paes|torrada|wrap|rap10|bisnaguinha|tapioca|cuscuz|bolo)\b/,
  },
  {
    secao: "hortifruti",
    re: /\b(banana|maca|mamao|laranja|morango|fruta|frutas|melancia|melao|abacaxi|manga|pera|uva|kiwi|limao|abacate|alface|rucula|tomate|cenoura|brocolis|couve|couve-flor|espinafre|repolho|abobrinha|abobora|berinjela|pepino|beterraba|chuchu|vagem|batata|batata doce|mandioca|aipim|inhame|cebola|alho|pimentao|salada|legumes?|verduras?|cheiro verde)\b/,
  },
  {
    secao: "mercearia",
    re: /\b(arroz|feijao|lentilha|grao de bico|macarrao|massa|aveia|granola|farinha|quinoa|azeite|oleo|pasta de amendoim|amendoim|castanha|nozes|amendoas|mel|chia|linhaca|cafe|cha|acucar|adocante|molho|atum em lata|milho|ervilha|sal|tempero|cacau|chocolate|biscoito|barra de cereal)\b/,
  },
];

function secaoDe(nomeNorm: string): Secao {
  return SECOES.find((s) => s.re.test(nomeNorm))?.secao ?? "outros";
}

function fatorCompra(nomeNorm: string) {
  if (!COZIDO.test(nomeNorm)) return 1;
  return FATOR_COZIDO.find((f) => f.re.test(nomeNorm))?.fator ?? 1;
}

const LIQUIDO = /\b(leite|suco|agua de coco|kefir|iogurte liquido|bebida|azeite|oleo)\b/;

function limparNome(nome: string) {
  const semPreparo = nome
    .replace(
      /\b(cozid[oa]s?|grelhad[oa]s?|assad[oa]s?|refogad[oa]s?|mexid[oa]s?|no vapor|frit[oa]s?|picad[oa]s?|em cubos|em rodelas|desfiad[oa]s?|amassad[oa]s?|fatiad[oa]s?|ralad[oa]s?|temperad[oa]s?)\b/gi,
      "",
    )
    .replace(/\s+/g, " ")
    .replace(/\s+([,.])/g, "$1")
    .trim();
  return semPreparo.charAt(0).toUpperCase() + semPreparo.slice(1);
}

function singular(nomeNorm: string) {
  return nomeNorm.replace(/\bovos\b/, "ovo").replace(/\bpaes\b/, "pao");
}

const fmt = (v: number, d = 1) => v.toLocaleString("pt-BR", { maximumFractionDigits: d });

/** Arredonda para cima em passos "de mercado". */
function arredondarPeso(g: number) {
  if (g < 100) return Math.ceil(g / 10) * 10;
  if (g < 1000) return Math.ceil(g / 50) * 50;
  return Math.ceil(g / 100) * 100;
}

function formatarPeso(g: number, liquido: boolean) {
  const v = arredondarPeso(g);
  if (liquido) return v >= 1000 ? `${fmt(v / 1000)} L` : `${v} ml`;
  return v >= 1000 ? `${fmt(v / 1000)} kg` : `${v} g`;
}

interface Acumulado {
  nome: string;
  nomeNorm: string;
  gramas: number;
  unidades: number;
  unidadeLabel: string | null;
  liquido: boolean;
  vezes: number;
}

/**
 * Monta a lista de compras para `dias` dias a partir do cardápio.
 * Cada refeição acontece uma vez por dia e as opções dela se revezam igualmente.
 */
export function buildShoppingList(plano: Plano | null | undefined, dias = 7): ItemCompra[] {
  const cardapio = plano?.cardapio ?? [];
  const acc = new Map<string, Acumulado>();

  for (const grupo of cardapio) {
    const opcoes = grupo.opcoes.filter((o) => o.itens.length > 0);
    if (opcoes.length === 0) continue;
    const vezesPorOpcao = dias / opcoes.length;

    for (const opcao of opcoes) {
      for (const item of opcao.itens as PlanoItem[]) {
        const nomeNorm = norm(item.nome);
        const key = singular(nomeNorm.replace(PREPARO, "").replace(/\s+/g, " ").trim()) || nomeNorm;
        const unidade = norm(item.unidade || "un");
        const liquido = unidade === "ml" || LIQUIDO.test(nomeNorm);
        const fator = fatorCompra(nomeNorm);

        const cur =
          acc.get(key) ??
          ({
            nome: limparNome(item.nome),
            nomeNorm: key,
            gramas: 0,
            unidades: 0,
            unidadeLabel: null,
            liquido,
            vezes: 0,
          } satisfies Acumulado);

        const qtd = Number(item.quantidade) || 0;
        const gramas = Number(item.gramas) || (unidade === "g" || unidade === "ml" ? qtd : 0);
        // Ovos e unidades inteiras (banana, pão) são comprados por unidade; o resto por peso.
        const porUnidade =
          unidade === "un" &&
          (/\b(ovo|banana|pao|maca|laranja|pera|kiwi|wrap|rap10|bisnaguinha)\b/.test(key) ||
            !gramas);
        if (porUnidade) {
          cur.unidades += qtd * vezesPorOpcao;
          cur.unidadeLabel = "un";
        } else if (gramas > 0) {
          cur.gramas += gramas * fator * vezesPorOpcao;
        } else if (qtd > 0) {
          // Sem peso (ex.: "1 fatia", "2 colheres"): mantém a unidade informada.
          cur.unidades += qtd * vezesPorOpcao;
          cur.unidadeLabel = item.unidade || "un";
        }
        cur.vezes += vezesPorOpcao;
        acc.set(key, cur);
      }
    }
  }

  return [...acc.entries()]
    .map(([key, a]) => {
      const partes: string[] = [];
      if (a.gramas > 0) partes.push(formatarPeso(a.gramas, a.liquido));
      if (a.unidades > 0) {
        const n = Math.ceil(a.unidades - 0.01);
        if (/\bovo\b/.test(a.nomeNorm)) {
          partes.push(
            n >= 12
              ? `${n} ovos (${fmt(Math.ceil(n / 6) / 2)} dúzia${n > 12 ? "s" : ""})`
              : `${n} ovos`,
          );
        } else {
          partes.push(
            `${n} ${a.unidadeLabel === "un" ? (n === 1 ? "unidade" : "unidades") : a.unidadeLabel}`,
          );
        }
      }
      return {
        key,
        nome: a.nome,
        secao: secaoDe(a.nomeNorm),
        quantidade: partes.join(" + ") || "a gosto",
        vezes: Math.round(a.vezes),
      };
    })
    .sort((x, y) => x.nome.localeCompare(y.nome, "pt-BR"));
}

/** Texto simples para colar no WhatsApp / Notas. */
export function shoppingListText(itens: ItemCompra[], dias: number, marcados: Set<string>) {
  const linhas = [`🛒 Lista de compras · ${dias} dias`];
  for (const secao of SECAO_ORDER) {
    const doGrupo = itens.filter((i) => i.secao === secao);
    if (doGrupo.length === 0) continue;
    linhas.push("", `*${SECAO_LABEL[secao]}*`);
    for (const i of doGrupo)
      linhas.push(`${marcados.has(i.key) ? "✅" : "▫️"} ${i.nome} — ${i.quantidade}`);
  }
  return linhas.join("\n");
}
