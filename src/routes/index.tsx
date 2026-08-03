import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <p className="text-lg">vou trazer um arquivo csv aqui do meu banco de dados, voce consegue puxar ?</p>
    </div>
  );
}
