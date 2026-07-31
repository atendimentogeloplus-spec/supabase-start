import { supabase } from "@/integrations/supabase/client";

const SALES_PAGE_SIZE = 1000;

/**
 * Fetch sales from the last `days` days (default 60).
 * Pass `days = 0` to fetch ALL sales (use with caution).
 */
export async function fetchAllSales<T = any>(select: string, days = 60): Promise<T[]> {
  const allSales: T[] = [];
  let from = 0;

  const sinceISO = days > 0
    ? new Date(Date.now() - days * 86400000).toISOString()
    : null;

  while (true) {
    let query = supabase
      .from("sales")
      .select(select)
      .order("created_at", { ascending: false })
      .range(from, from + SALES_PAGE_SIZE - 1);

    if (sinceISO) {
      query = query.gte("created_at", sinceISO);
    }

    const { data, error } = await query;

    if (error) throw error;
    if (!data?.length) break;

    allSales.push(...(data as T[]));

    if (data.length < SALES_PAGE_SIZE) break;
    from += SALES_PAGE_SIZE;
  }

  return allSales;
}
