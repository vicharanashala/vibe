// src/firebase.js
import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'

// const firebaseConfig = {
//   apiKey: import.meta.env.VITE_API_KEY,
//   authDomain: import.meta.env.VITE_AUTH_DOMAIN,
//   projectId: import.meta.env.VITE_PROJECT_ID,
//   storageBucket: import.meta.env.VITE_STORAGE_BUCKET,
//   messagingSenderId: import.meta.env.VITE_MESSAGING_SENDER_ID,
//   appId: import.meta.env.VITE_APP_ID,
//   measurementId: import.meta.env.VITE_MEASUREMENT_ID,
// }

const firebaseConfig = {
  apiKey: 'AIzaSyA5_HJWyWaDpIohV4q6UpKqB6DP48Sbhsk',
  authDomain: 'calm-594ef.firebaseapp.com',
  projectId: 'calm-594ef',
  storageBucket: 'calm-594ef.firebasestorage.app',
  messagingSenderId: '420629178412',
  appId: '1:420629178412:web:ff85b63f0a6b246f218989',
  measurementId: 'G-QR8DHVFDKD',
}
// Initialize Firebase
const app = initializeApp(firebaseConfig)

// Initialize Firebase Authentication
const auth = getAuth(app)

export { auth }
