import { useEffect, useState } from "react";
import { Lightbulb, TrendingUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/finance-data";
import { supabase } from "@/lib/supabase";

type InsightItem = {
  tipo: "padrao" | "recomendacao";
  titulo: string;
  descricao: string;
  prioridade: "alta" | "media" | "baixa";
};

type InsightRow = {
  insight_periodo_inicio: string;
  insight_periodo_fim: string;
  insight_itens: InsightItem[];
};

const prioridadeVariant: Record<InsightItem["prioridade"], "destructive" | "warning" | "secondary"> = {
  alta: "destructive",
  media: "warning",
  baixa: "secondary",
};

const prioridadeLabel: Record<InsightItem["prioridade"], string> = {
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};

export function InsightsCard({ className }: { className?: string }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [insight, setInsight] = useState<InsightRow | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    let active = true;

    supabase
      .from("insights")
      .select("insight_periodo_inicio, insight_periodo_fim, insight_itens")
      .eq("user_id", user.id)
      .order("insight_periodo_fim", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        const row = data as InsightRow | null;
        if (row && typeof row.insight_itens === "string") {
          try {
            row.insight_itens = JSON.parse(row.insight_itens);
          } catch {
            row.insight_itens = [];
          }
        }
        setInsight(row ?? null);
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [user]);

  if (loading) return null;

  const itens = insight?.insight_itens ?? [];

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
            <Lightbulb className="size-4" />
          </span>
          Insights da semana
        </CardTitle>
        <CardDescription className="text-xs">
          {insight
            ? `Período de ${formatDate(insight.insight_periodo_inicio)} a ${formatDate(insight.insight_periodo_fim)}.`
            : "Gerados automaticamente toda segunda-feira a partir dos seus lançamentos."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {itens.length === 0 && (
          <div className="rounded-2xl border border-dashed py-8 text-center text-xs text-muted-foreground">
            Nenhum insight relevante identificado nesta semana.
          </div>
        )}
        {itens.map((item, index) => (
          <div key={index} className="rounded-2xl border bg-background/40 p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-2.5">
                <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-secondary text-muted-foreground">
                  {item.tipo === "padrao" ? (
                    <TrendingUp className="size-3.5" />
                  ) : (
                    <Lightbulb className="size-3.5" />
                  )}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{item.titulo}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.descricao}</p>
                </div>
              </div>
              <Badge variant={prioridadeVariant[item.prioridade]} className="shrink-0">
                {prioridadeLabel[item.prioridade]}
              </Badge>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
