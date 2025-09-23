import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
export default function FullscreenModal({ open, title, onClose, children }) {
    // Lock page scroll while modal is open
    useEffect(() => {
        if (!open)
            return;
        const onKey = (e) => e.key === "Escape" && onClose();
        document.addEventListener("keydown", onKey);
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.removeEventListener("keydown", onKey);
            document.body.style.overflow = prev;
        };
    }, [open, onClose]);
    return (_jsx(AnimatePresence, { children: open && (_jsxs("div", { className: "fixed inset-0 z-[1000]", children: [_jsx(motion.div, { className: "fixed inset-0 bg-black", initial: { opacity: 0 }, animate: { opacity: 0.45 }, exit: { opacity: 0 }, transition: { duration: 0.22, ease: "easeOut" }, onClick: onClose }, "shade"), _jsx(motion.div, { className: "fixed inset-0 backdrop-blur-md", style: { WebkitBackdropFilter: "blur(12px)" }, initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.22, ease: "easeOut" }, onClick: onClose }, "blur"), _jsx(motion.div, { role: "dialog", "aria-modal": "true", "aria-label": title, className: "fixed inset-0 flex items-center justify-center", initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, children: _jsxs(motion.div, { onClick: (e) => e.stopPropagation(), className: "relative max-w-[95vw] max-h-[90vh] w-[1200px] bg-white rounded-2xl shadow-2xl overflow-hidden", initial: { opacity: 0, scale: 0.985, y: 8 }, animate: { opacity: 1, scale: 1, y: 0 }, exit: { opacity: 0, scale: 0.985, y: 8 }, transition: { duration: 0.22, ease: "easeOut" }, children: [_jsxs("div", { className: "flex items-center justify-between px-4 py-3 border-b", children: [_jsx("div", { className: "font-medium", children: title }), _jsx("button", { onClick: onClose, className: "px-3 py-1.5 rounded-lg border hover:bg-gray-50", "aria-label": "Close", children: "\u2715" })] }), _jsx("div", { className: "p-4 overflow-auto", children: children })] }) })] })) }));
}
