import React from "react";
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
} from "react-router-dom";
import { Layout } from "./components/Layout";
import { Login } from "./pages/Login";
import { Projects } from "./pages/Projects";
import { ProjectScaffold } from "./pages/ProjectScaffold";
import { ProjectDetail } from "./pages/ProjectDetail";
import { ExperimentDetail } from "./pages/ExperimentDetail";
import { Groups } from "./pages/Groups";
import { Inventory } from "./pages/Inventory";
import { Users } from "./pages/Users";
import { Roles } from "./pages/Roles";
import { Profile } from "./pages/Profile";
import { api } from "./lib/api";
import type { Project, Experiment } from "./types";

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
        path: "projects",
        element: <Projects />,
        handle: { breadcrumb: "projects" },
      },
      {
        id: "project",
        path: "projects/:projectId",
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
            path: "groups",
            element: <Groups />,
            loader: async ({ params }) => {
              try {
                const project = await api.get<{ name: string }>(`/api/v1/projects/${params.projectId}`);
                return { projectName: project.name };
              } catch {
                return { projectName: params.projectId };
              }
            },
            handle: {
              breadcrumb: "group_management",
            },
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
