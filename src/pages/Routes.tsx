import { useState, useCallback, useMemo, memo, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, GripVertical, ShoppingCart, ChevronLeft, Pencil, MapPin, Check, Search, Copy, Eraser } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const WEEKDAY_OPTIONS = [
  { value: 1, label: "Segunda-feira" },
  { value: 2, label: "Terça-feira" },
  { value: 3, label: "Quarta-feira" },
  { value: 4, label: "Quinta-feira" },
  { value: 5, label: "Sexta-feira" },
  { value: 6, label: "Sábado" },
  { value: 0, label: "Domingo" },
];

const PERIOD_OPTIONS = [
  { value: "morning", label: "Manhã" },
  { value: "afternoon", label: "Tarde" },
];

/** Given a weekday (0=Sun..6=Sat), return the date for that day in the current week (Mon-Sun). */
function getRouteDate(weekday: number): Date {
  const today = new Date();
  const currentDay = today.getDay(); // 0=Sun
  const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset);
  monday.setHours(0, 0, 0, 0);
  const targetOffset = weekday === 0 ? 6 : weekday - 1;
  const result = new Date(monday);
  result.setDate(monday.getDate() + targetOffset);
  return result;
}

function formatRouteDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getRouteDisplayName(route: any): string {
  let name = route.name;
  if (route.weekday != null) {
    const d = getRouteDate(route.weekday);
    name += ` (${formatRouteDate(d)})`;
  }
  return name;
}

interface FlatItem {
  id: string;
  rcId: string;
  client_id: string;
  client_name: string;
  product_id: string;
  product_name: string;
  price_table_name: string;
  quantity: number;
  position: number;
  observations: string | null;
}

const SortableItemRow = memo(({
  item,
  onRemove,
  onOrder,
  onUpdate,
  onMoveRoute,
  ordered,
  products,
  priceTables,
  routes,
  currentRouteId,
  readOnly = false,
  canDelete = true,
  isFirstInGroup,
  groupSize,
}: {
  item: FlatItem;
  onRemove: (id: string) => void;
  onOrder: (clientId: string) => void;
  onUpdate: (id: string, field: string, value: string | number) => void;
  onMoveRoute: (itemId: string, targetRouteId: string) => void;
  ordered: boolean;
  products: Array<{ id: string; name: string }>;
  priceTables: Array<{ id: string; name: string; price: number }>;
  routes: Array<{ id: string; name: string; weekday?: number | null }>;
  currentRouteId: string;
  readOnly?: boolean;
  canDelete?: boolean;
  isFirstInGroup: boolean;
  groupSize: number;
}) => {

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  const [editingQty, setEditingQty] = useState(false);
  const [localQty, setLocalQty] = useState(String(item.quantity));

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={cn(
        ordered && "bg-[hsl(var(--success)/0.08)]",
        isFirstInGroup && "border-t-2 border-t-primary/40"
      )}
    >
      <TableCell className="w-8 px-1">
        {readOnly || !isFirstInGroup ? (
          <span className="inline-block w-4" />
        ) : (
          <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 touch-none">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </TableCell>
      <TableCell className="font-medium text-sm">
        {isFirstInGroup ? (
          <div className="flex items-center gap-2">
            {ordered ? <Check className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--success))]" /> : null}
            <span>{item.client_name}</span>
            {groupSize > 1 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                {groupSize} itens
              </Badge>
            )}
          </div>
        ) : (
          <span className="text-muted-foreground/50 text-xs pl-4">↳</span>
        )}
      </TableCell>
      <TableCell className="text-sm p-1">
        {readOnly ? (
          <span className="text-xs">{item.product_name}</span>
        ) : (
          <Select value={item.product_id} onValueChange={(v) => onUpdate(item.id, "product_id", v)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {products.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </TableCell>
      <TableCell className="text-sm p-1">
        {readOnly ? (
          <span className="text-xs">{item.price_table_name}</span>
        ) : (
          <Select value={item.price_table_name} onValueChange={(v) => onUpdate(item.id, "price_table_name", v)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {priceTables.map((pt) => (
                <SelectItem key={pt.id} value={pt.name}>{pt.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </TableCell>
      <TableCell className="text-sm p-1">
        {readOnly || !isFirstInGroup ? null : (
          <Select
            value={currentRouteId}
            onValueChange={(v) => {
              if (v !== currentRouteId) onMoveRoute(item.id, v);
            }}
            disabled={ordered}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {routes.map((r) => (
                <SelectItem key={r.id} value={r.id}>{getRouteDisplayName(r)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </TableCell>
      <TableCell className="text-sm text-center p-1">
        {editingQty && !ordered && !readOnly ? (
          <Input
            type="number"
            min="1"
            className="w-16 h-8 text-xs text-center mx-auto"
            value={localQty}
            autoFocus
            onChange={(e) => setLocalQty(e.target.value)}
            onBlur={() => {
              const val = parseInt(localQty) || item.quantity;
              if (val !== item.quantity) onUpdate(item.id, "quantity", val);
              setEditingQty(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
          />
        ) : (
          <span
            className={ordered || readOnly ? "px-2 py-1 inline-block font-medium" : "cursor-pointer hover:underline px-2 py-1 inline-block"}
            onClick={() => {
              if (!ordered && !readOnly) {
                setLocalQty(String(item.quantity));
                setEditingQty(true);
              }
            }}
          >
            {item.quantity}
          </span>
        )}
      </TableCell>
      <TableCell className="px-2">
        <div className="flex items-center justify-end gap-2">
          {isFirstInGroup && ordered ? (
            <Badge
              variant="secondary"
              className="border-0 bg-[hsl(var(--success)/0.14)] text-[hsl(var(--success))]"
            >
              <Check className="h-3 w-3 mr-1" /> Feito
            </Badge>
          ) : isFirstInGroup && !readOnly ? (
            <Button size="sm" className="h-9 min-w-[96px] justify-center gap-2" onClick={() => onOrder(item.client_id)}>
              <ShoppingCart className="h-4 w-4" />
              Pedido
            </Button>
          ) : null}
          {!readOnly && canDelete && (
            <Button size="sm" variant="ghost" onClick={() => onRemove(item.id)}>
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
});


SortableItemRow.displayName = "SortableItemRow";

export default function Routes() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { isDriver, isAdmin } = useUserRole();
  const readOnly = isDriver;
  const canDelete = isAdmin;
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [routeName, setRouteName] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [routeWeekday, setRouteWeekday] = useState<string>("");
  const [routePeriod, setRoutePeriod] = useState<string>("");
  const [routeDriverId, setRouteDriverId] = useState<string>("");
  const [globalBatch, setGlobalBatch] = useState<string>(() => localStorage.getItem("lastBatchNumber") || "");

  // Inline add state
  const [addClientId, setAddClientId] = useState("");
  const [addProductId, setAddProductId] = useState("");
  const [addTableName, setAddTableName] = useState("");
  const [addQty, setAddQty] = useState("1");

  // Client search dialog
  const [clientSearchOpen, setClientSearchOpen] = useState(false);
  const [clientSearchTerm, setClientSearchTerm] = useState("");

  // Last order dialog
  const [lastOrderOpen, setLastOrderOpen] = useState(false);
  const [lastOrderItems, setLastOrderItems] = useState<Array<{
    product_id: string;
    product_name: string;
    quantity: number;
    price_table_name: string | null;
  }>>([]);
  const [lastOrderLoading, setLastOrderLoading] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Queries
  const { data: routes = [], isLoading } = useQuery({
    queryKey: ["routes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("routes").select("*").eq("active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  // Sync globalBatch from DB once routes load (only if user hasn't typed anything)
  useEffect(() => {
    if (routes.length === 0) return;
    const dbBatch = (routes.find((r: any) => r.batch_number) as any)?.batch_number || "";
    if (dbBatch && dbBatch !== globalBatch) {
      setGlobalBatch(dbBatch);
      localStorage.setItem("lastBatchNumber", dbBatch);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routes.length]);

  // Check completion status for ALL routes (for the list view)
  // "Feito" = a linha do cliente nesta rota gerou uma venda. Sem filtro por data;
  // cada rota é independente — pedido em uma rota não conta em outra.
  const { data: routeCompletionMap = new Map<string, boolean>() } = useQuery({
    queryKey: ["route-completion-all", routes.map((r) => r.id).join(",")],
    queryFn: async () => {
      if (routes.length === 0) return new Map<string, boolean>();

      // Fetch all route_clients with items for active routes
      const routeIds = routes.map((r) => r.id);
      const { data: rcs } = await supabase
        .from("route_clients")
        .select("id, route_id")
        .in("route_id", routeIds);
      if (!rcs || rcs.length === 0) return new Map<string, boolean>();

      // Check which route_clients have items
      const rcIds = rcs.map((rc: any) => rc.id);
      const { data: items } = await supabase
        .from("route_client_items")
        .select("route_client_id")
        .in("route_client_id", rcIds);
      const rcsWithItems = new Set((items || []).map((i: any) => i.route_client_id));

      // Build map: routeId -> Set of rcIds that have items
      const routeRcsMap = new Map<string, Set<string>>();
      for (const rc of rcs) {
        if (!rcsWithItems.has(rc.id)) continue;
        if (!routeRcsMap.has(rc.route_id)) routeRcsMap.set(rc.route_id, new Set());
        routeRcsMap.get(rc.route_id)!.add(rc.id);
      }

      // Fetch sales linked directly to these route_client_ids
      const { data: sales } = await supabase
        .from("sales")
        .select("route_client_id")
        .in("route_client_id", rcIds);
      const doneRcIds = new Set((sales || []).map((s: any) => s.route_client_id).filter(Boolean));

      // Rota completa quando todas as linhas com itens têm venda associada
      const result = new Map<string, boolean>();
      for (const routeId of routeIds) {
        const rcsNeeded = routeRcsMap.get(routeId);
        if (!rcsNeeded || rcsNeeded.size === 0) {
          result.set(routeId, false);
          continue;
        }
        const allDone = [...rcsNeeded].every((id) => doneRcIds.has(id));
        result.set(routeId, allDone);
      }
      return result;
    },
    enabled: routes.length > 0,
    refetchInterval: 30000,
  });


  const { data: flatItems = [], isLoading: itemsLoading } = useQuery({
    queryKey: ["route-flat-items", selectedRouteId],
    queryFn: async () => {
      if (!selectedRouteId) return [];
      const { data: rcs, error } = await supabase
        .from("route_clients")
        .select("id, client_id, position, observations, clients(name)")
        .eq("route_id", selectedRouteId)
        .order("position");
      if (error) throw error;
      if (!rcs || rcs.length === 0) return [];

      const rcIds = rcs.map((rc: any) => rc.id);
      const { data: items } = await supabase
        .from("route_client_items")
        .select("id, route_client_id, product_id, price_table_name, quantity, products(name)")
        .in("route_client_id", rcIds);

      const result: FlatItem[] = [];
      const sortedRcs = [...rcs].sort((a: any, b: any) => a.position - b.position);
      for (const rc of sortedRcs) {
        const rcItems = (items || []).filter((i: any) => i.route_client_id === (rc as any).id);
        for (const item of rcItems) {
          result.push({
            id: item.id,
            rcId: (rc as any).id,
            client_id: (rc as any).client_id,
            client_name: (rc as any).clients?.name || "Cliente removido",
            product_id: item.product_id,
            product_name: (item as any).products?.name || "Produto removido",
            price_table_name: item.price_table_name,
            quantity: item.quantity,
            position: (rc as any).position,
            observations: (rc as any).observations || null,
          });
        }
      }
      return result;
    },
    enabled: !!selectedRouteId,
  });

  const selectedRoute = routes.find((r) => r.id === selectedRouteId);

  // "Feito" por linha individual da rota: vendas com route_client_id pertencente a esta rota
  const { data: orderedRcIds = new Set<string>() } = useQuery({
    queryKey: ["route-ordered-rcids", selectedRouteId],
    queryFn: async () => {
      if (!selectedRouteId) return new Set<string>();
      const { data: rcs } = await supabase
        .from("route_clients")
        .select("id")
        .eq("route_id", selectedRouteId);
      const rcIds = (rcs || []).map((r: any) => r.id);
      if (rcIds.length === 0) return new Set<string>();
      const { data } = await supabase
        .from("sales")
        .select("route_client_id")
        .in("route_client_id", rcIds);
      return new Set((data || []).map((s: any) => s.route_client_id).filter(Boolean));
    },
    enabled: !!selectedRouteId,
    refetchInterval: 30000,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-active"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id, name, default_price_table").eq("active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  const handleClientSelect = (cId: string) => {
    setAddClientId(cId);
    const client = clients.find((c) => c.id === cId);
    const defaultTable = (client as any)?.default_price_table;
    if (defaultTable) {
      setAddTableName(defaultTable);
    }
    fetchLastOrder(cId);
  };

  const fetchLastOrder = async (clientId: string) => {
    setLastOrderLoading(true);
    try {
      const { data: lastSale } = await supabase
        .from("sales")
        .select("id")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!lastSale) {
        toast.info("Nenhum pedido anterior encontrado para este cliente.");
        setLastOrderLoading(false);
        return;
      }

      const { data: saleItems } = await supabase
        .from("sale_items")
        .select("product_id, product_name, quantity, price_table_name")
        .eq("sale_id", lastSale.id);

      if (saleItems && saleItems.length > 0) {
        setLastOrderItems(saleItems.map((si) => ({ ...si })));
        setLastOrderOpen(true);
      } else {
        toast.info("Último pedido não possui itens.");
      }
    } catch {
      toast.error("Erro ao buscar último pedido.");
    }
    setLastOrderLoading(false);
  };

  const handleCopyLastOrder = async () => {
    if (!selectedRouteId || !addClientId || lastOrderItems.length === 0) return;

    try {
      const { data: existing } = await supabase
        .from("route_clients")
        .select("id")
        .eq("route_id", selectedRouteId)
        .eq("client_id", addClientId)
        .maybeSingle();

      let rcId: string;
      if (existing) {
        rcId = existing.id;
      } else {
        const maxPos = flatItems.length > 0 ? Math.max(...flatItems.map((i) => i.position)) + 1 : 0;
        const { data: newRc, error } = await supabase
          .from("route_clients")
          .insert({ route_id: selectedRouteId, client_id: addClientId, position: maxPos })
          .select("id")
          .single();
        if (error) throw error;
        rcId = newRc.id;
      }

      const inserts = lastOrderItems
        .filter((item) => item.quantity > 0)
        .map((item) => ({
          route_client_id: rcId,
          product_id: item.product_id,
          price_table_name: item.price_table_name || priceTables[0]?.name || "Padrão",
          quantity: item.quantity,
        }));

      if (inserts.length > 0) {
        const { error } = await supabase.from("route_client_items").insert(inserts);
        if (error) throw error;
      }

      qc.invalidateQueries({ queryKey: ["route-flat-items", selectedRouteId] });
      setLastOrderOpen(false);
      setLastOrderItems([]);
      setAddClientId("");
      setAddProductId("");
      setAddTableName("");
      setAddQty("1");
      toast.success("Itens do último pedido copiados!");
    } catch {
      toast.error("Erro ao copiar itens.");
    }
  };

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: priceTables = [] } = useQuery({
    queryKey: ["price-tables"],
    queryFn: async () => {
      const { data, error } = await supabase.from("price_tables").select("id, name, price").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: drivers = [] } = useQuery({
    queryKey: ["drivers-active"],
    queryFn: async () => {
      const { data, error } = await supabase.from("drivers").select("id, name, is_main").eq("active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  // Mutations
  const saveRoute = useMutation({
    mutationFn: async (name: string) => {
      const payload: any = { name };
      if (routeWeekday !== "") payload.weekday = parseInt(routeWeekday);
      else payload.weekday = null;
      if (routePeriod !== "") payload.period = routePeriod;
      else payload.period = null;
      payload.driver_id = routeDriverId || null;

      if (editId) {
        const { error } = await supabase.from("routes").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("routes").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["routes"] });
      setDialogOpen(false);
      setRouteName("");
      setEditId(null);
      setRouteWeekday("");
      setRoutePeriod("");
      setRouteDriverId("");
      toast.success("Rota salva!");
    },
    onError: () => toast.error("Erro ao salvar rota"),
  });

  const deleteRoute = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("routes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["routes"] });
      if (selectedRouteId) setSelectedRouteId(null);
      toast.success("Rota removida!");
    },
    onError: () => toast.error("Erro ao remover rota"),
  });

  const addItemMutation = useMutation({
    mutationFn: async () => {
      const { data: existing } = await supabase
        .from("route_clients")
        .select("id")
        .eq("route_id", selectedRouteId!)
        .eq("client_id", addClientId)
        .maybeSingle();

      let rcId: string;
      if (existing) {
        rcId = existing.id;
      } else {
        const maxPos = flatItems.length > 0 ? Math.max(...flatItems.map((i) => i.position)) + 1 : 0;
        const { data: newRc, error } = await supabase
          .from("route_clients")
          .insert({ route_id: selectedRouteId!, client_id: addClientId, position: maxPos })
          .select("id")
          .single();
        if (error) throw error;
        rcId = newRc.id;
      }

      const { error } = await supabase.from("route_client_items").insert({
        route_client_id: rcId,
        product_id: addProductId,
        price_table_name: addTableName,
        quantity: parseInt(addQty) || 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["route-flat-items", selectedRouteId] });
      setAddClientId("");
      setAddProductId("");
      setAddTableName("");
      setAddQty("1");
      toast.success("Item adicionado!");
    },
    onError: () => toast.error("Erro ao adicionar item"),
  });

  const removeItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const item = flatItems.find((i) => i.id === itemId);
      const { error } = await supabase.from("route_client_items").delete().eq("id", itemId);
      if (error) throw error;

      if (item) {
        const remaining = flatItems.filter((i) => i.rcId === item.rcId && i.id !== itemId);
        if (remaining.length === 0) {
          await supabase.from("route_clients").delete().eq("id", item.rcId);
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["route-flat-items", selectedRouteId] });
      toast.success("Item removido!");
    },
    onError: () => toast.error("Erro ao remover item"),
  });

  const updateItemMutation = useMutation({
    mutationFn: async ({ itemId, field, value }: { itemId: string; field: string; value: string | number }) => {
      const updateData: Record<string, string | number> = { [field]: value };
      const { error } = await supabase.from("route_client_items").update(updateData as any).eq("id", itemId);
      if (error) throw error;
    },
    onMutate: async ({ itemId, field, value }) => {
      await qc.cancelQueries({ queryKey: ["route-flat-items", selectedRouteId] });
      const previousItems = qc.getQueryData<FlatItem[]>(["route-flat-items", selectedRouteId]);
      
      if (previousItems) {
        qc.setQueryData(["route-flat-items", selectedRouteId], 
          previousItems.map(item => item.id === itemId ? { ...item, [field]: value } : item)
        );
      }
      
      return { previousItems };
    },
    onError: (err, variables, context) => {
      if (context?.previousItems) {
        qc.setQueryData(["route-flat-items", selectedRouteId], context.previousItems);
      }
      toast.error("Erro ao atualizar item");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["route-flat-items", selectedRouteId] });
    },
  });

  const handleUpdateItem = useCallback((itemId: string, field: string, value: string | number) => {
    updateItemMutation.mutate({ itemId, field, value });
  }, [updateItemMutation]);

  const moveItemRouteMutation = useMutation({
    mutationFn: async ({ itemId, targetRouteId }: { itemId: string; targetRouteId: string }) => {
      const item = flatItems.find((i) => i.id === itemId);
      if (!item) throw new Error("Item não encontrado");
      if (orderedRcIds.has(item.rcId)) {
        throw new Error("Linha já feita não pode ser movida");
      }

      // Find or create route_client in target route for this client
      const { data: existing } = await supabase
        .from("route_clients")
        .select("id")
        .eq("route_id", targetRouteId)
        .eq("client_id", item.client_id)
        .maybeSingle();

      let targetRcId: string;
      if (existing) {
        targetRcId = existing.id;
      } else {
        // Position = end of target route
        const { data: targetRcs } = await supabase
          .from("route_clients")
          .select("position")
          .eq("route_id", targetRouteId)
          .order("position", { ascending: false })
          .limit(1);
        const nextPos = targetRcs && targetRcs.length > 0 ? (targetRcs[0] as any).position + 1 : 0;
        const { data: newRc, error: insErr } = await supabase
          .from("route_clients")
          .insert({ route_id: targetRouteId, client_id: item.client_id, position: nextPos })
          .select("id")
          .single();
        if (insErr) throw insErr;
        targetRcId = newRc.id;
      }

      // Move the item
      const { error } = await supabase
        .from("route_client_items")
        .update({ route_client_id: targetRcId })
        .eq("id", itemId);
      if (error) throw error;

      // If origin route_client has no more items, remove it
      const remaining = flatItems.filter((i) => i.rcId === item.rcId && i.id !== itemId);
      if (remaining.length === 0) {
        await supabase.from("route_clients").delete().eq("id", item.rcId);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["route-flat-items", selectedRouteId] });
      qc.invalidateQueries({ queryKey: ["route-completion-all"] });
      toast.success("Linha movida para outra rota!");
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao mover linha"),
  });

  const handleMoveRoute = useCallback((itemId: string, targetRouteId: string) => {
    moveItemRouteMutation.mutate({ itemId, targetRouteId });
  }, [moveItemRouteMutation]);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      if (readOnly) return;
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const activeItem = flatItems.find((i) => i.id === active.id);
      const overItem = flatItems.find((i) => i.id === over.id);
      if (!activeItem || !overItem) return;
      if (activeItem.rcId === overItem.rcId) return;

      // Build unique client-block order and move the whole block
      const rcOrder: string[] = [];
      for (const it of flatItems) {
        if (!rcOrder.includes(it.rcId)) rcOrder.push(it.rcId);
      }
      const fromIdx = rcOrder.indexOf(activeItem.rcId);
      const toIdx = rcOrder.indexOf(overItem.rcId);
      if (fromIdx === -1 || toIdx === -1) return;
      const newRcOrder = arrayMove(rcOrder, fromIdx, toIdx);

      const rcPositions = new Map<string, number>();
      newRcOrder.forEach((rcId, idx) => rcPositions.set(rcId, idx));

      // Rebuild flat list grouped by new rc order, keeping items within each rc in original sequence
      const grouped = new Map<string, typeof flatItems>();
      for (const it of flatItems) {
        if (!grouped.has(it.rcId)) grouped.set(it.rcId, []);
        grouped.get(it.rcId)!.push(it);
      }
      const reordered = newRcOrder.flatMap((rcId) =>
        (grouped.get(rcId) || []).map((it) => ({ ...it, position: rcPositions.get(rcId)! }))
      );
      qc.setQueryData(["route-flat-items", selectedRouteId], reordered);

      for (const [rcId, position] of rcPositions) {
        await supabase.from("route_clients").update({ position }).eq("id", rcId);
      }
      qc.invalidateQueries({ queryKey: ["route-flat-items", selectedRouteId] });
    },
    [flatItems, selectedRouteId, qc, readOnly]
  );

  const clearRouteMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRouteId) return;
      const { data: rcs } = await supabase
        .from("route_clients")
        .select("id")
        .eq("route_id", selectedRouteId);
      if (rcs && rcs.length > 0) {
        const rcIds = rcs.map((rc) => rc.id);
        await supabase.from("route_client_items").delete().in("route_client_id", rcIds);
        await supabase.from("route_clients").delete().eq("route_id", selectedRouteId);
        // Limpar também a observação da câmara (storage_note) na tabela de rotas
        await supabase.from("routes").update({ storage_note: null } as any).eq("id", selectedRouteId);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["route-flat-items", selectedRouteId] });
      toast.success("Rota limpa com sucesso!");
    },
    onError: () => toast.error("Erro ao limpar rota"),
  });

  const handleOrderAll = () => {
    const byClient = new Map<string, FlatItem[]>();
    for (const item of flatItems) {
      if (!byClient.has(item.client_id)) byClient.set(item.client_id, []);
      byClient.get(item.client_id)!.push(item);
    }

    const first = flatItems[0];
    if (!first) return;

    const clientItems = byClient.get(first.client_id)!;
    const cartItems = clientItems.map((item) => {
      const pt = priceTables.find((p) => p.name === item.price_table_name);
      const unitPrice = pt?.price || 0;
      return {
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: unitPrice,
        subtotal: unitPrice * item.quantity,
        price_table_name: item.price_table_name,
      };
    });
    sessionStorage.setItem("routeCart", JSON.stringify(cartItems));
    sessionStorage.setItem("routeId", selectedRouteId!);
    sessionStorage.setItem("routeClientId", first.rcId);
    const routeBatch = globalBatch || (selectedRoute as any)?.batch_number || "";
    if (routeBatch) sessionStorage.setItem("routeBatchNumber", routeBatch);
    else sessionStorage.removeItem("routeBatchNumber");
    const routeDriver = (selectedRoute as any)?.driver_id || "";
    if (routeDriver) sessionStorage.setItem("routeDriverId", routeDriver);
    else sessionStorage.removeItem("routeDriverId");
    const obs = clientItems[0]?.observations || "";
    if (obs) sessionStorage.setItem("routeObservations", obs);
    else sessionStorage.removeItem("routeObservations");
    // Pass the route's weekday date for the current week
    if (selectedRoute?.weekday != null) {
      const today = new Date();
      const currentDay = today.getDay();
      const diff = selectedRoute.weekday - currentDay;
      const routeDate = new Date(today);
      routeDate.setDate(today.getDate() + diff);
      sessionStorage.setItem("routeDate", routeDate.toISOString());
    }
    navigate({ to: "/sales", search: { clientId: String(first.client_id) } });
  };

  const handleOrderClient = (clientId: string) => {
    const clientItems = flatItems.filter((i) => i.client_id === clientId);
    if (clientItems.length === 0) return;
    const cartItems = clientItems.map((item) => {
      const pt = priceTables.find((p) => p.name === item.price_table_name);
      const unitPrice = pt?.price || 0;
      return {
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: unitPrice,
        subtotal: unitPrice * item.quantity,
        price_table_name: item.price_table_name,
      };
    });
    sessionStorage.setItem("routeCart", JSON.stringify(cartItems));
    sessionStorage.setItem("routeId", selectedRouteId!);
    sessionStorage.setItem("routeClientId", clientItems[0].rcId);
    const routeBatch = globalBatch || (selectedRoute as any)?.batch_number || "";
    if (routeBatch) sessionStorage.setItem("routeBatchNumber", routeBatch);
    else sessionStorage.removeItem("routeBatchNumber");
    const routeDriver = (selectedRoute as any)?.driver_id || "";
    if (routeDriver) sessionStorage.setItem("routeDriverId", routeDriver);
    else sessionStorage.removeItem("routeDriverId");
    const obs = clientItems[0]?.observations || "";
    if (obs) sessionStorage.setItem("routeObservations", obs);
    else sessionStorage.removeItem("routeObservations");
    // Pass the route's weekday date for the current week
    if (selectedRoute?.weekday != null) {
      const today = new Date();
      const currentDay = today.getDay();
      const diff = selectedRoute.weekday - currentDay;
      const routeDate = new Date(today);
      routeDate.setDate(today.getDate() + diff);
      sessionStorage.setItem("routeDate", routeDate.toISOString());
    }
    navigate({ to: "/sales", search: { clientId: String(clientId) } });
  };

  // Unique clients in the route
  const uniqueClients = useMemo(() => Array.from(
    new Map(flatItems.map((i) => [i.client_id, { id: i.client_id, name: i.client_name }])).values()
  ), [flatItems]);

  // Product totals summary
  const productTotals = useMemo(() => {
    const map = new Map<string, { name: string; total: number }>();
    for (const item of flatItems) {
      const existing = map.get(item.product_id);
      if (existing) {
        existing.total += item.quantity;
      } else {
        map.set(item.product_id, { name: item.product_name, total: item.quantity });
      }
    }
    return Array.from(map.values());
  }, [flatItems]);

  // Sort routes by weekday then period (must be before early return)
  const sortedRoutes = useMemo(() => {
    return [...routes].sort((a: any, b: any) => {
      const wa = a.weekday != null ? (a.weekday === 0 ? 7 : a.weekday) : 99;
      const wb = b.weekday != null ? (b.weekday === 0 ? 7 : b.weekday) : 99;
      if (wa !== wb) return wa - wb;
      const pa = a.period === "morning" ? 0 : a.period === "afternoon" ? 1 : 2;
      const pb = b.period === "morning" ? 0 : b.period === "afternoon" ? 1 : 2;
      if (pa !== pb) return pa - pb;
      return (a.name || "").localeCompare(b.name || "");
    });
  }, [routes]);

  const openEditDialog = (route?: any) => {
    if (route) {
      setEditId(route.id);
      setRouteName(route.name);
      setRouteWeekday(route.weekday != null ? String(route.weekday) : "");
      setRoutePeriod(route.period || "");
      setRouteDriverId((route as any).driver_id || "");
    } else {
      setEditId(null);
      setRouteName("");
      setRouteWeekday("");
      setRoutePeriod("");
      const mainDriver = drivers.find((d: any) => d.is_main);
      setRouteDriverId(mainDriver?.id || "");
    }
    setDialogOpen(true);
  };

  // Shared dialog content
  const renderRouteDialog = () => (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editId ? "Editar Rota" : "Nova Rota"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Input
            placeholder="Nome da rota (ex: Segunda - Manhã)"
            value={routeName}
            onChange={(e) => setRouteName(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Dia da Semana</label>
              <Select value={routeWeekday} onValueChange={setRouteWeekday}>
                <SelectTrigger>
                  <SelectValue placeholder="Opcional" />
                </SelectTrigger>
                <SelectContent>
                  {WEEKDAY_OPTIONS.map((w) => (
                    <SelectItem key={w.value} value={String(w.value)}>{w.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Período</label>
              <Select value={routePeriod} onValueChange={setRoutePeriod}>
                <SelectTrigger>
                  <SelectValue placeholder="Opcional" />
                </SelectTrigger>
                <SelectContent>
                  {PERIOD_OPTIONS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Motorista</label>
            <Select value={routeDriverId || "__none__"} onValueChange={(v) => setRouteDriverId(v === "__none__" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o motorista" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Nenhum</SelectItem>
                {drivers.map((d: any) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}{d.is_main ? " ⭐" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {routeWeekday !== "" && (
            <p className="text-xs text-muted-foreground">
              Data desta semana: <span className="font-medium">{formatRouteDate(getRouteDate(parseInt(routeWeekday)))}</span>
            </p>
          )}
          <Button
            className="w-full"
            disabled={!routeName.trim() || saveRoute.isPending}
            onClick={() => saveRoute.mutate(routeName.trim())}
          >
            Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  // Detail view
  if (selectedRouteId && selectedRoute) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => setSelectedRouteId(null)}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            {getRouteDisplayName(selectedRoute)}
          </h2>
          {productTotals.map((pt) => (
            <Badge key={pt.name} variant="outline">{pt.total} un {pt.name}</Badge>
          ))}
          {productTotals.length > 1 && (
            <Badge className="bg-primary text-primary-foreground font-bold">
              {productTotals.reduce((s, pt) => s + pt.total, 0)} un Total
            </Badge>
          )}
          <Badge variant="secondary">{uniqueClients.length} clientes</Badge>
          {!readOnly && (
            <div className="flex items-center gap-1.5 ml-auto flex-wrap">
              <label className="text-xs font-semibold whitespace-nowrap text-destructive">OBS Câmara:</label>
              <Input
                placeholder="Retirar de qual câmara?"
                className="h-8 w-56 text-sm font-semibold text-destructive border-destructive/60 focus-visible:ring-destructive placeholder:text-destructive/50"
                value={(selectedRoute as any)?.storage_note || ""}
                onChange={(e) => {
                  const val = e.target.value;
                  qc.setQueryData(["routes"], (old: any[]) =>
                    old?.map((r) => r.id === selectedRouteId ? { ...r, storage_note: val } : r)
                  );
                }}
                onBlur={(e) => {
                  const val = e.target.value.trim() || null;
                  supabase.from("routes").update({ storage_note: val } as any).eq("id", selectedRouteId!).then();
                }}
              />
            </div>
          )}
        </div>

        {(selectedRoute as any)?.storage_note && (
          <div className="rounded-md border-2 border-destructive bg-destructive/10 px-4 py-2 text-destructive font-bold text-base">
            ⚠ {(selectedRoute as any).storage_note}
          </div>
        )}

        {/* Inline add row */}
        {!readOnly && (
          <Card>
            <CardContent className="pt-4">
              <div className="flex gap-2 flex-wrap items-end">
                <div className="flex-1 min-w-[130px]">
                  <label className="text-xs text-muted-foreground mb-1 block">Cliente</label>
                  <Button
                    variant="outline"
                    className="w-full justify-start font-normal"
                    onClick={() => { setClientSearchTerm(""); setClientSearchOpen(true); }}
                  >
                    <Search className="h-4 w-4 mr-2 text-muted-foreground" />
                    {addClientId
                      ? clients.find((c) => c.id === addClientId)?.name || "Cliente"
                      : "Buscar cliente..."}
                  </Button>
                </div>
                <div className="flex-1 min-w-[130px]">
                  <label className="text-xs text-muted-foreground mb-1 block">Produto</label>
                  <Select value={addProductId} onValueChange={setAddProductId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Produto" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1 min-w-[130px]">
                  <label className="text-xs text-muted-foreground mb-1 block">Tabela</label>
                  <Select value={addTableName} onValueChange={setAddTableName}>
                    <SelectTrigger>
                      <SelectValue placeholder="Tabela" />
                    </SelectTrigger>
                    <SelectContent>
                      {priceTables.map((pt) => (
                        <SelectItem key={pt.id} value={pt.name}>
                          {pt.name} (R$ {Number(pt.price).toFixed(2)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-20">
                  <label className="text-xs text-muted-foreground mb-1 block">Qtd</label>
                  <Input
                    type="number"
                    min="1"
                    value={addQty}
                    onChange={(e) => setAddQty(e.target.value)}
                  />
                </div>
                <Button
                  disabled={!addClientId || !addProductId || !addTableName || !addQty || addItemMutation.isPending}
                  onClick={() => addItemMutation.mutate()}
                >
                  <Check className="h-4 w-4 mr-1" /> OK
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
        {/* Items table */}
        {itemsLoading ? (
          <p className="text-muted-foreground text-center py-8">Carregando...</p>
        ) : flatItems.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">Nenhum item na rota. Adicione acima.</p>
        ) : (
          <Card>
            <CardContent className="p-0">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={flatItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8"></TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Produto</TableHead>
                        <TableHead>Tabela</TableHead>
                        <TableHead>Rota</TableHead>
                        <TableHead className="text-center">Qtd</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {flatItems.map((item, idx) => {
                        const isFirstInGroup = idx === 0 || flatItems[idx - 1].client_id !== item.client_id;
                        const groupSize = flatItems.filter((i) => i.client_id === item.client_id).length;
                        return (
                          <SortableItemRow
                            key={item.id}
                            item={item}
                            onRemove={(id) => removeItemMutation.mutate(id)}
                            onOrder={handleOrderClient}
                            onUpdate={handleUpdateItem}
                            onMoveRoute={handleMoveRoute}
                            ordered={orderedRcIds.has(item.rcId)}
                            products={products}
                            priceTables={priceTables}
                            routes={routes}
                            currentRouteId={selectedRouteId!}
                            readOnly={readOnly}
                            canDelete={canDelete}
                            isFirstInGroup={isFirstInGroup}
                            groupSize={groupSize}
                          />
                        );
                      })}

                    </TableBody>
                  </Table>
                </SortableContext>
              </DndContext>
            </CardContent>
          </Card>
        )}

        {/* Client Observations */}
        {uniqueClients.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Observações por Cliente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {uniqueClients.map((c) => {
                const rcItem = flatItems.find((i) => i.client_id === c.id);
                const rcId = rcItem?.rcId;
                const currentObs = rcItem?.observations || "";
                return (
                  <div key={c.id} className="flex flex-col gap-1.5 border rounded-md p-2">
                    <div className="text-xs font-semibold text-muted-foreground">{c.name}</div>
                    {readOnly ? (
                      <p className="text-xs whitespace-pre-wrap min-h-[20px]">
                        {currentObs || <span className="text-muted-foreground italic">Sem observações</span>}
                      </p>
                    ) : (
                      <Textarea
                        placeholder="Observações do pedido (ex: entregar às 14h, portão lateral...)"
                        defaultValue={currentObs}
                        className="min-h-[40px] text-xs"
                        onBlur={(e) => {
                          const val = e.target.value.trim();
                          if (val !== (currentObs || "") && rcId) {
                            supabase.from("route_clients").update({ observations: val || null } as any).eq("id", rcId).then(() => {
                              qc.invalidateQueries({ queryKey: ["route-flat-items", selectedRouteId] });
                            });
                          }
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Clear route button */}
        {!readOnly && canDelete && flatItems.length > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full">
                <Eraser className="h-4 w-4 mr-2" /> Limpar Rota
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Limpar rota?</AlertDialogTitle>
                <AlertDialogDescription>
                  Isso vai remover todos os itens e clientes desta rota. Essa ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => clearRouteMutation.mutate()}>
                  Limpar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {/* Client search dialog */}
        <Dialog open={clientSearchOpen} onOpenChange={setClientSearchOpen}>
          <DialogContent className="max-w-sm top-[10%] translate-y-0 sm:top-[50%] sm:translate-y-[-50%]">
            <DialogHeader>
              <DialogTitle>Buscar Cliente</DialogTitle>
            </DialogHeader>
            <Input
              placeholder="Digite o nome do cliente..."
              value={clientSearchTerm}
              onChange={(e) => setClientSearchTerm(e.target.value)}
              autoFocus
            />
            <div className="max-h-60 overflow-y-auto space-y-1">
              {clients
                .filter((c) =>
                  c.name.toLowerCase().includes(clientSearchTerm.toLowerCase())
                )
                .map((c) => (
                  <Button
                    key={c.id}
                    variant={addClientId === c.id ? "default" : "ghost"}
                    className="w-full justify-start text-sm"
                    onClick={() => {
                      handleClientSelect(c.id);
                      setClientSearchOpen(false);
                    }}
                  >
                    {c.name}
                  </Button>
                ))}
              {clients.filter((c) =>
                c.name.toLowerCase().includes(clientSearchTerm.toLowerCase())
              ).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum cliente encontrado.
                </p>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Last order dialog */}
        <Dialog open={lastOrderOpen} onOpenChange={setLastOrderOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Último Pedido - {clients.find((c) => c.id === addClientId)?.name}</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">Altere as quantidades ou remova itens antes de copiar.</p>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {lastOrderItems.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 border rounded-md p-2">
                  <div className="flex-1 text-sm font-medium">{item.product_name}</div>
                  <div className="text-xs text-muted-foreground">{item.price_table_name || "—"}</div>
                  <Input
                    type="number"
                    min="0"
                    className="w-16 h-8 text-sm"
                    value={item.quantity}
                    onChange={(e) => {
                      const updated = [...lastOrderItems];
                      updated[idx] = { ...updated[idx], quantity: parseInt(e.target.value) || 0 };
                      setLastOrderItems(updated);
                    }}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setLastOrderItems(lastOrderItems.filter((_, i) => i !== idx))}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
              {lastOrderItems.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum item.</p>
              )}
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setLastOrderOpen(false)}>Cancelar</Button>
              <Button disabled={lastOrderItems.filter((i) => i.quantity > 0).length === 0} onClick={handleCopyLastOrder}>
                <Copy className="h-4 w-4 mr-1" /> Copiar para rota
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {renderRouteDialog()}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <MapPin className="h-5 w-5 text-primary" /> Rotas
        </h2>
        {!readOnly && (
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-muted-foreground whitespace-nowrap">Lote:</label>
            <Input
              placeholder="Nº do lote"
              className="h-8 w-28 text-sm"
              value={globalBatch}
              onChange={(e) => {
                const val = e.target.value;
                setGlobalBatch(val);
                localStorage.setItem("lastBatchNumber", val);
                qc.setQueryData(["routes"], (old: any[]) =>
                  old?.map((r) => ({ ...r, batch_number: val }))
                );
              }}
              onBlur={(e) => {
                const val = e.target.value.trim() || null;
                const ids = routes.map((r: any) => r.id);
                if (ids.length) supabase.from("routes").update({ batch_number: val }).in("id", ids).then();
              }}
            />

          </div>
        )}
        {!readOnly && (
          <Button onClick={() => openEditDialog()}>
            <Plus className="h-4 w-4 mr-1" /> Nova Rota
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-center py-8">Carregando...</p>
      ) : routes.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">Nenhuma rota cadastrada.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {sortedRoutes.map((route: any) => (
            <Card
              key={route.id}
              className={cn(
                "cursor-pointer hover:border-primary/40 transition-colors",
                routeCompletionMap.get(route.id) && "border-green-500 bg-green-100/50 dark:bg-green-950/50 dark:border-green-600 shadow-md shadow-green-500/10"
              )}
              onClick={() => setSelectedRouteId(route.id)}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    {routeCompletionMap.get(route.id) && (
                      <Check className="h-4 w-4 text-green-600 shrink-0" />
                    )}
                    {route.name}
                    {route.weekday != null && (
                      <span className="text-sm font-normal text-muted-foreground">
                        ({formatRouteDate(getRouteDate(route.weekday))})
                      </span>
                    )}
                  </span>
                  {!readOnly && (
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openEditDialog(route)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      {canDelete && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (confirm("Remover esta rota?")) deleteRoute.mutate(route.id);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      )}
                    </div>
                  )}
                </CardTitle>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      {renderRouteDialog()}
    </div>
  );
}
