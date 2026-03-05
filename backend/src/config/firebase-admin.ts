import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { env } from "@/config/env";

const privateKey = env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n");

const app =
  getApps()[0] ??
  initializeApp({
    credential: cert({
      projectId: env.FIREBASE_PROJECT_ID,
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
      privateKey,
    }),
  });

export const firebaseAuth = getAuth(app);
