// client/src/api/metrics.ts
import { api } from "./client";

export interface DefaultMetrics {
  publicationsByJournal: { journal: string; count: number }[];
  citationsByJournal: { journal: string; count: number }[];
  publications2024ByJournal: { journal: string; count: number }[];
  citations2024ByJournal: { journal: string; count: number }[];
  impactFactors: { year: number; JACC?: number; CIRC?: number; EHJ?: number }[];
  originalsByJournal: { journal: string; count: number }[];
  originalCitationsByJournal: { journal: string; count: number }[];
}

const DUMMY: DefaultMetrics = {
  publicationsByJournal: [{ journal: "JACC", count: 12000 }, { journal: "Circulation", count: 11500 }, { journal: "EHJ", count: 11000 }],
  citationsByJournal: [{ journal: "JACC", count: 480000 }, { journal: "Circulation", count: 470000 }, { journal: "EHJ", count: 460000 }],
  publications2024ByJournal: [{ journal: "JACC", count: 980 }, { journal: "Circulation", count: 940 }, { journal: "EHJ", count: 910 }],
  citations2024ByJournal: [{ journal: "JACC", count: 32000 }, { journal: "Circulation", count: 31000 }, { journal: "EHJ", count: 30000 }],
  impactFactors: Array.from({ length: 17 }).map((_, i) => {
    const year = 2008 + i;
    return { year, JACC: 15 + Math.sin(i/2)*1.2, CIRC: 20 + Math.cos(i/3)*1.5, EHJ: 22 + Math.sin(i/4)*0.9 };
  }),
  originalsByJournal: [{ journal: "JACC", count: 7200 }, { journal: "Circulation", count: 7050 }, { journal: "EHJ", count: 6900 }],
  originalCitationsByJournal: [{ journal: "JACC", count: 380000 }, { journal: "Circulation", count: 370000 }, { journal: "EHJ", count: 360000 }]
};

function sumByJournal(rows: any[] | undefined, valueKey = "value") {
  const acc: Record<string, number> = {};
  for (const r of rows ?? []) {
    const j = String(r?.journal ?? "").trim();
    const v = Number(r?.[valueKey]);
    if (!j || !Number.isFinite(v)) continue;
    acc[j] = (acc[j] ?? 0) + v;
  }
  return Object.entries(acc).map(([journal, count]) => ({ journal, count }));
}

function normJournalKey(name: any): "JACC" | "CIRC" | "EHJ" | string {
  const n = String(name ?? "").toUpperCase();
  if (n.startsWith("JACC")) return "JACC";
  if (n.startsWith("CIRC")) return "CIRC"; // Circulation
  if (n.startsWith("EHJ") || n.includes("EUROPEAN")) return "EHJ";
  return n;
}

export async function getDefaultMetrics(): Promise<DefaultMetrics> {
  try {
    // Server returns: { pubs_total, cites_total, pubs_2024, cites_2024, orig_pubs, orig_cites, impact_factors }
    const { data } = await api.get<any>("/dashboard/default");

    const publicationsByJournal = sumByJournal(data?.pubs_total);
    const citationsByJournal = sumByJournal(data?.cites_total);
    const publications2024ByJournal = sumByJournal(data?.pubs_2024);
    const citations2024ByJournal = sumByJournal(data?.cites_2024);
    const originalsByJournal = sumByJournal(data?.orig_pubs);
    const originalCitationsByJournal = sumByJournal(data?.orig_cites);

    // Pivot impact_factors -> [{year, JACC, CIRC, EHJ}]
    const ifByYear: Record<number, { year: number; [k: string]: number }> = {};
    for (const r of (data?.impact_factors ?? [])) {
      const year = Number(r?.year);
      const val = Number(r?.if_val ?? r?.value);
      if (!Number.isFinite(year) || !Number.isFinite(val)) continue;
      const key = normJournalKey(r?.journal);
      const row = (ifByYear[year] ||= { year });
      row[key] = val;
    }
    const impactFactors = Object.values(ifByYear).sort((a, b) => a.year - b.year);

    return {
      publicationsByJournal,
      citationsByJournal,
      publications2024ByJournal,
      citations2024ByJournal,
      impactFactors,
      originalsByJournal,
      originalCitationsByJournal
    };
  } catch {
    // Fall back to dummy if backend route not available
    return DUMMY;
  }
}
