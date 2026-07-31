import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Search, History, CheckCircle2, XCircle, Factory, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { format } from "date-fns";
import { useUserRole } from "@/hooks/useUserRole";



export default function Freezers() {
  const qc = useQueryClient();
  const { isDriver } = useUserRole();
  const [open, setOpen] = useState(false);
  const [maintenanceOpen, setMaintenanceOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedFreezer, setSelectedFreezer] = useState<any>(null);
  const [maintenanceForm, setMaintenanceForm] = useState({ description: "" });
  
  const [form, setForm] = useState({
    client_id: "",
    freezer_type: "horizontal",
    serial_number: "",
    contract_signed: false,
    notes: "",
    at_factory: false,
  });
  const [editId, setEditId] = useState<string | null>(null);

  const { data: freezers = [] } = useQuery({
    queryKey: ["freezers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("freezers")
        .select("*, clients(name)")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-active"],
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, name")
        .eq("active", true)
        .order("name");
      return data || [];
    },
  });

  const { data: maintenanceLogs = [] } = useQuery({
    queryKey: ["maintenance-logs", selectedFreezer?.id],
    enabled: !!selectedFreezer,
    queryFn: async () => {
      const { data } = await supabase
        .from("freezer_maintenance")
        .select("*")
        .eq("freezer_id", selectedFreezer.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const save = useMutation({
    mutationFn: async (payload: any) => {
      if (editId) {
        const { error } = await supabase.from("freezers").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("freezers").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["freezers"] });
      setOpen(false);
      resetForm();
      toast.success(editId ? "Freezer atualizado!" : "Freezer cadastrado!");
    },
    onError: (error: any) => toast.error("Erro ao salvar freezer: " + error.message),
  });

  const deleteFreezer = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("freezers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["freezers"] });
      toast.success("Freezer removido!");
    },
    onError: (error: any) => toast.error("Erro ao remover freezer: " + error.message),
  });

  const toggleContract = useMutation({
    mutationFn: async ({ id, signed }: { id: string; signed: boolean }) => {
      const { error } = await supabase
        .from("freezers")
        .update({ contract_signed: signed })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["freezers"] });
      toast.success("Status do contrato atualizado!");
    },
  });

  const saveMaintenance = useMutation({
    mutationFn: async (description: string) => {
      const { error } = await supabase.from("freezer_maintenance").insert({
        freezer_id: selectedFreezer.id,
        description,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["maintenance-logs", selectedFreezer?.id] });
      setMaintenanceForm({ description: "" });
      toast.success("Manutenção registrada!");
    },
  });

  const resetForm = () => {
    setForm({
      client_id: "",
      freezer_type: "horizontal",
      serial_number: "",
      contract_signed: false,
      notes: "",
      at_factory: false,
    });
    setEditId(null);
  };

  const openEdit = (f: any) => {
    setEditId(f.id);
    setForm({
      client_id: f.client_id || "",
      freezer_type: f.freezer_type,
      serial_number: f.serial_number || "",
      contract_signed: f.contract_signed,
      notes: f.notes || "",
      at_factory: f.at_factory || false,
    });
    setOpen(true);
  };

  const [sortBy, setSortBy] = useState<"client" | "type" | "serial" | "contract" | "updated">("updated");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const toggleSort = (col: typeof sortBy) => {
    if (sortBy === col) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortBy(col);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ col }: { col: typeof sortBy }) => {
    if (sortBy !== col) return <ArrowUpDown className="h-3 w-3 ml-1 inline opacity-40" />;
    return sortDir === "asc"
      ? <ArrowUp className="h-3 w-3 ml-1 inline" />
      : <ArrowDown className="h-3 w-3 ml-1 inline" />;
  };

  const filteredFreezers = freezers
    .filter((f: any) => {
      const clientName = f.clients?.name?.toLowerCase() || "";
      const serial = f.serial_number?.toLowerCase() || "";
      const s = search.toLowerCase();
      return clientName.includes(s) || serial.includes(s);
    })
    .slice()
    .sort((a: any, b: any) => {
      const dir = sortDir === "asc" ? 1 : -1;
      const getVal = (f: any) => {
        switch (sortBy) {
          case "client": return f.at_factory ? "zzz_fabrica" : (f.clients?.name?.toLowerCase() || "zzz");
          case "type": return f.freezer_type || "";
          case "serial": return f.serial_number?.toLowerCase() || "";
          case "contract": return f.contract_signed ? 1 : 0;
          case "updated": return new Date(f.updated_at || 0).getTime();
        }
      };
      const av = getVal(a), bv = getVal(b);
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Gerenciamento de Freezers</h2>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> Novo Freezer</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editId ? "Editar" : "Cadastrar"} Freezer</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); save.mutate({ ...form, client_id: form.at_factory ? null : (form.client_id || null) }); }} className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Cliente</Label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={form.at_factory}
                      onCheckedChange={(c) => setForm(prev => ({ ...prev, at_factory: !!c, client_id: c ? "" : prev.client_id }))}
                    />
                    <Factory className="h-4 w-4" /> Na Fábrica
                  </label>
                </div>
                <Select 
                  value={form.client_id} 
                  onValueChange={(v) => setForm(prev => ({ ...prev, client_id: v }))}
                  disabled={form.at_factory}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={form.at_factory ? "—" : "Selecione um cliente"} />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Tipo de Freezer</Label>
                <Select 
                  value={form.freezer_type} 
                  onValueChange={(v) => setForm(prev => ({ ...prev, freezer_type: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="horizontal">Horizontal</SelectItem>
                    <SelectItem value="vertical">Vertical</SelectItem>
                    <SelectItem value="mini_camara">Mini Câmara</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Numeração (Serial)</Label>
                <Input 
                  value={form.serial_number} 
                  onChange={(e) => setForm(prev => ({ ...prev, serial_number: e.target.value }))}
                  placeholder="Ex: GP-001"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Button 
                  type="button"
                  variant={form.contract_signed ? "default" : "outline"}
                  className={form.contract_signed ? "bg-green-600 hover:bg-green-700" : "text-red-500 border-red-500 hover:bg-red-50"}
                  onClick={() => setForm(prev => ({ ...prev, contract_signed: !prev.contract_signed }))}
                >
                  {form.contract_signed ? <CheckCircle2 className="h-4 w-4 mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
                  Contrato {form.contract_signed ? "Assinado" : "Pendente"}
                </Button>
              </div>

              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Observações sobre este freezer..."
                />
              </div>

              <Button type="submit" className="w-full" disabled={save.isPending}>
                {save.isPending ? "Salvando..." : "Salvar Freezer"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Buscar por cliente ou numeração..." 
          value={search} 
          onChange={(e) => setSearch(e.target.value)} 
          className="pl-9" 
        />
      </div>

      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("client")}>Cliente<SortIcon col="client" /></TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("type")}>Tipo<SortIcon col="type" /></TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("serial")}>Numeração<SortIcon col="serial" /></TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("contract")}>Contrato<SortIcon col="contract" /></TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("updated")}>Atualizado em<SortIcon col="updated" /></TableHead>
              <TableHead className="w-40 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredFreezers.map((f: any, index) => (
              <TableRow key={f.id}>
                <TableCell className="font-medium">{index + 1}</TableCell>
                <TableCell>
                  {f.at_factory ? (
                    <span className="inline-flex items-center gap-1 font-medium text-blue-700"><Factory className="h-4 w-4" /> Na Fábrica</span>
                  ) : (f.clients?.name || "Sem cliente")}
                </TableCell>
                <TableCell className="capitalize">{f.freezer_type}</TableCell>
                <TableCell>{f.serial_number || "—"}</TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={f.contract_signed ? "text-green-600 hover:text-green-700 hover:bg-green-50" : "text-red-600 hover:text-red-700 hover:bg-red-50"}
                    onClick={() => toggleContract.mutate({ id: f.id, signed: !f.contract_signed })}
                  >
                    {f.contract_signed ? <CheckCircle2 className="h-4 w-4 mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
                    {f.contract_signed ? "Assinado" : "Pendente"}
                  </Button>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {f.updated_at ? format(new Date(f.updated_at), "dd/MM/yyyy HH:mm") : "—"}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      title="Histórico de Reparos"
                      onClick={() => { setSelectedFreezer(f); setMaintenanceOpen(true); }}
                    >
                      <History className="h-4 w-4 text-blue-600" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(f)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {!isDriver && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => { if (confirm("Excluir este freezer?")) deleteFreezer.mutate(f.id); }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filteredFreezers.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Nenhum freezer encontrado
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={maintenanceOpen} onOpenChange={setMaintenanceOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Histórico de Reparos - {selectedFreezer?.serial_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 mt-4">
            <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
              <Label>Novo Reparo / Observação</Label>
              <Textarea 
                placeholder="Descreva o que foi feito no freezer..."
                value={maintenanceForm.description}
                onChange={(e) => setMaintenanceForm({ description: e.target.value })}
              />
              <Button 
                onClick={() => saveMaintenance.mutate(maintenanceForm.description)}
                disabled={!maintenanceForm.description || saveMaintenance.isPending}
              >
                Registrar Manutenção
              </Button>
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Follow-up de Manutenções</h4>
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                {maintenanceLogs.map((log: any) => (
                  <div key={log.id} className="p-3 border rounded-lg bg-card">
                    <div className="flex justify-between items-start mb-2">
                      <Badge variant="secondary">
                        {format(new Date(log.created_at), "dd/MM/yyyy HH:mm")}
                      </Badge>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{log.description}</p>
                  </div>
                ))}
                {maintenanceLogs.length === 0 && (
                  <p className="text-center py-8 text-muted-foreground text-sm">Nenhum registro de manutenção</p>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMaintenanceOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
