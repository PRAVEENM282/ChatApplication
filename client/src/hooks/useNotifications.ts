import { useEffect, useRef, useCallback } from "react";
import { useSocket } from "../context/SocketProvider";
import { useAuth } from "../context/AuthProvider";

/**
 * useNotifications hook.
 * Requests browser Notification permission and shows native OS notifications
 * when messages arrive from other users while the tab is not focused.
 */
export const useNotifications = () => {
  const socket = useSocket();
  const { user } = useAuth();
  const permissionRef = useRef<NotificationPermission>("default");

  // Request notification permission on mount
  useEffect(() => {
    if (!("Notification" in window)) return;

    if (Notification.permission === "granted") {
      permissionRef.current = "granted";
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then((perm) => {
        permissionRef.current = perm;
      });
    }
  }, []);

  const showNotification = useCallback(
    (title: string, body: string, chatroomId?: string) => {
      if (permissionRef.current !== "granted") return;
      // Only show when tab is not focused
      if (document.hasFocus()) return;

      try {
        const notification = new Notification(title, {
          body,
          icon: "/favicon.ico",
          tag: chatroomId || "chat-notification", // Collapse same-chat notifications
          silent: false,
        });

        notification.onclick = () => {
          window.focus();
          notification.close();
        };

        // Auto-close after 5 seconds
        setTimeout(() => notification.close(), 5000);
      } catch (e) {
        // Notification API not supported in this context (e.g., service worker only)
        console.warn("Notification failed:", e);
      }
    },
    []
  );

  // Listen for incoming message notifications
  useEffect(() => {
    if (!socket || !user) return;

    const handleNotification = (data: {
      chatroomId: string;
      message: any;
    }) => {
      const { message } = data;
      if (message.sender._id === user._id) return;

      const senderName = message.sender.username || "Someone";
      const msgType = message.type;

      let body = "Sent you a message";
      if (msgType === "image") {
        body = "📷 Sent an image";
      } else if (msgType === "file") {
        body = "📎 Sent a file";
      } else {
        body = "💬 New encrypted message";
      }

      showNotification(senderName, body, data.chatroomId);
    };

    socket.on("new_message_notification", handleNotification);
    return () => {
      socket.off("new_message_notification", handleNotification);
    };
  }, [socket, user, showNotification]);

  return { requestPermission: () => Notification.requestPermission() };
};
