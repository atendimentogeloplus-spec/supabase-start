import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useEmployees, useSalaryEntries, calculateProvisioning } from "@/financeiro/lib/fopag-store";
import { formatCurrency, MONTHS, getMonthKey } from "@/financeiro/lib/finance-store";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props { year: number; }

export default function Provisionamento({ year }: Props) {
  const { employees, loading: loadingEmp } = useEmployees();
  const { entries, loading: loadingEntries, upsertEntry, deleteEntry } = useSalaryEntries(year);

  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("0");
  const [salary, setSalary] = useState("");
  const [commission, setCommission] = useState("");

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedEmployee) { toast.error("Selecione um funcionário"); return; }
    const salaryNum = Number(salary);
    if (!salaryNum || salaryNum <= 0) { toast.error("Informe um salário válido"); return; }

    const monthKey = getMonthKey(year, Number(selectedMonth));
    const commissionNum = Number(commission) || 0;
    await upsertEntry(selectedEmployee, monthKey, salaryNum, commissionNum);
    toast.success("Lançamento salvo");
    setSalary("");
    setCommission("");
  }

  const loading = loadingEmp || loadingEntries;
  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const monthlyData = MONTHS.map((monthName, idx) => {
    const monthKey = getMonthKey(year, idx);
    const monthEntries = entries.filter(e => e.month_key === monthKey);
    return { monthName, monthKey, idx, entries: monthEntries };
  }).filter(m => m.entries.length > 0);

  const allProvisionings = entries.map(e => {
    const emp = employees.find(emp => emp.id === e.employee_id);
    return calculateProvisioning(e.salary, emp?.employee_type || "funcionario", e.commission);
  });
  const totalSalary = allProvisionings.reduce((s, p) => s + p.salary, 0);
  const totalFgts = allProvisionings.reduce((s, p) => s + p.fgts, 0);
  const total13 = allProvisionings.reduce((s, p) => s + p.thirteenth, 0);
  const totalVacation = allProvisionings.reduce((s, p) => s + p.vacation, 0);
  const totalFgts13Vac = allProvisionings.reduce((s, p) => s + p.fgtsThirteenthVacation, 0);
  const grandTotal = allProvisionings.reduce((s, p) => s + p.total, 0);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Lançar Salário</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
            <div className="space-y-2">
              <Label>Funcionário</Label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {employees.filter(e => e.active).map(emp => (
                    <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Mês</Label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => (
                    <SelectItem key={i} value={String(i)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Salário (R$)</Label>
              <Input type="number" step="0.01" min="0" value={salary} onChange={(e) => setSalary(e.target.value)} placeholder="0,00" />
            </div>
            <div className="space-y-2">
              <Label>Comissão (R$)</Label>
              <Input type="number" step="0.01" min="0" value={commission} onChange={(e) => setCommission(e.target.value)} placeholder="0,00" />
            </div>
            <Button type="submit"><Plus className="h-4 w-4 mr-1" /> Lançar</Button>
          </form>
        </CardContent>
      </Card>

      {entries.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: "Total Salários", value: totalSalary },
            { label: "FGTS (8%)", value: totalFgts },
            { label: "13º Salário", value: total13 },
            { label: "Férias", value: totalVacation },
            { label: "FGTS 13º/Férias", value: totalFgts13Vac },
            { label: "Custo Total", value: grandTotal },
          ].map(item => (
            <Card key={item.label}>
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="text-sm font-bold text-primary mt-1">{formatCurrency(item.value)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {monthlyData.map(({ monthName, entries: mEntries }) => (
        <Card key={monthName}>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-base">{monthName} {year}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Funcionário</TableHead>
                    <TableHead className="text-right">Salário</TableHead>
                    <TableHead className="text-right">Comissão</TableHead>
                    <TableHead className="text-right">FGTS</TableHead>
                    <TableHead className="text-right hidden md:table-cell">13º</TableHead>
                    <TableHead className="text-right hidden md:table-cell">Férias</TableHead>
                    <TableHead className="text-right hidden lg:table-cell">FGTS 13º/Férias</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mEntries.map(entry => {
                    const emp = employees.find(e => e.id === entry.employee_id);
                    const prov = calculateProvisioning(entry.salary, emp?.employee_type || "funcionario", entry.commission);
                    return (
                      <TableRow key={entry.id}>
                        <TableCell className="font-medium">
                          {emp?.name || "—"}
                          {emp?.employee_type === "funcionario" && <Badge variant="default" className="ml-2 text-[10px]">Funcionário</Badge>}
                          {emp?.employee_type === "socio" && <Badge variant="secondary" className="ml-2 text-[10px]">Sócio</Badge>}
                          {emp?.employee_type === "pj" && <Badge variant="outline" className="ml-2 text-[10px]">PJ</Badge>}
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(entry.salary)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(entry.commission)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(prov.fgts)}</TableCell>
                        <TableCell className="text-right hidden md:table-cell">{formatCurrency(prov.thirteenth)}</TableCell>
                        <TableCell className="text-right hidden md:table-cell">{formatCurrency(prov.vacation)}</TableCell>
                        <TableCell className="text-right hidden lg:table-cell">{formatCurrency(prov.fgtsThirteenthVacation)}</TableCell>
                        <TableCell className="text-right font-bold">{formatCurrency(prov.total)}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => { deleteEntry(entry.id); toast.success("Removido"); }}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ))}

      {entries.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhum lançamento de salário para {year}. Use o formulário acima para começar.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
