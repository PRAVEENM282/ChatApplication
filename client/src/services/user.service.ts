import api from "../lib/axios";
import { User } from "../types/user.types";

/**
 * Retrieves the currently authenticated user's own profile detail.
 */
export const getMe = async (): Promise<User> => {
  const response = await api.get("/api/users/me");
  return response.data;
};

/**
 * Searches users database for establishing conversations.
 */
export const searchUsers = async (query: string, page = 1, limit = 20) => {
  const { data } = await api.get(`/api/users/search`, {
    params: { q: query, page, limit },
  });
  return data;
};

/**
 * Updates the user's username.
 * Fixes route path matching to /api/users/profile.
 */
export const updateUserProfile = async (newName: string) => {
  const response = await api.put("/api/users/profile", { username: newName });
  return response.data;
};

/**
 * Updates the user's login password securely.
 * Fixes route path matching to /api/users/password.
 */
export const updateUserPassword = async (
  currentPassword: string,
  newPassword: string
) => {
  const response = await api.put("/api/users/password", {
    currentPassword: currentPassword,
    newPassword: newPassword,
  });
  return response.data;
};

/**
 * Uploads user avatar image (triggers S3 upload backend middleware).
 * Fixes route path matching to /api/users/avatar.
 */
export const updateUserAvatar = async (formData: FormData) => {
  const response = await api.put("/api/users/avatar", formData);
  return response.data;
};

/**
 * Deletes user account and tears down all related chat session structures.
 */
export const deleteAccount = async () => {
  const response = await api.delete("/api/users/me");
  return response.data;
};

/**
 * Fetch encrypted E2EE private key vault for the current user.
 */
export const getMyKeyVault = async () => {
  const { data } = await api.get("/api/users/me/key-vault");
  return data;
};

/**
 * Update encrypted E2EE private key vault (used after password changes / migrations).
 */
export const updateMyKeyVault = async (keyVault: any) => {
  const { data } = await api.put("/api/users/me/key-vault", { keyVault });
  return data;
};

export const updateMySettings = async (settings: {
  notificationsEnabled?: boolean;
  readReceiptsEnabled?: boolean;
  encryptedFilePreviewsEnabled?: boolean;
}) => {
  const { data } = await api.patch("/api/users/me/settings", settings);
  return data;
};

export interface SessionInfo {
  _id: string;
  deviceInfo: string;
  ipAddress: string;
  lastActive: string;
  createdAt: string;
  isCurrent: boolean;
}

export const getMySessions = async (): Promise<SessionInfo[]> => {
  const { data } = await api.get("/api/sessions");
  return data;
};

export const revokeSession = async (sessionId: string): Promise<void> => {
  await api.delete(`/api/sessions/${sessionId}`);
};

export const revokeOtherSessions = async (): Promise<void> => {
  await api.delete("/api/sessions");
};
