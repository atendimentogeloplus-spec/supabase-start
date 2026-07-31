import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import { Card, CardContent } from "@/components/ui/card";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Pencil, Trash2, Plus, Phone, MapPin, Target, Search } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

type LeadStatus = "contato" | "compra_gelo" | "clientes_grandes" | "negociacao" | "nao_tem_como" | "fechado";

interface Lead {
  id: string;
  client_name: string;
  phone: string | null;
  address: string | null;
  region: string | null;
  order_projection: string | null;
  observations: string | null;
  status: LeadStatus;
  position: number;
  created_at: string;
  updated_at: string;
}

const COLUMNS: { key: LeadStatus; title: string; color: string }[] = [
  { key: "contato", title: "Entrar em Contato", color: "bg-blue-500" },
  { key: "compra_gelo", title: "Compra Gelo", color: "bg-cyan-500" },
  { key: "clientes_grandes", title: "Clientes Grandes", color: "bg-purple-500" },
  { key: "negociacao", title: "Em Negociação", color: "bg-amber-500" },
  { key: "nao_tem_como", title: "Não tem Como", color: "bg-red-500" },
  { key: "fechado", title: "Fechado", color: "bg-green-600" },
];

const emptyForm = {
  client_name: "",
  phone: "",
  address: "",
  region: "",
  order_projection: "",
  observations: "",
  status: "contato" as LeadStatus,
};

export default function Leads() {
  const { session } = useAuth();
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  const { data: leads = [] } = useQuery({
    queryKey: ["leads", session?.user?.id],
    enabled: !!session?.user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .order("position", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Lead[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.client_name.trim()) throw new Error("Nome do cliente é obrigatório");
      const payload = {
        client_name: form.client_name.trim(),
        phone: form.phone || null,
        address: form.address || null,
        region: form.region || null,
        order_projection: form.order_projection || null,
        observations: form.observations || null,
        status: form.status,
      };
      if (editingId) {
        const { error } = await supabase.from("leads").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("leads").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      toast.success(editingId ? "Lead atualizado" : "Lead criado");
      setEditOpen(false);
      setEditingId(null);
      setForm(emptyForm);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("leads").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Lead apagado");
      setDeleteId(null);
      setDetailsOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const moveStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: LeadStatus }) => {
      const { error } = await supabase.from("leads").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: ["leads"] });
      const prev = qc.getQueryData<Lead[]>(["leads", session?.user?.id]);
      qc.setQueryData<Lead[]>(["leads", session?.user?.id], (old) =>
        (old ?? []).map((l) => (l.id === id ? { ...l, status } : l)),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["leads", session?.user?.id], ctx.prev);
      toast.error("Erro ao mover lead");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
  });

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setEditOpen(true);
  }

  function openEdit(lead: Lead) {
    setEditingId(lead.id);
    setForm({
      client_name: lead.client_name,
      phone: lead.phone ?? "",
      address: lead.address ?? "",
      region: lead.region ?? "",
      order_projection: lead.order_projection ?? "",
      observations: lead.observations ?? "",
      status: lead.status,
    });
    setEditOpen(true);
    setDetailsOpen(false);
  }

  function handleDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const lead = leads.find((l) => l.id === active.id);
    if (!lead) return;
    const newStatus = over.id as LeadStatus;
    if (!COLUMNS.find((c) => c.key === newStatus)) return;
    if (lead.status === newStatus) return;
    moveStatusMutation.mutate({ id: lead.id, status: newStatus });
  }

  const activeLead = activeId ? leads.find((l) => l.id === activeId) : null;

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Leads</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie potenciais clientes em formato Kanban
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setSearchTerm(""); setSearchOpen(true); }}>
            <Search className="h-4 w-4" /> Pesquisar
          </Button>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Novo Lead
          </Button>
        </div>
      </div>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
          {COLUMNS.map((col) => {
            const colLeads = leads.filter((l) => l.status === col.key);
            return (
              <KanbanColumn key={col.key} column={col} count={colLeads.length}>
                {colLeads.map((lead) => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    onClick={() => {
                      setSelectedLead(lead);
                      setDetailsOpen(true);
                    }}
                    onEdit={() => openEdit(lead)}
                    onDelete={() => setDeleteId(lead.id)}
                  />
                ))}
                {colLeads.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-6">
                    Sem leads
                  </p>
                )}
              </KanbanColumn>
            );
          })}
        </div>
        <DragOverlay>
          {activeLead && (
            <div className="rotate-2 opacity-90">
              <LeadCardView lead={activeLead} />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedLead?.client_name}</DialogTitle>
          </DialogHeader>
          {selectedLead && (
            <div className="space-y-3 text-sm">
              <DetailRow label="Telefone" value={selectedLead.phone} />
              <DetailRow label="Endereço" value={selectedLead.address} />
              <DetailRow label="Região" value={selectedLead.region} />
              <DetailRow
                label="Projeção de Pedido"
                value={selectedLead.order_projection}
              />
              <div>
                <p className="font-medium text-muted-foreground mb-1">
                  Observações / Follow-up
                </p>
                <p className="whitespace-pre-wrap rounded-md bg-muted p-3 min-h-[60px]">
                  {selectedLead.observations || "—"}
                </p>
              </div>
              <div>
                <p className="font-medium text-muted-foreground mb-1">Status</p>
                <p>{COLUMNS.find((c) => c.key === selectedLead.status)?.title}</p>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => selectedLead && openEdit(selectedLead)}
            >
              <Pencil className="h-4 w-4" /> Editar
            </Button>
            <Button
              variant="destructive"
              onClick={() => selectedLead && setDeleteId(selectedLead.id)}
            >
              <Trash2 className="h-4 w-4" /> Apagar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit/Create Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Lead" : "Novo Lead"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Cliente *</Label>
              <Input
                value={form.client_name}
                onChange={(e) => setForm({ ...form, client_name: e.target.value })}
              />
              {(() => {
                const term = form.client_name.trim().toLowerCase();
                if (term.length < 2) return null;
                const matches = leads.filter(
                  (l) =>
                    l.id !== editingId &&
                    l.client_name.toLowerCase().includes(term),
                );
                if (matches.length === 0) return null;
                return (
                  <div className="mt-1 rounded-md border bg-muted/40 p-2 space-y-1 max-h-40 overflow-y-auto">
                    <p className="text-xs text-amber-700 font-medium">
                      ⚠ Já existe lead com nome parecido:
                    </p>
                    {matches.slice(0, 5).map((l) => {
                      const col = COLUMNS.find((c) => c.key === l.status);
                      return (
                        <button
                          key={l.id}
                          type="button"
                          onClick={() => {
                            setEditOpen(false);
                            setSelectedLead(l);
                            setDetailsOpen(true);
                          }}
                          className="w-full text-left text-xs rounded px-2 py-1 hover:bg-background flex items-center justify-between gap-2"
                        >
                          <span className="truncate">{l.client_name}</span>
                          {col && (
                            <span className="flex items-center gap-1 shrink-0">
                              <span className={`h-2 w-2 rounded-full ${col.color}`} />
                              {col.title}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Telefone</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div>
                <Label>Região</Label>
                <Input
                  value={form.region}
                  onChange={(e) => setForm({ ...form, region: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Endereço</Label>
              <Input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>
            <div>
              <Label>Projeção de Pedido</Label>
              <Input
                value={form.order_projection}
                onChange={(e) =>
                  setForm({ ...form, order_projection: e.target.value })
                }
                placeholder="Ex: 50 pacotes/semana"
              />
            </div>
            <div>
              <Label>Status</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.status}
                onChange={(e) =>
                  setForm({ ...form, status: e.target.value as LeadStatus })
                }
              >
                {COLUMNS.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Observações / Follow-up</Label>
              <Textarea
                rows={4}
                value={form.observations}
                onChange={(e) => setForm({ ...form, observations: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar Lead?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
            >
              Apagar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Pesquisar Lead</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            placeholder="Digite nome, telefone ou região..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <ScrollArea className="flex-1 min-h-0 h-[60vh] -mx-2">
            <div className="px-2 space-y-1">
              {(() => {
                const term = searchTerm.trim().toLowerCase();
                const base = term
                  ? leads.filter((l) =>
                      [l.client_name, l.phone, l.region, l.address]
                        .filter(Boolean)
                        .some((v) => v!.toLowerCase().includes(term)),
                    )
                  : leads;
                const filtered = [...base].sort((a, b) =>
                  a.client_name.localeCompare(b.client_name, "pt-BR", { sensitivity: "base" }),
                );
                if (filtered.length === 0) {
                  return (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      Nenhum lead encontrado
                    </p>
                  );
                }
                return filtered.map((lead) => {
                  const col = COLUMNS.find((c) => c.key === lead.status);
                  return (
                    <button
                      key={lead.id}
                      onClick={() => {
                        setSelectedLead(lead);
                        setSearchOpen(false);
                        setDetailsOpen(true);
                      }}
                      className="w-full text-left rounded-md border p-2 hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-sm">{lead.client_name}</p>
                        {col && (
                          <span className="text-xs flex items-center gap-1">
                            <span className={`h-2 w-2 rounded-full ${col.color}`} />
                            {col.title}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {[lead.phone, lead.region].filter(Boolean).join(" • ") || "—"}
                      </p>
                    </button>
                  );
                });
              })()}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="font-medium text-muted-foreground">{label}</p>
      <p>{value || "—"}</p>
    </div>
  );
}

function KanbanColumn({
  column,
  count,
  children,
}: {
  column: { key: LeadStatus; title: string; color: string };
  count: number;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.key });
  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg border bg-muted/30 flex flex-col min-h-[200px] transition-colors ${
        isOver ? "bg-muted/70 ring-2 ring-primary" : ""
      }`}
    >
      <div className="flex items-center justify-between p-3 border-b">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${column.color}`} />
          <h3 className="font-semibold text-sm">{column.title}</h3>
        </div>
        <span className="text-xs bg-background rounded-full px-2 py-0.5 border">
          {count}
        </span>
      </div>
      <div className="p-2 space-y-2 flex-1">{children}</div>
    </div>
  );
}

function LeadCard({
  lead,
  onClick,
  onEdit,
  onDelete,
}: {
  lead: Lead;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: lead.id,
  });
  return (
    <div
      ref={setNodeRef}
      style={{ opacity: isDragging ? 0.4 : 1 }}
      {...attributes}
      {...listeners}
    >
      <div onClick={onClick} className="cursor-pointer">
        <LeadCardView lead={lead} onEdit={onEdit} onDelete={onDelete} />
      </div>
    </div>
  );
}

function LeadCardView({
  lead,
  onEdit,
  onDelete,
}: {
  lead: Lead;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-3 space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold text-sm leading-tight">{lead.client_name}</p>
          {(onEdit || onDelete) && (
            <div className="flex gap-0.5 -mr-1 -mt-1" onPointerDown={(e) => e.stopPropagation()}>
              {onEdit && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit();
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              )}
              {onDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          )}
        </div>
        {lead.phone && (
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Phone className="h-3 w-3" /> {lead.phone}
          </p>
        )}
        {lead.region && (
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <MapPin className="h-3 w-3" /> {lead.region}
          </p>
        )}
        {lead.order_projection && (
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Target className="h-3 w-3" /> {lead.order_projection}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
