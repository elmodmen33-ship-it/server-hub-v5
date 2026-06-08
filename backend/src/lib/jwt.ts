import jwt from "jsonwebtoken";

const SECRET = process.env.SESSION_SECRET || "serverhub-secret-2024";

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
