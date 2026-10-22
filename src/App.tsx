import { useState } from 'react';
import { OpticalSender } from './components/OpticalSender';
import { OpticalReceiver } from './components/OpticalReceiver';
import { DualModeSimulator } from './components/DualModeSimulator';
import { 
  Zap, Radio, Camera, Split, Info, ShieldCheck, 
  WifiOff, FileCheck, Cpu 
} from 'lucide-react';

export function App() {
  const [currentTab, setCurrentTab] = useState<'send' | 'receive' | 'dual' | 'docs'>('send');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-slate-950/80 border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-xl shadow-lg shadow-cyan-500/20 text-slate-950">
              <Zap size={22} className="fill-current text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold tracking-tight text-lg text-slate-100 font-mono">
                  FLASH<span className="text-cyan-400">QR</span>
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  v2.0 Pulse
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Optical Light-Speed Media & Data Transmission
              </p>
            </div>
          </div>

          {/* Navigation Pill Tabs */}
          <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setCurrentTab('send')}
              className={`py-1.5 px-3.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                currentTab === 'send'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Radio size={14} />
              <span>Transmit</span>
            </button>

            <button
              onClick={() => setCurrentTab('receive')}
              className={`py-1.5 px-3.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                currentTab === 'receive'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Camera size={14} />
              <span>Receive</span>
            </button>

            <button
              onClick={() => setCurrentTab('dual')}
              className={`py-1.5 px-3.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                currentTab === 'dual'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Split size={14} />
              <span>Split Studio</span>
            </button>

            <button
              onClick={() => setCurrentTab('docs')}
              className={`py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                currentTab === 'docs'
                  ? 'bg-slate-800 text-slate-200'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Info size={14} />
              <span className="hidden md:inline">Protocol</span>
            </button>
          </div>

          {/* Air-gap / Offline Status Pill */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1 bg-slate-900/80 border border-slate-800 rounded-full text-xs font-mono text-emerald-400">
            <WifiOff size={13} className="text-emerald-400" />
            <span>Air-Gap Ready</span>
          </div>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentTab === 'send' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-4">
              <div>
                <h1 className="text-2xl font-bold text-slate-100 font-mono flex items-center gap-2">
                  <Radio className="text-cyan-400" size={24} /> Optical Transmitter
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                  Upload files, record voice clips, or enter text. The transmitter slices and compresses data into high-speed QR pulses changing every millisecond.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                <span className="px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-lg">
                  Deflate Compression: ON
                </span>
              </div>
            </div>
            <OpticalSender />
          </div>
        )}

        {currentTab === 'receive' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-4">
              <div>
                <h1 className="text-2xl font-bold text-slate-100 font-mono flex items-center gap-2">
                  <Camera className="text-emerald-400" size={24} /> Optical Receiver
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                  Continuously scans the transmitter's rapidly changing QR codes, detects missing chunks, and automatically reconstructs the media/file.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                <span className="px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-lg">
                  Engine: Hardware BarcodeDetector + jsQR
                </span>
              </div>
            </div>
            <OpticalReceiver />
          </div>
        )}

        {currentTab === 'dual' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-4">
              <div>
                <h1 className="text-2xl font-bold text-slate-100 font-mono flex items-center gap-2">
                  <Split className="text-purple-400" size={24} /> Split-Screen Studio
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                  Run transmitter and optical receiver side-by-side on one screen or pair with a smartphone.
                </p>
              </div>
            </div>
            <DualModeSimulator />
          </div>
        )}

        {currentTab === 'docs' && (
          <div className="max-w-4xl mx-auto space-y-8 py-4">
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-bold text-slate-100 font-mono">
                Optical Light Stream Protocol (OLSP)
              </h2>
              <p className="text-sm text-slate-400">
                How Flash QR beams arbitrary files, images, voice memos, and data across screens without wireless radio signals.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
                <div className="p-3 bg-cyan-500/10 text-cyan-400 rounded-xl w-fit">
                  <Cpu size={24} />
                </div>
                <h3 className="text-sm font-bold text-slate-200">1. Compression & Chunking</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Payloads are compressed using standard Deflate algorithm (saving up to 80% size), converted into Base64 byte slices, and packaged with a compact JSON header.
                </p>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
                <div className="p-3 bg-purple-500/10 text-purple-400 rounded-xl w-fit">
                  <Zap size={24} />
                </div>
                <h3 className="text-sm font-bold text-slate-200">2. Millisecond Pulsing</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  QR canvases are pre-rendered into GPU memory buffers and cycled at user-configurable intervals (from 25ms to 200ms) with zero frame drops or GC stalls.
                </p>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
                <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl w-fit">
                  <FileCheck size={24} />
                </div>
                <h3 className="text-sm font-bold text-slate-200">3. Continuous Reassembly</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  The scanner reads frames in any arbitrary order. Even if the camera misses frames during high-speed rotation, subsequent loop cycles capture remaining chunks.
                </p>
              </div>
            </div>

            {/* Packet Specification breakdown */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <h3 className="text-sm font-bold text-cyan-300 font-mono uppercase tracking-wider">
                Packet Wire Frame Structure
              </h3>
              <pre className="bg-slate-950 p-4 rounded-xl text-xs font-mono text-cyan-400 border border-slate-800/80 overflow-x-auto">
{`{
  "v": 1,              // Protocol Version
  "id": "A7X9K",       // 5-Char Unique Transfer Session Token
  "i": 3,              // Packet Chunk Index (0 .. n-1)
  "n": 15,             // Total Number of Chunks
  "d": "eJzt1b0N...",  // Base64-Encoded Compressed Data Slice
  "m": "image/png",    // File MIME Content-Type
  "fn": "photo.png",   // Original Filename
  "s": 45120,          // Raw Byte Length
  "c": 1               // 1 = Deflate Compressed, 0 = Raw
}`}
              </pre>
            </div>

            {/* Security Benefits */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 flex items-start gap-4">
              <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
                <ShieldCheck size={28} />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-200">
                  Air-Gapped / Eavesdropping Proof Security
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Because optical QR transmission operates purely through emitted visible light photons, it cannot be intercepted by Wi-Fi packet sniffers, Bluetooth scanners, or cellular interceptors. Transmission requires direct line-of-sight between screen and camera lens.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/60 bg-slate-950/60 py-6 mt-12 text-center text-xs font-mono text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Zap size={14} className="text-cyan-400" />
            <span>FLASH-QR • Optical Air-Gapped High-Frequency Media & Data Link</span>
          </div>
          <div>
            Pure Client-Side Browser Engine • 0% Cloud Dependencies
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
