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
    .map((origin) => {
      let cleaned = origin.trim();
      // Remove leading/trailing quotes if user accidentally added them on Render/Railway
      cleaned = cleaned.replace(/^['"]|['"]$/g, "");
      // Remove trailing slash if present
      cleaned = cleaned.replace(/\/$/, "");
      return cleaned;
    })
    .filter(Boolean);
}

export function isOriginAllowed(origin) {
  if (!origin) return true; // Allow requests with no origin (e.g. mobile apps, curl, postman)
  const allowed = getAllowedOrigins();
  return allowed.includes(origin) || allowed.includes("*");
}

export function validateEnv() {
  const required = ["MONGODB_URI", "ACCESS_TOKEN_SECRET", "REFRESH_TOKEN_SECRET"];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}
