import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const ROLES: { title: string; items: string[] }[] = [
  {
    title: "Administrador",
    items: [
      "Acesso a tudo: Leads, Clientes, Carteira, Painéis, Relatórios, Estoque, Usuários, Histórico e Lixeira.",
      "Edita e exclui qualquer registro, troca o responsável dos leads e aprova ou desativa usuários.",
      "Exclui pedidos sem precisar de justificativa.",
    ],
  },
  {
    title: "Representante interno / externo",
    items: [
      "Leads: vê e trabalha nos próprios leads; o Painel de Leads mostra só os números dele.",
      "Clientes: vê todos, mas edita só os que estão sob sua responsabilidade.",
      "Carteira de perdidos: vê tudo, mas não troca o responsável.",
      "Estoque: vê todas as abas apenas para consulta, sem alterar nada.",
    ],
  },
  {
    title: "Vendedor nível 2",
    items: [
      "Tudo o que o Representante tem.",
      "Também vê o Painel do Estoque.",
      "Pode excluir pedidos, mas precisa escrever a justificativa da exclusão.",
    ],
  },
  {
    title: "Estoquista",
    items: [
      "Não vê Leads.",
      "Vê e edita todo o Estoque: Pedidos, Saídas, Gestão, Movimentações e Produtos.",
      "Não pode excluir produtos (somente administrador).",
    ],
  },
];

export function PermissionsGuide() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <ShieldCheck className="mr-1 h-4 w-4" /> Ver permissões
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>O que cada papel vê e pode fazer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            {ROLES.map((r) => (
              <div key={r.title} className="rounded-lg border p-3">
                <p className="mb-1 font-semibold">{r.title}</p>
                <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                  {r.items.map((i) => <li key={i}>{i}</li>)}
                </ul>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">Usuários, Histórico, Lixeira e Relatórios gerais são exclusivos dos administradores.</p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
