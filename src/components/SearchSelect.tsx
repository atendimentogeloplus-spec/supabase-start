import { useEffect, useRef, useState } from "react";
import { matches } from "@/lib/search";

export type Opt = { value: string; label: string };

/** Seletor com busca: digite qualquer parte do nome (início, meio ou fim). */
export function SearchSelect({ value, onChange, options, placeholder, disabled, className = "" }: {
  value: string; onChange: (v: string) => void; options: Opt[]; placeholder: string; disabled?: boolean; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value)?.label ?? "";

  useEffect(() => {
    const h = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const list = options.filter((o) => matches(o.label, text));
  const pick = (v: string) => { onChange(v); setOpen(false); setText(""); };

  return (
    <div ref={box} className={`relative w-full ${className}`}>
      <input
        className="h-9 w-full rounded-md border bg-background px-2 text-sm disabled:opacity-50"
        disabled={disabled}
        placeholder={current || placeholder}
        value={open ? text : current}
        onFocus={() => { setOpen(true); setText(""); }}
        onChange={(e) => { setText(e.target.value); setOpen(true); }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && list[0]) { e.preventDefault(); pick(list[0].value); }
          if (e.key === "Escape") setOpen(false);
        }}
      />
      {open && !disabled && (
        <div className="absolute z-50 mt-1 max-h-64 w-full min-w-[16rem] overflow-y-auto rounded-md border bg-popover text-sm text-popover-foreground shadow-md">
          <button type="button" className="block w-full px-2 py-1.5 text-left text-muted-foreground hover:bg-accent" onClick={() => pick("")}>{placeholder}</button>
          {list.map((o) => (
            <button key={o.value} type="button" className={`block w-full px-2 py-1.5 text-left hover:bg-accent ${o.value === value ? "font-medium" : ""}`} onClick={() => pick(o.value)}>{o.label}</button>
          ))}
          {list.length === 0 && <div className="px-2 py-1.5 text-muted-foreground">Nada encontrado.</div>}
        </div>
      )}
    </div>
  );
}
