import { spawn } from 'child_process';
import admin from 'firebase-admin';
import net from 'net';

const EMULATOR_HOST = '127.0.0.1';
const EMULATOR_PORT = 9099;
process.env.FIREBASE_AUTH_EMULATOR_HOST = `${EMULATOR_HOST}:${EMULATOR_PORT}`;

// 1. Start Firebase Emulator
console.log('Starting Firebase Auth Emulator...');
const emulator = spawn('npx.cmd', ['firebase', 'emulators:start', '--only', 'auth'], {
  cwd: process.cwd(),
  stdio: 'inherit',
  shell: true
});

// Helper to check if port is open
function checkPort(port, host) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const onError = () => {
      socket.destroy();
      resolve(false);
    };
    socket.setTimeout(1000);
    socket.once('error', onError);
    socket.once('timeout', onError);
    socket.connect(port, host, () => {
      socket.end();
      resolve(true);
    });
  });
}

// Wait for port to open, then setup user
async function setupUserWhenReady() {
  console.log('Waiting for emulator port to open...');
  for (let i = 0; i < 30; i++) {
    const isOpen = await checkPort(EMULATOR_PORT, EMULATOR_HOST);
    if (isOpen) {
      console.log('Emulator is online! Setting up user...');
      await new Promise(resolve => setTimeout(resolve, 2000)); // give it a brief moment
      
      admin.initializeApp({ projectId: 'vibe-5b35a' });
      try {
        // Delete incorrect UIDs if they exist
        try { await admin.auth().deleteUser('qoL0zaRc2GZQB0exORLU3xqM26c8'); } catch (e) {}
        try { await admin.auth().deleteUser('HJv7zMACtlniuroWhHRII1sPEObe'); } catch (e) {}
        
        // Create the user with the correct UID from MongoDB
        const userRecord = await admin.auth().createUser({
          uid: 'HJv7zMACtlniuroWhHRII1sPEObe',
          email: 'khushidosi2006@gmail.com',
          password: 'Khushi@123',
          displayName: 'Khushi Dosi',
          emailVerified: false,
          disabled: false,
        });
        console.log('Successfully restored user in Firebase Emulator:', userRecord.uid);
      } catch (error) {
        console.error('Failed to setup user:', error.message);
      }
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  console.error('Timeout waiting for emulator port to open.');
}

setupUserWhenReady();

// Handle exit
process.on('SIGINT', () => {
  emulator.kill();
  process.exit();
});
process.on('SIGTERM', () => {
  emulator.kill();
  process.exit();
});
