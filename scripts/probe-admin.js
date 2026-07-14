// Minimal admin SDK probe
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.GOOGLE_CLOUD_PROJECT = 'demo-test';
process.env.FIREBASE_PROJECT_ID = 'demo-test';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.FIREBASE_CLIENT_EMAIL = 'dummy@demo-test.iam.gserviceaccount.com';
process.env.FIREBASE_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCnbuNitRxe58wvEUYDXGZFoMDhn1ePN3zZM9BU5gb1OFZZs/krh34fp/vcjVuQWR0usEBXsja2wqgMLeoZw6beCY4PmjKLcaLOoo7uUPyKMn3GE5zucBEZi9nQTy25VzLAn/F1tHhm2LH/iIpiGscsfeu9vU4ILw1nxDSTV0ru+j/o5fVXRmz0RDRO8ZUeBgQtAQ9CUIacmx3An7GHUBjGxPSpk2NRjAPO/77fWPSBCzLTW3n/CaIPNfghiO2wvxfaZ9uIUF1z2RPUT737UcIDCG+BBp5iF6eFYtPdiA65o4MGtVfZ/nBgebjqQ7IKJfWQ+Tu/TWyp7m1qLw8IULvzAgMBAAECggEACJycp8eOoYJaT14b6UatNfiaOHX0es0iUp5RIVoW0ocRc0SyqglVNItJ2jgPv8Ftov31bpf1K3pLSsZpIOZzeeko5ubfTFUjHW4MBvhLEk/y2ydyw2rSiQCsn9kVY3qM2uPUd2GPGHnIfKReZcRgfoqC1RFcZvGwm/03V7q+Lm4YTKlLY+0cP+nGtD1fllI0afo/apiyufukhqaUzgQJFsRnaULbAnf5KJoqrJ1SLqHLdLlv5649wdsobxSWSQMOg7PyZiToB8HWeGfZSNSuGC+v70hNPEINvq2nWToAzr5L8Pqpp4ZgK1fTM0DLH+4YdXFhAEZ/y2vzQlf5v3SrCQKBgQDi6yBIq97eRPWl2/kUn9UcQkebWEDDZG7S1jPNWlEW2MZi1JYeh6m2OZM5NAxn9TJ0qqpJpnAWTHEpAFATDUi8LOkghKjb+blgEktpihUCqv+HC0HxgqR1mkqcJXym0ZaREz+7Z9vNEJS8AuQ90MbvLI/dmr/nodTioLyuLQOriwKBgQC85CIlold0yRnhFuF6bYYszGJwmOEyMAGSkswhZKnqSZ+Szoa/Z0uUTwKiCe13x1oPEJzjjl7u7P0DG+37XRKgejWZjaZNfhVBShMWOq+Lfu9+u78xdOoP8/msPcIQrUX910NWb1+ofC8Rzuf8+PcaEmcUuskuqYQn8lnahtfeOQKBgQC4opJRLy+XcUrjWrov8uFHLhLvrn57veOCv/HEfGGQkm/RiKJhUwdfEzfciqIxkEwuq5MFfFyleCt3Lh75cYymOHC0Gdz/qBESv7AGvujbk+F4s0tDxIYmfpWIuePUJKM7hgsMZLRvBbfPxxaJya+keoDQ0pKlWYNLp3f+zPe4gwKBgC7Fvr7a6BT/Bu15oPOT0zmcknOXJ4wp3vnQZ8ONDZX6DQ1pHmyew1RCDEDbfHXAY0h/sJmYU2GORUhTziYD8ezS1hrjvF5L7i9wjDFg7r73+43CJ6GzdZHls9k2oatHfKFSgFYS1fj+ZxldxowZifZmwCed6NspFpRdqmo2IZXhAoGBANGZ+nRyoQyXhFJZ/q7nOrWYPd1qCVlrQh4BUJizElTAgbgUB8FUV1uhTzJyRLHhcEQGmvJpuufZv2jUl2q+4II6nt32Kmy28pa5922WT5MDdosDis3OnKSDG85q7FwvDI0BWyGSjcUHBUmoESgaKWDG2IjBRULlMNlFsKn+/HQc\n-----END PRIVATE KEY-----';

const admin = require('C:/Users/openclaw-user/Projects/vibe/backend/node_modules/firebase-admin');
admin.initializeApp({ credential: admin.credential.cert({ clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'), projectId: process.env.FIREBASE_PROJECT_ID }) });
console.log('FIREBASE_AUTH_EMULATOR_HOST:', process.env.FIREBASE_AUTH_EMULATOR_HOST);
(async () => {
  try {
    const r = await admin.auth().createUser({ email: 'admin-probe-' + Date.now() + '@example.com', password: 'Xxx' + Date.now() });
    console.log('CREATED:', r.uid);
  } catch (e) {
    console.log('ERR:', e.message, '|', e.code);
  }
})();
