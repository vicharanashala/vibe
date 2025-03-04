import express from 'express';
import {https} from 'firebase-functions';
import { PrismaClient } from '@prisma/client';
import AssessmentGrading from './routes/AssessmentGrading';
import ProgressTracking from './routes/ProgressTracking';
import FetchProgress from './routes/FetchProgress';
import GoogleAuthhVerification from './routes/GoogleAuthhVerification';
import BulkProcess from './routes/BulkProgress';
import cors from 'cors';
import admin from 'firebase-admin';
import * as dotenv from 'dotenv';

dotenv.config();
// Read and parse the CORS environment variable
const allowedOrigins = '*';
console.log("Allowed CORS Origins:", allowedOrigins); // Debugging
const app = express();

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
});

const prisma = new PrismaClient();
const PORT = 8080;

// Use CORS middleware first with dynamic origins
app.use(cors({
    origin: allowedOrigins,
    credentials: true
}));

// Then, use JSON parser
app.use(express.json());
app.get('/', (req, res) => {
    res.status(200).send('CALM Activity Engine');
    });
// After setting up CORS, add your routes
app.use(AssessmentGrading);
app.use(ProgressTracking);
app.use(GoogleAuthhVerification);
app.use(BulkProcess);
app.use(FetchProgress);

exports.activityEngine = https.onRequest(app);
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});


