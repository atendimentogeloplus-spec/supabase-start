import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";
import { format, parseISO, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Trash2, TrendingUp, TrendingDown, DollarSign, Wallet, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";

export default function CashFlow() {
  const queryClient = useQueryClient();
  const [startDate, setStartDate] = useState(
    format(startOfDay(new Date()), "yyyy-MM-dd")
  );
  const [endDate, setEndDate] = useState(
    format(endOfDay(new Date()), "yyyy-MM-dd")
  );
  const [methodFilter, setMethodFilter] = useState<string>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState<string>("");

  const { data: cashFlowData, isLoading } = useQuery({
    queryKey: ["cash-flow", startDate, endDate, methodFilter],
    queryFn: async () => {
      let query = supabase
        .from("cash_flow")
        .select("*")
        .gte("payment_date", startOfDay(parseISO(startDate)).toISOString())
        .lte("payment_date", endOfDay(parseISO(endDate)).toISOString());

      if (methodFilter !== "all") {
        query = query.eq("payment_method", methodFilter);
      }

      const { data, error } = await query.order("payment_date", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cash_flow").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cash-flow"] });
      toast.success("Registro removido com sucesso!");
    },
    onError: (error) => {
      console.error("Error deleting cash flow entry:", error);
      toast.error("Erro ao remover registro.");
    },
  });

  const updateMethodMutation = useMutation({
    mutationFn: async ({ id, method }: { id: string; method: string }) => {
      const { error } = await supabase
        .from("cash_flow")
        .update({ payment_method: method })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cash-flow"] });
      toast.success("Forma de pagamento atualizada!");
    },
    onError: (error) => {
      console.error("Error updating payment method:", error);
      toast.error("Erro ao atualizar forma de pagamento.");
    },
  });

  const updateAmountMutation = useMutation({
    mutationFn: async ({ id, amount }: { id: string; amount: number }) => {
      const { error } = await supabase
        .from("cash_flow")
        .update({ amount })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cash-flow"] });
      setEditingId(null);
      toast.success("Valor atualizado com sucesso!");
    },
    onError: (error) => {
      console.error("Error updating amount:", error);
      toast.error("Erro ao atualizar valor.");
    },
  });

  const totalAmount = cashFlowData?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0;
  
  const totalsByMethod = cashFlowData?.reduce((acc, curr) => {
    const method = curr.payment_method || "Caixa";
    acc[method] = (acc[method] || 0) + Number(curr.amount);
    return acc;
  }, {} as Record<string, number>) || {};

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Fluxo de Caixa</h1>
        <p className="text-muted-foreground">
          Acompanhe os pagamentos recebidos e a movimentação financeira.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <Card className="bg-emerald-50 border-emerald-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-emerald-900">Total Geral</CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-700">R$ {totalAmount.toFixed(2)}</div>
            <p className="text-xs text-emerald-600/80">No período selecionado</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Caixa</CardTitle>
            <TrendingUp className="h-4 w-4 text-sky-500" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">R$ {(totalsByMethod["Caixa"] || totalsByMethod["Pix"] || 0).toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Pagamentos via Caixa</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Dinheiro</CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">R$ {(totalsByMethod["Dinheiro"] || 0).toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Pagamentos em espécie</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Inter</CardTitle>
            <Wallet className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">R$ {(totalsByMethod["Inter"] || totalsByMethod["Boleto"] || 0).toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Pagamentos via Inter</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Itaú</CardTitle>
            <Wallet className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">R$ {(totalsByMethod["Itaú"] || 0).toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Pagamentos via Itaú</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>Selecione o período e forma de pagamento para visualização</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start-date">Data Inicial</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-date">Data Final</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Meio de Pagamento</Label>
              <Select value={methodFilter} onValueChange={setMethodFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                   <SelectItem value="Caixa">Caixa</SelectItem>
                   <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                   <SelectItem value="Inter">Inter</SelectItem>
                   <SelectItem value="Itaú">Itaú</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Movimentações</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data de Pagamento</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Forma</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : cashFlowData?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nenhuma movimentação encontrada no período.
                    </TableCell>
                  </TableRow>
                ) : (
                  cashFlowData?.map((entry) => (
                    <TableRow key={entry.id} className="group">
                      <TableCell>
                        {format(parseISO(entry.payment_date), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="font-medium">{entry.client_name}</TableCell>
                      <TableCell>{entry.description || "Pagamento de pedido"}</TableCell>
                      <TableCell className="text-right font-bold text-emerald-600 whitespace-nowrap">
                        {editingId === entry.id ? (
                          <div className="flex items-center justify-end gap-2">
                            <Input
                              type="number"
                              value={editAmount}
                              onChange={(e) => setEditAmount(e.target.value)}
                              className="w-24 h-8 text-right"
                              autoFocus
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-emerald-600"
                              onClick={() => updateAmountMutation.mutate({ id: entry.id, amount: Number(editAmount) })}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive"
                              onClick={() => setEditingId(null)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            <span>R$ {Number(entry.amount).toFixed(2)}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => {
                                setEditingId(entry.id);
                                setEditAmount(entry.amount.toString());
                              }}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Select
                          defaultValue={entry.payment_method || "Caixa"}
                          onValueChange={(value) => updateMethodMutation.mutate({ id: entry.id, method: value })}
                        >
                          <SelectTrigger className="h-8 w-[110px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                             <SelectItem value="Caixa">Caixa</SelectItem>
                             <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                             <SelectItem value="Inter">Inter</SelectItem>
                             <SelectItem value="Itaú">Itaú</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm("Tem certeza que deseja remover este registro?")) {
                              deleteMutation.mutate(entry.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
