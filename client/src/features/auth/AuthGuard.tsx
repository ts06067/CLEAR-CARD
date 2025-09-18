import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAppSelector } from "../../app/hooks";

export default function AuthGuard({ children }: { children: ReactNode }) {
  const { token } = useAppSelector(s => s.auth);
  const loc = useLocation();
  if (!token) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  return <>{children}</>;
}
