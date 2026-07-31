import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/Drivers";
import { RequireTab } from "@/components/RequireTab";

export const Route = createFileRoute("/_app/drivers")({
  head: () => ({
    meta: [
      { title: "Drivers | Gelo Plus" },
      { name: "description", content: "Gestão de Drivers no sistema Gelo Plus." },
      { property: "og:title", content: "Drivers | Gelo Plus" },
      { property: "og:description", content: "Gestão de Drivers no sistema Gelo Plus." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <RequireTab tab="drivers">
      <Page />
    </RequireTab>
  ),
});
