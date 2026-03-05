import type { NextFunction, Request, Response } from "express";
import { firebaseAuth } from "@/config/firebase-admin";
import { redis } from "@/cache/redis";

declare module "express-serve-static-core" {
  interface Request {
    user?: { uid: string; email?: string };
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const token = authHeader.slice("Bearer ".length);
    const cacheKey = `firebase:token:${token}`;
    const cached = await redis.get(cacheKey);

    const decoded = cached ? JSON.parse(cached) : await firebaseAuth.verifyIdToken(token);

    if (!cached) {
      await redis.set(cacheKey, JSON.stringify(decoded), "EX", 60 * 10);
    }

    req.user = { uid: decoded.uid, email: decoded.email };
    return next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
}
