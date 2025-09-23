import { api } from "./client";
export async function loginApi(email, password) {
    // Server expects { username, password }
    const payload = { username: email, password };
    const { data } = await api.post("/auth/login", payload, { headers: { "Content-Type": "application/json", Accept: "application/json" } });
    return data;
}
export async function registerApi(email, password, name) {
    // Server expects { username, password, name }
    const payload = { username: email, password, name };
    try {
        const { data } = await api.post("/auth/register", payload, { headers: { "Content-Type": "application/json", Accept: "application/json" } });
        return data;
    }
    catch (err) {
        // Some Spring controllers accept form-encoded params instead of JSON.
        // If JSON fails (e.g., 400/403/415 due to mapping), retry as x-www-form-urlencoded.
        const status = err?.response?.status;
        if (status === 400 || status === 403 || status === 415) {
            const form = new URLSearchParams();
            form.set("username", email);
            form.set("password", password);
            if (name)
                form.set("name", name);
            const { data } = await api.post("/auth/register", form, { headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" } });
            return data;
        }
        throw err;
    }
}
