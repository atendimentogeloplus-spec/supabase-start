import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEmployees, useSalaryEntries, calculateProvisioning } from "@/financeiro/lib/fopag-store";
import { MONTHS_SHORT, getMonthKey, formatCurrency } from "@/financeiro/lib/finance-store";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line, AreaChart, Area } from "recharts";
import { DollarSign, Users, TrendingUp, Calculator, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const MONTHS_FULL = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

interface Props { year: number; }

export default function FopagDashboard({ year }: Props) {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const { employees, loading: loadingEmp } = useEmployees();
  const { entries, loading: loadingCur } = useSalaryEntries(year);
  const { entries: prevEntries, loading: loadingPrev } = useSalaryEntries(year - 1);

  const loading = loadingEmp || loadingCur || loadingPrev;
  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const monthlyData = MONTHS_SHORT.map((name, idx) => {
    const monthKey = getMonthKey(year, idx);
    const monthEntries = entries.filter(e => e.month_key === monthKey);
    const provs = monthEntries.map(e => {
      const emp = employees.find(emp => emp.id === e.employee_id);
      return calculateProvisioning(e.salary, emp?.employee_type || "funcionario", e.commission);
    });

    const salary = provs.reduce((s, p) => s + p.salary, 0);
    const fgts = provs.reduce((s, p) => s + p.fgts, 0);
    const thirteenth = provs.reduce((s, p) => s + p.thirteenth, 0);
    const vacation = provs.reduce((s, p) => s + p.vacation, 0);
    const fgts13vac = provs.reduce((s, p) => s + p.fgtsThirteenthVacation, 0);
    const total = provs.reduce((s, p) => s + p.total, 0);

    const prevMonthKey = getMonthKey(year - 1, idx);
    const prevMonthEntries = prevEntries.filter(e => e.month_key === prevMonthKey);
    const prevProvs = prevMonthEntries.map(e => {
      const emp = employees.find(emp => emp.id === e.employee_id);
      return calculateProvisioning(e.salary, emp?.employee_type || "funcionario", e.commission);
    });
    const prevTotal = prevProvs.reduce((s, p) => s + p.total, 0);

    return { name, salary, fgts, thirteenth, vacation, fgts13vac, total, prevTotal, employees: monthEntries.length };
  });

  const cm = monthlyData[selectedMonth];
  const prevMonthTotal = cm.prevTotal;
  const monthVariation = prevMonthTotal > 0 ? ((cm.total - prevMonthTotal) / prevMonthTotal * 100) : 0;

  const allProvs = entries.map(e => {
    const emp = employees.find(emp => emp.id === e.employee_id);
    return calculateProvisioning(e.salary, emp?.employee_type || "funcionario", e.commission);
  });
  const totals = {
    salary: allProvs.reduce((s, p) => s + p.salary, 0),
    fgts: allProvs.reduce((s, p) => s + p.fgts, 0),
    thirteenth: allProvs.reduce((s, p) => s + p.thirteenth, 0),
    vacation: allProvs.reduce((s, p) => s + p.vacation, 0),
    fgts13vac: allProvs.reduce((s, p) => s + p.fgtsThirteenthVacation, 0),
    total: allProvs.reduce((s, p) => s + p.total, 0),
  };

  const prevAllProvs = prevEntries.map(e => {
    const emp = employees.find(emp => emp.id === e.employee_id);
    return calculateProvisioning(e.salary, emp?.employee_type || "funcionario", e.commission);
  });
  const prevTotalYear = prevAllProvs.reduce((s, p) => s + p.total, 0);
  const yearVariation = prevTotalYear > 0 ? ((totals.total - prevTotalYear) / prevTotalYear * 100) : 0;

  const activeEmployees = employees.filter(e => e.active).length;

  let cumCurrent = 0;
  let cumPrev = 0;
  const cumulativeData = monthlyData.map(m => {
    cumCurrent += m.total;
    cumPrev += m.prevTotal;
    return { name: m.name, atual: cumCurrent, anterior: cumPrev };
  });

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold">Dashboard FOPAG</h2>
            <p className="text-muted-foreground">Visão mensal da folha de pagamento</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setSelectedMonth(m => Math.max(0, m - 1))} disabled={selectedMonth === 0}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-semibold min-w-[110px] text-center">{MONTHS_FULL[selectedMonth]} {year}</span>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setSelectedMonth(m => Math.min(11, m + 1))} disabled={selectedMonth === 11}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <KpiCard icon={<DollarSign className="h-5 w-5 text-primary" />} label="Custo Total Mês" value={formatCurrency(cm.total)} />
          <KpiCard icon={<Calculator className="h-5 w-5 text-secondary" />} label="Salários Mês" value={formatCurrency(cm.salary)} />
          <KpiCard icon={<Users className="h-5 w-5" />} label="Funcionários no Mês" value={String(cm.employees)} />
          <KpiCard icon={<TrendingUp className="h-5 w-5 text-warning" />} label={`Var. vs ${year - 1}`} value={prevMonthTotal > 0 ? `${monthVariation > 0 ? "+" : ""}${monthVariation.toFixed(1)}%` : "—"} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "FGTS (8%)", value: cm.fgts },
            { label: "13º Salário", value: cm.thirteenth },
            { label: "Férias", value: cm.vacation },
            { label: "FGTS 13º/Férias", value: cm.fgts13vac },
          ].map(item => (
            <Card key={item.label}>
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="text-lg font-bold mt-1">{formatCurrency(item.value)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-4">
          <h3 className="text-xl font-bold">Resumo Anual — {year}</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <KpiCard icon={<DollarSign className="h-5 w-5 text-primary" />} label="Custo Total Anual" value={formatCurrency(totals.total)} />
          <KpiCard icon={<Calculator className="h-5 w-5 text-secondary" />} label="Total Salários" value={formatCurrency(totals.salary)} />
          <KpiCard icon={<Users className="h-5 w-5" />} label="Funcionários Ativos" value={String(activeEmployees)} />
          <KpiCard icon={<TrendingUp className="h-5 w-5 text-warning" />} label="Variação Anual" value={prevTotalYear > 0 ? `${yearVariation > 0 ? "+" : ""}${yearVariation.toFixed(1)}%` : "—"} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle className="text-sm">Composição de Custos por Mês</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" fontSize={12} />
                  <YAxis fontSize={12} tickFormatter={v => `R$ ${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Legend />
                  <Bar dataKey="salary" name="Salário" stackId="a" fill="hsl(224, 76%, 48%)" />
                  <Bar dataKey="fgts" name="FGTS" stackId="a" fill="hsl(200, 70%, 50%)" />
                  <Bar dataKey="thirteenth" name="13º" stackId="a" fill="hsl(48, 85%, 50%)" />
                  <Bar dataKey="vacation" name="Férias" stackId="a" fill="hsl(142, 71%, 45%)" />
                  <Bar dataKey="fgts13vac" name="FGTS 13º/Férias" stackId="a" fill="hsl(38, 92%, 50%)" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">Comparativo Anual</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" fontSize={12} />
                  <YAxis fontSize={12} tickFormatter={v => `R$ ${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Legend />
                  <Bar dataKey="prevTotal" name={String(year - 1)} fill="hsl(220, 13%, 75%)" />
                  <Bar dataKey="total" name={String(year)} fill="hsl(224, 76%, 48%)" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">Evolução Acumulada</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={cumulativeData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" fontSize={12} />
                  <YAxis fontSize={12} tickFormatter={v => `R$ ${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Legend />
                  <Area type="monotone" dataKey="anterior" name={String(year - 1)} stroke="hsl(220, 13%, 70%)" fill="hsl(220, 13%, 90%)" />
                  <Area type="monotone" dataKey="atual" name={String(year)} stroke="hsl(224, 76%, 48%)" fill="hsl(224, 76%, 88%)" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader><CardTitle className="text-sm">Evolução Mensal do Custo Total</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" fontSize={12} />
                  <YAxis fontSize={12} tickFormatter={v => `R$ ${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Legend />
                  <Line type="monotone" dataKey="prevTotal" name={String(year - 1)} stroke="hsl(220, 13%, 70%)" strokeDasharray="5 5" />
                  <Line type="monotone" dataKey="total" name={String(year)} stroke="hsl(224, 76%, 48%)" strokeWidth={2.5} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">{icon}</div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
