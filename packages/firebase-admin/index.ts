import * as admin from 'firebase-admin';

/**
 * FIREBASE ADMIN INITIALIZATION
 * Ensure FIREBASE_PRIVATE_KEY, FIREBASE_PROJECT_ID, and FIREBASE_CLIENT_EMAIL exist in the server backend .env.local
 */

let app: admin.app.App;

if (!admin.apps.length) {
    if (!process.env.FIREBASE_PRIVATE_KEY) {
        console.error('CRITICAL: FIREBASE_PRIVATE_KEY is missing from environment. Firestore Admin will fail.');
    }

    try {
        app = admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                // Handle escaped newlines from environment variables
                privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            }),
        });
        console.log("Firebase Admin successfully initialized in package");
    } catch (e: any) {
        console.error("Firebase Admin Init Error:", e.message);
        throw e;
    }
} else {
    app = admin.app();
}

export const dbAdmin = admin.firestore();
export const authAdmin = admin.auth();
export { admin };
