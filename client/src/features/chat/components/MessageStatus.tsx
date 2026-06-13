import React from "react";

interface MessageStatusProps {
  status: "sending" | "sent" | "delivered" | "read" | "failed";
  isMe: boolean;
}

const ClockIcon = () => (
  <svg width="16" height="11" viewBox="0 0 16 11" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.2" fill="none" />
    <path d="M5.5 3V5.5L7 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
  </svg>
);

const SingleCheck = () => (
  <svg width="16" height="11" viewBox="0 0 16 11" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M11 1L5.5 8.5L2 5.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const DoubleCheck = () => (
  <svg width="18" height="11" viewBox="0 0 18 11" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M13 1L7.5 8.5L5 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M9 1L3.5 8.5L1 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const FailedIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="7" cy="7" r="6" stroke="#EA0038" strokeWidth="1.5" />
    <path d="M7 4V7.5" stroke="#EA0038" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="7" cy="9.5" r="0.75" fill="#EA0038" />
  </svg>
);

export const MessageStatus: React.FC<MessageStatusProps> = React.memo(({
  status,
  isMe,
}) => {
  if (!isMe) return null;

  const getStatusIcon = () => {
    switch (status) {
      case "sending":
        return <span className="text-wa-text-secondary/60"><ClockIcon /></span>;
      case "sent":
        return <span className="text-wa-text-secondary/70"><SingleCheck /></span>;
      case "delivered":
        return <span className="text-wa-text-secondary/70"><DoubleCheck /></span>;
      case "read":
        return <span className="text-[#53BDEB]"><DoubleCheck /></span>;
      case "failed":
        return <FailedIcon />;
      default:
        return null;
    }
  };

  return (
    <span className="inline-flex items-center ml-1 flex-shrink-0">
      {getStatusIcon()}
    </span>
  );
});