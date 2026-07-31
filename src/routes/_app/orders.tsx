import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/Orders";
import { RequireTab } from "@/components/RequireTab";

export const Route = createFileRoute("/_app/orders")({
  head: () => ({
    meta: [
      { title: "Orders | Gelo Plus" },
      { name: "description", content: "Gestão de Orders no sistema Gelo Plus." },
      { property: "og:title", content: "Orders | Gelo Plus" },
      { property: "og:description", content: "Gestão de Orders no sistema Gelo Plus." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <RequireTab tab="orders">
      <Page />
    </RequireTab>
  ),
});
