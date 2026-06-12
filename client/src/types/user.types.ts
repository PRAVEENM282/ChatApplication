export interface User {
  _id: string;
  username: string;
  email: string;
  publicKey: string;
  avatarUrl?: string; // This field is optional
  settings?: {
    notificationsEnabled?: boolean;
    readReceiptsEnabled?: boolean;
    encryptedFilePreviewsEnabled?: boolean;
  };
  lastSeen: string; // Dates are typically transmitted as ISO strings over JSON
  createdAt: string;
  updatedAt: string;
}
