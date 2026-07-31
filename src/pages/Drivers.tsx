import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Star } from "lucide-react";
import { toast } from "sonner";

const emptyDriver = { name: "", phone: "", is_main: false };

export default function Drivers() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyDriver);
  const [editId, setEditId] = useState<string | null>(null);

  const { data: drivers = [] } = useQuery({
    queryKey: ["drivers"],
    queryFn: async () => {
      const { data } = await supabase.from("drivers").select("*").order("name");
      return data || [];
    },
  });

  const save = useMutation({
    mutationFn: async (d: typeof emptyDriver) => {
      if (d.is_main) {
        // Remove main from others first
        await supabase.from("drivers").update({ is_main: false } as any).eq("is_main", true);
      }
      if (editId) {
        const { error } = await supabase.from("drivers").update(d as any).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("drivers").insert(d as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["drivers"] });
      setOpen(false);
      setForm(emptyDriver);
      setEditId(null);
      toast.success(editId ? "Motorista atualizado!" : "Motorista cadastrado!");
    },
    onError: () => toast.error("Erro ao salvar motorista"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("drivers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["drivers"] });
      toast.success("Motorista removido!");
    },
    onError: () => toast.error("Erro ao remover motorista"),
  });

  const setMain = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("drivers").update({ is_main: false } as any).eq("is_main", true);
      const { error } = await supabase.from("drivers").update({ is_main: true } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["drivers"] });
      toast.success("Motorista principal definido!");
    },
  });

  const openEdit = (d: any) => {
    setEditId(d.id);
    setForm({ name: d.name, phone: d.phone || "", is_main: d.is_main });
    setOpen(true);
  };

  const activeDrivers = drivers.filter((d: any) => d.active !== false);
  const inactiveDrivers = drivers.filter((d: any) => d.active === false);

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Motoristas</h2>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setForm(emptyDriver); setEditId(null); } }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> Novo Motorista</Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>{editId ? "Editar" : "Novo"} Motorista</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); save.mutate(form); }} className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Nome *</Label>
                <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Telefone</Label>
                <Input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.is_main} onCheckedChange={(v) => setForm((p) => ({ ...p, is_main: v }))} />
                <Label className="text-xs">Motorista Principal</Label>
              </div>
              <Button type="submit" className="w-full" disabled={!form.name || save.isPending}>
                {save.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-lg bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-28">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activeDrivers.map((d: any) => (
              <TableRow key={d.id}>
                <TableCell className="font-medium">
                  {d.name}
                  {d.is_main && <Badge variant="default" className="ml-2 text-xs">Principal</Badge>}
                </TableCell>
                <TableCell>{d.phone || "—"}</TableCell>
                <TableCell><Badge variant="outline">Ativo</Badge></TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {!d.is_main && (
                      <Button variant="ghost" size="icon" title="Definir como principal" onClick={() => setMain.mutate(d.id)}>
                        <Star className="h-4 w-4 text-amber-500" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => openEdit(d)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => { if (window.confirm(`Remover "${d.name}"?`)) remove.mutate(d.id); }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {activeDrivers.length === 0 && (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nenhum motorista cadastrado</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
