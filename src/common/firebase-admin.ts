import { App, cert, getApps, initializeApp } from 'firebase-admin/app';
import { Auth, getAuth } from 'firebase-admin/auth';
import { Firestore, getFirestore } from 'firebase-admin/firestore';

const requiredEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`FIREBASE_ADMIN_INIT_FAILED: Missing ${name}.`);
  }
  return value;
};

/** Lazily initialises the Admin SDK once. Credentials never leave the server. */
function getAdminApp(): App {
  const existing = getApps()[0];
  if (existing) return existing;
  return initializeApp({
    credential: cert({
      projectId: requiredEnv('FIREBASE_PROJECT_ID'),
      clientEmail: requiredEnv('FIREBASE_CLIENT_EMAIL'),
      privateKey: requiredEnv('FIREBASE_PRIVATE_KEY').replace(/\\n/g, '\n'),
    }),
  });
}

export const getAdminAuth = (): Auth => getAuth(getAdminApp());
export const getAdminFirestore = (): Firestore => getFirestore(getAdminApp());
