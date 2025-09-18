import { api } from "./client";

export interface DefaultMetrics {
  publicationsByJournal: { journal: string; count: number }[];
  citationsByJournal: { journal: string; count: number }[];
  publications2024ByJournal: { journal: string; count: number }[];
  citations2024ByJournal: { journal: string; count: number }[];
  impactFactors: { year: number; JACC: number; CIRC: number; EHJ: number }[];
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

export async function getDefaultMetrics(): Promise<DefaultMetrics> {
  try {
    const { data } = await api.get<DefaultMetrics>("/metrics/default");
    return data;
  } catch {
    return DUMMY;
  }
}
