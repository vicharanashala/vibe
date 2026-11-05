import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, GoogleAuthProvider } from 'firebase/auth';

import { env } from './env';

const app = initializeApp(env.firebase);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

if (env.authEmulatorUrl) {
  connectAuthEmulator(auth, env.authEmulatorUrl, { disableWarnings: true });
}
