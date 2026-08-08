import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";

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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { categories, categoryList, type Transaction, type TxType } from "@/lib/finance-data";
import { useRiccos } from "./store";

export function TransactionDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: Transaction | null;
}) {
  const { addTransaction, updateTransaction } = useRiccos();
  const [type, setType] = useState<TxType>("despesa");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState<Date | undefined>(new Date(2026, 7, 15));
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [frequency, setFrequency] = useState<"pontual" | "recorrente" | "parcelado">("pontual");
  const [installments, setInstallments] = useState("2");
  const [paid, setPaid] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setType(editing.type);
      setDescription(editing.description);
      setAmount(String(editing.amount));
      setDate(new Date(`${editing.date}T12:00:00`));
      setCategory(editing.category);
      setSubcategory(editing.subcategory);
      setFrequency(editing.frequency.kind);
      setInstallments(editing.frequency.kind === "parcelado" ? String(editing.frequency.total) : "2");
      setPaid(editing.status === "pago");
    } else {
      setType("despesa");
      setDescription("");
      setAmount("");
      setDate(new Date(2026, 7, 15));
      setCategory("");
      setSubcategory("");
      setFrequency("pontual");
      setInstallments("2");
      setPaid(false);
    }
  }, [open, editing]);

  const subcategories = useMemo(() => (category ? categories[category] ?? [] : []), [category]);

  const submit = () => {
    if (!description || !amount || !date || !category) return;
    const payload: Omit<Transaction, "id"> = {
      description,
      amount: Number(amount.replace(",", ".")),
      date: format(date, "yyyy-MM-dd"),
      category,
      subcategory: subcategory || (categories[category]?.[0] ?? ""),
      type,
      status: paid ? "pago" : "pendente",
      frequency:
        frequency === "parcelado"
          ? { kind: "parcelado", current: 1, total: Math.max(2, Number(installments) || 2) }
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
          <DialogTitle>{editing ? "Editar transação" : "Nova transação"}</DialogTitle>
          <DialogDescription>
            Informe os dados do lançamento para manter o mês atualizado.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-1 rounded-xl bg-secondary p-1">
          {(["despesa", "receita"] as TxType[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                setType(option);
                setCategory(option === "receita" ? "Receitas" : "");
                setSubcategory("");
              }}
              className={cn(
                "rounded-lg py-2 text-sm font-semibold transition-colors",
                type === option
                  ? option === "receita"
                    ? "bg-success text-success-foreground"
                    : "bg-danger text-danger-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option === "despesa" ? "Despesa" : "Receita"}
            </button>
          ))}
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
              <Label htmlFor="valor">Valor (R$)</Label>
              <Input
                id="valor"
                inputMode="decimal"
                placeholder="0,00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Data de vencimento</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("justify-start font-normal", !date && "text-muted-foreground")}
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
                value={category}
                onValueChange={(v) => {
                  setCategory(v);
                  setSubcategory("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar" />
                </SelectTrigger>
                <SelectContent>
                  {categoryList
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
              <Select value={subcategory} onValueChange={setSubcategory} disabled={!category}>
                <SelectTrigger>
                  <SelectValue placeholder={category ? "Selecionar" : "Escolha a categoria"} />
                </SelectTrigger>
                <SelectContent>
                  {subcategories.map((s) => (
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
                  className="flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm font-medium has-data-[state=checked]:border-primary has-data-[state=checked]:bg-accent"
                >
                  <RadioGroupItem value={option.value} />
                  {option.label}
                </Label>
              ))}
            </RadioGroup>
          </div>

          {frequency === "parcelado" && (
            <div className="grid gap-2">
              <Label htmlFor="parcelas">Quantidade de parcelas</Label>
              <Input
                id="parcelas"
                type="number"
                min={2}
                value={installments}
                onChange={(e) => setInstallments(e.target.value)}
                className="sm:max-w-40"
              />
            </div>
          )}

          <Label className="flex cursor-pointer items-center gap-3 rounded-xl border bg-secondary/40 p-3 text-sm font-medium">
            <Checkbox checked={paid} onCheckedChange={(v) => setPaid(v === true)} />
            Já está {type === "receita" ? "recebido" : "pago"}
          </Label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit}>{editing ? "Salvar alterações" : "Adicionar lançamento"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
