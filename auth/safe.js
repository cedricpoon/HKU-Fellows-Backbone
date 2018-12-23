const crypto = require('crypto');

const CIPHER_KEY = process.env.CIPHER_KEY || ' '.repeat(32); // Must be 256 bytes (32 characters)
const IV_LENGTH = 16; // For AES, this is always 16

// encryption.js by vlucas, https://gist.github.com/vlucas/2bd40f62d20c1d49237a109d491974eb
function encrypt(text) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(CIPHER_KEY), iv);
  let encrypted = cipher.update(text);

  encrypted = Buffer.concat([encrypted, cipher.final()]);

  return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
}

// encryption.js by vlucas, https://gist.github.com/vlucas/2bd40f62d20c1d49237a109d491974eb
function decrypt(text) {
  const textParts = text.split(':');
  const iv = Buffer.from(textParts.shift(), 'hex');
  const encryptedText = Buffer.from(textParts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(CIPHER_KEY), iv);
  let decrypted = decipher.update(encryptedText);

  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString();
}

function hash(plaintext) {
  return crypto.createHash('md5').update(`${plaintext};${CIPHER_KEY}`).digest('hex');
}

module.exports = { decrypt, encrypt, hash };
