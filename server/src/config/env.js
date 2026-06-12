import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function loadEnv() {
  // Load only the repository root .env to centralize configuration
  dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
}

export function getAllowedOrigins() {
  return (process.env.CLIENT_ORIGIN || "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function validateEnv() {
  const required = ["MONGODB_URI", "ACCESS_TOKEN_SECRET", "REFRESH_TOKEN_SECRET"];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}
