// src/middleware/firebaseAuth.js
const admin = require('firebase-admin');

const authenticateFirebaseUser = (req, res, next) => {
    const authorization = req.headers.authorization;

    if (!authorization || !authorization.startsWith('Bearer ')) {
        res.status(401).send({ message: 'Unauthorized' });
        return; // stop further execution in this callback
    }

    const idToken = authorization.split('Bearer ')[1];

    admin.auth().verifyIdToken(idToken)
        .then(decodedToken => {
            req.user = decodedToken; // Here you can cast to any to avoid type issues or extend Request type
            next(); // move control to the next middleware
        })
        .catch(error => {
            console.error('Error while verifying Firebase ID token:', error);
            res.status(403).send({ message: 'Unauthorized' });
        });
};

module.exports = { authenticateFirebaseUser };
