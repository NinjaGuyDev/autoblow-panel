/**
 * Token encryption using Web Crypto API (AES-GCM with PBKDF2 key derivation).
 *
 * Security model: This provides protection against generic XSS scrapers reading
 * raw localStorage. It is NOT meant to resist targeted attacks since the
 * password is hardcoded in the app.
 *
 * For a local-only app with no user accounts, this strikes a balance between
 * usability (transparent to user) and security (encrypted at rest).
 */

const SALT_KEY = 'autoblow-token-salt';
const IV_KEY = 'autoblow-token-iv';
const TOKEN_KEY = 'autoblow-device-token';

// App-level password for key derivation (not user-facing)
const APP_PASSWORD = 'autoblow-panel-v1';

// PBKDF2 iterations (100k is OWASP recommendation for 2023+)
const PBKDF2_ITERATIONS = 100000;

/**
 * Converts ArrayBuffer to base64 string for localStorage storage
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Converts base64 string back to ArrayBuffer
 */
function base64ToArrayBuffer(base64: string | null): ArrayBuffer | null {
  if (!base64) return null;
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  } catch {
    return null;
  }
}

/**
 * Derives AES-GCM key from password and salt using PBKDF2
 */
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts device token and stores in localStorage.
 * Generates fresh IV for each encryption operation (critical for AES-GCM security).
 */
export async function encryptToken(token: string): Promise<void> {
  // Generate or retrieve salt (salt can be reused, but IV cannot)
  let salt: Uint8Array;
  const storedSalt = localStorage.getItem(SALT_KEY);

  if (storedSalt) {
    const saltBuffer = base64ToArrayBuffer(storedSalt);
    salt = saltBuffer ? new Uint8Array(saltBuffer) : crypto.getRandomValues(new Uint8Array(16));
  } else {
    salt = crypto.getRandomValues(new Uint8Array(16));
    localStorage.setItem(SALT_KEY, arrayBufferToBase64(salt.buffer as ArrayBuffer));
  }

  // Generate fresh IV (NEVER reuse IV with same key)
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 12 bytes for AES-GCM

  // Derive key and encrypt
  const key = await deriveKey(APP_PASSWORD, salt);
  const encodedToken = new TextEncoder().encode(token);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encodedToken
  );

  // Store ciphertext and IV (both needed for decryption)
  localStorage.setItem(TOKEN_KEY, arrayBufferToBase64(ciphertext));
  localStorage.setItem(IV_KEY, arrayBufferToBase64(iv.buffer as ArrayBuffer));
}

/**
 * Decrypts device token from localStorage.
 * Returns null if decryption fails or no token stored.
 */
export async function decryptToken(): Promise<string | null> {
  const storedCiphertext = localStorage.getItem(TOKEN_KEY);
  const storedIv = localStorage.getItem(IV_KEY);
  const storedSalt = localStorage.getItem(SALT_KEY);

  if (!storedCiphertext || !storedIv || !storedSalt) {
    return null;
  }

  try {
    const ciphertext = base64ToArrayBuffer(storedCiphertext);
    const iv = base64ToArrayBuffer(storedIv);
    const salt = base64ToArrayBuffer(storedSalt);

    if (!ciphertext || !iv || !salt) {
      return null;
    }

    const key = await deriveKey(APP_PASSWORD, new Uint8Array(salt));
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(iv) },
      key,
      ciphertext
    );

    return new TextDecoder().decode(decrypted);
  } catch (error) {
    console.warn('[Token Encryption] Decryption failed:', error);
    return null;
  }
}

/**
 * Removes all encrypted token data from localStorage
 */
export function clearEncryptedToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(IV_KEY);
  localStorage.removeItem(SALT_KEY);
}
