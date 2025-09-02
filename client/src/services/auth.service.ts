import api from "../lib/axios";
import { generateKeys } from "./crypto.service";
import { savePrivateKey, getPrivateKey } from "../utils/KeyStorage"; // ensure correct casing

// Define the shape of the registration data
interface RegistrationData {
  username: string;
  email: string;
  password: string;
}

export const registerUser = async (data: RegistrationData) => {
  // 1. Generate the cryptographic keys on the client
  const { publicKeyBase64, privateKeyBase64 } = await generateKeys();

  // 2. Securely store the private key in IndexedDB using username as ID
  await savePrivateKey(data.username, privateKeyBase64);

  // 3. Call the backend API with the user data and the public key
  const response = await api.post("/api/auth/register", {
    username: data.username,
    email: data.email,
    password: data.password,
    publicKey: publicKeyBase64,
  });

  // 4. Return the server's response (which includes the accessToken)
  return response.data;
};

interface LoginData {
  email: string;
  password: string;
}

export const loginUser = async (data: LoginData) => {
  const res = await api.post("/api/auth/login", data);

  // Extract username and accessToken from API response
  const { username, accessToken, userId } = res.data;

  if (!username || !accessToken || !userId) {
    throw new Error("Login response missing username, userId or access token.");
  }

  // Retrieve private key for this username from IndexedDB (best-effort)
  // If not found, we still proceed with login so the user can access the app.
  try {
    await getPrivateKey(username);
  } catch (_) {
    // noop
  }

  // Return important auth info to caller (e.g., accessToken and username)
  return { username, userId, accessToken };
};
