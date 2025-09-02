export interface User {
  _id: string;
  username: string;
  email: string;
  publicKey: string;
  avatarUrl?: string;
  lastSeen?: string;
  createdAt: string;
  updatedAt: string;
}