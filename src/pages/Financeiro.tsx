import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart3, Calculator, Users } from "lucide-react";
import FinanceiroModule from "@/financeiro/components/financeiro/FinanceiroModule";
import Funcionarios from "@/financeiro/components/fopag/Funcionarios";
import Provisionamento from "@/financeiro/components/fopag/Provisionamento";
import FopagDashboard from "@/financeiro/components/fopag/FopagDashboard";
import FechamentoModule from "@/financeiro/components/fechamento/FechamentoModule";
import Patrimonio from "@/financeiro/components/Patrimonio";

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

type Module = "financeiro" | "fopag" | "fechamento" | "patrimonio";

const moduleConfig: { key: Module; label: string; icon: string }[] = [
  { key: "financeiro", label: "Financeiro", icon: "💰" },
  { key: "fopag", label: "FOPAG", icon: "📋" },
  { key: "fechamento", label: "Fechamento", icon: "📊" },
  { key: "patrimonio", label: "Patrimônio", icon: "🏢" },
];

export default function Financeiro() {
  const [year, setYear] = useState(currentYear);
  const [module, setModule] = useState<Module>("financeiro");
  const [tabKey, setTabKey] = useState(0);

  function switchModule(m: Module) {
    setModule(m);
    setTabKey(k => k + 1);
  }

  return (
    <div className="min-h-screen">
      <div className="border-b bg-card/80 backdrop-blur-md sticky top-0 z-30 -mx-4 sm:-mx-6 px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3">
          <div>
            <h1 className="text-lg sm:text-xl font-bold">Financeiro</h1>
            <p className="text-xs text-muted-foreground">Módulo financeiro Gelo Plus</p>
          </div>
          <div className="flex items-center gap-2">
            <nav className="hidden md:flex items-center gap-1 bg-muted/60 rounded-xl p-1">
              {moduleConfig.map(m => (
                <button
                  key={m.key}
                  onClick={() => switchModule(m.key)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                    module === m.key ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-card"
                  }`}
                >
                  {m.icon} {m.label}
                </button>
              ))}
            </nav>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="w-24 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="md:hidden flex border-t overflow-x-auto">
          {moduleConfig.map(m => (
            <button
              key={m.key}
              onClick={() => switchModule(m.key)}
              className={`flex-1 py-2.5 text-xs font-semibold whitespace-nowrap ${
                module === m.key ? "bg-primary/10 text-primary border-b-2 border-primary" : "text-muted-foreground"
              }`}
            >
              {m.icon} {m.label}
            </button>
          ))}
        </div>
      </div>

      <main className="pt-4 sm:pt-6">
        {module === "financeiro" ? (
          <FinanceiroModule key={`fin-${tabKey}`} />
        ) : module === "patrimonio" ? (
          <Patrimonio year={year} />
        ) : module === "fechamento" ? (
          <FechamentoModule />
        ) : (
          <Tabs key={`fop-${tabKey}`} defaultValue="dashboard" className="space-y-4 sm:space-y-6">
            <TabsList className="grid w-full max-w-xl grid-cols-3 bg-muted/50 p-1 rounded-xl">
              <TabsTrigger value="dashboard" className="text-xs sm:text-sm"><BarChart3 className="h-4 w-4 mr-1" /> Dashboard</TabsTrigger>
              <TabsTrigger value="provisionamento" className="text-xs sm:text-sm"><Calculator className="h-4 w-4 mr-1" /> Provisionamento</TabsTrigger>
              <TabsTrigger value="funcionarios" className="text-xs sm:text-sm"><Users className="h-4 w-4 mr-1" /> Funcionários</TabsTrigger>
            </TabsList>
            <TabsContent value="dashboard"><FopagDashboard year={year} /></TabsContent>
            <TabsContent value="provisionamento"><Provisionamento year={year} /></TabsContent>
            <TabsContent value="funcionarios"><Funcionarios /></TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}
