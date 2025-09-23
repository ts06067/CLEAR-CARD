import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useAppSelector, useAppDispatch } from "../app/hooks";
import { LogOut, BarChart3 } from "lucide-react";
import { logout } from "../features/auth/authSlice";
/**
 * Compact top-left overlay bar:
 * - white blur + shadow
 * - readable height, small margins
 * - Left: logo trigger (hovering here opens the sidebar overlay)
 * - Middle: greeting
 * - Right: small Logout button
 */
export default function Topbar() {
    const user = useAppSelector((s) => s.auth.user);
    const dispatch = useAppDispatch();
    return (_jsxs("header", { className: "fixed top-3 left-3 z-[190] px-3 py-2 border rounded-2xl\r\n                 bg-white/85 backdrop-blur shadow-md flex items-center gap-3", style: { minWidth: 360, maxWidth: "60vw" }, children: [_jsxs("button", { id: "sidebar-hover-anchor", className: "inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border bg-white/80 hover:bg-white shadow-sm", title: "Menu", children: [_jsx(BarChart3, { className: "text-brand h-4 w-4" }), _jsx("span", { className: "text-sm font-extrabold tracking-tight", children: "CLEAR-CARD" })] }), _jsx("div", { className: "text-sm text-slate-700 truncate", children: user?.name ? `Welcome, ${user.name}` : "v0.1.0-alpha" }), _jsx("div", { className: "ml-auto", children: _jsxs("button", { className: "inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border hover:bg-gray-50", onClick: () => dispatch(logout()), title: "Log out", children: [_jsx(LogOut, { className: "h-3.5 w-3.5" }), "Logout"] }) })] }));
}
