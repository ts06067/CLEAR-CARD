import { createContext } from "react";

/** State kept across tabs/navigation */
export type CacheState = {
  columns: string[];
  fullRows: string[][];
  qb: any;
  yearFrom: number;
  yearTo: number;
  sort: "cited_pub_year" | "cited_journal" | "citation_count" | "fitness" | "cited_title";
  order: "asc" | "desc";
  page: number;
  pageSize: number;
  status: "OK" | "ERROR";
  error: string;
  hydrated: boolean; // set to true after first successful fetch
};

export type CacheCtx = CacheState & {
  setColumns: (v: string[]) => void;
  setFullRows: (v: string[][]) => void;
  setQB: (v: any) => void;
  setYearFrom: (n: number) => void;
  setYearTo: (n: number) => void;
  setSort: (s: CacheState["sort"]) => void;
  setOrder: (o: CacheState["order"]) => void;
  setPage: (n: number) => void;
  setPageSize: (n: number) => void;
  setStatus: (s: CacheState["status"]) => void;
  setError: (s: string) => void;
  setHydrated: (b: boolean) => void;
  reset: () => void;
};

export const defaultState: CacheState = {
  columns: [],
  fullRows: [],
  qb: { combinator: "and", rules: [], id: "article-qb" },
  yearFrom: 2008,
  yearTo: 2018,
  sort: "cited_pub_year",
  order: "desc",
  page: 1,
  pageSize: 50,
  status: "OK",
  error: "",
  hydrated: false,
};

export const ArticleCacheCtx = createContext<CacheCtx | null>(null);
