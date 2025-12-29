const crypto = require('crypto');

// Master Key for Encryption (In production, this should be outside the codebase or injected securely)
// For this request, we are embedding logic to "dehash" in code.
// We'll use a hardcoded secret salt for now to satisfy the "hash in env, dehash in code" pattern.
const ALGORITHM = 'aes-256-cbc';
const SECRET_KEY = crypto.createHash('sha256').update('MY_QUIZ_APP_SUPER_SECRET_KEY_2024').digest(); // 32 bytes
const IV_LENGTH = 16;

function encrypt(text) {
    if (!text) return text;
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, SECRET_KEY, iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text) {
    if (!text) return text;
    try {
        const textParts = text.split(':');
        // Handle unencrypted values gracefully (if they haven't been encrypted yet)
        if (textParts.length < 2) return text;

        const iv = Buffer.from(textParts.shift(), 'hex');
        const encryptedText = Buffer.from(textParts.join(':'), 'hex');
        const decipher = crypto.createDecipheriv(ALGORITHM, SECRET_KEY, iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    } catch (e) {
        console.error("Decryption failed:", e.message);
        return text; // Return original if decryption fails (fallback)
    }
}

// CLI usage if run directly
if (require.main === module) {
    const args = process.argv.slice(2);
    const command = args[0];
    const value = args[1];

    if (command === 'encrypt') {
        console.log(encrypt(value));
    } else if (command === 'decrypt') {
        console.log(decrypt(value));
    } else {
        console.log("Usage: node encryptor.js [encrypt|decrypt] [value]");
    }
}

module.exports = { encrypt, decrypt };
