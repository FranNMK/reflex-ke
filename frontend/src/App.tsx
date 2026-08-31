import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./AuthContext";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import RetailerPage from "./pages/RetailerPage";
import DispatcherPage from "./pages/DispatcherPage";
import RiderPage from "./pages/RiderPage";
import { ReactNode } from "react";

function RequireAuth({ children, role }: { children: ReactNode; role: string }) {
  const { token, role: userRole } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  if (userRole !== role) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { token, role } = useAuth();

  // Redirect logged-in users away from login page to their dashboard
  const loginRedirect = token
    ? role === "dispatcher"
      ? "/dispatcher"
      : role === "rider"
      ? "/rider"
      : "/retailer"
    : null;

  return (
    <Routes>
      {/* Public home page */}
      <Route path="/" element={<HomePage />} />

      {/* Login — redirect already-authenticated users to their dashboard */}
      <Route
        path="/login"
        element={loginRedirect ? <Navigate to={loginRedirect} replace /> : <LoginPage />}
      />

      <Route
        path="/retailer"
        element={
          <RequireAuth role="retailer_staff">
            <RetailerPage />
          </RequireAuth>
        }
      />
      <Route
        path="/dispatcher"
        element={
          <RequireAuth role="dispatcher">
            <DispatcherPage />
          </RequireAuth>
        }
      />
      <Route
        path="/rider"
        element={
          <RequireAuth role="rider">
            <RiderPage />
          </RequireAuth>
        }
      />
      {/* Anything unknown → home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
