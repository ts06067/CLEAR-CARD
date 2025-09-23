import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { createContext, useContext, useEffect, useState } from "react";
import LoadingOverlay from "./LoadingOverlay";
import api from "../api/api";
const Ctx = createContext({ active: 0 });
export const useHttpLoading = () => useContext(Ctx);
export default function HttpLoadingProvider({ children }) {
    const [active, setActive] = useState(0);
    useEffect(() => {
        const onStart = () => setActive(x => x + 1);
        const onEnd = () => setActive(x => Math.max(0, x - 1));
        const req = api.interceptors.request.use((cfg) => { onStart(); return cfg; }, (e) => { onEnd(); return Promise.reject(e); });
        const res = api.interceptors.response.use((r) => { onEnd(); return r; }, (e) => { onEnd(); return Promise.reject(e); });
        return () => {
            api.interceptors.request.eject(req);
            api.interceptors.response.eject(res);
        };
    }, []);
    return (_jsxs(Ctx.Provider, { value: { active }, children: [children, _jsx(LoadingOverlay, { open: active > 0 })] }));
}
