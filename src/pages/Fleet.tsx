import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { Plus, Pencil, Trash2, Wrench, Car } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useUserRole } from "@/hooks/useUserRole";

type Vehicle = {
  id: string;
  name: string;
  plate: string | null;
  model: string | null;
  year: number | null;
  notes: string | null;
  active: boolean;
};

type Maintenance = {
  id: string;
  vehicle_id: string;
  maintenance_date: string;
  service_type: string;
  description: string | null;
  cost: number;
  responsible: string | null;
};

const fmtMoney = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

export default function Fleet() {
  const qc = useQueryClient();
  const { isAdmin } = useUserRole();

  const [vehicleOpen, setVehicleOpen] = useState(false);
  const [editVehicleId, setEditVehicleId] = useState<string | null>(null);
  const [vehicleForm, setVehicleForm] = useState({
    name: "",
    plate: "",
    model: "",
    year: "",
    notes: "",
    active: true,
  });

  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);

  const [maintOpen, setMaintOpen] = useState(false);
  const [editMaintId, setEditMaintId] = useState<string | null>(null);
  const [maintForm, setMaintForm] = useState({
    maintenance_date: format(new Date(), "yyyy-MM-dd"),
    service_type: "",
    description: "",
    cost: "",
    responsible: "",
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ["fleet-vehicles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fleet_vehicles" as any)
        .select("*")
        .order("name");
      if (error) throw error;
      return (data as any as Vehicle[]) || [];
    },
  });

  const { data: maintenances = [] } = useQuery({
    queryKey: ["fleet-maintenances", selectedVehicle?.id],
    queryFn: async () => {
      if (!selectedVehicle) return [];
      const { data, error } = await supabase
        .from("fleet_maintenances" as any)
        .select("*")
        .eq("vehicle_id", selectedVehicle.id)
        .order("maintenance_date", { ascending: false });
      if (error) throw error;
      return (data as any as Maintenance[]) || [];
    },
    enabled: !!selectedVehicle,
  });

  const totalCost = maintenances.reduce((s, m) => s + Number(m.cost || 0), 0);

  const resetVehicleForm = () => {
    setVehicleForm({ name: "", plate: "", model: "", year: "", notes: "", active: true });
    setEditVehicleId(null);
  };

  const openNewVehicle = () => {
    resetVehicleForm();
    setVehicleOpen(true);
  };

  const openEditVehicle = (v: Vehicle) => {
    setEditVehicleId(v.id);
    setVehicleForm({
      name: v.name,
      plate: v.plate || "",
      model: v.model || "",
      year: v.year ? String(v.year) : "",
      notes: v.notes || "",
      active: v.active,
    });
    setVehicleOpen(true);
  };

  const saveVehicle = useMutation({
    mutationFn: async () => {
      const payload = {
        name: vehicleForm.name.trim(),
        plate: vehicleForm.plate.trim() || null,
        model: vehicleForm.model.trim() || null,
        year: vehicleForm.year ? Number(vehicleForm.year) : null,
        notes: vehicleForm.notes.trim() || null,
        active: vehicleForm.active,
      };
      if (!payload.name) throw new Error("Nome do veículo é obrigatório");
      if (editVehicleId) {
        const { error } = await supabase
          .from("fleet_vehicles" as any)
          .update(payload)
          .eq("id", editVehicleId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("fleet_vehicles" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fleet-vehicles"] });
      setVehicleOpen(false);
      resetVehicleForm();
      toast.success("Veículo salvo");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar"),
  });

  const deleteVehicle = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("fleet_vehicles" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fleet-vehicles"] });
      setSelectedVehicle(null);
      toast.success("Veículo removido");
    },
    onError: (e: any) => toast.error(e.message || "Erro"),
  });

  const resetMaintForm = () => {
    setMaintForm({
      maintenance_date: format(new Date(), "yyyy-MM-dd"),
      service_type: "",
      description: "",
      cost: "",
      responsible: "",
    });
    setEditMaintId(null);
  };

  const openNewMaint = () => {
    resetMaintForm();
    setMaintOpen(true);
  };

  const openEditMaint = (m: Maintenance) => {
    setEditMaintId(m.id);
    setMaintForm({
      maintenance_date: m.maintenance_date,
      service_type: m.service_type,
      description: m.description || "",
      cost: String(m.cost || ""),
      responsible: m.responsible || "",
    });
    setMaintOpen(true);
  };

  const saveMaint = useMutation({
    mutationFn: async () => {
      if (!selectedVehicle) throw new Error("Selecione um veículo");
      const payload = {
        vehicle_id: selectedVehicle.id,
        maintenance_date: maintForm.maintenance_date,
        service_type: maintForm.service_type.trim(),
        description: maintForm.description.trim() || null,
        cost: maintForm.cost ? Number(maintForm.cost) : 0,
        responsible: maintForm.responsible.trim() || null,
      };
      if (!payload.service_type) throw new Error("Informe o que foi feito");
      if (editMaintId) {
        const { error } = await supabase
          .from("fleet_maintenances" as any)
          .update(payload)
          .eq("id", editMaintId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("fleet_maintenances" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fleet-maintenances", selectedVehicle?.id] });
      setMaintOpen(false);
      resetMaintForm();
      toast.success("Manutenção salva");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar"),
  });

  const deleteMaint = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("fleet_maintenances" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fleet-maintenances", selectedVehicle?.id] });
      toast.success("Manutenção removida");
    },
    onError: (e: any) => toast.error(e.message || "Erro"),
  });

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Frota</h1>
          <p className="text-sm text-muted-foreground">
            Cadastro de veículos e histórico de manutenções.
          </p>
        </div>
        <Button onClick={openNewVehicle}>
          <Plus className="h-4 w-4 mr-1" /> Novo Veículo
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Veículo</TableHead>
              <TableHead>Placa</TableHead>
              <TableHead>Modelo</TableHead>
              <TableHead>Ano</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vehicles.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Nenhum veículo cadastrado.
                </TableCell>
              </TableRow>
            )}
            {vehicles.map((v) => (
              <TableRow key={v.id}>
                <TableCell className="font-medium">
                  <button
                    className="flex items-center gap-2 hover:underline text-left"
                    onClick={() => setSelectedVehicle(v)}
                  >
                    <Car className="h-4 w-4 text-primary" />
                    {v.name}
                  </button>
                </TableCell>
                <TableCell>{v.plate || "-"}</TableCell>
                <TableCell>{v.model || "-"}</TableCell>
                <TableCell>{v.year || "-"}</TableCell>
                <TableCell>
                  {v.active ? (
                    <Badge>Ativo</Badge>
                  ) : (
                    <Badge variant="secondary">Inativo</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right space-x-1">
                  <Button size="sm" variant="outline" onClick={() => setSelectedVehicle(v)}>
                    <Wrench className="h-4 w-4 mr-1" /> Manutenções
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => openEditVehicle(v)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  {isAdmin && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        if (confirm("Remover este veículo e todo o histórico de manutenções?"))
                          deleteVehicle.mutate(v.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Dialog Veículo */}
      <Dialog open={vehicleOpen} onOpenChange={setVehicleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editVehicleId ? "Editar Veículo" : "Novo Veículo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome / Identificação *</Label>
              <Input
                value={vehicleForm.name}
                onChange={(e) => setVehicleForm({ ...vehicleForm, name: e.target.value })}
                placeholder="Ex: Fiorino Branca"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Placa</Label>
                <Input
                  value={vehicleForm.plate}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, plate: e.target.value })}
                />
              </div>
              <div>
                <Label>Ano</Label>
                <Input
                  type="number"
                  value={vehicleForm.year}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, year: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Modelo</Label>
              <Input
                value={vehicleForm.model}
                onChange={(e) => setVehicleForm({ ...vehicleForm, model: e.target.value })}
              />
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea
                value={vehicleForm.notes}
                onChange={(e) => setVehicleForm({ ...vehicleForm, notes: e.target.value })}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={vehicleForm.active}
                onChange={(e) => setVehicleForm({ ...vehicleForm, active: e.target.checked })}
              />
              Ativo
            </label>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setVehicleOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => saveVehicle.mutate()} disabled={saveVehicle.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Histórico de Manutenções */}
      <Dialog
        open={!!selectedVehicle}
        onOpenChange={(o) => {
          if (!o) setSelectedVehicle(null);
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Car className="h-5 w-5" />
              {selectedVehicle?.name}
              {selectedVehicle?.plate && (
                <span className="text-sm text-muted-foreground font-normal">
                  · {selectedVehicle.plate}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {maintenances.length} manutenções · Total gasto:{" "}
              <span className="font-semibold text-foreground">{fmtMoney(totalCost)}</span>
            </div>
            <Button size="sm" onClick={openNewMaint}>
              <Plus className="h-4 w-4 mr-1" /> Nova Manutenção
            </Button>
          </div>

          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Serviço</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {maintenances.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                      Nenhuma manutenção registrada.
                    </TableCell>
                  </TableRow>
                )}
                {maintenances.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      {format(new Date(m.maintenance_date + "T12:00:00"), "dd/MM/yyyy", {
                        locale: ptBR,
                      })}
                    </TableCell>
                    <TableCell className="font-medium">{m.service_type}</TableCell>
                    <TableCell className="max-w-xs truncate" title={m.description || ""}>
                      {m.description || "-"}
                    </TableCell>
                    <TableCell>{m.responsible || "-"}</TableCell>
                    <TableCell className="text-right">{fmtMoney(Number(m.cost))}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="icon" variant="ghost" onClick={() => openEditMaint(m)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          if (confirm("Remover esta manutenção?")) deleteMaint.mutate(m.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Manutenção */}
      <Dialog open={maintOpen} onOpenChange={setMaintOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editMaintId ? "Editar Manutenção" : "Nova Manutenção"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data *</Label>
                <Input
                  type="date"
                  value={maintForm.maintenance_date}
                  onChange={(e) =>
                    setMaintForm({ ...maintForm, maintenance_date: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Valor (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={maintForm.cost}
                  onChange={(e) => setMaintForm({ ...maintForm, cost: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>O que foi feito *</Label>
              <Input
                value={maintForm.service_type}
                onChange={(e) => setMaintForm({ ...maintForm, service_type: e.target.value })}
                placeholder="Ex: Troca de óleo"
              />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea
                value={maintForm.description}
                onChange={(e) => setMaintForm({ ...maintForm, description: e.target.value })}
                placeholder="Detalhes do serviço, peças trocadas, quilometragem..."
              />
            </div>
            <div>
              <Label>Responsável</Label>
              <Input
                value={maintForm.responsible}
                onChange={(e) => setMaintForm({ ...maintForm, responsible: e.target.value })}
                placeholder="Ex: Oficina do João"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setMaintOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => saveMaint.mutate()} disabled={saveMaint.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
