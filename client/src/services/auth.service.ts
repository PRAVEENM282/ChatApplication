import api from "../lib/axios";
import { generateKeys } from "./crypto.service";
import { savePrivateKey, getPrivateKey } from "../utils/KeyStorage";

interface RegistrationData {
  username: string;
  email: string;
  password: string;
}

// This function now returns the generated keys to the component
export const registerUser = async (data: RegistrationData) => {
  const { publicKeyBase64, privateKeyBase64 } = await generateKeys();

  // Store the key locally right away
  await savePrivateKey(data.username, privateKeyBase64);

  // Call the backend, but only send the PUBLIC key
  const response = await api.post("/api/auth/register", {
    username: data.username,
    email: data.email,
    password: data.password,
    publicKey: publicKeyBase64,
  });

  // Return the server's response AND the private key for the UI to display
  return { ...response.data, privateKeyBase64 };
};

interface LoginData {
  email: string;
  password: string;
}

// Login is now much simpler
export const loginUser = async (data: LoginData) => {
  const res = await api.post("/api/auth/login", data);
  const { username, accessToken, userId } = res.data;

  if (!username || !accessToken || !userId) {
    throw new Error("Login response missing username, userId or access token.");
  }

  // We will check for the private key in the component after login.
  return { username, userId, accessToken };
};