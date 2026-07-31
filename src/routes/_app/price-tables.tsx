import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/PriceTables";
import { RequireTab } from "@/components/RequireTab";

export const Route = createFileRoute("/_app/price-tables")({
  head: () => ({
    meta: [
      { title: "PriceTables | Gelo Plus" },
      { name: "description", content: "Gestão de PriceTables no sistema Gelo Plus." },
      { property: "og:title", content: "PriceTables | Gelo Plus" },
      { property: "og:description", content: "Gestão de PriceTables no sistema Gelo Plus." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <RequireTab tab="price-tables">
      <Page />
    </RequireTab>
  ),
});
