import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutDashboard, List, LineChart, Tags, Wallet, Receipt, ArrowRightLeft, AlertCircle } from "lucide-react";
import { useFinanceData } from "./useFinanceData";
import VisaoGeral from "./VisaoGeral";
import Lancamentos from "./Lancamentos";
import Projecao from "./Projecao";
import Categorias from "./Categorias";
import ContasReceber from "./ContasReceber";
import ContasPagar from "./ContasPagar";
import Transferencias from "./Transferencias";
import Dividas from "./Dividas";

export default function FinanceiroModule() {
  const [tab, setTab] = useState("proj");
  const { transactions, categories, loading, reload, userId } = useFinanceData();

  if (loading && transactions.length === 0 && categories.length === 0) {
    return <div className="py-20 text-center text-muted-foreground">Carregando...</div>;
  }


  return (
    <Tabs value={tab} onValueChange={setTab} className="space-y-4 sm:space-y-6">
      <TabsList className="grid w-full max-w-6xl grid-cols-4 md:grid-cols-8 bg-muted/50 p-1 rounded-xl">
        <TabsTrigger value="visao" className="flex items-center gap-1.5 rounded-lg text-[10px] sm:text-xs">
          <LayoutDashboard className="h-4 w-4" /> <span>Visão Geral</span>
        </TabsTrigger>
        <TabsTrigger value="lanc" className="flex items-center gap-1.5 rounded-lg text-[10px] sm:text-xs">
          <List className="h-4 w-4" /> <span>Lançamentos</span>
        </TabsTrigger>
        <TabsTrigger value="receber" className="flex items-center gap-1.5 rounded-lg text-[10px] sm:text-xs">
          <Wallet className="h-4 w-4" /> <span>A Receber</span>
        </TabsTrigger>
        <TabsTrigger value="pagar" className="flex items-center gap-1.5 rounded-lg text-[10px] sm:text-xs">
          <Receipt className="h-4 w-4" /> <span>A Pagar</span>
        </TabsTrigger>
        <TabsTrigger value="proj" className="flex items-center gap-1.5 rounded-lg text-[10px] sm:text-xs">
          <LineChart className="h-4 w-4" /> <span>Projeção</span>
        </TabsTrigger>
        <TabsTrigger value="trf" className="flex items-center gap-1.5 rounded-lg text-[10px] sm:text-xs">
          <ArrowRightLeft className="h-4 w-4" /> <span>Transferências</span>
        </TabsTrigger>
        <TabsTrigger value="div" className="flex items-center gap-1.5 rounded-lg text-[10px] sm:text-xs">
          <AlertCircle className="h-4 w-4" /> <span>Dívidas</span>
        </TabsTrigger>
        <TabsTrigger value="cat" className="flex items-center gap-1.5 rounded-lg text-[10px] sm:text-xs">
          <Tags className="h-4 w-4" /> <span>Categorias</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="visao">
        <VisaoGeral transactions={transactions} categories={categories} onViewAll={() => setTab("lanc")} />
      </TabsContent>
      <TabsContent value="lanc">
        <Lancamentos transactions={transactions} categories={categories} userId={userId} reload={reload} />
      </TabsContent>
      <TabsContent value="receber">
        <ContasReceber userId={userId} categories={categories} reloadTransactions={reload} />
      </TabsContent>
      <TabsContent value="pagar">
        <ContasPagar userId={userId} categories={categories} reloadTransactions={reload} />
      </TabsContent>
      <TabsContent value="proj">
        <Projecao transactions={transactions} categories={categories} userId={userId} reload={reload} />
      </TabsContent>
      <TabsContent value="trf">
        <Transferencias userId={userId} reload={reload} />
      </TabsContent>
      <TabsContent value="div">
        <Dividas transactions={transactions} />
      </TabsContent>
      <TabsContent value="cat">
        <Categorias categories={categories} transactions={transactions} userId={userId} reload={reload} />
      </TabsContent>
    </Tabs>
  );
}

