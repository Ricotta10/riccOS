import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { MoreHorizontal, Pencil, Plus, Search, Trash2 } from "lucide-react";

import { PageHeader } from "@/components/riccos/app-shell";
import { useRiccos } from "@/components/riccos/store";
import { TransactionDialog } from "@/components/riccos/transaction-dialog";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  categoryList,
  formatBRL,
  formatDate,
  frequencyLabel,
  type Transaction,
} from "@/lib/finance-data";

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

function TransactionsPage() {
  const { monthTransactions, toggleStatus, removeTransaction } = useRiccos();
  const [query, setQuery] = useState("");
  const [type, setType] = useState("todas");
  const [category, setCategory] = useState("todas");
  const [status, setStatus] = useState("todos");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);

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

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Transações"
        description="Todos os lançamentos do mês selecionado, com filtros e edição rápida."
      />

      <Card className="shadow-none">
        <CardContent className="space-y-4 px-0">
          <div className="flex flex-col gap-3 px-6 lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por descrição..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:w-auto">
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="sm:w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  <SelectItem value="receita">Receitas</SelectItem>
                  <SelectItem value="despesa">Despesas</SelectItem>
                </SelectContent>
              </Select>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="sm:w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Categorias</SelectItem>
                  {categoryList.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="sm:w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Status</SelectItem>
                  <SelectItem value="pago">Pago</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
              className="shrink-0"
            >
              <Plus /> Adicionar Lançamento
            </Button>
          </div>

          <div className="overflow-x-auto border-t">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Frequência</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="pr-6 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="pl-6 text-xs text-muted-foreground tabular-nums">
                      {formatDate(tx.date)}
                    </TableCell>
                    <TableCell className="max-w-56 truncate text-sm font-medium">{tx.description}</TableCell>
                    <TableCell className="text-xs">
                      <span className="font-medium">{tx.category}</span>
                      <span className="text-muted-foreground"> / {tx.subcategory}</span>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`text-xs font-semibold ${tx.type === "receita" ? "text-success" : "text-danger"}`}
                      >
                        {tx.type === "receita" ? "Receita" : "Despesa"}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {frequencyLabel(tx.frequency)}
                    </TableCell>
                    <TableCell
                      className={`text-right text-sm font-semibold tabular-nums ${
                        tx.type === "receita" ? "text-success" : "text-foreground"
                      }`}
                    >
                      {tx.type === "receita" ? "+" : "−"} {formatBRL(tx.amount)}
                    </TableCell>
                    <TableCell>
                      <button type="button" onClick={() => toggleStatus(tx.id)} title="Alternar status">
                        <Badge
                          variant="outline"
                          className={`cursor-pointer border-transparent ${
                            tx.status === "pago"
                              ? "bg-success-soft text-success"
                              : "bg-warning-soft text-warning-foreground"
                          }`}
                        >
                          {tx.status === "pago" ? "Pago" : "Pendente"}
                        </Badge>
                      </button>
                    </TableCell>
                    <TableCell className="pr-6 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setEditing(tx);
                              setOpen(true);
                            }}
                          >
                            <Pencil /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
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
                    <TableCell colSpan={8} className="py-12 text-center text-sm text-muted-foreground">
                      Nenhum lançamento encontrado com os filtros atuais.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <TransactionDialog open={open} onOpenChange={setOpen} editing={editing} />
    </div>
  );
}
