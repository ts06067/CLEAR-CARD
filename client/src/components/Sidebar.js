import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
/**
 * Hover sidebar overlay:
 * - Opens when hovering the Topbar logo (element id="sidebar-hover-anchor")
 * - Closes as soon as cursor leaves BOTH the topbar trigger and the sidebar
 * - Small size with fade + subtle scale animation
 */
export default function Sidebar({ brand, items, footer, }) {
    const [open, setOpen] = useState(false);
    const insideRef = useRef(false);
    // Tie to topbar logo trigger
    useEffect(() => {
        const anchor = document.getElementById("sidebar-hover-anchor");
        if (!anchor)
            return;
        const enter = () => setOpen(true);
        let leaveTimer;
        const leave = () => {
            window.clearTimeout(leaveTimer);
            leaveTimer = window.setTimeout(() => {
                if (!insideRef.current)
                    setOpen(false);
            }, 120);
        };
        anchor.addEventListener("mouseenter", enter);
        anchor.addEventListener("mouseleave", leave);
        return () => {
            anchor.removeEventListener("mouseenter", enter);
            anchor.removeEventListener("mouseleave", leave);
            window.clearTimeout(leaveTimer);
        };
    }, []);
    // Escape closes
    useEffect(() => {
        const onKey = (e) => e.key === "Escape" && setOpen(false);
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, []);
    // Helper to decide "exact" NavLink behavior
    const isExact = (to) => to === "/dashboard" || to === "/jobs";
    return (_jsx(AnimatePresence, { children: open && (_jsx(motion.div, { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, className: "fixed inset-0 z-[180] bg-black/20 backdrop-blur-[2px]", onMouseLeave: () => { if (!insideRef.current)
                setOpen(false); }, onClick: () => setOpen(false), children: _jsxs(motion.aside, { initial: { opacity: 0, scale: 0.98, y: 8 }, animate: { opacity: 1, scale: 1, y: 0 }, exit: { opacity: 0, scale: 0.98, y: 8 }, transition: { duration: 0.18, ease: "easeInOut" }, className: "absolute left-6 top-16 w-[220px] max-h-[85vh] bg-white border shadow-2xl rounded-2xl overflow-hidden", onMouseEnter: () => { insideRef.current = true; }, onMouseLeave: () => { insideRef.current = false; setOpen(false); }, onClick: (e) => e.stopPropagation(), children: [_jsx("div", { className: "px-3 py-2 border-b text-sm font-semibold", children: brand }), _jsx("nav", { className: "p-2 space-y-1 overflow-auto", children: items.map((it) => (_jsxs(NavLink, { to: it.to, end: isExact(it.to), onClick: () => setOpen(false), className: ({ isActive }) => `flex items-center gap-2 px-3 py-2 rounded-md text-sm transition ${isActive ? "bg-brand text-white shadow-smooth" : "hover:bg-slate-100"}`, children: [_jsx(it.icon, { className: "h-4 w-4" }), _jsx("span", { children: it.label })] }, it.to))) }), footer && (_jsx("div", { className: "px-3 py-2 border-t text-xs text-slate-600", children: footer }))] }) }, "sb-overlay")) }));
}
