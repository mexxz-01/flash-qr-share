import { deflateSync, inflateSync, strToU8, strFromU8 } from 'fflate';

export interface PacketMetadata {
  id: string;             // Unique transfer identifier
  totalChunks: number;    // Total chunks
  mime: string;           // MIME type (e.g. image/png, audio/mp3, text/plain)
  filename: string;       // Original filename
  originalSize: number;   // Raw uncompressed byte count
  compressed: boolean;    // Whether data was compressed with deflate
  checksum?: number;      // Simple checksum for integrity
}

export interface PacketPayload {
  v: number;              // Version (1)
  id: string;             // Transfer ID
  i: number;              // Current chunk index (0 .. n-1)
  n: number;              // Total chunks count
  d: string;              // Base64 chunk string
  m: string;              // Mime type
  fn: string;             // Filename
  s: number;              // Original size
  c: number;              // 1 if compressed, 0 if not
}

// Convert Uint8Array to base64 efficiently without stack limits
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  const chunkSize = 8192;
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return btoa(binary);
}

// Convert base64 to Uint8Array safely
export function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Generate simple 6-char transfer session ID
export function generateSessionId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < 5; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

// Slice arbitrary data (media/text) into compressed QR packets
export function preparePackets(
  data: Uint8Array | string,
  options: {
    filename?: string;
    mime?: string;
    chunkSize?: number; // In base64 characters per QR code (default ~240)
    compress?: boolean;
    customId?: string;
  } = {}
): { packets: string[]; metadata: PacketMetadata } {
  const isString = typeof data === 'string';
  const rawBytes = isString ? strToU8(data) : data;
  const originalSize = rawBytes.length;
  const filename = options.filename || (isString ? 'message.txt' : 'file.bin');
  const mime = options.mime || (isString ? 'text/plain' : 'application/octet-stream');
  const chunkSize = options.chunkSize || 220; // 220 base64 chars is ideal for rapid webcam scanning
  const shouldCompress = options.compress !== false;

  let payloadBytes = rawBytes;
  let isCompressed = false;

  if (shouldCompress) {
    try {
      const deflated = deflateSync(rawBytes, { level: 9 });
      // Only use compressed if it actually reduced size
      if (deflated.length < rawBytes.length) {
        payloadBytes = deflated;
        isCompressed = true;
      }
    } catch {
      // Fallback to uncompressed
      payloadBytes = rawBytes;
    }
  }

  const base64Data = uint8ArrayToBase64(payloadBytes);
  const totalChunks = Math.max(1, Math.ceil(base64Data.length / chunkSize));
  const transferId = options.customId || generateSessionId();

  const packets: string[] = [];

  for (let i = 0; i < totalChunks; i++) {
    const chunkSlice = base64Data.slice(i * chunkSize, (i + 1) * chunkSize);
    const packetObj: PacketPayload = {
      v: 1,
      id: transferId,
      i,
      n: totalChunks,
      d: chunkSlice,
      m: mime,
      fn: filename,
      s: originalSize,
      c: isCompressed ? 1 : 0
    };
    packets.push(JSON.stringify(packetObj));
  }

  return {
    packets,
    metadata: {
      id: transferId,
      totalChunks,
      mime,
      filename,
      originalSize,
      compressed: isCompressed
    }
  };
}

// Parse an incoming scanned QR string
export function parsePacket(rawText: string): PacketPayload | null {
  try {
    const parsed = JSON.parse(rawText);
    if (parsed && parsed.v === 1 && parsed.id && typeof parsed.i === 'number' && typeof parsed.n === 'number' && typeof parsed.d === 'string') {
      return parsed as PacketPayload;
    }
    return null;
  } catch {
    return null;
  }
}

// Reassembles received chunks into original Blob / string
export class TransferReassembler {
  public id: string = '';
  public totalChunks: number = 0;
  public mime: string = '';
  public filename: string = '';
  public originalSize: number = 0;
  public compressed: boolean = false;
  public chunks: Map<number, string> = new Map();
  public firstReceivedAt: number = 0;
  public lastReceivedAt: number = 0;
  public completed: boolean = false;

  constructor(firstPacket?: PacketPayload) {
    if (firstPacket) {
      this.initFromPacket(firstPacket);
    }
  }

  public initFromPacket(packet: PacketPayload) {
    this.id = packet.id;
    this.totalChunks = packet.n;
    this.mime = packet.m || 'application/octet-stream';
    this.filename = packet.fn || 'download';
    this.originalSize = packet.s || 0;
    this.compressed = packet.c === 1;
    this.firstReceivedAt = Date.now();
    this.lastReceivedAt = Date.now();
    this.chunks.clear();
    this.completed = false;
    this.addChunk(packet);
  }

  public addChunk(packet: PacketPayload): boolean {
    if (packet.id !== this.id) return false;
    this.lastReceivedAt = Date.now();
    
    // Update metadata if previous didn't have it
    if (!this.mime && packet.m) this.mime = packet.m;
    if (!this.filename && packet.fn) this.filename = packet.fn;
    if (!this.originalSize && packet.s) this.originalSize = packet.s;
    if (packet.c !== undefined) this.compressed = packet.c === 1;
    if (packet.n) this.totalChunks = packet.n;

    const isNew = !this.chunks.has(packet.i);
    this.chunks.set(packet.i, packet.d);

    if (this.chunks.size === this.totalChunks) {
      this.completed = true;
    }

    return isNew;
  }

  public getProgress(): number {
    if (this.totalChunks === 0) return 0;
    return Math.min(100, Math.round((this.chunks.size / this.totalChunks) * 100));
  }

  public getMissingChunkIndices(): number[] {
    const missing: number[] = [];
    for (let i = 0; i < this.totalChunks; i++) {
      if (!this.chunks.has(i)) {
        missing.push(i);
      }
    }
    return missing;
  }

  // Build the final reconstructed data
  public assemble(): {
    blob: Blob;
    objectUrl: string;
    textPreview?: string;
    size: number;
    filename: string;
    mime: string;
  } {
    if (!this.completed) {
      throw new Error(`Transfer incomplete: ${this.chunks.size}/${this.totalChunks} chunks`);
    }

    // Concatenate base64 in order
    let combinedBase64 = '';
    for (let i = 0; i < this.totalChunks; i++) {
      const part = this.chunks.get(i);
      if (part === undefined) {
        throw new Error(`Missing chunk #${i}`);
      }
      combinedBase64 += part;
    }

    const payloadBytes = base64ToUint8Array(combinedBase64);
    let finalBytes = payloadBytes;

    if (this.compressed) {
      try {
        finalBytes = inflateSync(payloadBytes);
      } catch (err) {
        console.warn('Decompression failed, using raw bytes:', err);
      }
    }

    const blob = new Blob([finalBytes as unknown as BlobPart], { type: this.mime });
    const objectUrl = URL.createObjectURL(blob);

    let textPreview: string | undefined;
    if (this.mime.startsWith('text/') || this.mime === 'application/json') {
      try {
        textPreview = strFromU8(finalBytes);
      } catch {
        // ignore
      }
    }

    return {
      blob,
      objectUrl,
      textPreview,
      size: finalBytes.byteLength,
      filename: this.filename,
      mime: this.mime
    };
  }
}
