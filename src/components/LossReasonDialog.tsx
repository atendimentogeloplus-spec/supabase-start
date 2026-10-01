import { useState } from "react";
import { createRoot } from "react-dom/client";
import { Button } from "@/components/ui/button";

export const LOSS_REASONS = [
  "Pedido mínimo alto",
  "Fora da área de atendimento",
  "Comprou de outro fornecedor",
  "Preço",
  "Prazo",
  "Desistiu/adiou a compra",
  "Sem retorno do cliente",
  "Outro",
];

function Dialog({ onDone }: { onDone: (v: string | null) => void }) {
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [err, setErr] = useState("");
  function save() {
    if (!reason) return setErr("Selecione um motivo.");
    if (reason === "Outro" && !notes.trim()) return setErr("Descreva o motivo nas observações.");
    onDone(notes.trim() ? `${reason} — ${notes.trim().slice(0, 500)}` : reason);
  }
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/40 p-4">
      <div className="w-full max-w-md space-y-3 rounded-xl bg-background p-5 shadow-xl">
        <h2 className="text-lg font-semibold">Motivo da perda</h2>
        <div className="grid gap-1.5">
          {LOSS_REASONS.map((r) => (
            <label key={r} className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm ${reason === r ? "border-primary bg-primary/10" : ""}`}>
              <input type="radio" name="loss" checked={reason === r} onChange={() => { setReason(r); setErr(""); }} />
              {r}
            </label>
          ))}
        </div>
        <div>
          <label className="text-sm font-medium">Observações{reason === "Outro" ? " (obrigatório)" : " (opcional)"}</label>
          <textarea className="mt-1 min-h-20 w-full rounded-md border bg-background p-2 text-sm" value={notes} onChange={(e) => { setNotes(e.target.value); setErr(""); }} />
        </div>
        {err && <p className="text-sm text-destructive">{err}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onDone(null)}>Cancelar</Button>
          <Button onClick={save}>Confirmar</Button>
        </div>
      </div>
    </div>
  );
}

export function askLossReason(): Promise<string | null> {
  return new Promise((resolve) => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    const root = createRoot(el);
    root.render(<Dialog onDone={(v) => { root.unmount(); el.remove(); resolve(v); }} />);
  });
}
