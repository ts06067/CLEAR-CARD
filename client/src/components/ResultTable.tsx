export default function ResultTable({ rows }: { rows?: any[] }) {
  if (!rows || !rows.length) return null;
  const cols = Object.keys(rows[0] ?? {});
  return (
    <div className="overflow-auto border rounded">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 sticky top-0">
          <tr>
            {cols.map((c) => (
              <th key={c} className="px-3 py-2 text-left">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="odd:bg-white even:bg-slate-50">
              {cols.map((c) => (
                <td key={c} className="px-3 py-1">
                  {String(r[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
