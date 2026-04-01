const admin = require('firebase-admin');

type FirebaseAdminModule = typeof admin;

const getRequiredEnv = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `FIREBASE_ADMIN_INIT_FAILED: Missing ${name}. Ensure Firebase env vars are loaded before using FirebaseAuthGuard.`,
    );
  }
  return value;
};

export const getFirebaseAdmin = (): FirebaseAdminModule => {
  if (admin.apps.length) {
    return admin;
  }

  const projectId = getRequiredEnv('FIREBASE_PROJECT_ID');
  const clientEmail = getRequiredEnv('FIREBASE_CLIENT_EMAIL');
  const privateKey = getRequiredEnv('FIREBASE_PRIVATE_KEY').replace(/\\n/g, '\n');

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });

  return admin;
};
