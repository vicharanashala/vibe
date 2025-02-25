// src/firebase.js
import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: 'AIzaSyADve0GEutUqzbuJ4LDkkLubL8DqQms4jQ',
  authDomain: 'vicharanashala-calm.firebaseapp.com',
  projectId: 'vicharanashala-calm',
  storageBucket: 'vicharanashala-calm.firebasestorage.app',
  messagingSenderId: '339283531284',
  appId: '1:339283531284:web:5810e6c27b4c7fbf95f901',
  measurementId: 'G-4B0ZKXKFSH',
}

// const firebaseConfig = {
//   apiKey: 'AIzaSyA5_HJWyWaDpIohV4q6UpKqB6DP48Sbhsk',
//   authDomain: 'calm-594ef.firebaseapp.com',
//   projectId: 'calm-594ef',
//   storageBucket: 'calm-594ef.firebasestorage.app',
//   messagingSenderId: '420629178412',
//   appId: '1:420629178412:web:ff85b63f0a6b246f218989',
//   measurementId: 'G-QR8DHVFDKD',
// }

// Initialize Firebase
const app = initializeApp(firebaseConfig)

// Initialize Firebase Authentication
const auth = getAuth(app)

export { auth }
