# ⚡ FlashQR: Millisecond Optical Media & Data Transmission

> Air-gapped, high-frequency optical data transmission website that beams media and files through animated QR codes changing every millisecond (25ms – 200ms) with zero network requirement.

![FlashQR License](https://img.shields.io/badge/license-MIT-blue.svg)
![React 19](https://img.shields.io/badge/React-19.3-cyan.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)
![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-v4-teal.svg)
![Vite](https://img.shields.io/badge/Vite-8.x-purple.svg)

---

## 🌟 Overview

**FlashQR** transforms your device screen into an optical light transmitter and your webcam/camera into an optical light receiver. By compressing and partitioning arbitrary files (images, audio memos, text, documents, archives) into sequential packet frames, FlashQR streams them as rapid QR pulses at up to **40-60 FPS**.

Even when individual frames are missed by a camera sensor, the continuous looping burst matrix ensures 100% data recovery and reconstruction.

---

## 🚀 Key Features

- **Pulsing Optical Transmitter**:
  - **Custom Millisecond Frequency**: Configurable from **25ms (40 FPS)** up to **400ms**.
  - **Multi-Source Support**:
    - 📁 Any File Upload (Images, Audio, PDFs, ZIPs, arbitrary binaries).
    - 📝 Text & Secrets Editor (Keys, Passwords, Code, Markdown).
    - 🎙️ Built-in Voice Memo Recorder (speaks and beams audio optically).
    - 📷 Webcam Snapshot (snaps a photo and beams it).
    - ✨ 1-Click Presets (Vector SVG, Chiptune 8-bit Audio, Mission Brief, Satellite JSON).
  - **Deflate Compression**: Automatically compresses payloads by up to 80% with `fflate`.
  - **Pre-Rendered Canvas Buffer**: Zero frame-drop / zero GC pauses during high-frequency cycling.
  - **Shuffle & Loop Modes**: Random or sequential packet dispersal.

- **Continuous Optical Receiver**:
  - **Hardware Acceleration**: Uses browser-native `BarcodeDetector` API with fallback to `jsQR`.
  - **Real-Time Reassembly Matrix**: Visual glowing block grid that illuminates as chunks are collected.
  - **Dynamic Audio Synthesizer**: Web Audio API micro-blip tones that rise in pitch with progress, followed by a celebratory fanfare.
  - **Instant Media Previews**:
    - 🖼️ Interactive Image Viewer with download.
    - 🎵 Embedded Audio Player with auto-play.
    - 📋 Formatted Code/Text block with 1-click clipboard copy.
    - 💾 Generic file download with original filename, MIME type, and size.

- **Split Studio Mode**:
  - Test transmitter and receiver side-by-side on a single computer or display.

- **100% Air-Gapped & Offline**:
  - Zero cloud servers, Wi-Fi, or Bluetooth needed. Works in complete airplane mode.

---

## 📡 Protocol Specification (OLSP - Optical Light Stream Protocol)

Each frame is packaged into a compact JSON structure:

```json
{
  "v": 1,              // Protocol Version
  "id": "A7X9K",       // 5-Char Unique Transfer Session Token
  "i": 3,              // Packet Chunk Index (0 .. n-1)
  "n": 15,             // Total Number of Chunks
  "d": "eJzt1b0N...",  // Base64-Encoded Deflate-Compressed Data Slice
  "m": "image/png",    // File MIME Content-Type
  "fn": "photo.png",   // Original Filename
  "s": 45120,          // Raw Byte Length
  "c": 1               // 1 = Compressed, 0 = Raw
}
```

---

## 🛠️ Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or newer)
- npm or pnpm

### Installation

```bash
git clone https://github.com/mexxz-01/flash-qr-share.git
cd flash-qr-share
npm install
```

### Running Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

To test across devices (e.g. computer screen to smartphone camera), access your computer's local IP address displayed in the terminal:
```
http://<your-local-ip>:3000
```

### Production Build

```bash
npm run build
npm run preview
```

---

## 📜 License

MIT License © 2026 mexxz-01
