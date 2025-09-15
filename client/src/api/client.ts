import axios from "axios";

// Dev uses Vite proxy: /api/* → http://localhost:8080/*
export const api = axios.create({
  baseURL: "/api",
  timeout: 60_000
});
