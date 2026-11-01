import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { getToken } from "../lib/api";

export default function RequireAdmin({ children }: { children: ReactNode }) {
  return getToken() ? <>{children}</> : <Navigate to="/admin/login" replace />;
}