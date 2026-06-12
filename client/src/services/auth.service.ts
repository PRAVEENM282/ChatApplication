import api from "../lib/axios";
import { generateKeys } from "../utils/keyUtils";
import {
  decryptPrivateKeyFromVault,
  encryptPrivateKeyToVault,
  type KeyVaultPayload,
} from "./keyVault.service";

import { RegistrationData, LoginData } from "../types/auth.types";

/**
 * Registers a new user. Generates client-side E2EE Curve25519 keys,
 * stores the private key locally, and registers the public key on the server.
 */
export const registerUser = async (data: RegistrationData) => {
  // Generate a fresh Curve25519 E2EE keypair
  const { publicKeyBase64, privateKeyBase64 } = await generateKeys();
  
  const keyVault = await encryptPrivateKeyToVault(privateKeyBase64, data.password);

  const response = await api.post("/api/auth/register", {
    username: data.username,
    email: data.email,
    password: data.password,
    publicKey: publicKeyBase64,
    keyVault,
  });

  if (response.data) {
    // Store the private key locally on this device
    localStorage.setItem("privateKey", privateKeyBase64);
  }

  return response.data;
};


/**
 * Authenticates user credentials.
 * If private key is missing on this device (e.g. logging in from a new place),
 * the login still succeeds but the app will prompt for a private key import/backup.
 */
export const loginUser = async (data: LoginData) => {
  const res = await api.post("/api/auth/login", data);

  const keyVault = (res.data?.keyVault || null) as KeyVaultPayload | null;
  if (keyVault) {
    const privateKeyBase64 = await decryptPrivateKeyFromVault(
      keyVault,
      data.password
    );
    localStorage.setItem("privateKey", privateKeyBase64);
  }

  return res.data;
};