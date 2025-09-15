import { api } from "./client";

export interface JobSubmitResponse {
  job_id: string;
  status: "PENDING" | "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED";
}
export interface JobStatusResponse {
  state: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED";
  error?: string;
}

export async function submitJob(
  sql: string,
  opts?: { format?: "csv" | "json"; pageSize?: number; maxRows?: number }
) {
  const params = {
    format: opts?.format ?? "csv",
    pageSize: opts?.pageSize ?? 5000,
    maxRows: opts?.maxRows ?? 5_000_000
  };
  // Swagger shows plain text SQL body
  const { data } = await api.post<JobSubmitResponse>("/jobs", sql, {
    headers: { "Content-Type": "text/plain" },
    params
  });
  return data;
}

export async function getJobStatus(jobId: string) {
  const { data } = await api.get<JobStatusResponse>(`/jobs/${jobId}`);
  return data;
}

export async function getResultJson(jobId: string) {
  const { data } = await api.get<any[]>(`/jobs/${jobId}/download.json`);
  return data;
}

export function getResultCsvUrl(jobId: string) {
  // Vite proxy will rewrite /api → backend root
  return `/api/jobs/${jobId}/download.csv`;
}
