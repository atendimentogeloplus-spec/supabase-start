import { useEffect, useMemo, useState } from "react";

/** Tamanho de lote por requisição (o banco devolve no máximo 1000 por vez). */
export const PAGE_CHUNK = 1000;

/**
 * Busca TODAS as linhas de uma consulta em lotes de 1000, sem limite.
 * Uso: fetchAll((from, to) => supabase.from("x").select("*").order("id").range(from, to))
 */
export async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<{ data: T[]; error: null }> {
  const all: T[] = [];
  for (let from = 0; ; from += PAGE_CHUNK) {
    const { data, error } = await build(from, from + PAGE_CHUNK - 1);
    if (error) throw error;
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < PAGE_CHUNK) break;
  }
  return { data: all, error: null };
}

/** Paginação na tela: divide uma lista em páginas. */
export function usePaged<T>(items: T[], pageSize = 50) {
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  useEffect(() => {
    if (page > pages) setPage(pages);
  }, [page, pages]);
  const rows = useMemo(() => items.slice((page - 1) * pageSize, page * pageSize), [items, page, pageSize]);
  return { rows, page, pages, total: items.length, setPage };
}
