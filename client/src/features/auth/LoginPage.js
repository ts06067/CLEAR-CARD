import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { login } from "./authSlice";
export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPw] = useState("");
    const { loading, error } = useAppSelector(s => s.auth);
    const dispatch = useAppDispatch();
    const nav = useNavigate();
    const submit = async (e) => {
        e.preventDefault();
        const r = await dispatch(login({ email, password }));
        if (r.meta.requestStatus === "fulfilled")
            nav("/dashboard");
    };
    return (_jsx("div", { className: "min-h-screen grid place-items-center bg-gradient-to-br from-slate-50 to-slate-200", children: _jsxs(motion.div, { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, className: "card w-full max-w-md", children: [_jsx("div", { className: "card-h text-2xl", children: "Sign in" }), _jsxs("div", { className: "card-b space-y-4", children: [error && _jsx("div", { className: "text-red-600 text-sm", children: error }), _jsxs("form", { className: "space-y-3", onSubmit: submit, children: [_jsxs("div", { children: [_jsx("label", { className: "text-sm", children: "Email" }), _jsx("input", { className: "input w-full mt-1", type: "email", value: email, onChange: e => setEmail(e.target.value), required: true })] }), _jsxs("div", { children: [_jsx("label", { className: "text-sm", children: "Password" }), _jsx("input", { className: "input w-full mt-1", type: "password", value: password, onChange: e => setPw(e.target.value), required: true })] }), _jsx("button", { className: "btn btn-primary w-full", disabled: loading, children: loading ? "Signing in…" : "Sign in" })] }), _jsxs("div", { className: "text-sm text-slate-600", children: ["New here? ", _jsx(Link, { className: "underline", to: "/register", children: "Create an account" })] })] })] }) }));
}
