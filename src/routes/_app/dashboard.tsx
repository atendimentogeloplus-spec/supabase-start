import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/Dashboard";
import { RequireTab } from "@/components/RequireTab";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard | Gelo Plus" },
      { name: "description", content: "Gestão de Dashboard no sistema Gelo Plus." },
      { property: "og:title", content: "Dashboard | Gelo Plus" },
      { property: "og:description", content: "Gestão de Dashboard no sistema Gelo Plus." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <RequireTab tab="dashboard">
      <Page />
    </RequireTab>
  ),
});
