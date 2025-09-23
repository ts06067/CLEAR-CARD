import api from "./api";
import axios from "axios";
import type { AxiosRequestConfig } from "axios";

export type TableJson = {
  columns: string[];
  rows: string[][];
  total?: number;
  status: "OK" | "ERROR";
  error?: string;
};

export type ArticleDetail = {
  cited_eid: string;
  cited_doi: string;
  cited_title: string;
  cited_journal: string;
  cited_pub_date: string;
  cited_pub_year: number | null;
  cited_pub_month: number | null;
  cited_pub_day: number | null;
  cited_category: string | null;
  fitness: number | null;
  citation_count_2y: number | null;
} | null;

async function getWithFallback<T>(
  path: string,
  params?: Record<string, any>,
  opts?: { signal?: AbortSignal; timeoutMs?: number }
): Promise<T> {
  const cfg: AxiosRequestConfig = {
    params,
    headers: { Accept: "application/json" },
    withCredentials: true,
    timeout: opts?.timeoutMs ?? 300_000,
    signal: opts?.signal,
  };
  try {
    console.log("GET", path, params);
    const { data } = await api.get<T>(path, cfg);
    console.log("GOT", path, data);
    return data;
  } catch (err: any) {
    const st = err?.response?.status;
    if (st === 403 || st === 404) {
      const { data } = await axios.get<T>(`http://localhost:8080${path}`, cfg);
      return data;
    }
    throw err;
  }
}

async function postWithFallback<T>(
  path: string,
  body?: any,
  opts?: { signal?: AbortSignal; timeoutMs?: number }
): Promise<T> {
  const cfg: AxiosRequestConfig = {
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    withCredentials: true,
    timeout: opts?.timeoutMs ?? 360_000,
    signal: opts?.signal,
  };
  try {
    const { data } = await api.post<T>(path, body ?? {}, cfg);
    return data;
  } catch (err: any) {
    const st = err?.response?.status;
    if (st === 403 || st === 404) {
      const { data } = await axios.post<T>(`http://localhost:8080${path}`, body ?? {}, cfg);
      return data;
    }
    throw err;
  }
}

/* public APIs (no server paging) */

export async function listArticles(
  params: {
    q?: string;
    category?: string;
    yearFrom?: number;
    yearTo?: number;
    sort?: "cited_pub_year" | "cited_journal" | "citation_count" | "fitness" | "cited_title";
    order?: "asc" | "desc";
  },
  opts?: { signal?: AbortSignal; timeoutMs?: number }
): Promise<TableJson> {
  return getWithFallback<TableJson>("/articles", params, opts);
}

export async function searchArticles(
  body: {
    qb: any;
    sort?: "cited_pub_year" | "cited_journal" | "citation_count" | "fitness" | "cited_title";
    order?: "asc" | "desc";
    yearFrom?: number;
    yearTo?: number;
    q?: string;
    category?: string;
  },
  opts?: { signal?: AbortSignal; timeoutMs?: number }
): Promise<TableJson> {
  return postWithFallback<TableJson>("/articles/search", body, opts);
}

export async function getArticleDetail(
  eid: string,
  opts?: { signal?: AbortSignal; timeoutMs?: number }
): Promise<ArticleDetail> {
  if (!eid) throw new Error("eid required");
  return getWithFallback<ArticleDetail>(`/articles/${encodeURIComponent(eid)}`, undefined, opts);
}

export async function getArticleCitations(
  eid: string,
  opts?: { signal?: AbortSignal; timeoutMs?: number }
): Promise<TableJson> {
  if (!eid) throw new Error("eid required");
  return getWithFallback<TableJson>(`/articles/${encodeURIComponent(eid)}/cites`, undefined, opts);
}
