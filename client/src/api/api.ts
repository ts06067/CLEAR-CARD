import axios from "axios";

// Point all API calls at the dev proxy path
const api = axios.create({
  baseURL: "/api",
  withCredentials: true  // allow cookies (for XSRF-TOKEN)
});

// Make axios use Spring’s default cookie/header names
api.defaults.xsrfCookieName = "XSRF-TOKEN";
api.defaults.xsrfHeaderName = "X-XSRF-TOKEN";

export async function ensureCsrfCookie() {
  // This will set the XSRF-TOKEN cookie via proxy (origin stays 5173)
  await api.get("/csrf");
}

export default api;
