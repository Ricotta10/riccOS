import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Check, Copy, RotateCcw, ShoppingCart } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/riccos/app-shell";
import { useAlimentacao } from "@/components/riccos/alimentacao-store";
import { NoProtocolCard } from "@/components/riccos/alimentacao-widgets";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { localDateKey, weekStart } from "@/lib/alimentacao";
import { SECAO_LABEL, SECAO_ORDER, buildShoppingList, shoppingListText } from "@/lib/compras";
import { formatDate } from "@/lib/finance-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/alimentacao/compras")({
  head: () => ({
    meta: [
      { title: "Lista de compras — RiccOS" },
      {
        name: "description",
        content: "Lista de compras da semana gerada a partir do cardápio do protocolo alimentar.",
      },
    ],
  }),
  component: ComprasPage,
});

const DIAS_OPCOES = [5, 6, 7] as const;

/** Marcações e preferências ficam no aparelho e zeram a cada semana (segunda-feira). */
function storageKey(protocoloId: string, semana: string) {
  return `riccos_compras_${protocoloId}_${semana}`;
}

function loadState(key: string): { dias: number; marcados: string[] } | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as { dias: number; marcados: string[] }) : null;
  } catch {
    return null;
  }
}

function ComprasPage() {
  const { protocoloAtivo, loaded } = useAlimentacao();
  const semana = weekStart(localDateKey(new Date()));
  const key = protocoloAtivo ? storageKey(protocoloAtivo.protocolo_id, semana) : null;

  const [dias, setDias] = useState(7);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [hydratedKey, setHydratedKey] = useState<string | null>(null);

  // Carrega o estado salvo quando o protocolo/semana ficam conhecidos.
  useEffect(() => {
    if (!key) return;
    const saved = loadState(key);
    setDias(saved?.dias ?? 7);
    setMarcados(new Set(saved?.marcados ?? []));
    setHydratedKey(key);
  }, [key]);

  useEffect(() => {
    if (!key || hydratedKey !== key) return;
    try {
      localStorage.setItem(key, JSON.stringify({ dias, marcados: [...marcados] }));
    } catch {
      // sem armazenamento local: a lista funciona, só não lembra as marcações
    }
  }, [key, hydratedKey, dias, marcados]);

  const itens = useMemo(
    () => buildShoppingList(protocoloAtivo?.protocolo_plano, dias),
    [protocoloAtivo, dias],
  );
  const grupos = SECAO_ORDER.map((secao) => ({
    secao,
    itens: itens.filter((i) => i.secao === secao),
  })).filter((g) => g.itens.length > 0);

  const feitos = itens.filter((i) => marcados.has(i.key)).length;

  const toggle = (k: string) =>
    setMarcados((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(shoppingListText(itens, dias, marcados));
      toast.success("Lista copiada. É só colar no WhatsApp ou nas Notas.");
    } catch {
      toast.error("Não foi possível copiar a lista neste navegador.");
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        eyebrow="Alimentação"
        title="Lista de compras"
        description={`Semana de ${formatDate(semana).slice(0, 5)} · tudo o que o cardápio do protocolo pede.`}
        showPeriodFilter={false}
      >
        {itens.length > 0 && (
          <Button variant="outline" className="h-11 w-full sm:h-10 sm:w-auto" onClick={copiar}>
            <Copy /> Copiar lista
          </Button>
        )}
      </PageHeader>

      {loaded && !protocoloAtivo && <NoProtocolCard />}

      {protocoloAtivo && itens.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            O protocolo ativo não tem cardápio com itens, então não há lista para montar.
          </CardContent>
        </Card>
      )}

      {itens.length > 0 && (
        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-4 p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold">Quantos dias vai comer em casa?</p>
                  <p className="text-xs text-muted-foreground">
                    Cada refeição do dia uma vez, alternando as opções do cardápio.
                  </p>
                </div>
                <div className="flex h-10 gap-1 rounded-xl border bg-background/50 p-1">
                  {DIAS_OPCOES.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDias(d)}
                      className={cn(
                        "flex-1 rounded-lg px-4 text-xs font-semibold transition-colors sm:flex-none",
                        dias === d
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {d} dias
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold">
                    {feitos === itens.length
                      ? "Tudo comprado!"
                      : `${feitos} de ${itens.length} itens no carrinho`}
                  </span>
                  {feitos > 0 && (
                    <button
                      type="button"
                      onClick={() => setMarcados(new Set())}
                      className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
                    >
                      <RotateCcw className="size-3" /> Desmarcar tudo
                    </button>
                  )}
                </div>
                <Progress value={(feitos / itens.length) * 100} />
              </div>
            </CardContent>
          </Card>

          {grupos.map((g) => (
            <Card key={g.secao}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShoppingCart className="size-4 text-muted-foreground" />
                  {SECAO_LABEL[g.secao]}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 pt-0">
                {g.itens.map((i) => {
                  const done = marcados.has(i.key);
                  return (
                    <label
                      key={i.key}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-accent/40",
                        done && "opacity-60",
                      )}
                    >
                      <Checkbox checked={done} onCheckedChange={() => toggle(i.key)} />
                      <span
                        className={cn("min-w-0 flex-1 text-sm font-medium", done && "line-through")}
                      >
                        {i.nome}
                      </span>
                      <span className="shrink-0 text-sm font-semibold tabular-nums">
                        {i.quantidade}
                      </span>
                    </label>
                  );
                })}
              </CardContent>
            </Card>
          ))}

          <p className="flex items-start gap-1.5 px-1 text-xs text-muted-foreground">
            <Check className="mt-0.5 size-3.5 shrink-0" />
            Quantidades já convertidas para compra (ex.: arroz cozido → arroz cru; frango grelhado →
            peso cru) e arredondadas para cima. As marcações ficam salvas neste aparelho e zeram
            toda segunda-feira.
          </p>
        </div>
      )}
    </div>
  );
}
