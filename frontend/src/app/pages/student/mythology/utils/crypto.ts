import CryptoJS from 'crypto-js';

// Derives a strong 256-bit encryption key from a user's passcode using PBKDF2
export const deriveKey = (passcode: string, salt: string = 'vibe-mythology-salt'): string => {
  return CryptoJS.PBKDF2(passcode, salt, {
    keySize: 256 / 32,
    iterations: 1000
  }).toString();
};

// Hashes a passcode for verification
export const hashPasscode = (passcode: string): string => {
  return CryptoJS.SHA256(passcode + 'vibe-auth-salt').toString();
};

// Encrypts an object to a base64 AES-256 ciphertext
export const encryptData = (data: any, key: string): string => {
  const jsonStr = JSON.stringify(data);
  return CryptoJS.AES.encrypt(jsonStr, key).toString();
};

// Decrypts ciphertext back to an object
export const decryptData = (ciphertext: string, key: string): any | null => {
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, key);
    const decryptedStr = bytes.toString(CryptoJS.enc.Utf8);
    if (!decryptedStr) return null;
    return JSON.parse(decryptedStr);
  } catch (err) {
    return null; // Invalid key or corrupted data
  }
};
