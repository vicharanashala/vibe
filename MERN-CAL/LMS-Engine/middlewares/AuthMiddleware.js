const admin = require('firebase-admin');

const authenticateFirebaseUser = async (req, res, next) => {
    try {
        const authorization = req.headers.authorization;

        if (!authorization || !authorization.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, message: 'Unauthorized: No token provided' });
        }

        const idToken = authorization.split('Bearer ')[1];

        // Verify Firebase Token
        const decodedToken = await admin.auth().verifyIdToken(idToken);

        // Attach Firebase UID and email to request
        req.user = {
            firebase_id: decodedToken.uid, // Firebase unique user ID
            email: decodedToken.email || null // Email if available
        };

        next(); // Move control to the next middleware or route
    } catch (error) {
        console.error('Error verifying Firebase ID token:', error);
        return res.status(403).json({ success: false, message: 'Unauthorized: Invalid or expired token' });
    }
};

module.exports = { authenticateFirebaseUser };
