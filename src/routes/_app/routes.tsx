import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/Routes";
import { RequireTab } from "@/components/RequireTab";

export const Route = createFileRoute("/_app/routes")({
  head: () => ({
    meta: [
      { title: "Routes | Gelo Plus" },
      { name: "description", content: "Gestão de Routes no sistema Gelo Plus." },
      { property: "og:title", content: "Routes | Gelo Plus" },
      { property: "og:description", content: "Gestão de Routes no sistema Gelo Plus." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <RequireTab tab="routes">
      <Page />
    </RequireTab>
  ),
});
