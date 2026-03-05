import { auth } from "@/lib/firebase";

export async function getFirebaseIdToken(): Promise<string | null> {
  const currentUser = auth.currentUser;
  if (!currentUser) return null;
  return currentUser.getIdToken();
}
