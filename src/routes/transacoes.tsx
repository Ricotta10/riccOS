import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";

import { PageHeader } from "@/components/riccos/app-shell";
import { useRiccos } from "@/components/riccos/store";
import { TransactionDialog } from "@/components/riccos/transaction-dialog";
import { WalletReview } from "@/components/riccos/wallet-review";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  categoryList,
  formatBRL,
  formatDate,
  frequencyLabel,
  type Transaction,
} from "@/lib/finance-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/transacoes")({
  head: () => ({
    meta: [
      { title: "Transações — RiccOS | Lançamentos do mês" },
      {
        name: "description",
        content:
          "Liste, filtre, edite e cadastre receitas e despesas com frequência pontual, recorrente ou parcelada.",
      },
      { property: "og:title", content: "Transações — RiccOS" },
      {
        property: "og:description",
        content: "Central de lançamentos do RiccOS com busca, filtros e cadastro rápido.",
      },
    ],
  }),
  component: TransactionsPage,
});

function StatusBadge({ status, onClick }: { status: Transaction["status"]; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} title="Alternar status" className="rounded-full">
      <Badge
        variant={status === "pago" ? "success" : "warning"}
        className="cursor-pointer transition-transform hover:scale-105"
      >
        {status === "pago" ? "Pago" : "Pendente"}
      </Badge>
    </button>
  );
}

function TypeIcon({ type }: { type: Transaction["type"] }) {
  const isIncome = type === "receita";
  return (
    <span
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-xl",
        isIncome ? "bg-success-soft text-success" : "bg-secondary text-foreground",
      )}
    >
      {isIncome ? <ArrowUpRight className="size-4" /> : <ArrowDownRight className="size-4" />}
    </span>
  );
}

function TransactionsPage() {
  const { monthTransactions, toggleStatus, removeTransaction, dbCategories } = useRiccos();
  const [query, setQuery] = useState("");
  const [type, setType] = useState("todas");
  const [category, setCategory] = useState("todas");
  const [status, setStatus] = useState("todos");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);

  const availableCategoryNames = useMemo(() => {
    if (dbCategories.length > 0) {
      return Array.from(new Set(dbCategories.map((c) => c.categoria_nome)));
    }
    return categoryList;
  }, [dbCategories]);

  const rows = useMemo(
    () =>
      monthTransactions
        .filter((tx) => tx.description.toLowerCase().includes(query.toLowerCase()))
        .filter((tx) => (type === "todas" ? true : tx.type === type))
        .filter((tx) => (category === "todas" ? true : tx.category === category))
        .filter((tx) => (status === "todos" ? true : tx.status === status))
        .sort((a, b) => a.date.localeCompare(b.date)),
    [monthTransactions, query, type, category, status],
  );

  const openNew = () => {
    setEditing(null);
    setOpen(true);
  };

  const openEdit = (tx: Transaction) => {
    setEditing(tx);
    setOpen(true);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        eyebrow="Financeiro"
        title="Transações"
        description="Todos os lançamentos do mês selecionado, com filtros e edição rápida."
        showBalance={false}
      >
        <Button onClick={openNew} className="h-11 w-full sm:h-10 sm:w-auto">
          <Plus /> Novo lançamento
        </Button>
      </PageHeader>

      <WalletReview onEdit={openEdit} />

      {/* Filtros */}
      <Card>
        <CardContent className="p-4 sm:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por descrição…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-11 pl-10 sm:h-10"
              />
            </div>
            <div className="grid grid-cols-3 gap-2 lg:w-auto">
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="h-11 text-xs sm:h-10 sm:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  <SelectItem value="receita">Receitas</SelectItem>
                  <SelectItem value="despesa">Despesas</SelectItem>
                </SelectContent>
              </Select>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-11 text-xs sm:h-10 sm:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Categorias</SelectItem>
                  {availableCategoryNames.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-11 text-xs sm:h-10 sm:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Status</SelectItem>
                  <SelectItem value="pago">Pago</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mobile: lista em cards */}
      <div className="space-y-3 md:hidden">
        {rows.map((tx) => (
          <Card key={tx.id} className="p-4">
            <div className="flex items-start gap-3">
              <TypeIcon type={tx.type} />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate text-sm font-semibold">{tx.description}</p>
                  <span
                    className={cn(
                      "shrink-0 text-sm font-semibold tabular-nums",
                      tx.type === "receita" ? "text-success" : "text-foreground",
                    )}
                  >
                    {tx.type === "receita" ? "+" : "−"} {formatBRL(tx.amount)}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {tx.category}
                  {tx.subcategory ? ` · ${tx.subcategory}` : ""}
                </p>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="tabular-nums">{formatDate(tx.date)}</span>
                    <span className="size-1 rounded-full bg-border" />
                    <span>{frequencyLabel(tx.frequency)}</span>
                  </div>
                  <StatusBadge status={tx.status} onClick={() => toggleStatus(tx.id)} />
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 border-t border-border/60 pt-3">
              <Button variant="secondary" size="sm" className="flex-1" onClick={() => openEdit(tx)}>
                <Pencil /> Editar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="flex-1 text-danger hover:bg-danger-soft hover:text-danger"
                onClick={() => removeTransaction(tx.id)}
              >
                <Trash2 /> Excluir
              </Button>
            </div>
          </Card>
        ))}

        {rows.length === 0 && (
          <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            Nenhum lançamento encontrado com os filtros atuais.
          </div>
        )}
      </div>

      {/* Desktop: tabela */}
      <Card className="hidden overflow-hidden md:block">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-6">Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="hidden lg:table-cell">Categoria</TableHead>
                <TableHead className="hidden xl:table-cell">Frequência</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pr-6 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell className="pl-6 text-xs tabular-nums text-muted-foreground">
                    {formatDate(tx.date)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <TypeIcon type={tx.type} />
                      <div className="min-w-0">
                        <p className="max-w-56 truncate text-sm font-medium">{tx.description}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {tx.type === "receita" ? "Receita" : "Despesa"}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden text-xs lg:table-cell">
                    <span className="font-medium">{tx.category}</span>
                    {tx.subcategory && (
                      <span className="text-muted-foreground"> · {tx.subcategory}</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden text-xs text-muted-foreground xl:table-cell">
                    {frequencyLabel(tx.frequency)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "whitespace-nowrap text-right text-sm font-semibold tabular-nums",
                      tx.type === "receita" ? "text-success" : "text-foreground",
                    )}
                  >
                    {tx.type === "receita" ? "+" : "−"} {formatBRL(tx.amount)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={tx.status} onClick={() => toggleStatus(tx.id)} />
                  </TableCell>
                  <TableCell className="pr-6 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label="Ações">
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(tx)}>
                          <Pencil /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-danger focus:bg-danger-soft focus:text-danger"
                          onClick={() => removeTransaction(tx.id)}
                        >
                          <Trash2 /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-14 text-center text-sm text-muted-foreground"
                  >
                    Nenhum lançamento encontrado com os filtros atuais.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <TransactionDialog open={open} onOpenChange={setOpen} editing={editing} />
    </div>
  );
}
