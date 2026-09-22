import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useLeadTrackBase } from "@/lib/leadtrack-data";
import { daysSince, formatCurrency, type Lead } from "@/lib/leadtrack";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/painel")({
  head: () => ({
    meta: [
      { title: "Painel de desempenho | LeadTrack" },
      { name: "description", content: "Indicadores do funil: leads por etapa, conversão, valor em negociação e leads parados." },
      { property: "og:title", content: "Painel de desempenho | LeadTrack" },
      { property: "og:description", content: "Indicadores do funil: leads por etapa, conversão, valor em negociação e leads parados." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <AppShell>
      <PainelPage />
    </AppShell>
  ),
});

function PainelPage() {
  const { columns, profiles, stalledDays } = useLeadTrackBase();

  const { data: leads = [] } = useQuery({
    queryKey: ["leads"],
    queryFn: async () => {
      const { data, error } = await supabase.from("leads").select("*");
      if (error) throw error;
      return data as Lead[];
    },
  });

  const wonKeys = columns.filter((c) => c.is_won).map((c) => c.key);
  const lostKeys = columns.filter((c) => c.is_lost).map((c) => c.key);
  const won = leads.filter((l) => wonKeys.includes(l.status));
  const lost = leads.filter((l) => lostKeys.includes(l.status));
  const openLeads = leads.filter((l) => !wonKeys.includes(l.status) && !lostKeys.includes(l.status));
  const stalled = openLeads.filter((l) => daysSince(l.last_interaction_at ?? l.updated_at) >= stalledDays);
  const closed = won.length + lost.length;
  const conversion = closed ? Math.round((won.length / closed) * 100) : 0;
  const pipeline = openLeads.reduce((sum, l) => sum + (l.estimated_value ?? 0), 0);

  const cards = [
    { label: "Leads em aberto", value: String(openLeads.length) },
    { label: "Valor em negociação", value: formatCurrency(pipeline) },
    { label: "Taxa de conversão", value: `${conversion}%` },
    { label: `Parados (${stalledDays}+ dias)`, value: String(stalled.length) },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Painel</h1>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">{c.label}</p>
              <p className="mt-1 text-2xl font-semibold">{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Leads por etapa</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {columns.map((c) => {
              const count = leads.filter((l) => l.status === c.key).length;
              const pct = leads.length ? (count / leads.length) * 100 : 0;
              return (
                <div key={c.id}>
                  <div className="flex justify-between text-sm">
                    <span>{c.label}</span>
                    <span className="text-muted-foreground">{count}</span>
                  </div>
                  <div className="mt-1 h-2 rounded bg-muted">
                    <div className="h-2 rounded" style={{ width: `${pct}%`, backgroundColor: c.color }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Desempenho por representante</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="pb-2">Representante</th>
                  <th className="pb-2">Abertos</th>
                  <th className="pb-2">Ganhos</th>
                  <th className="pb-2">Parados</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="py-2">{p.name}</td>
                    <td className="py-2">{openLeads.filter((l) => l.owner_id === p.id).length}</td>
                    <td className="py-2">{won.filter((l) => l.owner_id === p.id).length}</td>
                    <td className="py-2">{stalled.filter((l) => l.owner_id === p.id).length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
