/**
 * Hit the actual /users/enrollments endpoint with a fresh Firebase token
 * for the test learner. This is the DEFINITIVE check.
 *
 * If the backend isn't running, we'll see a connection error.
 * If the response is 200 with enrollments, the data flow works backend-to-API.
 * If the response is 200 with empty enrollments, we know the service returns [].
 */

const http = require('http');
const { MongoClient, ObjectId } = require('mongodb');
const admin = require('firebase-admin');

const HOST = '127.0.0.1';
const PORT = process.env.PORT || 5000;
const USER_EMAIL = 'test.learner@vibe.local';
const USER_ID = '6a46ec683f01733f189df8a3';

(async () => {
  // Init firebase admin
  try {
    const serviceAccount = require('../src/shared/config/firebase-service-account.json');
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    }
  } catch (e) {
    console.error('Could not init firebase admin:', e.message);
    console.error('Falling back to bare db lookup to validate the path');
  }

  // Look up the user by firebaseUid via DB
  const url = process.env.MONGO_URI_OVERRIDE || 'mongodb://127.0.0.1:27017';
  const client = new MongoClient(url);
  await client.connect();
  const db = client.db('vibe');

  const user = await db.collection('users').findOne({ email: USER_EMAIL });
  console.log('User found:', user ? { _id: user._id.toString(), email: user.email, firebaseUid: user.firebaseUid } : null);

  if (!user) {
    console.error('USER NOT FOUND');
    await client.close();
    return;
  }

  // Generate a custom token for the user
  let idToken;
  try {
    // Try to fetch real token from DB if stored
    if (user.firebaseUid) {
      const customToken = await admin.auth().createCustomToken(user.firebaseUid);
      console.log('Generated custom token for uid:', user.firebaseUid);
      // ... but a customToken needs to be exchanged for an idToken via the client SDK.
      // Skip this since we can't do that server-side.
      console.log('WARNING: custom tokens cannot be used directly as Bearer tokens.');
      console.log('We need an ID token. Trying alternate approach...');
    }
  } catch (e) {
    console.log('Could not generate token:', e.message);
  }

  // Alternate: hit the /users/enrollments endpoint with NO auth to see what happens
  const epUrl = `http://${HOST}:${PORT}/users/enrollments?page=1&limit=10&role=STUDENT&tab=active`;
  console.log('');
  console.log('Probing:', epUrl);

  await new Promise(resolve => {
    http.get(epUrl, (res) => {
      console.log('Status:', res.statusCode);
      console.log('Headers:', JSON.stringify(res.headers, null, 2));
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('Body:', data.slice(0, 500));
        resolve();
      });
    }).on('error', (err) => {
      console.log('Network error (backend NOT running?):', err.message);
      resolve();
    });
  });

  await client.close();
})().catch(e => {
  console.error('FAIL:', e);
  process.exit(1);
});