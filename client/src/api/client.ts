import axios from "axios";

// read a cookie by name (safe for TS)
function getCookie(name: string): string | undefined {
  const m = document.cookie.match(
    new RegExp("(?:^|; )" + name.replace(/[-[\]{}()*+?.,\\^$|#\\s]/g, "\\$&") + "=([^;]*)")
  );
  const v = m?.[1];
  return typeof v === "string" ? decodeURIComponent(v) : undefined;
}

export const api = axios.create({
  baseURL: "/api",
  timeout: 60_000,
  withCredentials: true,
  xsrfCookieName: "XSRF-TOKEN",
  xsrfHeaderName: "X-XSRF-TOKEN",
});

api.interceptors.request.use((cfg) => {
  // Attach JWT if present
  const token = localStorage.getItem("cc:token");
  if (token && token !== "undefined" && token !== "null" && token.trim() !== "") {
    cfg.headers = cfg.headers ?? {};
    (cfg.headers as any).Authorization = `Bearer ${token}`;
  }

  // Attach CSRF tokens if a cookie exists (covers various Spring names)
  const method = (cfg.method ?? "get").toUpperCase();
  if (!["GET", "HEAD", "OPTIONS", "TRACE"].includes(method)) {
    const xsrf =
      getCookie("XSRF-TOKEN") || getCookie("XSRF_TOKEN") || getCookie("CSRF-TOKEN") || getCookie("CSRF_TOKEN");
    if (xsrf) {
      cfg.headers = cfg.headers ?? {};
      const h = cfg.headers as any;
      if (!h["X-XSRF-TOKEN"]) h["X-XSRF-TOKEN"] = xsrf;
      if (!h["X-CSRF-TOKEN"]) h["X-CSRF-TOKEN"] = xsrf;
    }
  }

  return cfg;
});
