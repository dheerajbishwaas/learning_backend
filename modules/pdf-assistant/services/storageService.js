// d:\NODEJS\tutohub\learning_backend\modules\pdf-assistant\services\storageService.js
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const dotenv = require('dotenv');
dotenv.config();

// Private storage directory (NEVER served by express.static)
const PRIVATE_STORAGE_DIR = process.env.PDF_STORAGE_DIR || path.join(__dirname, '../../../../storage/pdf_documents');

if (!fs.existsSync(PRIVATE_STORAGE_DIR)) {
  fs.mkdirSync(PRIVATE_STORAGE_DIR, { recursive: true });
}

class StorageService {
  constructor() {
    this.driver = process.env.PDF_STORAGE_DRIVER || 'local'; // 'local' or 's3'

    const envKey = process.env.PDF_ENCRYPTION_KEY;
    if (envKey) {
      const keyBuffer = Buffer.from(envKey, 'hex');
      if (keyBuffer.length !== 32) {
        throw new Error(`[StorageService] PDF_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). Received ${keyBuffer.length} bytes.`);
      }
      this.encryptionKey = keyBuffer;
    } else {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('[StorageService] FATAL: PDF_ENCRYPTION_KEY is required in production. Automatic key generation or fallback is disallowed.');
      }
      // Deterministic fallback for local test/dev environments only
      this.encryptionKey = crypto.createHash('sha256').update(process.env.JWT_SECRET || 'tutohub_pdf_secret_salt').digest();
    }
  }

  // Encrypt buffer before storing at rest using AES-256-GCM
  _encrypt(buffer) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
    const tag = cipher.getAuthTag();
    // Payload format: [12 bytes IV][16 bytes AuthTag][Encrypted data]
    return Buffer.concat([iv, tag, encrypted]);
  }

  // Decrypt buffer when reading from storage
  _decrypt(encryptedBuffer) {
    if (encryptedBuffer.length < 28) {
      throw new Error('Encrypted file format invalid or corrupted');
    }
    const iv = encryptedBuffer.subarray(0, 12);
    const tag = encryptedBuffer.subarray(12, 28);
    const ciphertext = encryptedBuffer.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(tag);
    try {
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    } catch (err) {
      throw new Error(`Failed to decrypt document: ${err.message}. Encryption key may have changed or file is corrupted.`);
    }
  }

  async saveFile(buffer, ownerKey, originalName) {
    const ext = path.extname(originalName) || '.pdf';
    const uniqueId = crypto.randomBytes(16).toString('hex');
    const filename = `${uniqueId}${ext}.enc`;

    // Partition by owner key to prevent flat directory performance issues
    const sanitizedOwner = ownerKey.replace(/[^a-zA-Z0-9_-]/g, '_');
    const relativeDir = path.join(sanitizedOwner);
    const absoluteDir = path.join(PRIVATE_STORAGE_DIR, relativeDir);

    if (!fs.existsSync(absoluteDir)) {
      fs.mkdirSync(absoluteDir, { recursive: true });
    }

    const relativePath = path.join(relativeDir, filename);
    const absolutePath = path.join(PRIVATE_STORAGE_DIR, relativePath);

    const encryptedData = this._encrypt(buffer);
    await fs.promises.writeFile(absolutePath, encryptedData);

    return relativePath;
  }

  async getFileStream(storageKey) {
    const absolutePath = path.join(PRIVATE_STORAGE_DIR, storageKey);
    if (!fs.existsSync(absolutePath)) {
      throw new Error('File not found in storage');
    }
    const encryptedData = await fs.promises.readFile(absolutePath);
    const decryptedData = this._decrypt(encryptedData);
    
    const { Readable } = require('stream');
    return Readable.from(decryptedData);
  }

  async getFileBuffer(storageKey) {
    const absolutePath = path.join(PRIVATE_STORAGE_DIR, storageKey);
    if (!fs.existsSync(absolutePath)) {
      throw new Error('File not found in storage');
    }
    const encryptedData = await fs.promises.readFile(absolutePath);
    return this._decrypt(encryptedData);
  }

  async deleteFile(storageKey) {
    try {
      const absolutePath = path.join(PRIVATE_STORAGE_DIR, storageKey);
      if (fs.existsSync(absolutePath)) {
        await fs.promises.unlink(absolutePath);
      }
    } catch (err) {
      console.error(`Storage deletion failed for ${storageKey}:`, err.message);
    }
  }
}

module.exports = new StorageService();
