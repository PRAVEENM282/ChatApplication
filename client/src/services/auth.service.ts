import api from "../lib/axios";
import { generateKeys } from "../utils/keyUtils";
interface RegistrationData {
  username: string;
  email: string;
  password: string;
}

export const registerUser = async (data: RegistrationData) => {
  const { publicKeyBase64, privateKeyBase64 } = await generateKeys();
  localStorage.setItem("privateKey", privateKeyBase64);
  const response = await api.post("/api/auth/register", {
    username: data.username,
    email: data.email,
    password: data.password,
    publicKey: publicKeyBase64,
  });
  return response.data;
};

interface loginData {
  email: string;
  password: string;
}

export const loginUser = async (data: loginData) => {
  const res = await api.post("api/auth/login", data);

  const privateKey = localStorage.getItem("privateKey");
  if (!privateKey) {
    throw new Error("Please use the device you registered with");
  }

  return res.data;
};