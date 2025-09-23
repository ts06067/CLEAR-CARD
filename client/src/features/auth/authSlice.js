import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { loginApi, registerApi } from "../../api/auth";
/* ---------- safe localStorage readers ---------- */
function readLocalUser() {
    const raw = localStorage.getItem("cc:user");
    if (!raw || raw === "undefined" || raw === "null" || raw.trim() === "") {
        localStorage.removeItem("cc:user");
        return undefined;
    }
    try {
        return JSON.parse(raw);
    }
    catch {
        // corrupted value — clean it up
        localStorage.removeItem("cc:user");
        return undefined;
    }
}
function readToken() {
    const raw = localStorage.getItem("cc:token");
    if (!raw || raw === "undefined" || raw === "null" || raw.trim() === "") {
        localStorage.removeItem("cc:token");
        return undefined;
    }
    return raw;
}
/* ---------- initial ---------- */
const initial = {
    user: readLocalUser(),
    token: readToken(),
    loading: false
};
/* ---------- thunks ---------- */
export const login = createAsyncThunk("auth/login", async ({ email, password }, { rejectWithValue }) => {
    try {
        return await loginApi(email, password);
    }
    catch (e) {
        return rejectWithValue(e?.response?.data?.message ?? "Login failed");
    }
});
export const register = createAsyncThunk("auth/register", async ({ email, password, name }, { rejectWithValue }) => {
    try {
        return await registerApi(email, password, name);
    }
    catch (e) {
        return rejectWithValue(e?.response?.data?.message ?? "Register failed");
    }
});
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
            const user = a.payload?.user;
            const token = a.payload?.token;
            s.user = user;
            s.token = token;
            if (user)
                localStorage.setItem("cc:user", JSON.stringify(user));
            else
                localStorage.removeItem("cc:user");
            if (token && token !== "undefined" && token !== "null")
                localStorage.setItem("cc:token", token);
            else
                localStorage.removeItem("cc:token");
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
            const user = a.payload?.user;
            const token = a.payload?.token;
            s.user = user;
            s.token = token;
            if (user)
                localStorage.setItem("cc:user", JSON.stringify(user));
            else
                localStorage.removeItem("cc:user");
            if (token && token !== "undefined" && token !== "null")
                localStorage.setItem("cc:token", token);
            else
                localStorage.removeItem("cc:token");
        });
        b.addCase(register.rejected, (s, a) => {
            s.loading = false;
            s.error = String(a.payload ?? a.error.message);
        });
    }
});
export const { logout } = slice.actions;
export default slice.reducer;
