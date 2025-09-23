// client/src/api/jobs.ts
import { api } from "./client";
/* ---------- Helpers ---------- */
const ALLOWED = new Set(["PENDING", "QUEUED", "RUNNING", "SUCCEEDED", "FAILED"]);
function normalizeStatus(s) {
    let v = String(s ?? "PENDING").toUpperCase();
    if (!ALLOWED.has(v)) {
        if (v === "SUCCESS" || v === "DONE" || v === "COMPLETED")
            v = "SUCCEEDED";
        else if (v === "ERROR")
            v = "FAILED";
        else
            v = "PENDING";
    }
    return v;
}
function tryParseJSON(maybeJSON) {
    if (maybeJSON == null)
        return undefined;
    if (typeof maybeJSON !== "string")
        return maybeJSON;
    try {
        return JSON.parse(maybeJSON);
    }
    catch {
        return maybeJSON;
    }
}
function normalizeSummary(raw) {
    const idRaw = raw?.id ?? raw?.jobId ?? raw?.job_id ?? raw?.uuid ?? raw?.job?.id;
    const id = (idRaw !== undefined && idRaw !== null) ? String(idRaw) : "";
    if (!id.trim())
        return null;
    const title = raw?.title ?? raw?.name ?? raw?.jobTitle ?? undefined;
    const createdAtRaw = raw?.createdAt ?? raw?.created_at ?? raw?.submitted_at ??
        raw?.createdDate ?? raw?.created_date ?? raw?.createdTime ??
        raw?.created_time ?? new Date().toISOString();
    const completedAtRaw = raw?.completedAt ?? raw?.completed_at ?? raw?.finished_at ?? undefined;
    const status = normalizeStatus(raw?.status ?? raw?.state ?? raw?.jobStatus);
    // new fields coming from the DAO join
    const tableConfig = tryParseJSON(raw?.table_config ?? raw?.tableConfig);
    const chartConfig = tryParseJSON(raw?.chart_config ?? raw?.chartConfig);
    return {
        id: id.trim(),
        title,
        createdAt: String(createdAtRaw),
        completedAt: completedAtRaw ? String(completedAtRaw) : undefined,
        status,
        tableConfig,
        chartConfig,
    };
}
function normalizeDetail(raw, jobId) {
    const base = normalizeSummary({ ...raw, id: raw?.id ?? jobId });
    const sql = String(raw?.sql ?? raw?.query ?? raw?.statement ?? "");
    let config = raw?.config ?? raw?.jobConfig ?? undefined;
    if (typeof config === "string") {
        try {
            config = JSON.parse(config);
        }
        catch { /* ignore */ }
    }
    const ownerId = String(raw?.ownerId ?? raw?.owner_id ?? raw?.userId ?? raw?.user_id ?? raw?.createdBy ?? "");
    return { ...base, sql, config, ownerId };
}
/* Some Spring configs issue the XSRF cookie only after some GET */
async function ensureCsrfCookie() {
    try {
        await api.get("/csrf");
    }
    catch (_e) {
        void _e;
    }
    try {
        await api.get("/auth/csrf");
    }
    catch (_e) {
        void _e;
    }
}
/* ---------- API ---------- */
export async function submitJob(sql, opts) {
    const params = {
        format: opts?.format ?? "csv",
        pageSize: opts?.pageSize ?? 5000,
        maxRows: opts?.maxRows ?? 5000000
    };
    await ensureCsrfCookie();
    try {
        const { data } = await api.post("/jobs", sql, {
            headers: {
                "Content-Type": "text/plain; charset=utf-8",
                ...(opts?.title ? { "X-Job-Title": opts.title } : {}),
                ...(opts?.config ? { "X-Job-Config": JSON.stringify(opts.config) } : {})
            },
            params
        });
        return data;
    }
    catch (err) {
        const status = err?.response?.status;
        if (status === 403 || status === 415 || status === 400) {
            const body = {
                sql,
                title: opts?.title ?? null,
                tableConfig: opts?.config?.qb ?? null,
                chartConfig: opts?.config?.cfg ?? null
            };
            const { data } = await api.post("/jobs", body, {
                headers: { "Content-Type": "application/json", Accept: "application/json" },
                params
            });
            return data;
        }
        throw err;
    }
}
export async function getJobStatus(jobId) {
    if (!jobId)
        throw new Error("jobId required");
    const { data } = await api.get(`/jobs/${jobId}`);
    return data;
}
export async function getResultJson(jobId) {
    if (!jobId)
        throw new Error("jobId required");
    try {
        const { data } = await api.get(`/jobs/${jobId}/download.json`, {
            headers: { Accept: "application/json" },
            responseType: "json",
        });
        return data;
    }
    catch (err) {
        const st = err?.response?.status;
        if (st === 409 || st === 404)
            return null;
        throw err;
    }
}
export function getResultCsvUrl(jobId) {
    return `/api/jobs/${jobId}/download.csv`;
}
export async function listMyJobs() {
    try {
        const { data } = await api.get("/jobs/mine");
        return (Array.isArray(data) ? data : [])
            .map(normalizeSummary)
            .filter(Boolean);
    }
    catch {
        const { data } = await api.get("/jobs", { params: { owner: "me" } });
        return (Array.isArray(data) ? data : [])
            .map(normalizeSummary)
            .filter(Boolean);
    }
}
export async function getJob(jobId) {
    const { data } = await api.get(`/jobs/${jobId}/detail`);
    return normalizeDetail(data, jobId);
}
export async function setServerPin(jobId, pinned) {
    try {
        await api.patch(`/jobs/${jobId}/pin`, { pinned });
    }
    catch {
        // best effort
    }
}
