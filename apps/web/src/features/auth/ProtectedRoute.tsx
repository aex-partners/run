import { Outlet, Navigate } from "react-router-dom";
import { trpc } from "../../platform/trpc";
import { apiUrl } from "../../platform/api";
import { AuthContext, type AuthUser } from "./useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useCallback } from "react";

export function ProtectedRoute() {
  const { data: user, isLoading } = trpc.auth.me.useQuery();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const logout = useCallback(async () => {
    await fetch(apiUrl("/api/auth/sign-out"), {
      method: "POST",
      credentials: "include",
    });
    queryClient.clear();
    navigate("/login");
  }, [queryClient, navigate]);

  if (isLoading) {
    return (
      <div
        style={{
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-muted)",
          fontSize: 14,
        }}
      >
        Loading...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const authUser: AuthUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: (user as Record<string, unknown>).role as string ?? "user",
    image: ((user as Record<string, unknown>).image as string | null) ?? null,
  };

  return (
    <AuthContext.Provider value={{ user: authUser, logout }}>
      <Outlet />
    </AuthContext.Provider>
  );
}
