import React from "react";
import { Navigate, createBrowserRouter, RouterProvider } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Login } from "./pages/Login";
import { Projects } from "./pages/Projects";
import { ProjectScaffold } from "./pages/ProjectScaffold";
import { ProjectDetail } from "./pages/ProjectDetail";
import { ExperimentDetail } from "./pages/ExperimentDetail";
import { ExperimentDesign } from "./pages/ExperimentDesign";
import { WorkflowConfigPage } from "./pages/WorkflowConfig";
import { Inventory } from "./pages/Inventory";
import { Users } from "./pages/Users";
import { Roles } from "./pages/Roles";
import { Profile } from "./pages/Profile";
import { api } from "./lib/api";
import { Dashboard } from "./pages/Dashboard";
import type { Project } from "./types";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuth = localStorage.getItem("auth") === "true";
  if (!isAuth) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

const router = createBrowserRouter([
  {
    path: "/login",
    element: <Login />,
  },
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <Layout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/projects" replace /> },
      {
        path: "dashboard",
        element: <Dashboard />,
        handle: { breadcrumb: "dashboard" },
      },
      {
        path: "projects",
        handle: { breadcrumb: "projects" },
        children: [
          { index: true, element: <Projects /> },
          {
            id: "project",
            path: ":projectId",
            element: <ProjectScaffold />,
            loader: async ({ params }) => {
              try {
                return await api.get<Project>(`/api/v1/projects/${params.projectId}`);
              } catch {
                return null;
              }
            },
            handle: {
              breadcrumb: (match: any) => match.data?.name ?? match.params.projectId,
            },
            children: [
              { index: true, element: <ProjectDetail /> },
              {
                path: "design",
                element: <ExperimentDesign />,
                handle: { breadcrumb: "experiment_design" },
              },
              {
                path: "procurement",
                element: <Navigate to="../design" replace />,
              },
              {
                path: "experiments/:experimentId",
                element: <ExperimentDetail />,
                loader: async ({ params }) => {
                  try {
                    return await api.get<any>(`/api/v1/experiments/${params.experimentId}`);
                  } catch {
                    return null;
                  }
                },
                handle: {
                  breadcrumb: (match: any) => match.data?.title ?? match.params.experimentId,
                },
              },
            ],
          },
        ],
      },
      {
        path: "inventory",
        element: <Inventory />,
        handle: { breadcrumb: "inventory" },
      },
      {
        path: "users",
        element: <Users />,
        handle: { breadcrumb: "user_management" },
      },
      {
        path: "roles",
        element: <Roles />,
        handle: { breadcrumb: "role_management" },
      },
      {
        path: "workflow-config",
        element: <WorkflowConfigPage />,
        handle: { breadcrumb: "workflow_config" },
      },
      {
        path: "profile",
        element: <Profile />,
        handle: { breadcrumb: "my_profile" },
      },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
