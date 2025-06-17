import CryptoJS from 'crypto-js';

const ENCRYPTION_KEY = process.env.REACT_APP_ENCRYPTION_KEY || 'your-encryption-key';

export function encrypt(data) {
  try {
    const json = JSON.stringify(data);
    return CryptoJS.AES.encrypt(json, ENCRYPTION_KEY).toString();
  } catch (error) {
    console.error('Encryption error:', error);
    return null;
  }
}

export function decrypt(encryptedData) {
  try {
    if (!encryptedData) return null;
    const bytes = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY);
    return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
  } catch (error) {
    console.error('Decryption error:', error);
    return null;
  }
}
