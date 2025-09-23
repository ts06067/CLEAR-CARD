import { useMemo, useState } from "react";

export default function ResultTable({ rows }: { rows?: any[] }) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);

  const data = rows ?? [];

  // Derive columns from first row (memoized)
  const cols = useMemo(() => (data[0] ? Object.keys(data[0]) : []), [data]);

  // Filtered rows (memoized)
  const filtered = useMemo(() => {
    if (!q.trim()) return data;
    const needle = q.toLowerCase();
    return data.filter(r => cols.some(c => String(r[c]).toLowerCase().includes(needle)));
  }, [q, data, cols]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = useMemo(
    () => filtered.slice(page * pageSize, (page + 1) * pageSize),
    [filtered, page, pageSize]
  );

  if (!data.length) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          className="input w-64"
          placeholder="Search…"
          value={q}
          onChange={e => {
            setQ(e.target.value);
            setPage(0);
          }}
        />
        <select
          className="select"
          value={pageSize}
          onChange={e => {
            setPageSize(Number(e.target.value));
            setPage(0);
          }}
        >
          {[10, 20, 50, 100].map(n => (
            <option key={n} value={n}>
              {n} / page
            </option>
          ))}
        </select>
        <div className="text-sm text-slate-500 ml-auto">{filtered.length} rows</div>
      </div>

      <div className="overflow-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 sticky top-0">
            <tr>
              {cols.map(c => (
                <th key={c} className="px-3 py-2 text-left">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {current.map((r, i) => (
              <tr key={i} className="odd:bg-white even:bg-slate-50">
                {cols.map(c => (
                  <td key={c} className="px-3 py-1">
                    {String(r[c])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2 justify-end">
        <button className="btn btn-ghost" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>
          Prev
        </button>
        <div className="text-sm">
          {page + 1} / {pages}
        </div>
        <button
          className="btn btn-ghost"
          onClick={() => setPage(p => Math.min(pages - 1, p + 1))}
          disabled={page === pages - 1}
        >
          Next
        </button>
      </div>
    </div>
  );
}
