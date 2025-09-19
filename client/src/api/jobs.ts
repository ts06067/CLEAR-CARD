// client/src/api/jobs.ts
import { api } from "./client";

/* ---------- Types ---------- */
export interface JobSummary {
  id: string;
  title?: string;
  createdAt: string;
  status: "PENDING" | "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED";
  pinned?: boolean;
}
export interface JobDetail extends JobSummary {
  sql: string;
  config?: any;
  ownerId: string;
}
export interface JobSubmitResponse {
  job_id: string;
  status: "PENDING" | "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED";
}
export interface JobStatusResponse {
  state: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED";
  error?: string;
}

/* ---------- Helpers ---------- */
const ALLOWED = new Set(["PENDING", "QUEUED", "RUNNING", "SUCCEEDED", "FAILED"]);

function normalizeStatus(s: any): JobSummary["status"] {
  let v = String(s ?? "PENDING").toUpperCase();
  if (!ALLOWED.has(v)) {
    if (v === "SUCCESS" || v === "DONE" || v === "COMPLETED") v = "SUCCEEDED";
    else if (v === "ERROR") v = "FAILED";
    else v = "PENDING";
  }
  return v as JobSummary["status"];
}

function normalizeSummary(raw: any): JobSummary | null {
  const idRaw = raw?.id ?? raw?.jobId ?? raw?.job_id ?? raw?.uuid ?? raw?.job?.id;
  const id = (idRaw !== undefined && idRaw !== null) ? String(idRaw) : "";
  if (!id.trim()) return null;

  const title = raw?.title ?? raw?.name ?? raw?.jobTitle ?? undefined;

  const createdAtRaw =
    raw?.createdAt ??
    raw?.created_at ??
    raw?.createdDate ??
    raw?.created_date ??
    raw?.createdTime ??
    raw?.created_time ??
    new Date().toISOString();

  const status = normalizeStatus(raw?.status ?? raw?.state ?? raw?.jobStatus);

  return { id: id.trim(), title, createdAt: String(createdAtRaw), status };
}

function normalizeDetail(raw: any, jobId: string): JobDetail {
  const base = normalizeSummary({ ...raw, id: raw?.id ?? jobId })!;
  const sql = String(raw?.sql ?? raw?.query ?? raw?.statement ?? "");
  let config: any = raw?.config ?? raw?.jobConfig ?? undefined;
  if (typeof config === "string") {
    try { config = JSON.parse(config); } catch { /* ignore */ }
  }
  const ownerId = String(
    raw?.ownerId ?? raw?.owner_id ?? raw?.userId ?? raw?.user_id ?? raw?.createdBy ?? ""
  );
  return { ...base, sql, config, ownerId };
}

/* Some Spring configs issue the XSRF cookie only after some GET */
async function ensureCsrfCookie() {
  try { await api.get("/csrf"); } catch (_e) { void _e; }
  try { await api.get("/auth/csrf"); } catch (_e) { void _e; }
}

/* ---------- API ---------- */

export async function submitJob(
  sql: string,
  opts?: { format?: "csv" | "json"; pageSize?: number; maxRows?: number; config?: any; title?: string }
) {
  const params = {
    format: opts?.format ?? "csv",
    pageSize: opts?.pageSize ?? 5000,
    maxRows: opts?.maxRows ?? 5_000_000
  };

  console.log("Submitting job with params:", params, "and config:", opts?.config);

  await ensureCsrfCookie();

  try {
    const { data } = await api.post<JobSubmitResponse>("/jobs", sql, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        ...(opts?.title ? { "X-Job-Title": opts.title } : {}),
        ...(opts?.config ? { "X-Job-Config": JSON.stringify(opts.config) } : {})
      },
      params
    });

    console.log("Job submitted, got response:", data);
    return data;
  } catch (err: any) {
    const status = err?.response?.status;
    if (status === 403 || status === 415 || status === 400) {
      const body = {
        sql,
        title: opts?.title ?? null,
        tableConfig: opts?.config?.qb ?? null,
        chartConfig: opts?.config?.cfg ?? null
      };
      const { data } = await api.post<JobSubmitResponse>("/jobs", body, {
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        params
      });
      return data;
    }
    throw err;
  }
}

export async function getJobStatus(jobId: string) {
  if (!jobId) throw new Error("jobId required");
  const { data } = await api.get<JobStatusResponse>(`/jobs/${jobId}`);
  return data;
}

export async function getResultJson(jobId: string) {
  if (!jobId) throw new Error("jobId required");
  // Treat 409/404 as "not ready" and return null instead of throwing.
  try {
    const { data } = await api.get<any[]>(`/jobs/${jobId}/download.json`, {
      headers: { Accept: "application/json" },
      responseType: "json",
    });
    return data;
  } catch (err: any) {
    console.error("Error fetching JSON result for job", jobId, err);
    const st = err?.response?.status;
    if (st === 409 || st === 404) return null;
    throw err;
  }
}

export function getResultCsvUrl(jobId: string) {
  return `/api/jobs/${jobId}/download.csv`;
}

export async function listMyJobs() {
  try {
    const { data } = await api.get<any[]>("/jobs/mine");
    return (Array.isArray(data) ? data : []).map(normalizeSummary).filter(Boolean) as JobSummary[];
  } catch {
    const { data } = await api.get<any[]>("/jobs", { params: { owner: "me" } });
    return (Array.isArray(data) ? data : []).map(normalizeSummary).filter(Boolean) as JobSummary[];
  }
}

export async function getJob(jobId: string) {
  const { data } = await api.get<any>(`/jobs/${jobId}/detail`);
  return normalizeDetail(data, jobId);
}

export async function setServerPin(jobId: string, pinned: boolean) {
  try {
    await api.patch(`/jobs/${jobId}/pin`, { pinned });
  } catch {
    // ignore best-effort pin errors
  }
}
