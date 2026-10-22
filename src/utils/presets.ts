// Generates sample payloads for instant testing without needing external files

// Helper to create a small 8-bit style WAV audio in memory
function createSampleWavAudio(): Uint8Array {
  const sampleRate = 8000;
  const duration = 1.8; // seconds
  const numSamples = Math.floor(sampleRate * duration);
  const headerSize = 44;
  const buffer = new Uint8Array(headerSize + numSamples);

  // RIFF header
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) buffer[offset + i] = str.charCodeAt(i);
  };
  const writeUint32 = (offset: number, val: number) => {
    buffer[offset] = val & 0xff;
    buffer[offset + 1] = (val >> 8) & 0xff;
    buffer[offset + 2] = (val >> 16) & 0xff;
    buffer[offset + 3] = (val >> 24) & 0xff;
  };
  const writeUint16 = (offset: number, val: number) => {
    buffer[offset] = val & 0xff;
    buffer[offset + 1] = (val >> 8) & 0xff;
  };

  writeString(0, 'RIFF');
  writeUint32(4, 36 + numSamples);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  writeUint32(16, 16); // Subchunk1Size
  writeUint16(20, 1);  // AudioFormat: PCM
  writeUint16(22, 1);  // NumChannels: 1 (mono)
  writeUint32(24, sampleRate);
  writeUint32(28, sampleRate); // ByteRate
  writeUint16(32, 1);  // BlockAlign
  writeUint16(34, 8);  // BitsPerSample: 8-bit
  writeString(36, 'data');
  writeUint32(40, numSamples);

  // Generate a retro arpeggio
  const frequencies = [440, 554.37, 659.25, 880, 659.25, 554.37];
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const noteIndex = Math.floor((t * 6) % frequencies.length);
    const freq = frequencies[noteIndex];
    // 8-bit unsigned PCM: 0-255, center at 128
    const val = 128 + Math.floor(100 * Math.sin(2 * Math.PI * freq * t) * Math.exp(-((t * 6) % 1) * 2));
    buffer[headerSize + i] = Math.max(0, Math.min(255, val));
  }

  return buffer;
}

// Small SVG avatar badge
const SAMPLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
  <defs>
    <linearGradient id="cyber" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#06b6d4" />
      <stop offset="50%" stop-color="#3b82f6" />
      <stop offset="100%" stop-color="#8b5cf6" />
    </linearGradient>
  </defs>
  <rect width="160" height="160" rx="32" fill="#0f172a" stroke="url(#cyber)" stroke-width="4"/>
  <circle cx="80" cy="80" r="50" fill="none" stroke="#06b6d4" stroke-width="2" stroke-dasharray="4 4" />
  <polygon points="80,45 105,95 55,95" fill="url(#cyber)"/>
  <circle cx="80" cy="78" r="8" fill="#ffffff" />
  <text x="80" y="132" fill="#38bdf8" font-family="monospace" font-size="11" font-weight="bold" text-anchor="middle">FLASH-QR</text>
</svg>`;

export const SAMPLE_PRESETS = [
  {
    id: 'cyber-art',
    title: 'Cyberpunk SVG Vector',
    category: 'Media (Image)',
    filename: 'cyber-badge.svg',
    mime: 'image/svg+xml',
    getData: () => new TextEncoder().encode(SAMPLE_SVG),
    description: 'Vector graphic badge transmitted over animated QR pulses.'
  },
  {
    id: 'audio-tune',
    title: '8-Bit Synth Sound',
    category: 'Media (Audio)',
    filename: 'chiptune.wav',
    mime: 'audio/wav',
    getData: () => createSampleWavAudio(),
    description: 'Chiptune arpeggio audio synthesized and beamed optically.'
  },
  {
    id: 'secret-note',
    title: 'Quantum Mission Brief',
    category: 'Text & Keys',
    filename: 'mission-brief.txt',
    mime: 'text/plain',
    getData: () => new TextEncoder().encode(
`[TOP SECRET // OPTICAL AIR-GAP TRANSMISSION]
Timestamp: ${new Date().toISOString()}
Agent: Zero-One
Status: Target Acquired

Transfer Protocol: Rapid Animated QR Code Pulse
Security: Offline / Air-Gapped Optical Transfer
Payload Integrity: 100% Verified

"The future is already here — it's just not evenly distributed."`
    ),
    description: 'Air-gapped text brief with timestamp and cryptographic header.'
  },
  {
    id: 'telemetry-json',
    title: 'Satellite Telemetry Data',
    category: 'Structured Data',
    filename: 'telemetry.json',
    mime: 'application/json',
    getData: () => new TextEncoder().encode(
      JSON.stringify({
        source: 'Orbital-Array-7',
        status: 'OPERATIONAL',
        orbit_altitude_km: 540.2,
        velocity_km_s: 7.61,
        sensors: {
          optical_lux: 12480,
          temperature_c: -42.8,
          battery_pct: 94.6,
          link_frequency_ghz: 28.5
        },
        payload_hash: '0x8f2d4e91ab37c'
      }, null, 2)
    ),
    description: 'Formatted JSON object with satellite telemetry measurements.'
  }
];
