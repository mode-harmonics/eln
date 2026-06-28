import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Login } from "./pages/Login";
import { Projects } from "./pages/Projects";
import { ProjectDetail } from "./pages/ProjectDetail";
import { ExperimentDetail } from "./pages/ExperimentDetail";
import { Inventory } from "./pages/Inventory";
import { Users } from "./pages/Users";
import { Roles } from "./pages/Roles";
import { Profile } from "./pages/Profile";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuth = localStorage.getItem("auth") === "true";
  if (!isAuth) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        {/* Protected Routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/projects" replace />} />
          <Route path="projects" element={<Projects />} />
          <Route path="projects/:projectId" element={<ProjectDetail />} />
          <Route path="experiments/:experimentId" element={<ExperimentDetail />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="users" element={<Users />} />
          <Route path="roles" element={<Roles />} />
          <Route path="profile" element={<Profile />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
