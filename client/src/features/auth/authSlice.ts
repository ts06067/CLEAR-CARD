import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { loginApi, registerApi } from "../../api/auth";
import type { User } from "../../api/auth";

export interface AuthState {
  user?: User;
  token?: string;
  loading: boolean;
  error?: string;
}

/* ---------- safe localStorage readers ---------- */
function readLocalUser(): User | undefined {
  const raw = localStorage.getItem("cc:user");
  if (!raw || raw === "undefined" || raw === "null" || raw.trim() === "") {
    localStorage.removeItem("cc:user");
    return undefined;
  }
  try {
    return JSON.parse(raw) as User;
  } catch {
    // corrupted value — clean it up
    localStorage.removeItem("cc:user");
    return undefined;
  }
}
function readToken(): string | undefined {
  const raw = localStorage.getItem("cc:token");
  if (!raw || raw === "undefined" || raw === "null" || raw.trim() === "") {
    localStorage.removeItem("cc:token");
    return undefined;
  }
  return raw;
}

/* ---------- initial ---------- */
const initial: AuthState = {
  user: readLocalUser(),
  token: readToken(),
  loading: false
};

/* ---------- thunks ---------- */
export const login = createAsyncThunk(
  "auth/login",
  async ({ email, password }: { email: string; password: string }, { rejectWithValue }) => {
    try {
      return await loginApi(email, password);
    } catch (e: any) {
      return rejectWithValue(e?.response?.data?.message ?? "Login failed");
    }
  }
);

export const register = createAsyncThunk(
  "auth/register",
  async ({ email, password, name }: { email: string; password: string; name?: string }, { rejectWithValue }) => {
    try {
      return await registerApi(email, password, name);
    } catch (e: any) {
      return rejectWithValue(e?.response?.data?.message ?? "Register failed");
    }
  }
);

/* ---------- slice ---------- */
const slice = createSlice({
  name: "auth",
  initialState: initial,
  reducers: {
    logout: (s) => {
      s.user = undefined;
      s.token = undefined;
      localStorage.removeItem("cc:user");
      localStorage.removeItem("cc:token");
    }
  },
  extraReducers: (b) => {
    b.addCase(login.pending, (s) => {
      s.loading = true;
      s.error = undefined;
    });
    b.addCase(login.fulfilled, (s, a) => {
      s.loading = false;
      const user = a.payload?.user as User | undefined;
      const token = a.payload?.token as string | undefined;

      s.user = user;
      s.token = token;

      if (user) localStorage.setItem("cc:user", JSON.stringify(user));
      else localStorage.removeItem("cc:user");

      if (token && token !== "undefined" && token !== "null") localStorage.setItem("cc:token", token);
      else localStorage.removeItem("cc:token");
    });
    b.addCase(login.rejected, (s, a) => {
      s.loading = false;
      s.error = String(a.payload ?? a.error.message);
    });

    b.addCase(register.pending, (s) => {
      s.loading = true;
      s.error = undefined;
    });
    b.addCase(register.fulfilled, (s, a) => {
      s.loading = false;
      const user = a.payload?.user as User | undefined;
      const token = a.payload?.token as string | undefined;

      s.user = user;
      s.token = token;

      if (user) localStorage.setItem("cc:user", JSON.stringify(user));
      else localStorage.removeItem("cc:user");

      if (token && token !== "undefined" && token !== "null") localStorage.setItem("cc:token", token);
      else localStorage.removeItem("cc:token");
    });
    b.addCase(register.rejected, (s, a) => {
      s.loading = false;
      s.error = String(a.payload ?? a.error.message);
    });
  }
});

export const { logout } = slice.actions;
export default slice.reducer;
