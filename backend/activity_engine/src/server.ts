import express from 'express';
import { PrismaClient } from '@prisma/client';
import AssessmentGrading from './routes/AssessmentGrading';
import ProgressTracking from './routes/ProgressTracking';
import GoogleAuthhVerification from './routes/GoogleAuthhVerification';
import cors from 'cors';
import admin from 'firebase-admin';

const app = express();

// Initialize Firebase Admin with environment variable
if (!process.env.FIREBASE_ADMIN_SDK_PATH) {
  throw new Error('FIREBASE_ADMIN_SDK_PATH environment variable is not defined');
}
const serviceAccount = require(process.env.FIREBASE_ADMIN_SDK_PATH);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const prisma = new PrismaClient();
const PORT = 3001;

// Use CORS middleware first
app.use(cors({
    origin: [
        'http://localhost:4000',
        'http://192.168.1.46:4000',
        'http://157.20.214.128:8000',
        'vicharanashala.in'
    ],
    credentials: true
}));

// Then, use JSON parser
app.use(express.json());

// After setting up CORS, add your routes
app.use(AssessmentGrading);
app.use(ProgressTracking);
app.use(GoogleAuthhVerification);

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
