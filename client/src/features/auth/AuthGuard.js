import { jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import { Navigate, useLocation } from "react-router-dom";
import { useAppSelector } from "../../app/hooks";
export default function AuthGuard({ children }) {
    const { token } = useAppSelector(s => s.auth);
    const loc = useLocation();
    if (!token)
        return _jsx(Navigate, { to: "/login", replace: true, state: { from: loc.pathname } });
    return _jsx(_Fragment, { children: children });
}
