import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Blank Project" },
      {
        name: "description",
        content: "Blank project connected to external Supabase.",
      },
      { property: "og:title", content: "Blank Project" },
      {
        property: "og:description",
        content: "Blank project connected to external Supabase.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-foreground">
          Projeto conectado ao Supabase
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Configure suas credenciais para começar.
        </p>
      </div>
    </div>
  );
}
