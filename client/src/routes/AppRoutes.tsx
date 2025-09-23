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
  return (
    <HttpLoadingProvider>
      <ArticleCacheProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage/>}/>
            <Route path="/register" element={<RegisterPage/>}/>
            <Route element={<AuthGuard><DashboardLayout/></AuthGuard>}>
              <Route path="/" element={<Navigate to="/dashboard" replace/>}/>
              <Route path="/dashboard" element={<DashboardPage/>}/>
              <Route path="/jobs" element={<JobsListPage/>}/>
              <Route path="/jobs/create" element={<CreateJobPage/>}/>
              <Route path="/jobs/:id" element={<JobDetailPage/>}/>
              <Route path="/articles" element={<ArticleExplorer />} />
              <Route path="/articles/:eid" element={<ArticleDetail />} />
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" replace/>}/>
          </Routes>
        </BrowserRouter>
      </ArticleCacheProvider>
    </HttpLoadingProvider>
  );
}
