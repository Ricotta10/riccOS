import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Loader2, Plus, Scale, Trash2 } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { PageHeader } from "@/components/riccos/app-shell";
import { useAlimentacao } from "@/components/riccos/alimentacao-store";
import { StatCard, type StatTone } from "@/components/riccos/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { localDateKey, type DbMedida } from "@/lib/alimentacao";
import { chartColors, chartTooltipStyle, formatDate } from "@/lib/finance-data";

export const Route = createFileRoute("/alimentacao/corpo")({
  head: () => ({
    meta: [
      { title: "Corpo — RiccOS" },
      {
        name: "description",
        content: "Peso, gordura corporal, massa muscular e medidas ao longo do tempo.",
      },
    ],
  }),
  component: CorpoPage,
});

type NumKey =
  | "medida_peso_kg"
  | "medida_bf_pct"
  | "medida_massa_muscular_kg"
  | "medida_cintura_cm"
  | "medida_abdomen_cm"
  | "medida_quadril_cm"
  | "medida_peito_cm"
  | "medida_braco_cm"
  | "medida_coxa_cm";

const FIELDS: { key: NumKey; label: string; unit: string }[] = [
  { key: "medida_peso_kg", label: "Peso", unit: "kg" },
  { key: "medida_bf_pct", label: "Gordura (BF)", unit: "%" },
  { key: "medida_massa_muscular_kg", label: "Massa muscular", unit: "kg" },
  { key: "medida_cintura_cm", label: "Cintura", unit: "cm" },
  { key: "medida_abdomen_cm", label: "Abdômen", unit: "cm" },
  { key: "medida_quadril_cm", label: "Quadril", unit: "cm" },
  { key: "medida_peito_cm", label: "Peito", unit: "cm" },
  { key: "medida_braco_cm", label: "Braço", unit: "cm" },
  { key: "medida_coxa_cm", label: "Coxa", unit: "cm" },
];

const fmt = (v: number, digits = 1) => v.toLocaleString("pt-BR", { maximumFractionDigits: digits });

/** Último valor preenchido de um campo e a variação desde o primeiro registro. */
function trend(medidas: DbMedida[], key: NumKey) {
  const withValue = medidas.filter((m) => m[key] != null);
  const last = withValue[0];
  const first = withValue[withValue.length - 1];
  if (!last) return null;
  const value = last[key] as number;
  const delta = first && first !== last ? value - (first[key] as number) : null;
  return { value, delta, since: first?.medida_data };
}

function CorpoPage() {
  const { medidas, loaded } = useAlimentacao();
  const [open, setOpen] = useState(false);

  const peso = trend(medidas, "medida_peso_kg");
  const bf = trend(medidas, "medida_bf_pct");
  const massa = trend(medidas, "medida_massa_muscular_kg");
  const cintura = trend(medidas, "medida_cintura_cm");

  const chartData = useMemo(
    () =>
      [...medidas].reverse().map((m) => ({
        data: formatDate(m.medida_data).slice(0, 5),
        peso: m.medida_peso_kg,
        bf: m.medida_bf_pct,
        massa: m.medida_massa_muscular_kg,
      })),
    [medidas],
  );

  // Queda de peso/BF/cintura é boa; ganho de massa muscular é bom.
  const tone = (delta: number | null | undefined, goodWhenUp: boolean): StatTone => {
    if (delta == null || Math.abs(delta) < 0.05) return "neutral";
    return delta > 0 === goodWhenUp ? "success" : "danger";
  };
  const hint = (t: ReturnType<typeof trend>, unit: string) =>
    t?.delta != null && t.since
      ? `${t.delta > 0 ? "+" : ""}${fmt(t.delta)} ${unit} desde ${formatDate(t.since).slice(0, 5)}`
      : "Sem comparação ainda";

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Alimentação"
        title="Corpo"
        description="Registre pesagens e medidas para ver o resultado do protocolo."
        showPeriodFilter={false}
      >
        <Button className="h-11 w-full sm:h-10 sm:w-auto" onClick={() => setOpen(true)}>
          <Plus /> Nova medição
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Peso"
          value={peso ? `${fmt(peso.value)} kg` : "—"}
          hint={hint(peso, "kg")}
          tone={tone(peso?.delta, false)}
          icon={Scale}
        />
        <StatCard
          label="Gordura (BF)"
          value={bf ? `${fmt(bf.value)}%` : "—"}
          hint={hint(bf, "p.p.")}
          tone={tone(bf?.delta, false)}
        />
        <StatCard
          label="Massa muscular"
          value={massa ? `${fmt(massa.value)} kg` : "—"}
          hint={hint(massa, "kg")}
          tone={tone(massa?.delta, true)}
        />
        <StatCard
          label="Cintura"
          value={cintura ? `${fmt(cintura.value)} cm` : "—"}
          hint={hint(cintura, "cm")}
          tone={tone(cintura?.delta, false)}
        />
      </div>

      {chartData.length >= 2 && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <TrendChart
            title="Peso"
            unit="kg"
            data={chartData}
            lines={[{ key: "peso", color: chartColors[0]! }]}
          />
          <TrendChart
            title="Composição"
            unit=""
            data={chartData}
            lines={[
              { key: "bf", color: chartColors[1]!, label: "BF %" },
              { key: "massa", color: chartColors[4]!, label: "Massa muscular kg" },
            ]}
          />
        </div>
      )}

      <Card className="mt-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Histórico</CardTitle>
          <CardDescription>
            A balança de bioimpedância tem margem de erro: olhe a tendência, não um dia isolado.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 pt-0">
          {loaded && medidas.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhuma medição ainda. Que tal se pesar amanhã cedo, em jejum?
            </p>
          )}
          {medidas.map((m) => (
            <MedidaRow key={m.medida_id} medida={m} />
          ))}
        </CardContent>
      </Card>

      <MedidaDialog open={open} onOpenChange={setOpen} last={medidas[0]} />
    </div>
  );
}

function TrendChart({
  title,
  unit,
  data,
  lines,
}: {
  title: string;
  unit: string;
  data: Record<string, unknown>[];
  lines: { key: string; color: string; label?: string }[];
}) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-56 pt-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis
              dataKey="data"
              tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={["auto", "auto"]}
              tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
              axisLine={false}
              tickLine={false}
              unit={unit ? ` ${unit}` : ""}
              width={56}
            />
            <Tooltip contentStyle={chartTooltipStyle} />
            {lines.map((l) => (
              <Line
                key={l.key}
                type="monotone"
                dataKey={l.key}
                name={l.label ?? title}
                stroke={l.color}
                strokeWidth={2.5}
                dot={{ r: 3 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function MedidaRow({ medida }: { medida: DbMedida }) {
  const { removerMedida } = useAlimentacao();
  const [busy, setBusy] = useState(false);
  const values = FIELDS.filter((f) => medida[f.key] != null);
  return (
    <div className="flex items-start gap-3 rounded-xl border bg-background/50 p-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{formatDate(medida.medida_data)}</p>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs tabular-nums text-muted-foreground">
          {values.map((f) => (
            <span key={f.key}>
              {f.label}{" "}
              <span className="font-semibold text-foreground">{fmt(medida[f.key] as number)}</span>{" "}
              {f.unit}
            </span>
          ))}
        </div>
        {medida.medida_observacao && (
          <p className="mt-1 text-xs text-muted-foreground">{medida.medida_observacao}</p>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={busy}
        aria-label="Excluir medição"
        onClick={async () => {
          setBusy(true);
          await removerMedida(medida.medida_id);
          setBusy(false);
        }}
      >
        {busy ? <Loader2 className="animate-spin" /> : <Trash2 />}
      </Button>
    </div>
  );
}

function MedidaDialog({
  open,
  onOpenChange,
  last,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  last: DbMedida | undefined;
}) {
  const { salvarMedida } = useAlimentacao();
  const [data, setData] = useState(localDateKey(new Date()));
  const [values, setValues] = useState<Partial<Record<NumKey, string>>>({});
  const [obs, setObs] = useState("");
  const [saving, setSaving] = useState(false);

  const parsed = (k: NumKey) => {
    const raw = values[k]?.trim();
    if (!raw) return null;
    const n = Number(raw.replace(",", "."));
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const hasAny = FIELDS.some((f) => parsed(f.key) != null);

  const save = async () => {
    setSaving(true);
    const row = Object.fromEntries(FIELDS.map((f) => [f.key, parsed(f.key)])) as Record<
      NumKey,
      number | null
    >;
    const ok = await salvarMedida({
      ...row,
      medida_data: data,
      medida_observacao: obs.trim() || null,
    });
    setSaving(false);
    if (ok) {
      setValues({});
      setObs("");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-3xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova medição</DialogTitle>
          <DialogDescription>
            Preencha só o que mediu. Idealmente de manhã, em jejum.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="medida-data">Data</Label>
            <Input
              id="medida-data"
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="sm:w-48"
            />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {FIELDS.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <Label className="text-xs">{f.label}</Label>
                <div className="relative">
                  <Input
                    inputMode="decimal"
                    value={values[f.key] ?? ""}
                    placeholder={last?.[f.key] != null ? fmt(last[f.key] as number) : ""}
                    onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                    className="pr-10 tabular-nums"
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
                    {f.unit}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="medida-obs" className="text-xs">
              Observação <span className="font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <Input id="medida-obs" value={obs} onChange={(e) => setObs(e.target.value)} />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving || !hasAny}>
            {saving && <Loader2 className="animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
