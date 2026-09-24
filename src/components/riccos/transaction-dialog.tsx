import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowDownRight, ArrowUpRight, CalendarIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  categories,
  categoryList,
  formatBRL,
  splitInstallments,
  type Transaction,
  type TxType,
} from "@/lib/finance-data";
import { useRiccos } from "./store";

function formatCurrencyInput(val: string): string {
  const digits = val.replace(/\D/g, "");
  if (!digits) return "";
  const numberValue = Number(digits) / 100;
  return numberValue.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parseCurrencyToNumber(val: string): number {
  if (!val) return 0;
  const clean = val.replace(/\./g, "").replace(",", ".");
  return Number(clean) || 0;
}

export function TransactionDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: Transaction | null;
}) {
  const { addTransaction, updateTransaction, dbCategories, dbSubcategories } = useRiccos();
  const [type, setType] = useState<TxType>("despesa");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [subcategoryName, setSubcategoryName] = useState("");
  const [frequency, setFrequency] = useState<"pontual" | "recorrente" | "parcelado">("pontual");
  const [currentInstallment, setCurrentInstallment] = useState("1");
  const [totalInstallments, setTotalInstallments] = useState("2");
  // Numa compra parcelada nova, o valor digitado pode ser o total da compra ou o de cada parcela.
  const [amountMode, setAmountMode] = useState<"total" | "parcela">("total");
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [paid, setPaid] = useState(false);

  // Categorias filtradas pelo tipo (Despesa vs Receita)
  const availableCategories = useMemo(() => {
    if (dbCategories.length > 0) {
      return dbCategories.filter((c) =>
        type === "receita"
          ? c.categoria_tipo?.toLowerCase() === "receita"
          : c.categoria_tipo?.toLowerCase() !== "receita",
      );
    }
    return [];
  }, [dbCategories, type]);

  // Subcategorias filtradas pela categoria selecionada
  const availableSubcategories = useMemo(() => {
    if (categoryId && dbSubcategories.length > 0) {
      return dbSubcategories.filter((s) => s.categoria_id === categoryId);
    }
    return [];
  }, [categoryId, dbSubcategories]);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setType(editing.type);
      setDescription(editing.description);
      setAmount(
        typeof editing.amount === "number" && !isNaN(editing.amount)
          ? editing.amount.toLocaleString("pt-BR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })
          : String(editing.amount),
      );
      setDate(new Date(`${editing.date}T12:00:00`));
      setCategoryId(editing.categoryId || "");
      setSubcategoryId(editing.subcategoryId || "");
      setCategoryName(editing.category || "");
      setSubcategoryName(editing.subcategory || "");
      setFrequency(editing.frequency.kind);
      setEndDate(editing.endDate ? new Date(`${editing.endDate}T12:00:00`) : undefined);
      if (editing.frequency.kind === "parcelado") {
        setCurrentInstallment(String(editing.frequency.current));
        setTotalInstallments(String(editing.frequency.total));
      } else {
        setCurrentInstallment("1");
        setTotalInstallments("2");
      }
      setPaid(editing.status === "pago");
    } else {
      setType("despesa");
      setDescription("");
      setAmount("");
      setDate(new Date());
      setCategoryId("");
      setSubcategoryId("");
      setCategoryName("");
      setSubcategoryName("");
      setFrequency("pontual");
      setEndDate(undefined);
      setCurrentInstallment("1");
      setTotalInstallments("2");
      setAmountMode("total");
      setPaid(false);
    }
  }, [open, editing]);

  const isNewInstallment = !editing && frequency === "parcelado";
  const installmentCount = Math.max(1, Number(totalInstallments) || 1);
  const numericAmount = parseCurrencyToNumber(amount);
  // Ao criar uma compra parcelada o store recebe o valor TOTAL e divide entre as parcelas.
  const purchaseTotal =
    isNewInstallment && amountMode === "parcela" ? numericAmount * installmentCount : numericAmount;
  const installmentPreview =
    isNewInstallment && numericAmount > 0 ? splitInstallments(purchaseTotal, installmentCount) : [];
  const firstInstallment = installmentPreview[0] ?? 0;
  const lastInstallment = installmentPreview[installmentPreview.length - 1] ?? 0;

  const submit = () => {
    if (!description || numericAmount <= 0 || !date || (!categoryId && !categoryName)) return;

    const payload: Omit<Transaction, "id"> = {
      description,
      amount: purchaseTotal,
      date: format(date, "yyyy-MM-dd"),
      endDate: frequency === "recorrente" && endDate ? format(endDate, "yyyy-MM-dd") : undefined,
      category: categoryName || "Outros",
      subcategory: subcategoryName || "",
      categoryId: categoryId || undefined,
      subcategoryId: subcategoryId || undefined,
      type,
      status: paid ? "pago" : "pendente",
      frequency:
        frequency === "parcelado"
          ? {
              kind: "parcelado",
              current: Math.max(1, Number(currentInstallment) || 1),
              total: Math.max(1, Number(totalInstallments) || 1),
            }
          : { kind: frequency },
    };

    if (editing) updateTransaction(editing.id, payload);
    else addTransaction(payload);

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {editing ? "Editar lançamento" : "Novo lançamento"}
          </DialogTitle>
          <DialogDescription>
            Informe os dados do lançamento para manter o mês atualizado.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-secondary p-1">
          {(["despesa", "receita"] as TxType[]).map((option) => {
            const active = type === option;
            const Icon = option === "receita" ? ArrowUpRight : ArrowDownRight;
            return (
              <button
                key={option}
                type="button"
                onClick={() => {
                  setType(option);
                  setCategoryId("");
                  setSubcategoryId("");
                  setCategoryName("");
                  setSubcategoryName("");
                }}
                className={cn(
                  "flex h-10 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all",
                  active
                    ? option === "receita"
                      ? "bg-success text-success-foreground shadow-soft"
                      : "bg-primary text-primary-foreground shadow-soft"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                {option === "despesa" ? "Despesa" : "Receita"}
              </button>
            );
          })}
        </div>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Input
              id="descricao"
              placeholder="Ex.: Aluguel apartamento"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="valor">
                {frequency === "parcelado" && (editing || amountMode === "parcela")
                  ? "Valor da parcela (R$)"
                  : frequency === "parcelado"
                    ? "Valor total (R$)"
                    : "Valor (R$)"}
              </Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
                  R$
                </span>
                <Input
                  id="valor"
                  inputMode="numeric"
                  placeholder="0,00"
                  className="pl-10 font-semibold tabular-nums"
                  value={amount}
                  onChange={(e) => setAmount(formatCurrencyInput(e.target.value))}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Data de vencimento</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("justify-start font-medium", !date && "text-muted-foreground")}
                  >
                    <CalendarIcon />
                    {date ? format(date, "dd/MM/yyyy") : "Selecionar"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    locale={ptBR}
                    className={cn("pointer-events-auto p-3")}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Categoria</Label>
              <Select
                value={categoryId || categoryName}
                onValueChange={(val) => {
                  const matched = availableCategories.find(
                    (c) => c.categoria_id === val || c.categoria_nome === val,
                  );
                  if (matched) {
                    setCategoryId(matched.categoria_id);
                    setCategoryName(matched.categoria_nome);
                  } else {
                    setCategoryName(val);
                  }
                  setSubcategoryId("");
                  setSubcategoryName("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar" />
                </SelectTrigger>
                <SelectContent>
                  {availableCategories.length > 0
                    ? availableCategories.map((c) => (
                        <SelectItem key={c.categoria_id} value={c.categoria_id}>
                          {c.categoria_nome}
                        </SelectItem>
                      ))
                    : categoryList
                        .filter((c) => (type === "receita" ? c === "Receitas" : c !== "Receitas"))
                        .map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Subcategoria</Label>
              <Select
                value={subcategoryId || subcategoryName}
                onValueChange={(val) => {
                  const matched = availableSubcategories.find(
                    (s) => s.subcategoria_id === val || s.subcategoria_nome === val,
                  );
                  if (matched) {
                    setSubcategoryId(matched.subcategoria_id);
                    setSubcategoryName(matched.subcategoria_nome);
                  } else {
                    setSubcategoryName(val);
                  }
                }}
                disabled={!categoryId && !categoryName}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={categoryId || categoryName ? "Selecionar" : "Escolha a categoria"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {availableSubcategories.length > 0
                    ? availableSubcategories.map((s) => (
                        <SelectItem key={s.subcategoria_id} value={s.subcategoria_id}>
                          {s.subcategoria_nome}
                        </SelectItem>
                      ))
                    : (categories[categoryName] ?? []).map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Frequência</Label>
            <RadioGroup
              value={frequency}
              onValueChange={(v) => setFrequency(v as typeof frequency)}
              className="grid grid-cols-1 gap-2 sm:grid-cols-3"
            >
              {[
                { value: "pontual", label: "Pontual" },
                { value: "recorrente", label: "Recorrente" },
                { value: "parcelado", label: "Parcelado" },
              ].map((option) => (
                <Label
                  key={option.value}
                  className="flex h-11 cursor-pointer items-center gap-2.5 rounded-xl border bg-card px-3 text-sm font-medium transition-colors hover:border-ring/50 has-data-[state=checked]:border-primary has-data-[state=checked]:bg-accent has-data-[state=checked]:text-accent-foreground"
                >
                  <RadioGroupItem value={option.value} />
                  {option.label}
                </Label>
              ))}
            </RadioGroup>
          </div>

          {frequency === "recorrente" && (
            <div className="grid gap-2">
              <Label>Data de término (opcional)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("justify-start font-medium", !endDate && "text-muted-foreground")}
                  >
                    <CalendarIcon />
                    {endDate ? format(endDate, "dd/MM/yyyy") : "Sem data de término"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <div className="p-2 border-b flex justify-between items-center">
                    <span className="text-xs font-semibold px-1">Data limite da recorrência</span>
                    {endDate && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs text-muted-foreground"
                        onClick={() => setEndDate(undefined)}
                      >
                        Limpar
                      </Button>
                    )}
                  </div>
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    locale={ptBR}
                    className={cn("pointer-events-auto p-3")}
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}

          {frequency === "parcelado" && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="parcelaAtual">Parcela atual</Label>
                <Input
                  id="parcelaAtual"
                  type="number"
                  min={1}
                  max={Math.max(1, Number(totalInstallments) || 1)}
                  value={currentInstallment}
                  onChange={(e) => setCurrentInstallment(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="parcelaTotal">Total de parcelas</Label>
                <Input
                  id="parcelaTotal"
                  type="number"
                  min={1}
                  value={totalInstallments}
                  onChange={(e) => setTotalInstallments(e.target.value)}
                />
              </div>
              {isNewInstallment && (
                <div className="grid gap-2 sm:col-span-2">
                  <div className="grid grid-cols-2 gap-1 rounded-2xl bg-secondary p-1">
                    {(
                      [
                        { value: "total", label: "Valor é o total" },
                        { value: "parcela", label: "Valor é da parcela" },
                      ] as const
                    ).map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setAmountMode(option.value)}
                        className={cn(
                          "flex h-9 items-center justify-center rounded-xl text-xs font-semibold transition-all",
                          amountMode === option.value
                            ? "bg-card text-foreground shadow-soft"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  {installmentPreview.length > 0 && (
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {installmentCount}x de {formatBRL(lastInstallment)}
                      {firstInstallment !== lastInstallment &&
                        ` (1ª de ${formatBRL(firstInstallment)})`}{" "}
                      · total {formatBRL(purchaseTotal)}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <Label className="flex h-12 cursor-pointer items-center gap-3 rounded-xl border bg-secondary/40 px-3.5 text-sm font-medium transition-colors hover:border-ring/50">
            <Checkbox checked={paid} onCheckedChange={(v) => setPaid(v === true)} />
            Já está {type === "receita" ? "recebido" : "pago"}
          </Label>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit}>{editing ? "Salvar alterações" : "Adicionar lançamento"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
