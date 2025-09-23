import api from "./api";
import axios from "axios";
async function getWithFallback(path, params, opts) {
    const cfg = {
        params,
        headers: { Accept: "application/json" },
        withCredentials: true,
        timeout: opts?.timeoutMs ?? 300000,
        signal: opts?.signal,
    };
    try {
        console.log("GET", path, params);
        const { data } = await api.get(path, cfg);
        console.log("GOT", path, data);
        return data;
    }
    catch (err) {
        const st = err?.response?.status;
        if (st === 403 || st === 404) {
            const { data } = await axios.get(`http://localhost:8080${path}`, cfg);
            return data;
        }
        throw err;
    }
}
async function postWithFallback(path, body, opts) {
    const cfg = {
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        withCredentials: true,
        timeout: opts?.timeoutMs ?? 360000,
        signal: opts?.signal,
    };
    try {
        const { data } = await api.post(path, body ?? {}, cfg);
        return data;
    }
    catch (err) {
        const st = err?.response?.status;
        if (st === 403 || st === 404) {
            const { data } = await axios.post(`http://localhost:8080${path}`, body ?? {}, cfg);
            return data;
        }
        throw err;
    }
}
/* public APIs (no server paging) */
export async function listArticles(params, opts) {
    return getWithFallback("/articles", params, opts);
}
export async function searchArticles(body, opts) {
    return postWithFallback("/articles/search", body, opts);
}
export async function getArticleDetail(eid, opts) {
    if (!eid)
        throw new Error("eid required");
    return getWithFallback(`/articles/${encodeURIComponent(eid)}`, undefined, opts);
}
export async function getArticleCitations(eid, opts) {
    if (!eid)
        throw new Error("eid required");
    return getWithFallback(`/articles/${encodeURIComponent(eid)}/cites`, undefined, opts);
}
