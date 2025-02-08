// src/firebase.js
import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'

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
