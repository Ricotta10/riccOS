import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Tag, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { normalizeMerchant, type DbMerchantAlias, type Transaction } from "@/lib/finance-data";
import { supabase } from "@/lib/supabase";
import { useRiccos } from "./store";

const NO_SUB = "__none__";

type AliasInput = {
  trecho: string;
  nome: string;
  categoriaId: string | null;
  subcategoriaId: string | null;
};

/**
 * Apelidos de estabelecimento: "quando o nome cru contiver X, chamar de Y na categoria Z".
 * O workflow n8n "Lançar Compra Wallet" aplica os apelidos nas compras novas; aqui
 * o app aplica também nas compras da Wallet que ainda estão na fila de revisão.
 */
export function useMerchantAliases() {
  const { user } = useAuth();
  const { transactions, refetchData } = useRiccos();
  const [aliases, setAliases] = useState<DbMerchantAlias[]>([]);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("estabelecimentos_apelidos")
      .select("*")
      .order("apelido_nome");
    if (error) console.error("Erro ao buscar apelidos:", error);
    setAliases((data as DbMerchantAlias[]) || []);
  }, []);

  useEffect(() => {
    load();
  }, [user, load]);

  // Corrige as compras da Wallet ainda não revisadas cujo nome original contém o padrão.
  const applyToPending = useCallback(
    async (padrao: string, input: AliasInput) => {
      const ids = transactions
        .filter(
          (t) =>
            t.origem === "wallet" &&
            t.revisada === false &&
            normalizeMerchant(t.estabelecimentoOriginal).includes(padrao),
        )
        .map((t) => t.id);
      if (ids.length === 0) return;

      const patch = input.categoriaId
        ? {
            transacao_descricao: input.nome,
            categoria_id: input.categoriaId,
            subcategoria_id: input.subcategoriaId,
          }
        : { transacao_descricao: input.nome };
      const { error } = await supabase.from("transacoes").update(patch).in("transacao_id", ids);
      if (error) console.error("Erro ao aplicar apelido nas compras pendentes:", error);
    },
    [transactions],
  );

  const saveAlias = useCallback(
    async (input: AliasInput, existingId?: string) => {
      const padrao = normalizeMerchant(input.trecho);
      const row = {
        apelido_trecho: input.trecho.trim(),
        apelido_padrao: padrao,
        apelido_nome: input.nome.trim(),
        categoria_id: input.categoriaId,
        subcategoria_id: input.subcategoriaId,
      };

      const { error } = existingId
        ? await supabase.from("estabelecimentos_apelidos").update(row).eq("apelido_id", existingId)
        : await supabase
            .from("estabelecimentos_apelidos")
            .upsert({ ...row, user_id: user?.id }, { onConflict: "user_id,apelido_padrao" });
      if (error) {
        console.error("Erro ao salvar apelido:", error);
        throw error;
      }

      await applyToPending(padrao, input);
      await Promise.all([load(), refetchData()]);
    },
    [user, applyToPending, load, refetchData],
  );

  const removeAlias = useCallback(
    async (id: string) => {
      setAliases((prev) => prev.filter((a) => a.apelido_id !== id));
      const { error } = await supabase.from("estabelecimentos_apelidos").delete().eq("apelido_id", id);
      if (error) console.error("Erro ao excluir apelido:", error);
      await load();
    },
    [load],
  );

  return { aliases, saveAlias, removeAlias };
}

/** Criar/editar um apelido. Abre a partir de uma compra (`fromTx`) ou de um apelido existente. */
export function AliasDialog({
  open,
  onOpenChange,
  fromTx,
  editing,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fromTx?: Transaction | null;
  editing?: DbMerchantAlias | null;
  onSave: (input: AliasInput, existingId?: string) => Promise<void>;
}) {
  const { dbCategories, dbSubcategories } = useRiccos();
  const [trecho, setTrecho] = useState("");
  const [nome, setNome] = useState("");
  const [categoriaId, setCategoriaId] = useState<string | null>(null);
  const [subcategoriaId, setSubcategoriaId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const original = fromTx?.estabelecimentoOriginal ?? null;

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (editing) {
      setTrecho(editing.apelido_trecho);
      setNome(editing.apelido_nome);
      setCategoriaId(editing.categoria_id);
      setSubcategoriaId(editing.subcategoria_id);
    } else {
      setTrecho(fromTx?.estabelecimentoOriginal ?? "");
      setNome(fromTx?.description ?? "");
      setCategoriaId(fromTx?.categoryId ?? null);
      setSubcategoriaId(fromTx?.subcategoryId ?? null);
    }
  }, [open, editing, fromTx]);

  const expenseCategories = useMemo(
    () => dbCategories.filter((c) => c.categoria_tipo?.toLowerCase() !== "receita"),
    [dbCategories],
  );
  const subcategories = useMemo(
    () => dbSubcategories.filter((s) => s.categoria_id === categoriaId),
    [dbSubcategories, categoriaId],
  );

  const padrao = normalizeMerchant(trecho);
  const originalMatches = !original || normalizeMerchant(original).includes(padrao);

  const submit = async () => {
    if (padrao.length < 2) return setError("O trecho precisa ter pelo menos 2 letras ou números.");
    if (!nome.trim()) return setError("Dê um nome para o estabelecimento.");
    if (!originalMatches) return setError("O trecho precisa fazer parte do nome original.");
    setSaving(true);
    try {
      await onSave({ trecho, nome, categoriaId, subcategoriaId }, editing?.apelido_id);
      onOpenChange(false);
    } catch {
      setError("Não foi possível salvar. Talvez já exista um apelido com esse trecho.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar apelido" : "Apelidar estabelecimento"}</DialogTitle>
          <DialogDescription>
            As próximas compras com esse nome já chegam com o apelido e a categoria certos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {original && (
            <div className="rounded-xl border bg-secondary/40 px-3.5 py-2.5">
              <p className="text-[11px] text-muted-foreground">Nome original da Wallet</p>
              <p className="break-all text-sm font-semibold">{original}</p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="alias-trecho">Trecho que identifica</Label>
            <Input
              id="alias-trecho"
              value={trecho}
              onChange={(e) => setTrecho(e.target.value)}
              placeholder="Ex.: IFD* ou PAG*JOSEDASILVA"
              className="h-11"
            />
            <p className="text-[11px] text-muted-foreground">
              Deixe só a parte que se repete. Maiúsculas, acentos, espaços e símbolos são ignorados.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="alias-nome">Nome que vai aparecer</Label>
            <Input
              id="alias-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: iFood"
              className="h-11"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select
                {...(categoriaId ? { value: categoriaId } : {})}
                onValueChange={(v) => {
                  setCategoriaId(v);
                  setSubcategoriaId(null);
                }}
              >
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="A IA escolhe" />
                </SelectTrigger>
                <SelectContent>
                  {expenseCategories.map((c) => (
                    <SelectItem key={c.categoria_id} value={c.categoria_id}>
                      {c.categoria_nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Subcategoria</Label>
              <Select
                value={subcategoriaId ?? NO_SUB}
                onValueChange={(v) => setSubcategoriaId(v === NO_SUB ? null : v)}
                disabled={!categoriaId}
              >
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_SUB}>Nenhuma</SelectItem>
                  {subcategories.map((s) => (
                    <SelectItem key={s.subcategoria_id} value={s.subcategoria_id}>
                      {s.subcategoria_nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {error && <p className="text-xs font-medium text-danger">{error}</p>}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Salvando…" : "Salvar apelido"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Lista de apelidos com criar/editar/excluir. */
export function AliasManagerDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { dbCategories, dbSubcategories } = useRiccos();
  const { aliases, saveAlias, removeAlias } = useMerchantAliases();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<DbMerchantAlias | null>(null);

  const categoryName = (a: DbMerchantAlias) => {
    const cat = dbCategories.find((c) => c.categoria_id === a.categoria_id)?.categoria_nome;
    const sub = dbSubcategories.find((s) => s.subcategoria_id === a.subcategoria_id)?.subcategoria_nome;
    if (!cat) return "Categoria pela IA";
    return sub ? `${cat} · ${sub}` : cat;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Apelidos de estabelecimentos</DialogTitle>
            <DialogDescription>
              Nomes que você mapeou para as compras da Wallet.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            {aliases.map((a) => (
              <div key={a.apelido_id} className="flex items-center gap-3 rounded-xl border bg-secondary/40 p-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground">
                  <Tag className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{a.apelido_nome}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    contém “{a.apelido_trecho}” · {categoryName(a)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Editar apelido"
                  onClick={() => {
                    setEditing(a);
                    setEditorOpen(true);
                  }}
                >
                  <Pencil />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Excluir apelido"
                  className="text-danger hover:bg-danger-soft hover:text-danger"
                  onClick={() => removeAlias(a.apelido_id)}
                >
                  <Trash2 />
                </Button>
              </div>
            ))}

            {aliases.length === 0 && (
              <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                Nenhum apelido ainda. Use “Apelidar” nas compras da Wallet para criar o primeiro.
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              onClick={() => {
                setEditing(null);
                setEditorOpen(true);
              }}
            >
              <Plus /> Novo apelido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AliasDialog open={editorOpen} onOpenChange={setEditorOpen} editing={editing} onSave={saveAlias} />
    </>
  );
}
