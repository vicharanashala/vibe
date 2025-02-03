// src/middleware/firebaseAuth.ts
import * as admin from 'firebase-admin';
import { Request, Response, NextFunction } from 'express';

export const authenticateFirebaseUser = (req: Request, res: Response, next: NextFunction) => {
  const authorization = req.headers.authorization;

  if (!authorization || !authorization.startsWith('Bearer ')) {
    res.status(401).send({ message: 'Unauthorized' });
    return; // stop further execution in this callback
  }

  const idToken = authorization.split('Bearer ')[1];

  admin.auth().verifyIdToken(idToken)
    .then(decodedToken => {
      (req as any).user = decodedToken; // Here you can cast to any to avoid type issues or extend Request type
      next(); // move control to the next middleware
    })
    .catch(error => {
      console.error('Error while verifying Firebase ID token:', error);
      res.status(403).send({ message: 'Unauthorized' });
    });
};
