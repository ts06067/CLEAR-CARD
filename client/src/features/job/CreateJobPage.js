import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { createJob, reset } from "./jobRunSlice";
import ConditionBuilder from "../builder/ConditionBuilder";
import ChartConfigPanel from "../config/ChartConfigPanel";
import { buildSql } from "../../utils/buildSql";
import SqlPreview from "../../components/SqlPreview";
import LoadingOverlay from "../../components/LoadingOverlay";
export default function CreateJobPage() {
    const [title, setTitle] = useState("");
    const [qb, setQb] = useState({ combinator: "and", rules: [] });
    const [cfg, setCfg] = useState({
        x: "cited_pub_year",
        groupBy: ["cited_journal"],
        orderDir: "ASC",
        yField: "n_article",
        yAgg: "COUNT",
        fitnessBinSize: 10.0,
        citationCountBinSize: 1.0
    });
    const sql = useMemo(() => buildSql(qb, cfg), [qb, cfg]);
    const { submitting, error } = useAppSelector(s => s.jobRun);
    const dispatch = useAppDispatch();
    const nav = useNavigate();
    return (_jsxs("div", { className: "p-4 pt-16 space-y-4 overflow-x-hidden", children: [_jsx(LoadingOverlay, { open: submitting, text: "Submitting job\u2026" }), _jsx("h1", { className: "text-3xl font-extrabold tracking-tight", children: "Create Job" }), _jsxs("div", { className: "grid grid-cols-12 gap-4", children: [_jsxs("div", { className: "col-span-12 lg:col-span-5 space-y-4", children: [_jsxs("div", { className: "card", children: [_jsx("div", { className: "card-h", children: "Job Title" }), _jsx("div", { className: "card-b", children: _jsx("input", { className: "input w-full", placeholder: "Optional title\u2026", value: title, onChange: (e) => setTitle(e.target.value) }) })] }), _jsx(ConditionBuilder, { query: qb, onChange: setQb }), _jsx(ChartConfigPanel, { cfg: cfg, onChange: setCfg })] }), _jsx("div", { className: "col-span-12 lg:col-span-7 space-y-4", children: _jsxs("div", { className: "card", children: [_jsx("div", { className: "card-h", children: "SQL Preview" }), _jsx("div", { className: "card-b", children: _jsx(SqlPreview, { sql: sql }) }), _jsxs("div", { className: "px-4 pb-4 flex gap-2", children: [_jsx("button", { className: "btn btn-primary", disabled: submitting, onClick: async () => {
                                                const r = await dispatch(createJob({ sql, title, config: { qb, cfg } }));
                                                if (r.meta.requestStatus === "fulfilled") {
                                                    dispatch(reset());
                                                    nav("/jobs");
                                                }
                                            }, children: submitting ? "Submitting…" : "Submit & Go to Job Lists" }), _jsx("button", { className: "btn btn-ghost", onClick: () => dispatch(reset()), children: "Reset" })] }), error && _jsxs("div", { className: "px-4 pb-4 text-red-600 text-sm", children: ["Error: ", error] })] }) })] })] }));
}
