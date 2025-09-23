import { api } from "./client";

export interface User {
  id: string;
  email?: string; // optional if server uses username only
  name?: string;
  username?: string;
}

export async function loginApi(email: string, password: string) {
  // Server expects { username, password }
  const payload = { username: email, password };
  const { data } = await api.post<{ token: string; user: User }>(
    "/auth/login",
    payload,
    { headers: { "Content-Type": "application/json", Accept: "application/json" } }
  );
  return data;
}

export async function registerApi(email: string, password: string, name?: string) {
  // Server expects { username, password, name }
  const payload = { username: email, password, name };

  try {
    const { data } = await api.post<{ token: string; user: User }>(
      "/auth/register",
      payload,
      { headers: { "Content-Type": "application/json", Accept: "application/json" } }
    );
    return data;
  } catch (err: any) {
    // Some Spring controllers accept form-encoded params instead of JSON.
    // If JSON fails (e.g., 400/403/415 due to mapping), retry as x-www-form-urlencoded.
    const status = err?.response?.status;
    if (status === 400 || status === 403 || status === 415) {
      const form = new URLSearchParams();
      form.set("username", email);
      form.set("password", password);
      if (name) form.set("name", name);
      const { data } = await api.post<{ token: string; user: User }>(
        "/auth/register",
        form,
        { headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" } }
      );
      return data;
    }
    throw err;
  }
}
