import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  LayoutDashboard,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  MessageSquare,
  Bell,
  History,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  Legend,
} from "recharts";
import { format } from "date-fns";
import { api } from "../lib/api";
import { API_ROUTES } from "@eln/shared";
import { PageLoader } from "../components/PageLoader";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/Card";
import { TableWrapper, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../components/Table";
import { PageHeader } from "../components/PageHeader";

interface DashboardSummary {
  projectStatusDistribution: { status: string; count: number }[];
  experimentStatusDistribution: { status: string; count: number }[];
  pendingApprovals: {
    id: string;
    title: string;
    status: string;
    updatedAt: string;
    projectId: string;
    projectName: string;
  }[];
  recentActivities: {
    id: string;
    type: "version" | "comment" | "notification";
    action: string;
    user?: string;
    timestamp: string;
    experimentId?: string;
    projectId?: string;
    experimentTitle?: string;
    content?: string;
    payload?: any;
  }[];
}

const COLORS = ["#1d74f5", "#f27429", "#10b981", "#ef4444", "#8b5cf6", "#f59e0b"];

export function Dashboard() {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get<DashboardSummary>(API_ROUTES.dashboard.summary)
      .then((res) => {
        if (!cancelled) setSummary(res);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Failed to load dashboard data");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <PageLoader className="h-64" />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-red-500">
        <AlertCircle className="w-12 h-12 mb-4" />
        <p>{error}</p>
      </div>
    );
  }

  if (!summary) return null;

  const totalProjects = summary.projectStatusDistribution.reduce((acc, curr) => acc + curr.count, 0);
  const totalExperiments = summary.experimentStatusDistribution.reduce((acc, curr) => acc + curr.count, 0);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "version":
        return <History className="w-4 h-4 text-blue-500" />;
      case "comment":
        return <MessageSquare className="w-4 h-4 text-green-500" />;
      case "notification":
        return <Bell className="w-4 h-4 text-orange-500" />;
      default:
        return <FileText className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("dashboard", "Dashboard")} icon={<LayoutDashboard className="h-5 w-5" />} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="flex flex-col items-center justify-center p-6 text-center">
          <CardDescription className="font-medium mb-1 mt-0">{t("total_projects", "Total Projects")}</CardDescription>
          <div className="text-2xl font-bold text-gray-900">{totalProjects}</div>
        </Card>
        <Card className="flex flex-col items-center justify-center p-6 text-center">
          <CardDescription className="font-medium mb-1 mt-0">{t("total_experiments", "Total Experiments")}</CardDescription>
          <div className="text-2xl font-bold text-gray-900">{totalExperiments}</div>
        </Card>
        <Card className="flex flex-col items-center justify-center p-6 text-center">
          <CardDescription className="font-medium mb-1 mt-0">{t("pending_approvals", "Pending Approvals")}</CardDescription>
          <div className="text-2xl font-bold text-action">{summary.pendingApprovals.length}</div>
        </Card>
        <Card className="flex flex-col items-center justify-center p-6 text-center">
          <CardDescription className="font-medium mb-1 mt-0">{t("recent_activities", "Recent Activities")}</CardDescription>
          <div className="text-2xl font-bold text-[#10b981]">{summary.recentActivities.length}</div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Charts */}
        <Card>
          <CardHeader className="pb-0 mb-4">
            <CardTitle>{t("project_status", "Project Status")}</CardTitle>
          </CardHeader>
          <CardContent className="h-64 pt-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={summary.projectStatusDistribution}
                  dataKey="count"
                  nameKey="status"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                >
                  {summary.projectStatusDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-0 mb-4">
            <CardTitle>{t("experiment_status", "Experiment Status")}</CardTitle>
          </CardHeader>
          <CardContent className="h-64 pt-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={summary.experimentStatusDistribution}
                  dataKey="count"
                  nameKey="status"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                >
                  {summary.experimentStatusDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Pending Approvals */}
        <Card className="col-span-1 lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-action" />
              {t("my_pending_approvals", "Pending My Approval")}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {summary.pendingApprovals.length === 0 ? (
              <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                <CheckCircle2 className="w-12 h-12 mx-auto text-green-400 mb-2" />
                <p>{t("no_pending_approvals", "You have no pending approvals. Great job!")}</p>
              </div>
            ) : (
              <TableWrapper>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("project", "Project")}</TableHead>
                      <TableHead>{t("experiment", "Experiment")}</TableHead>
                      <TableHead>{t("submitted_at", "Submitted At")}</TableHead>
                      <TableHead className="text-right">{t("action", "Action")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.pendingApprovals.map((exp) => (
                      <TableRow key={exp.id}>
                        <TableCell className="font-medium text-gray-900">{exp.projectName}</TableCell>
                        <TableCell>{exp.title}</TableCell>
                        <TableCell className="text-gray-500">{format(new Date(exp.updatedAt), "yyyy-MM-dd HH:mm")}</TableCell>
                        <TableCell className="text-right">
                          <Link
                            to={`/projects/${exp.projectId}/experiments/${exp.id}`}
                            className="font-medium text-action-muted hover:underline"
                          >
                            {t("review", "Review")}
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableWrapper>
            )}
          </CardContent>
        </Card>

        {/* Recent Activities */}
        <Card className="col-span-1 lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("recent_activities", "Recent Activities")}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {summary.recentActivities.length === 0 ? (
              <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                <p>{t("no_recent_activities", "No recent activities.")}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {summary.recentActivities.map((activity) => (
                  <div key={activity.id} className="flex gap-4 p-4 rounded-lg bg-gray-50 border border-gray-100 hover:bg-gray-100/50 transition-colors">
                    <div className="mt-1 bg-white p-2 rounded-full shadow-sm border border-gray-100 h-fit">
                      {getActivityIcon(activity.type)}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start mb-1">
                        <p className="text-sm font-medium text-gray-900">
                          {activity.user && <span className="text-action-muted">{activity.user}</span>}
                          {activity.user && " "}
                          {activity.action}
                        </p>
                        <span className="text-xs text-gray-500 whitespace-nowrap ml-4">
                          {format(new Date(activity.timestamp), "MMM dd, HH:mm")}
                        </span>
                      </div>
                      {activity.experimentTitle && (
                        <p className="text-xs text-gray-500 mb-1">
                          {t("experiment", "Experiment")}:{" "}
                          {activity.projectId && activity.experimentId ? (
                            <Link
                              to={`/projects/${activity.projectId}/experiments/${activity.experimentId}`}
                              className="font-medium text-gray-700 hover:text-action-muted"
                            >
                              {activity.experimentTitle}
                            </Link>
                          ) : (
                            <span className="font-medium text-gray-700">{activity.experimentTitle}</span>
                          )}
                        </p>
                      )}
                      {activity.content && (
                        <p className="text-sm text-gray-600 bg-white p-2 mt-2 rounded border border-gray-100 inline-block">
                          "{activity.content}"
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
