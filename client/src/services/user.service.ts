import api from "../lib/axios";

export const fetchUserPublicKey = async (userId: string) => {
  const res = await api.get(`/api/users/${userId}`);
  return res.data.publicKey;  // Assuming backend user object contains publicKey field
};

export const searchUsers = async (query: string) => {
  const res = await api.get(`/api/users/search?q=${encodeURIComponent(query)}`);
  return res.data; // array of users
};