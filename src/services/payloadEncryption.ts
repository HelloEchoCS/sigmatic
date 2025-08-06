import * as crypto from "crypto";
import * as zlib from "zlib";
import { promisify } from "util";

// Promisify zlib functions for async/await
const gunzip = promisify(zlib.gunzip);

/**
 * Interface for the encrypted request payload
 */
interface EncryptedPayload {
  ctr: string; // Base64-encoded RSA-encrypted AES counter
  et_payload: string; // Base64-encoded AES-encrypted and compressed data
}

/**
 * Interface for encryption metadata stored between request/response
 */
interface EncryptionMetadata {
  counter: Buffer;
  aesKey: string;
  timestamp: string;
}

/**
 * Interface for AES encryption result
 */
interface AESEncryptionResult {
  counter: Buffer;
  encrypted: Buffer;
}

/**
 * Configuration options for PayloadEncryption
 */
interface EncryptionConfig {
  rsaPublicKeyPem: string;
}

/**
 * Client-side payload encryption system for communicating with encrypted API endpoints
 * Uses AES-CTR + RSA-OAEP hybrid encryption with gzip compression
 * Only handles client-side encryption/decryption - server handles its own operations
 */
export class PayloadEncryption {
  private readonly rsaPublicKeyPem: string;
  public lastEncryptionMetadata?: EncryptionMetadata;

  constructor(config: EncryptionConfig) {
    this.rsaPublicKeyPem = config.rsaPublicKeyPem;
  }

  // ===============================
  // UTILITY FUNCTIONS
  // ===============================

  /**
   * Generate 10-digit Unix timestamp (seconds)
   */
  private generateTimestamp(): string {
    return Math.floor(Date.now() / 1000).toString();
  }

  /**
   * Normalize AES key to exactly 16 bytes (pad with '*' or truncate)
   */
  private normalizeAESKey(keyString: string): Buffer {
    const normalized = keyString.padEnd(16, "*").slice(0, 16);
    return Buffer.from(normalized, "utf8");
  }

  /**
   * Convert bytes to UTF-8 string
   */
  private bytesToString(buffer: Buffer): string {
    return buffer.toString("utf8");
  }

  // ===============================
  // ENCRYPTION FUNCTIONS
  // ===============================

  /**
   * Encrypt payload with AES-CTR
   */
  private async encryptPayloadAES(
    data: Buffer | string | object,
    aesKeyString: string,
  ): Promise<AESEncryptionResult> {
    // Convert data to buffer
    let dataBuffer: Buffer;
    if (Buffer.isBuffer(data)) {
      dataBuffer = data;
    } else if (typeof data === "string") {
      dataBuffer = Buffer.from(data, "utf8");
    } else {
      dataBuffer = Buffer.from(JSON.stringify(data), "utf8");
    }

    // Normalize AES key to 16 bytes
    const aesKey = this.normalizeAESKey(aesKeyString);

    // Generate random 16-byte counter for AES-CTR
    const counter = crypto.randomBytes(16);

    // Create AES-CTR cipher
    const cipher = crypto.createCipheriv("aes-128-ctr", aesKey, counter);

    // Encrypt the data
    const encrypted = Buffer.concat([
      cipher.update(dataBuffer),
      cipher.final(),
    ]);

    return {
      counter,
      encrypted,
    };
  }

  /**
   * Encrypt AES counter with RSA-OAEP
   */
  private async encryptCounterRSA(counter: Buffer): Promise<Buffer> {
    if (!this.rsaPublicKeyPem) {
      throw new Error("RSA public key is required for counter encryption");
    }

    // Encrypt with RSA-OAEP
    const encryptedCounter = crypto.publicEncrypt(
      {
        key: this.rsaPublicKeyPem,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha1",
      },
      counter,
    );

    return encryptedCounter;
  }

  /**
   * Main request encryption function
   * Returns encrypted payload ready for transmission
   */
  public async encryptRequest(
    requestData: object,
    aesKeyString: string,
  ): Promise<EncryptedPayload> {
    try {
      // 1. Generate timestamp
      const timestamp = this.generateTimestamp();

      // 2. Add timestamp to payload
      const payloadWithTimestamp = {
        ...requestData,
        hs_request_timestamp: timestamp,
      };

      // 3. Convert to JSON (NO compression for requests, just like browser implementation)
      const jsonString = JSON.stringify(payloadWithTimestamp);

      // 4. Encrypt JSON directly with AES-CTR (no compression step)
      const aesResult = await this.encryptPayloadAES(jsonString, aesKeyString);

      // 5. Encrypt the AES counter with RSA-OAEP
      const encryptedCounter = await this.encryptCounterRSA(aesResult.counter);

      // 6. Store decryption metadata for later use
      this.lastEncryptionMetadata = {
        counter: aesResult.counter,
        aesKey: aesKeyString,
        timestamp,
      };

      // 7. Return encrypted payload ready for transmission
      return {
        ctr: encryptedCounter.toString("base64"),
        et_payload: aesResult.encrypted.toString("base64"),
      };
    } catch (error) {
      console.error("Request encryption failed:", error);
      throw error;
    }
  }

  // ===============================
  // DECRYPTION FUNCTIONS
  // ===============================

  /**
   * Decrypt response data with AES-CTR
   */
  private async decryptResponseAES(
    encryptedData: string,
    aesKeyString: string,
    counter: Buffer,
  ): Promise<Buffer> {
    // Decode base64 encrypted data
    const encryptedBuffer = Buffer.from(encryptedData, "base64");

    // Normalize AES key
    const aesKey = this.normalizeAESKey(aesKeyString);

    // Create AES-CTR decipher with the same counter used for encryption
    const decipher = crypto.createDecipheriv("aes-128-ctr", aesKey, counter);

    // Decrypt the data
    const decrypted = Buffer.concat([
      decipher.update(encryptedBuffer),
      decipher.final(),
    ]);

    return decrypted;
  }

  /**
   * Decompress decrypted data using gzip
   */
  private async decompressData(compressedData: Buffer): Promise<Buffer> {
    try {
      const decompressed = await gunzip(compressedData);
      return decompressed;
    } catch (error) {
      console.error("Gzip decompression failed:", error);
      throw error;
    }
  }

  /**
   * Main response decryption function
   * Takes encrypted response data and returns decrypted JSON
   */
  public async decryptResponse<T = any>(
    encryptedResponseData: string,
  ): Promise<T> {
    if (!this.lastEncryptionMetadata) {
      throw new Error(
        "No encryption metadata available. Must encrypt a request first.",
      );
    }

    try {
      // 1. Decrypt with AES-CTR using stored key and counter
      const decryptedData = await this.decryptResponseAES(
        encryptedResponseData,
        this.lastEncryptionMetadata.aesKey,
        this.lastEncryptionMetadata.counter,
      );

      // 2. Decompress the decrypted data
      const decompressedData = await this.decompressData(decryptedData);

      // 3. Convert bytes to string and parse JSON
      const responseString = this.bytesToString(decompressedData);
      const responseJson: T = JSON.parse(responseString);

      return responseJson;
    } catch (error) {
      console.error("Response decryption failed:", error);
      throw error;
    }
  }

  // ===============================
  // UTILITY METHODS
  // ===============================

  /**
   * Get current encryption metadata (useful for debugging)
   */
  public getLastEncryptionMetadata(): EncryptionMetadata | undefined {
    return this.lastEncryptionMetadata;
  }

  /**
   * Clear encryption metadata (for security/cleanup)
   */
  public clearEncryptionMetadata(): void {
    this.lastEncryptionMetadata = undefined;
  }
}

// ===============================
// TYPE DEFINITIONS FOR COMMON USE CASES
// ===============================

/**
 * Common request data structure
 */
export interface RequestData {
  [key: string]: any;
  hs_request_timestamp?: string; // Added automatically during encryption
}

/**
 * Example API response structure
 */
export interface ApiResponse<T = any> {
  status: number;
  data: T;
  message?: string;
}

// ===============================
// BROWSER COMPATIBILITY NOTES
// ===============================

/*
CLIENT-SIDE ONLY IMPLEMENTATION:

This implementation mirrors the original browser code and only handles:
- Request encryption (client → server)
- Response decryption (server → client)

The server handles:
- Decrypting the RSA-encrypted counter with its private key
- Processing the request
- Encrypting the response using the same AES counter
- Sending back encrypted response data

CLIENT RESPONSIBILITIES:
1. Encrypt requests: Data → JSON → AES-CTR → RSA counter encryption → Base64
2. Decrypt responses: Base64 → AES-CTR → Gzip decompress → JSON

SERVER RESPONSIBILITIES (not implemented here):
1. Decrypt RSA counter with private key
2. Decrypt request payload with AES-CTR
3. Process business logic
4. Compress response data with gzip
5. Encrypt compressed response with same AES counter
6. Send encrypted response

IMPORTANT: COMPRESSION DIFFERENCE:
- REQUEST: NO compression (Data → JSON → AES-CTR)
- RESPONSE: WITH compression (Data → JSON → Gzip → AES-CTR)

SECURITY FLOW:
- Client generates random AES counter per request
- Client encrypts counter with server's RSA public key
- Server decrypts counter with RSA private key
- Both sides use same counter for AES-CTR encryption/decryption
- Perfect Forward Secrecy via unique counter per request
*/

// Uncomment to run the typed demonstration
// demonstrateTypedFlow();
