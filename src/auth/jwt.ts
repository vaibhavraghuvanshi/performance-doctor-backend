import jwt from "jsonwebtoken";

const ISS = "performance-doctor";

function secret(): string {
  const s = process.env.JWT_SECRET?.trim();
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET must be set to a strong value (>=16 chars) in production");
  }
  return "dev-only-jwt-secret-change-me";
}

export interface JwtPayload {
  sub: string;
  email: string;
}

export function signToken(userId: string, email: string): string {
  return jwt.sign({ sub: userId, email }, secret(), {
    expiresIn: "30d",
    issuer: ISS,
  });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, secret(), { issuer: ISS }) as jwt.JwtPayload;
    const sub = typeof decoded.sub === "string" ? decoded.sub : "";
    const email = typeof decoded.email === "string" ? decoded.email : "";
    if (!sub || !email) return null;
    return { sub, email };
  } catch {
    return null;
  }
}
