// src/routes/protectedRoutes.ts
import { Router } from 'express';
import { authenticateFirebaseUser } from '../Middleware/googleAuth';

const router = Router();

router.get('/protected', authenticateFirebaseUser, (req, res) => {
  // Type assertion to tell TypeScript about the user property
  const user = (req as any).user;  // If extending types doesn't work, as a last resort
  res.send(`Welcome ${user?.name}, you are authenticated!`);
});

export default router;
