import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import DashboardLayout from "../layouts/DashboardLayout";
import DashboardPage from "../features/dashboard/DashboardPage";
import CreateJobPage from "../features/job/CreateJobPage";
import JobsListPage from "../features/job/JobListPage";
import JobDetailPage from "../features/job/JobDetailPage";
import ArticleExplorer from "../pages/ArticleExplorer";
import ArticleDetail from "../pages/ArticleDetail";
import LoginPage from "../features/auth/LoginPage";
import RegisterPage from "../features/auth/RegisterPage";
import AuthGuard from "../features/auth/AuthGuard";
import ArticleCacheProvider from "../context/ArticleCacheProvider";
import HttpLoadingProvider from "../components/HttpLoadingProvider";
export default function AppRoutes() {
    return (_jsx(HttpLoadingProvider, { children: _jsx(ArticleCacheProvider, { children: _jsx(BrowserRouter, { children: _jsxs(Routes, { children: [_jsx(Route, { path: "/login", element: _jsx(LoginPage, {}) }), _jsx(Route, { path: "/register", element: _jsx(RegisterPage, {}) }), _jsxs(Route, { element: _jsx(AuthGuard, { children: _jsx(DashboardLayout, {}) }), children: [_jsx(Route, { path: "/", element: _jsx(Navigate, { to: "/dashboard", replace: true }) }), _jsx(Route, { path: "/dashboard", element: _jsx(DashboardPage, {}) }), _jsx(Route, { path: "/jobs", element: _jsx(JobsListPage, {}) }), _jsx(Route, { path: "/jobs/create", element: _jsx(CreateJobPage, {}) }), _jsx(Route, { path: "/jobs/:id", element: _jsx(JobDetailPage, {}) }), _jsx(Route, { path: "/articles", element: _jsx(ArticleExplorer, {}) }), _jsx(Route, { path: "/articles/:eid", element: _jsx(ArticleDetail, {}) })] }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: "/dashboard", replace: true }) })] }) }) }) }));
}
