import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { motion } from "motion/react";
import { Copy } from "lucide-react";
export default function SqlPreview({ sql }) {
    const [copied, setCopied] = useState(false);
    const onCopy = async () => {
        try {
            await navigator.clipboard.writeText(sql);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
        }
        catch {
            // noop
        }
    };
    return (_jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("div", { className: "text-sm text-slate-500", children: "Preview only. Executed on submit." }), _jsxs(motion.button, { whileTap: { scale: 0.95 }, className: "btn btn-ghost", onClick: onCopy, title: "Copy SQL", children: [_jsx(Copy, { className: "h-4 w-4 mr-2" }), copied ? "Copied" : "Copy"] })] }), _jsx("pre", { className: "bg-slate-900 text-slate-100 text-xs rounded-lg p-3 overflow-auto max-h-[60vh]", children: sql })] }));
}
