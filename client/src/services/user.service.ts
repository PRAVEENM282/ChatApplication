import api from "../lib/axios";
import { User } from "../types/user.types";

export const getMe = async (): Promise<User> => {
  const response = await api.get("/api/users/me");
  return response.data;
};

export const searchUsers = async (query: string, page = 1, limit = 20) => {
  const { data } = await api.get(`/api/users/search`, {
    params: { q: query, page, limit },
  });
  return data;
};

export const updateUserProfile = async (newName: string) => {
  const response = await api.put("/api/users/me", { username: newName });

  return response.data;
};

export const updateUserPassword = async (
  currentPassword: string,
  newPassword: string
) => {
  const response = await api.put("/api/users/me/password", {
    currentPassword: currentPassword,
    newPassword: newPassword,
  });

  return response.data;
};

export const updateUserAvatar = async (formData: FormData) => {
  const response = await api.put("/api/users/me/avatar", formData);
  return response.data;
};