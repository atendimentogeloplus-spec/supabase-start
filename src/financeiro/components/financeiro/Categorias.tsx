import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Category, CLOSING_GROUPS, ClosingGroup, Transaction, TxType } from "./useFinanceData";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function Categorias({
  categories, transactions, userId, reload,
}: { categories: Category[]; transactions: Transaction[]; userId?: string; reload: () => void }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<TxType>("entrada");
  const [color, setColor] = useState("#3b82f6");
  const [closingGroup, setClosingGroup] = useState<ClosingGroup | "__none__">("__none__");

  function openNew(t: TxType) {
    setEditing(null);
    setName(""); setType(t); setColor(t === "entrada" ? "#16a34a" : "#dc2626");
    setClosingGroup("__none__");
    setOpen(true);
  }
  function openEdit(c: Category) {
    setEditing(c);
    setName(c.name); setType(c.type); setColor(c.color);
    setClosingGroup((c.closing_group as ClosingGroup) || "__none__");
    setOpen(true);
  }

  async function save() {
    if (!name.trim() || !userId) return;
    if (closingGroup === "__none__") {
      toast.error("Selecione o grupo no Fechamento desta categoria.");
      return;
    }
    const payload = {
      name: name.trim(),
      type,
      color,
      user_id: userId,
      closing_group: closingGroup,
    };
    const res = editing
      ? await supabase.from("fin_categories").update(payload).eq("id", editing.id)
      : await supabase.from("fin_categories").insert(payload);
    if (res.error) { toast.error(res.error.message); return; }
    toast.success(editing ? "Categoria atualizada" : "Categoria criada");
    setOpen(false);
    reload();
  }

  async function remove(c: Category) {
    const used = transactions.some(t => t.category === c.name);
    if (used) { toast.error("Categoria em uso — exclua ou altere os lançamentos vinculados antes."); return; }
    if (!confirm(`Excluir categoria "${c.name}"?`)) return;
    const { error } = await supabase.from("fin_categories").delete().eq("id", c.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Categoria excluída");
    reload();
  }

  const entradas = categories.filter(c => c.type === "entrada");
  const saidas = categories.filter(c => c.type === "saida");

  return (
    <div className="grid md:grid-cols-2 gap-4">
      {([["Entradas", entradas, "entrada"], ["Saídas", saidas, "saida"]] as const).map(([title, list, t]) => (
        <Card key={title}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className={t === "entrada" ? "text-emerald-600" : "text-red-600"}>{title}</CardTitle>
            <Button size="sm" variant="outline" onClick={() => openNew(t as TxType)}>
              <Plus className="h-4 w-4 mr-1" /> Nova
            </Button>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {list.map(c => (
                <li key={c.id} className="flex items-center justify-between p-2 rounded-lg border bg-card">
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded" style={{ background: c.color }} />
                    <span className="font-medium">{c.name}</span>
                  </span>
                  <span className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(c)}><Trash2 className="h-4 w-4 text-red-600" /></Button>
                  </span>
                </li>
              ))}
              {list.length === 0 && <li className="text-sm text-muted-foreground p-2">Nenhuma categoria</li>}
            </ul>
          </CardContent>
        </Card>
      ))}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar Categoria" : "Nova Categoria"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant={type === "entrada" ? "default" : "outline"} onClick={() => setType("entrada")}>Entrada</Button>
              <Button type="button" variant={type === "saida" ? "default" : "outline"} onClick={() => setType("saida")}>Saída</Button>
            </div>
            <div>
              <Label>Grupo no Fechamento *</Label>
              <Select value={closingGroup} onValueChange={(v) => setClosingGroup(v as any)}>
                <SelectTrigger><SelectValue placeholder="Selecione o grupo..." /></SelectTrigger>
                <SelectContent>
                  {CLOSING_GROUPS.filter(g => g.type === type).map(g => (
                    <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Define em qual card da aba Fechamento esta categoria será somada.
              </p>
            </div>
            <div>
              <Label>Cor</Label>
              <Input type="color" value={color} onChange={e => setColor(e.target.value)} className="h-10 w-20 p-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
