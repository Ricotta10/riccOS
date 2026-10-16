import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowUp,
  Check,
  ChevronDown,
  Cpu,
  Loader2,
  MessageSquarePlus,
  PanelRightOpen,
  Search,
  Square,
  Trash2,
} from "lucide-react";

import { useAgente } from "@/components/riccos/agente-store";
import { LogoMark } from "@/components/riccos/brand";
import { useAuth } from "@/lib/auth";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import {
  MODELOS,
  SUGESTOES,
  agruparPorPeriodo,
  nomeDoModelo,
  type DbConversa,
  type MensagemNaTela,
  type ModeloAgente,
} from "@/lib/agente";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/agente")({
  head: () => ({
    meta: [
      { title: "Agente — RiccOS" },
      {
        name: "description",
        content: "Converse com um assistente que conhece todos os seus dados no RiccOS.",
      },
    ],
  }),
  component: AgentePage,
});

/* ---------------------------------------------------------------
 * Texto da resposta: markdown leve (negrito, listas, parágrafos)
 * ------------------------------------------------------------- */
function Formatado({ texto }: { texto: string }) {
  const linhas = texto.split("\n");
  return (
    <div className="space-y-2">
      {linhas.map((linha, i) => {
        const limpa = linha.trim();
        if (!limpa) return null;

        const comNegrito = (s: string) =>
          s.split(/(\*\*[^*]+\*\*)/g).map((parte, j) =>
            parte.startsWith("**") && parte.endsWith("**") ? (
              <strong key={j} className="font-semibold">
                {parte.slice(2, -2)}
              </strong>
            ) : (
              <span key={j}>{parte}</span>
            ),
          );

        const lista = /^[-*•]\s+/.test(limpa);
        const numerada = /^\d+[.)]\s+/.test(limpa);

        if (lista || numerada) {
          return (
            <div key={i} className="flex gap-2 pl-1">
              <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-primary" />
              <p className="flex-1 text-sm leading-relaxed">
                {comNegrito(limpa.replace(/^([-*•]|\d+[.)])\s+/, ""))}
              </p>
            </div>
          );
        }

        if (/^#{1,3}\s+/.test(limpa)) {
          return (
            <p key={i} className="pt-1 text-sm font-semibold">
              {comNegrito(limpa.replace(/^#{1,3}\s+/, ""))}
            </p>
          );
        }

        return (
          <p key={i} className="text-sm leading-relaxed">
            {comNegrito(limpa)}
          </p>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------
 * Balão de mensagem
 * ------------------------------------------------------------- */
function Balao({ m }: { m: MensagemNaTela }) {
  if (m.papel === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-primary-foreground">
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{m.conteudo}</p>
        </div>
      </div>
    );
  }

  const vazio = !m.conteudo && m.escrevendo;

  return (
    <div className="flex gap-3">
      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl bg-brand-black text-brand-mint ring-1 ring-brand-snow/10">
        <LogoMark className="h-3.5" />
      </span>
      <div className="min-w-0 flex-1 pt-1">
        {m.consultando && (
          <p className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
            <Search className="size-3 animate-pulse" />
            consultando {m.consultando.replace(/_/g, " ")}…
          </p>
        )}
        {vazio ? (
          <span className="inline-flex gap-1 pt-1">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </span>
        ) : (
          <Formatado texto={m.conteudo} />
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
 * Lista de conversas
 * ------------------------------------------------------------- */
function ListaConversas({
  conversas,
  conversaId,
  onAbrir,
  onExcluir,
  onNova,
}: {
  conversas: DbConversa[];
  conversaId: string | null;
  onAbrir: (id: string) => void;
  onExcluir: (id: string) => void;
  onNova: () => void;
}) {
  const grupos = agruparPorPeriodo(conversas);

  return (
    <div className="flex h-full flex-col gap-3">
      <Button onClick={onNova} className="w-full justify-start gap-2">
        <MessageSquarePlus /> Nova conversa
      </Button>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
        {grupos.length === 0 && (
          <p className="px-1 pt-2 text-xs text-muted-foreground">Suas conversas aparecem aqui.</p>
        )}
        {grupos.map((grupo) => (
          <div key={grupo.titulo}>
            <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {grupo.titulo}
            </p>
            <div className="space-y-0.5">
              {grupo.itens.map((c) => {
                const ativa = c.conversa_id === conversaId;
                return (
                  <div
                    key={c.conversa_id}
                    className={cn(
                      "group flex items-center gap-1 rounded-xl pr-1 transition-colors",
                      ativa ? "bg-accent" : "hover:bg-accent/60",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => onAbrir(c.conversa_id)}
                      className="min-w-0 flex-1 px-2.5 py-2 text-left"
                    >
                      <span
                        className={cn(
                          "block truncate text-sm",
                          ativa ? "font-semibold text-accent-foreground" : "text-foreground",
                        )}
                      >
                        {c.conversa_titulo}
                      </span>
                    </button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Excluir conversa"
                      className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-danger group-hover:opacity-100 focus-visible:opacity-100"
                      onClick={() => onExcluir(c.conversa_id)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
 * Página
 * ------------------------------------------------------------- */
function AgentePage() {
  const { profile } = useAuth();
  const a = useAgente();
  const [rascunho, setRascunho] = useState("");
  const [listaAberta, setListaAberta] = useState(false);
  const fimRef = useRef<HTMLDivElement>(null);
  const campoRef = useRef<HTMLTextAreaElement>(null);

  const primeiroNome = profile?.user_nome?.split(" ")[0] ?? "você";
  const vazia = a.mensagens.length === 0;

  // Rola para o fim quando chega texto novo
  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [a.mensagens]);

  // Campo cresce com o texto
  useEffect(() => {
    const el = campoRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [rascunho]);

  const enviar = () => {
    const texto = rascunho.trim();
    if (!texto || a.enviando) return;
    setRascunho("");
    void a.enviar(texto);
  };

  const abrir = (id: string) => {
    setListaAberta(false);
    void a.abrirConversa(id);
  };

  return (
    <div className="mx-auto flex h-[calc(100dvh-10.5rem)] max-w-6xl gap-6 md:h-[calc(100dvh-7rem)]">
      {/* ---------- Conversas (desktop) ---------- */}
      <aside className="hidden w-64 shrink-0 lg:block">
        <ListaConversas
          conversas={a.conversas}
          conversaId={a.conversaId}
          onAbrir={abrir}
          onExcluir={a.excluirConversa}
          onNova={a.novaConversa}
        />
      </aside>

      {/* ---------- Conversa ---------- */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Cabeçalho */}
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            {/* Lista em drawer no mobile */}
            <Sheet open={listaAberta} onOpenChange={setListaAberta}>
              <SheetTrigger asChild>
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="Conversas"
                  className="lg:hidden"
                >
                  <PanelRightOpen />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[85vw] max-w-xs p-4">
                <SheetHeader className="mb-3">
                  <SheetTitle>Conversas</SheetTitle>
                </SheetHeader>
                <div className="h-[calc(100dvh-7rem)]">
                  <ListaConversas
                    conversas={a.conversas}
                    conversaId={a.conversaId}
                    onAbrir={abrir}
                    onExcluir={a.excluirConversa}
                    onNova={() => {
                      setListaAberta(false);
                      a.novaConversa();
                    }}
                  />
                </div>
              </SheetContent>
            </Sheet>

            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold tracking-tight">Agente</h1>
              <p className="truncate text-xs text-muted-foreground">
                Conhece seus números, suas metas e sua rotina
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            {/* Seletor de modelo */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Cpu className="text-muted-foreground" />
                  <span className="hidden sm:inline">{nomeDoModelo(a.modelo)}</span>
                  <ChevronDown className="size-3.5 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Modelo da Claude
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {MODELOS.map((m) => (
                  <DropdownMenuItem
                    key={m.id}
                    onClick={() => void a.trocarModelo(m.id as ModeloAgente)}
                    className="flex-col items-start gap-0.5 py-2"
                  >
                    <span className="flex w-full items-center justify-between gap-2">
                      <span className="font-semibold">{m.nome}</span>
                      {a.modelo === m.id && <Check className="size-4 text-primary" />}
                    </span>
                    <span className="text-xs text-muted-foreground">{m.resumo}</span>
                    <span className="text-[10px] tabular-nums text-muted-foreground/70">
                      {m.preco}
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Nova conversa"
              onClick={a.novaConversa}
            >
              <MessageSquarePlus />
            </Button>
          </div>
        </div>

        {/* Mensagens */}
        <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border bg-card p-4 sm:p-5">
          {a.carregando ? (
            <div className="grid h-full place-items-center">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : vazia ? (
            <div className="grid h-full place-items-center">
              <div className="max-w-md text-center">
                <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-brand-black text-brand-mint shadow-soft ring-1 ring-brand-snow/10">
                  <LogoMark className="h-6" />
                </span>
                <h2 className="mt-4 text-lg font-semibold tracking-tight">
                  Pode perguntar, {primeiroNome}.
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Eu enxergo seus lançamentos, metas, reserva e rotina. Pergunte como se estivesse
                  falando com alguém que acompanha tudo de perto.
                </p>
                <div className="mt-5 grid gap-2">
                  {SUGESTOES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => void a.enviar(s)}
                      className="rounded-xl border bg-background/60 px-3.5 py-2.5 text-left text-sm transition-colors hover:border-ring/50 hover:bg-accent"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {a.mensagens.map((m) => (
                <Balao key={m.id} m={m} />
              ))}
              <div ref={fimRef} />
            </div>
          )}
        </div>

        {a.erro && (
          <Alert variant="destructive" className="mt-3 py-2.5 text-xs">
            <AlertCircle className="size-4" />
            <AlertTitle className="font-semibold">Não deu certo</AlertTitle>
            <AlertDescription>{a.erro}</AlertDescription>
          </Alert>
        )}

        {/* Campo */}
        <div className="mt-3">
          <div className="flex items-end gap-2 rounded-2xl border bg-card p-2 transition-colors focus-within:border-ring">
            <Textarea
              ref={campoRef}
              rows={1}
              value={rascunho}
              onChange={(e) => setRascunho(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  enviar();
                }
              }}
              placeholder="Pergunte alguma coisa…"
              className="max-h-40 min-h-0 flex-1 resize-none border-0 bg-transparent px-2 py-1.5 text-sm shadow-none focus-visible:ring-0"
            />
            {a.enviando ? (
              <Button
                size="icon"
                variant="outline"
                onClick={a.interromper}
                aria-label="Parar resposta"
              >
                <Square className="size-3.5 fill-current" />
              </Button>
            ) : (
              <Button size="icon" onClick={enviar} disabled={!rascunho.trim()} aria-label="Enviar">
                <ArrowUp />
              </Button>
            )}
          </div>
          <p className="mt-1.5 px-1 text-[10px] text-muted-foreground">
            Pode errar. Confira os números antes de decidir algo grande.
          </p>
        </div>
      </div>
    </div>
  );
}
