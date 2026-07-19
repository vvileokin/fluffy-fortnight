/**
 * PostgREST caps every response at 1000 rows, silently — a query over a bigger
 * table just returns the first page. Anything that must see *all* rows (scoring
 * a stage, enumerating participants) has to page through explicitly.
 */
export async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<{ rows: T[]; error: unknown }> {
  const SIZE = 1000;
  const rows: T[] = [];
  for (let from = 0; ; from += SIZE) {
    const { data, error } = await page(from, from + SIZE - 1);
    if (error) return { rows, error };
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < SIZE) break;
  }
  return { rows, error: null };
}
