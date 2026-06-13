import { z } from "zod";

export const registerSchema = z.object({
  body: z.object({
    username: z
      .string()
      .min(3, { message: "Username must be at least 3 characters long" })
      .max(40, { message: "Username cannot exceed 40 characters" }),
    email: z
      .string()
      .email({ message: "Invalid email address" }),
    password: z
      .string()
      .min(8, { message: "Password must be at least 8 characters long" }),
    publicKey: z.string().min(1, { message: "Public key is required" }),
    keyVault: z
      .object({
        encryptedPrivateKey: z.string(),
        nonce: z.string(),
        salt: z.string(),
        opslimit: z.number(),
        memlimit: z.number(),
      })
      .optional()
      .nullable(),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email({ message: "Invalid email address" }),
    password: z.string().min(1, { message: "Password is required" }),
  }),
});
