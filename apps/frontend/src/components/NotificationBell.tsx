import React, { useState, useEffect } from "react";
import { Bell, Check, Trash2, ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { Dropdown } from "./Dropdown";
import { Button } from "./Button";
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
    if (notif.relatedExperimentId) {
      // Find project id? The API might not give projectId, just navigate to experiments directly.
      // Assuming routing structure supports `/experiments/:id` or we can find it.
      navigate(`/experiments/${notif.relatedExperimentId}`);
    }
  };

  const renderNotificationMessage = (notif: Notification) => {
    switch (notif.type) {
      case 'REVIEW_SUBMITTED':
        return <span className="font-medium text-gray-900">Review Requested: {notif.payload?.experimentTitle}</span>;
      case 'REVIEW_APPROVED':
        return <span className="font-medium text-green-600">Approved: {notif.payload?.experimentTitle}</span>;
      case 'REVIEW_REJECTED':
        return <span className="font-medium text-red-600">Rejected: {notif.payload?.experimentTitle}</span>;
      case 'NEW_COMMENT':
        return <span className="text-gray-900">New Comment: "{notif.payload?.commentPreview}..."</span>;
      default:
        return <span className="text-gray-900">New Notification</span>;
    }
  };

  return (
    <Dropdown
      onOpenChange={setIsOpen}
      trigger={
        <button className="relative p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors mr-2">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 flex items-center justify-center w-4 h-4 text-[10px] font-bold text-white bg-red-500 rounded-full">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      }
    >
      <div className="w-80 max-h-96 flex flex-col bg-white">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between shrink-0">
          <h3 className="font-semibold text-gray-900 text-sm">{t('notifications', 'Notifications')}</h3>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="text-xs text-[#1d74f5] hover:text-blue-700 font-medium flex items-center gap-1"
            >
              <Check className="w-3 h-3" /> Mark all read
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-500">
              No notifications yet.
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {notifications.map(notif => (
                <li
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors ${!notif.isRead ? 'bg-blue-50/30' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    {!notif.isRead && <div className="w-2 h-2 mt-2 rounded-full bg-[#1d74f5] shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">
                        {renderNotificationMessage(notif)}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Dropdown>
  );
}
