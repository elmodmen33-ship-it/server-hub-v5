import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET || "default-secret-please-change-me-in-production-123";
if (SECRET === "default-secret-please-change-me-in-production-123") {
  console.warn("⚠️ WARNING: JWT_SECRET environment variable is missing! Using a default secret. This is insecure for production!");
}

export interface JwtPayload {
  userId: string;
  username: string;
  role: "admin" | "user";
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, SECRET) as JwtPayload;
  } catch {
    return null;
  }
}
