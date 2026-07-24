import React, { useState, useEffect } from "react";
import { Bell, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { Dropdown } from "./Dropdown";
import { formatDistanceToNow } from "date-fns";

interface Notification {
  id: string;
  type: string;
  payload: any;
  relatedExperimentId: string | null;
  isRead: boolean;
  createdAt: string;
}

export function NotificationBell() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const fetchUnreadCount = () => {
    api.get<{ count: number }>("/api/v1/notifications/unread-count")
      .then(res => setUnreadCount(res.count))
      .catch(() => {});
  };

  const fetchNotifications = () => {
    api.get<{ items: Notification[], total: number }>("/api/v1/notifications?limit=10")
      .then(res => setNotifications(res.items))
      .catch(() => {});
  };

  useEffect(() => {
    // Initial fetch
    fetchUnreadCount();
    // Poll every 30s
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen]);

  const handleMarkAllRead = async () => {
    try {
      await api.put("/api/v1/notifications/read-all");
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (e) {
      console.error(e);
    }
  };

  const handleNotificationClick = async (notif: Notification) => {
    if (!notif.isRead) {
      try {
        await api.put(`/api/v1/notifications/${notif.id}/read`);
        setUnreadCount(prev => Math.max(0, prev - 1));
        setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, isRead: true } : n));
      } catch (e) {
        console.error(e);
      }
    }
    setIsOpen(false);
    // Navigate based on payload
    const projectId = notif.payload?.projectId;
    const experimentId = notif.relatedExperimentId || notif.payload?.experimentId;
    if (projectId && experimentId) {
      navigate(`/projects/${projectId}/experiments/${experimentId}`);
    } else if (projectId) {
      navigate(`/projects/${projectId}`);
    } else if (experimentId) {
      // Fallback — try to find project from payload
      navigate(`/experiments/${experimentId}`);
    }
  };

  const renderNotificationType = (type: string) => {
    const map: Record<string, { key: string; color: string }> = {
      WORKFLOW_STEP_ASSIGNED: { key: "notif_step_assigned", color: "text-blue-600" },
      WORKFLOW_STEP_COMPLETED: { key: "notif_step_completed", color: "text-green-600" },
      WORKFLOW_COMPLETED: { key: "notif_project_completed", color: "text-green-700" },
      REVIEW_SUBMITTED: { key: "notif_review_requested", color: "text-amber-600" },
      REVIEW_APPROVED: { key: "notif_review_approved", color: "text-green-600" },
      REVIEW_REJECTED: { key: "notif_review_rejected", color: "text-red-600" },
      NEW_COMMENT: { key: "notif_new_comment", color: "text-blue-600" },
    };
    const entry = map[type];
    return entry ? { label: t(entry.key), color: entry.color } : { label: type.replace(/_/g, " "), color: "text-gray-600" };
  };

  const renderNotificationMessage = (notif: Notification) => {
    const info = renderNotificationType(notif.type);
    const stepName = notif.payload?.stepName || notif.payload?.stepLabel;
    const projectName = notif.payload?.projectName;
    const experimentTitle = notif.payload?.experimentTitle;
    const remaining = notif.payload?.remaining;

    return (
      <div className="space-y-0.5">
        <span className={`text-[11px] font-semibold uppercase tracking-wide ${info.color}`}>
          {info.label}
        </span>
        {stepName && (
          <p className="text-xs text-gray-700 mt-0.5">
            {t("notif_step")} <span className="font-medium">{stepName}</span>
          </p>
        )}
        {experimentTitle && (
          <p className="text-xs text-gray-500 truncate">{experimentTitle}</p>
        )}
        {projectName && !experimentTitle && (
          <p className="text-xs text-gray-500">{t("notif_project")} {projectName}</p>
        )}
        {remaining !== undefined && (
          <p className="text-[11px] text-gray-400">{t("notif_remaining", { count: remaining })}</p>
        )}
      </div>
    );
  };

  return (
    <Dropdown
      onOpenChange={setIsOpen}
      trigger={
        <button type="button" aria-label={t("notifications", "Notifications")} className="relative p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors mr-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/35">
          <Bell className="w-5 h-5" aria-hidden="true" />
          {unreadCount > 0 && (
            <span aria-label={`${unreadCount} unread`} className="absolute top-1 right-1 flex items-center justify-center w-4 h-4 text-[10px] font-bold text-white bg-red-500 rounded-full" style={{lineHeight: 16}}>
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      }
    >
      <div className="flex max-h-96 w-[min(20rem,calc(100vw-1rem))] flex-col bg-white">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between shrink-0">
          <h3 className="font-semibold text-gray-900 text-sm">{t('notifications', 'Notifications')}</h3>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="flex items-center gap-1 text-xs font-medium text-action-muted hover:text-action-hover"
            >
              <Check className="w-3 h-3" /> {t("notif_mark_all_read")}
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-500">
              {t("notif_no_notifications")}
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {notifications.map(notif => (
                <li key={notif.id}>
                  <button
                    type="button"
                    onClick={() => handleNotificationClick(notif)}
                    className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus/35 ${!notif.isRead ? 'bg-action-subtle/60' : ''}`}
                  >
                    <div className="flex items-start gap-3">
                    {!notif.isRead && <span className="inline-flex items-center h-4 shrink-0"><span className="w-2 h-2 rounded-full bg-action" /></span>}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate leading-4">
                        {renderNotificationMessage(notif)}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Dropdown>
  );
}
