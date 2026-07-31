import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Trash2, GripVertical, Check, X, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";

type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "avulsos";

type Item = {
  id: string;
  day: DayKey;
  client_name: string;
  position: number;
  notes: string | null;
  contacted: boolean;
};

const COLUMNS: { key: DayKey; label: string; color: string }[] = [
  { key: "mon", label: "Segunda", color: "bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300" },
  { key: "tue", label: "Terça", color: "bg-orange-100 dark:bg-orange-900/30 border-orange-300" },
  { key: "wed", label: "Quarta", color: "bg-pink-100 dark:bg-pink-900/30 border-pink-300" },
  { key: "thu", label: "Quinta", color: "bg-blue-100 dark:bg-blue-900/30 border-blue-300" },
  { key: "fri", label: "Sexta", color: "bg-green-100 dark:bg-green-900/30 border-green-300" },
  { key: "sat", label: "Sábado", color: "bg-purple-100 dark:bg-purple-900/30 border-purple-300" },
  { key: "avulsos", label: "Avulsos", color: "bg-slate-100 dark:bg-slate-800 border-slate-300" },
];

export default function WeekPlan() {
  const qc = useQueryClient();
  const { isAdmin } = useUserRole();
  const [pickerDay, setPickerDay] = useState<DayKey | null>(null);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<{ id: string; value: string } | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const topFloatRef = useRef<HTMLDivElement>(null);
  const floatRef = useRef<HTMLDivElement>(null);
  const [needsFloat, setNeedsFloat] = useState(false);



  const { data: clients = [] } = useQuery({
    queryKey: ["week-plan-clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name")
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: items = [] } = useQuery({
    queryKey: ["week-plan-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("week_plan_items" as any)
        .select("*")
        .order("position", { ascending: true });
      if (error) throw error;
      return (data as any as Item[]) || [];
    },
  });

  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;

    const syncScroll = () => {
      if (topFloatRef.current) topFloatRef.current.scrollLeft = scrollEl.scrollLeft;
      if (floatRef.current) floatRef.current.scrollLeft = scrollEl.scrollLeft;
    };
    const checkOverflow = () => {
      setNeedsFloat(scrollEl.scrollWidth > scrollEl.clientWidth);
    };

    checkOverflow();
    scrollEl.addEventListener("scroll", syncScroll);
    window.addEventListener("resize", checkOverflow);

    const observer = new ResizeObserver(checkOverflow);
    observer.observe(scrollEl);

    return () => {
      scrollEl.removeEventListener("scroll", syncScroll);
      window.removeEventListener("resize", checkOverflow);
      observer.disconnect();
    };
  }, [items]);

  const syncFromTopFloat = () => {
    if (topFloatRef.current && scrollRef.current) scrollRef.current.scrollLeft = topFloatRef.current.scrollLeft;
  };

  const syncFromBottomFloat = () => {
    if (floatRef.current && scrollRef.current) scrollRef.current.scrollLeft = floatRef.current.scrollLeft;
  };

  const { data: inRouteNames = new Set<string>() } = useQuery({
    queryKey: ["week-plan-in-route"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("route_clients")
        .select("clients(name)");
      if (error) throw error;
      const set = new Set<string>();
      (data || []).forEach((rc: any) => {
        const n = rc?.clients?.name;
        if (n) set.add(n.trim().toLowerCase());
      });
      return set;
    },
    refetchInterval: 15000,
  });

  const addItem = useMutation({
    mutationFn: async ({ day, name }: { day: DayKey; name: string }) => {
      const colItems = items.filter((i) => i.day === day);
      const pos = colItems.length ? Math.max(...colItems.map((i) => i.position)) + 1 : 0;
      const { error } = await supabase
        .from("week_plan_items" as any)
        .insert({ day, client_name: name.trim(), position: pos });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["week-plan-items"] });
      setPickerDay(null);
      setSearch("");
    },
    onError: (e: any) => toast.error(e.message || "Erro"),
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Item> }) => {
      const { error } = await supabase
        .from("week_plan_items" as any)
        .update(patch)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["week-plan-items"] }),
    onError: (e: any) => toast.error(e.message || "Erro"),
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("week_plan_items" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["week-plan-items"] }),
    onError: (e: any) => toast.error(e.message || "Erro"),
  });

  const reorder = useMutation({
    mutationFn: async (updates: { id: string; day: DayKey; position: number }[]) => {
      for (const u of updates) {
        const { error } = await supabase
          .from("week_plan_items" as any)
          .update({ day: u.day, position: u.position })
          .eq("id", u.id);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["week-plan-items"] }),
    onError: (e: any) => toast.error(e.message || "Erro ao reordenar"),
  });

  const handleDrop = (targetDay: DayKey, targetId?: string) => {
    if (!dragId) return;
    const dragged = items.find((i) => i.id === dragId);
    if (!dragged) return;
    const sourceDay = dragged.day;

    const dest = items.filter((i) => i.day === targetDay && i.id !== dragId).sort((a, b) => a.position - b.position);
    let insertIdx = dest.length;
    if (targetId) {
      const idx = dest.findIndex((i) => i.id === targetId);
      if (idx >= 0) insertIdx = idx;
    }
    const newDest = [...dest.slice(0, insertIdx), dragged, ...dest.slice(insertIdx)];
    const updates: { id: string; day: DayKey; position: number }[] = newDest.map((it, idx) => ({
      id: it.id,
      day: targetDay,
      position: idx,
    }));
    if (sourceDay !== targetDay) {
      const src = items
        .filter((i) => i.day === sourceDay && i.id !== dragId)
        .sort((a, b) => a.position - b.position)
        .map((it, idx) => ({ id: it.id, day: sourceDay, position: idx }));
      updates.push(...src);
    }
    reorder.mutate(updates);
    setDragId(null);
  };

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Plano da Semana</h1>
        <p className="text-sm text-muted-foreground">
          Organize os clientes por dia da semana. Arraste para reorganizar.
        </p>
      </div>

      <div className="sticky top-0 z-[100] bg-background py-1">
        <div ref={topFloatRef} onScroll={syncFromTopFloat} className="h-5 border-y overflow-x-scroll">
          <div className="w-[1400px] h-px" />
        </div>
      </div>

      <div ref={scrollRef} className="overflow-x-auto pb-2 -mx-4 px-4 sm:-mx-6 sm:px-6">
        <div className="grid grid-cols-7 gap-3 min-w-[1400px]">
          {COLUMNS.map((col) => {
            const colItems = items
              .filter((i) => i.day === col.key)
              .sort((a, b) => a.position - b.position);
            return (
              <div
                key={col.key}
                className={`rounded-lg border-2 ${col.color} flex flex-col min-h-[400px]`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(col.key)}
              >
                <div className="p-3 border-b-2 border-inherit font-semibold text-center text-base">
                  {col.label}
                  <span className="ml-2 text-xs text-muted-foreground">({colItems.length})</span>
                </div>
                <div className="flex-1 p-2 space-y-2">
                {colItems.map((it) => {
                  const inRoute = inRouteNames.has(it.client_name.trim().toLowerCase());
                  const cardCls = inRoute
                    ? "bg-neutral-900 text-white border-neutral-950 dark:bg-black dark:border-neutral-800"
                    : it.contacted
                      ? "bg-orange-500 text-white border-orange-600"
                      : "bg-background";
                  return (
                  <div
                    key={it.id}
                    draggable
                    onDragStart={(e) => {
                      setDragId(it.id);
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", it.id);
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.stopPropagation();
                      handleDrop(col.key, it.id);
                    }}
                    className={`group rounded px-3 py-2.5 border shadow-sm flex items-start gap-2 cursor-move text-sm ${cardCls}`}
                  >
                    <GripVertical className={`h-4 w-4 shrink-0 mt-0.5 ${inRoute || it.contacted ? "text-white/70" : "text-muted-foreground"}`} />
                    {editing?.id === it.id ? (
                      <>
                        <Input
                          value={editing.value}
                          onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                          className="h-7 text-sm px-1"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              updateItem.mutate({ id: it.id, patch: { client_name: editing.value.trim() } });
                              setEditing(null);
                            } else if (e.key === "Escape") setEditing(null);
                          }}
                        />
                        <button
                          onClick={() => {
                            updateItem.mutate({ id: it.id, patch: { client_name: editing.value.trim() } });
                            setEditing(null);
                          }}
                          className="text-green-600"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button onClick={() => setEditing(null)} className="text-muted-foreground">
                          <X className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        {inRoute && <CheckCircle2 className="h-4 w-4 text-white shrink-0 mt-0.5" />}
                        <span
                          className={`flex-1 break-words leading-snug cursor-pointer ${inRoute ? "line-through decoration-white/60" : ""}`}
                          onClick={() => {
                            if (inRoute) return;
                            updateItem.mutate({ id: it.id, patch: { contacted: !it.contacted } });
                          }}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            setEditing({ id: it.id, value: it.client_name });
                          }}
                          title="Clique: marcar como contatado • Duplo clique: editar"
                        >
                          {it.client_name}
                        </span>
                        {isAdmin && (
                          <button
                            onClick={() => {
                              if (confirm("Remover cliente?")) deleteItem.mutate(it.id);
                            }}
                            className={`opacity-0 group-hover:opacity-100 ${inRoute || it.contacted ? "text-white" : "text-destructive"}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                  );
                })}
              </div>
              <div className="p-2 border-t border-inherit">
                <Button
                  size="sm"
                  variant="ghost"
                  className="w-full h-7 text-xs justify-start"
                  onClick={() => { setPickerDay(col.key); setSearch(""); }}
                >
                  <Plus className="h-3 w-3 mr-1" /> Adicionar cliente
                </Button>
              </div>
            </div>
          );
        })}
        </div>
      </div>

      {needsFloat && (
        <div
          ref={floatRef}
          onScroll={syncFromBottomFloat}
          className="fixed bottom-0 left-0 right-0 h-4 bg-background border-t z-[100] overflow-x-scroll"
        >
          <div className="w-[1400px] h-px" />
        </div>
      )}

      <Dialog open={pickerDay !== null} onOpenChange={(o) => { if (!o) setPickerDay(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Selecionar cliente</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            placeholder="Buscar cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <ScrollArea className="h-72">
            <div className="space-y-1 pr-2">
              {clients
                .filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
                .map((c) => (
                  <button
                    key={c.id}
                    onClick={() => pickerDay && addItem.mutate({ day: pickerDay, name: c.name })}
                    className="w-full text-left px-3 py-2 rounded hover:bg-accent text-sm"
                  >
                    {c.name}
                  </button>
                ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
