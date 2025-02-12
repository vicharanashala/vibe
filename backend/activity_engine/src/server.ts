import express from 'express';
import {https} from 'firebase-functions';
import { PrismaClient } from '@prisma/client';
import AssessmentGrading from './routes/AssessmentGrading';
import ProgressTracking from './routes/ProgressTracking';
import GoogleAuthhVerification from './routes/GoogleAuthhVerification';
import cors from 'cors';
import admin from 'firebase-admin';

const app = express();

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
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

exports.activityEngine = https.onRequest(app);
