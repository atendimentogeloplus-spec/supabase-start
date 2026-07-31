import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/CashFlow";
import { RequireTab } from "@/components/RequireTab";

export const Route = createFileRoute("/_app/cash-flow")({
  head: () => ({
    meta: [
      { title: "CashFlow | Gelo Plus" },
      { name: "description", content: "Gestão de CashFlow no sistema Gelo Plus." },
      { property: "og:title", content: "CashFlow | Gelo Plus" },
      { property: "og:description", content: "Gestão de CashFlow no sistema Gelo Plus." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <RequireTab tab="cash-flow">
      <Page />
    </RequireTab>
  ),
});
