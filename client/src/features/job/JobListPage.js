import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "motion/react";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { fetchJobs, pollStatuses, togglePinnedLocal } from "./jobsSlice";
import { getResultCsvUrl } from "../../api/jobs";
import PinToggle from "../../components/PinToggle";
import { FileDown, ExternalLink } from "lucide-react";
import LoadingOverlay from "../../components/LoadingOverlay";
function StatusBadge({ s }) {
    const color = s === "SUCCEEDED"
        ? "bg-green-100 text-green-800"
        : s === "FAILED"
            ? "bg-red-100 text-red-700"
            : s === "RUNNING"
                ? "bg-blue-100 text-blue-700"
                : "bg-slate-100 text-slate-700";
    return _jsx("span", { className: `px-2 py-0.5 rounded text-xs ${color}`, children: s });
}
export default function JobsListPage() {
    const dispatch = useAppDispatch();
    const { items, loading } = useAppSelector((s) => s.jobs);
    const user = useAppSelector((s) => s.auth.user);
    const nav = useNavigate();
    // Track expanded Debug JSON per-card
    const [openDebug, setOpenDebug] = useState({});
    const toggleDebug = (id) => setOpenDebug((s) => ({ ...s, [id]: !s[id] }));
    useEffect(() => {
        dispatch(fetchJobs());
        const id = setInterval(() => dispatch(pollStatuses()), 2500);
        return () => clearInterval(id);
    }, [dispatch]);
    return (_jsxs("div", { className: "p-4 pt-16 space-y-4 overflow-x-hidden", children: [_jsx(LoadingOverlay, { open: loading, text: "Loading jobs..." }), _jsxs("div", { className: "flex items-center", children: [_jsx("h1", { className: "text-3xl font-extrabold tracking-tight", children: "Your Jobs" }), _jsx("div", { className: "ml-auto", children: _jsx(Link, { className: "btn btn-primary", to: "/jobs/create", children: "+ Create" }) })] }), _jsx("div", { className: "columns-1 md:columns-2 xl:columns-3 gap-4", children: items.map((j) => {
                    const isOpen = !!openDebug[j.id];
                    return (_jsx(motion.div, { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, className: "break-inside-avoid mb-4", children: _jsxs("div", { className: "card relative", children: [_jsx("div", { className: "absolute top-2 right-2", children: _jsx(PinToggle, { pinned: !!j.pinned, onToggle: () => dispatch(togglePinnedLocal({ id: j.id, userId: user?.id ?? "anon" })) }) }), _jsxs("div", { className: "card-h", children: [_jsx("div", { className: "font-semibold truncate text-base", children: j.title || `Job ${j.id}` }), _jsxs("div", { className: "text-xs text-slate-500 truncate", children: ["#", j.id] }), _jsx("div", { className: "mt-1", children: _jsx(StatusBadge, { s: j.status }) })] }), _jsxs("div", { className: "card-b space-y-3", children: [_jsxs("div", { className: "text-xs text-slate-600", children: [_jsxs("div", { children: [_jsx("span", { className: "font-medium", children: "Submitted:" }), " ", new Date(j.createdAt).toLocaleString()] }), _jsxs("div", { children: [_jsx("span", { className: "font-medium", children: "Completed:" }), " ", j.completedAt
                                                            ? new Date(j.completedAt).toLocaleString()
                                                            : "-"] })] }), (j.tableConfig || j.chartConfig) && (_jsxs("div", { className: "text-xs", children: [_jsx("button", { className: "text-slate-500 hover:text-slate-700 underline", onClick: () => toggleDebug(j.id), children: isOpen ? "▲ Debug JSON" : "▼ Debug JSON" }), isOpen && (_jsxs("div", { className: "mt-2 space-y-2", children: [j.tableConfig && (_jsxs(_Fragment, { children: [_jsx("div", { className: "font-medium text-slate-600", children: "table_config" }), _jsx("pre", { className: "bg-slate-50 p-2 rounded overflow-auto max-h-48", children: JSON.stringify(j.tableConfig, null, 2) })] })), j.chartConfig && (_jsxs(_Fragment, { children: [_jsx("div", { className: "font-medium text-slate-600", children: "chart_config" }), _jsx("pre", { className: "bg-slate-50 p-2 rounded overflow-auto max-h-48", children: JSON.stringify(j.chartConfig, null, 2) })] }))] }))] })), _jsxs("div", { className: "flex gap-2", children: [_jsxs("button", { className: "btn btn-ghost", onClick: () => nav(`/jobs/${j.id}`), children: [_jsx(ExternalLink, { className: "h-4 w-4 mr-2" }), " Details"] }), j.status === "SUCCEEDED" && (_jsxs("a", { className: "btn btn-ghost", href: getResultCsvUrl(j.id), children: [_jsx(FileDown, { className: "h-4 w-4 mr-2" }), " CSV"] }))] })] })] }) }, j.id));
                }) })] }));
}
