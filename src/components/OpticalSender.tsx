import React, { useState, useEffect, useRef, useCallback } from 'react';
import QRCode from 'qrcode';
import { 
  Play, Pause, RotateCcw, FastForward, 
  Upload, FileText, Sparkles, 
  Maximize2, Minimize2, Check, Zap, Shuffle,
  Volume2, VolumeX, Mic, MicOff, Camera
} from 'lucide-react';
import { preparePackets, type PacketMetadata } from '../utils/protocol';
import { SAMPLE_PRESETS } from '../utils/presets';
import { sounds } from '../utils/sound';

export const OpticalSender: React.FC = () => {
  // Input State
  const [activeTab, setActiveTab] = useState<'presets' | 'file' | 'text' | 'mic' | 'camera'>('presets');
  const [selectedFile, setSelectedFile] = useState<{ name: string; mime: string; data: Uint8Array } | null>(null);
  const [customText, setCustomText] = useState<string>('Hello from Flash QR! Optical data transmission at millisecond speeds.');
  
  // Audio Recording State
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Camera Snapshot State
  const videoSnapRef = useRef<HTMLVideoElement | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);

  // Transmission Configuration
  const [speedMs, setSpeedMs] = useState<number>(80); // interval in milliseconds
  const [chunkSize, setChunkSize] = useState<number>(220); // base64 chars per packet
  const [transmissionMode, setTransmissionMode] = useState<'loop' | 'shuffle'>('loop');
  const [isTransmitting, setIsTransmitting] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Packet & Rendering State
  const [packets, setPackets] = useState<string[]>([]);
  const [metadata, setMetadata] = useState<PacketMetadata | null>(null);
  const [currentFrameIndex, setCurrentFrameIndex] = useState<number>(0);
  const [cycleCount, setCycleCount] = useState<number>(0);
  const [actualFps, setActualFps] = useState<number>(0);

  // Canvas References
  const displayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const preRenderedCanvases = useRef<HTMLCanvasElement[]>([]);
  const isPreparingRef = useRef<boolean>(false);

  // FPS calculation
  const frameCountRef = useRef<number>(0);
  const lastFpsCalcRef = useRef<number>(Date.now());

  // Generate / Load default preset initially
  useEffect(() => {
    loadPreset(SAMPLE_PRESETS[0]);
  }, []);

  // Pre-generate QR canvases whenever packets change
  const prepareCanvases = useCallback(async (packetList: string[]) => {
    if (packetList.length === 0) return;
    isPreparingRef.current = true;
    const canvases: HTMLCanvasElement[] = [];

    for (let i = 0; i < packetList.length; i++) {
      const c = document.createElement('canvas');
      c.width = 440;
      c.height = 440;
      await QRCode.toCanvas(c, packetList[i], {
        width: 440,
        margin: 1,
        color: {
          dark: '#0f172a',
          light: '#ffffff'
        },
        errorCorrectionLevel: 'M'
      });
      canvases.push(c);
    }

    preRenderedCanvases.current = canvases;
    isPreparingRef.current = false;
    setCurrentFrameIndex(0);
    setCycleCount(0);
  }, []);

  // Load a preset payload
  const loadPreset = (preset: typeof SAMPLE_PRESETS[0]) => {
    const data = preset.getData();
    setSelectedFile({
      name: preset.filename,
      mime: preset.mime,
      data
    });
    const res = preparePackets(data, {
      filename: preset.filename,
      mime: preset.mime,
      chunkSize
    });
    setPackets(res.packets);
    setMetadata(res.metadata);
    prepareCanvases(res.packets);
    sounds.playStart();
  };

  // Handle local file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        const bytes = new Uint8Array(reader.result);
        setSelectedFile({
          name: file.name,
          mime: file.type || 'application/octet-stream',
          data: bytes
        });
        const res = preparePackets(bytes, {
          filename: file.name,
          mime: file.type || 'application/octet-stream',
          chunkSize
        });
        setPackets(res.packets);
        setMetadata(res.metadata);
        prepareCanvases(res.packets);
        sounds.playStart();
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Handle custom text compilation
  const handleCompileText = () => {
    if (!customText.trim()) return;
    const encoder = new TextEncoder();
    const bytes = encoder.encode(customText);
    setSelectedFile({
      name: 'note.txt',
      mime: 'text/plain',
      data: bytes
    });
    const res = preparePackets(bytes, {
      filename: 'note.txt',
      mime: 'text/plain',
      chunkSize
    });
    setPackets(res.packets);
    setMetadata(res.metadata);
    prepareCanvases(res.packets);
    sounds.playStart();
  };

  // Re-chunk when chunkSize changes
  useEffect(() => {
    if (selectedFile) {
      const res = preparePackets(selectedFile.data, {
        filename: selectedFile.name,
        mime: selectedFile.mime,
        chunkSize
      });
      setPackets(res.packets);
      setMetadata(res.metadata);
      prepareCanvases(res.packets);
    }
  }, [chunkSize]);

  // Audio Recording Handlers
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const arrayBuf = await audioBlob.arrayBuffer();
        const bytes = new Uint8Array(arrayBuf);
        setSelectedFile({
          name: `voice-note-${Date.now().toString().slice(-4)}.webm`,
          mime: 'audio/webm',
          data: bytes
        });
        const res = preparePackets(bytes, {
          filename: `voice-note-${Date.now().toString().slice(-4)}.webm`,
          mime: 'audio/webm',
          chunkSize
        });
        setPackets(res.packets);
        setMetadata(res.metadata);
        prepareCanvases(res.packets);
        sounds.playStart();
        stream.getTracks().forEach(t => t.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Audio recording failed:', err);
      alert('Microphone access is required to record voice notes.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Snapshot Camera
  const startCamera = async () => {
    try {
      setIsCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 480, height: 480 } });
      if (videoSnapRef.current) {
        videoSnapRef.current.srcObject = stream;
        videoSnapRef.current.play();
      }
    } catch (err) {
      console.error('Camera access failed:', err);
      setIsCameraActive(false);
    }
  };

  const capturePhoto = () => {
    if (!videoSnapRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 320;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoSnapRef.current, 0, 0, 320, 320);
      canvas.toBlob((blob) => {
        if (blob) {
          blob.arrayBuffer().then(buf => {
            const bytes = new Uint8Array(buf);
            setSelectedFile({
              name: `snap-${Date.now().toString().slice(-4)}.jpg`,
              mime: 'image/jpeg',
              data: bytes
            });
            const res = preparePackets(bytes, {
              filename: `snap-${Date.now().toString().slice(-4)}.jpg`,
              mime: 'image/jpeg',
              chunkSize: Math.max(chunkSize, 280)
            });
            setPackets(res.packets);
            setMetadata(res.metadata);
            prepareCanvases(res.packets);
            sounds.playStart();
          });
        }
      }, 'image/jpeg', 0.65);
    }
    // Stop camera stream
    const stream = videoSnapRef.current.srcObject as MediaStream;
    if (stream) stream.getTracks().forEach(t => t.stop());
    setIsCameraActive(false);
  };

  // Rapid Frame Animation Loop
  useEffect(() => {
    if (!isTransmitting || packets.length === 0) return;

    let timer: NodeJS.Timeout | number;

    const tick = () => {
      setCurrentFrameIndex((prev) => {
        let next: number;
        if (transmissionMode === 'shuffle') {
          next = Math.floor(Math.random() * packets.length);
        } else {
          next = prev + 1;
          if (next >= packets.length) {
            next = 0;
            setCycleCount(c => c + 1);
          }
        }
        return next;
      });

      // Track FPS
      frameCountRef.current++;
      const now = Date.now();
      if (now - lastFpsCalcRef.current >= 1000) {
        setActualFps(Math.round((frameCountRef.current * 1000) / (now - lastFpsCalcRef.current)));
        frameCountRef.current = 0;
        lastFpsCalcRef.current = now;
      }
    };

    timer = window.setInterval(tick, speedMs);
    return () => clearInterval(timer);
  }, [isTransmitting, packets.length, speedMs, transmissionMode]);

  // Render pre-drawn canvas onto main display canvas
  useEffect(() => {
    const displayCanvas = displayCanvasRef.current;
    if (!displayCanvas) return;
    const ctx = displayCanvas.getContext('2d');
    if (!ctx) return;

    const sourceCanvas = preRenderedCanvases.current[currentFrameIndex];
    if (sourceCanvas) {
      ctx.clearRect(0, 0, displayCanvas.width, displayCanvas.height);
      ctx.drawImage(sourceCanvas, 0, 0, displayCanvas.width, displayCanvas.height);
    }
  }, [currentFrameIndex]);

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start" ref={containerRef}>
      {/* Left Column: Visual QR Broadcaster */}
      <div className="w-full lg:w-1/2 flex flex-col items-center bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
        {/* Glowing cyber pulse backdrop */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header Badge */}
        <div className="w-full flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isTransmitting ? 'bg-cyan-400 opacity-75' : 'bg-amber-400 opacity-40'}`}></span>
              <span className={`relative inline-flex rounded-full h-3 w-3 ${isTransmitting ? 'bg-cyan-500' : 'bg-amber-500'}`}></span>
            </span>
            <span className="text-xs font-mono font-semibold tracking-wider uppercase text-cyan-300">
              {isTransmitting ? 'Transmitting High-Speed QR' : 'Transmission Paused'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const next = !soundEnabled;
                setSoundEnabled(next);
                sounds.enabled = next;
              }}
              className="p-1.5 text-slate-400 hover:text-cyan-400 transition-colors rounded-lg hover:bg-slate-800"
              title={soundEnabled ? 'Mute Audio' : 'Unmute Audio'}
            >
              {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>
            <button
              onClick={toggleFullscreen}
              className="p-1.5 text-slate-400 hover:text-cyan-400 transition-colors rounded-lg hover:bg-slate-800"
              title="Fullscreen Mode"
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
          </div>
        </div>

        {/* Main Canvas Display Container */}
        <div className="relative group p-4 bg-white rounded-2xl shadow-xl flex items-center justify-center border-4 border-slate-700/50 hover:border-cyan-500/60 transition-all">
          <canvas
            ref={displayCanvasRef}
            width={380}
            height={380}
            className="w-[280px] h-[280px] sm:w-[340px] sm:h-[340px] md:w-[380px] md:h-[380px] object-contain rounded-lg"
          />

          {/* Rapid laser scanline effect */}
          {isTransmitting && (
            <div className="absolute inset-0 pointer-events-none rounded-2xl overflow-hidden">
              <div className="w-full h-2 bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent blur-sm animate-scanline" />
            </div>
          )}

          {/* Center frame counter pill overlay */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-3 py-1 bg-slate-950/85 text-cyan-300 backdrop-blur-md rounded-full text-xs font-mono border border-cyan-500/30 flex items-center gap-2 shadow-lg">
            <Zap size={13} className="text-cyan-400 animate-pulse" />
            <span>Chunk #{currentFrameIndex + 1} of {packets.length || 1}</span>
            <span className="text-slate-500">•</span>
            <span>{actualFps} FPS</span>
          </div>
        </div>

        {/* Real-time Packet Progress Matrix Indicator */}
        <div className="w-full mt-5">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-2">
            <span>PACKET TIMELINE & BURST MAP</span>
            <span className="text-cyan-400 font-semibold">Loop #{cycleCount + 1}</span>
          </div>
          <div className="flex gap-1 flex-wrap justify-center p-2.5 bg-slate-950/60 rounded-xl border border-slate-800 max-h-24 overflow-y-auto">
            {packets.map((_, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setIsTransmitting(false);
                  setCurrentFrameIndex(idx);
                }}
                className={`w-4 h-4 rounded text-[9px] font-mono flex items-center justify-center transition-all ${
                  idx === currentFrameIndex
                    ? 'bg-cyan-400 text-slate-950 font-bold scale-125 shadow-lg shadow-cyan-500/50 ring-2 ring-cyan-300'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                {idx + 1}
              </button>
            ))}
          </div>
        </div>

        {/* Speed & Controls Bar */}
        <div className="w-full mt-5 space-y-4">
          {/* Millisecond Speed Slider */}
          <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800">
            <div className="flex justify-between items-center mb-1.5">
              <div className="flex items-center gap-2">
                <FastForward size={15} className="text-cyan-400" />
                <span className="text-xs font-medium text-slate-300">Pulse Interval (Change Frequency)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-mono font-bold text-cyan-400">{speedMs} ms</span>
                <span className="text-[11px] font-mono text-slate-400">({Math.round(1000 / speedMs)} FPS)</span>
              </div>
            </div>

            <input
              type="range"
              min={25}
              max={400}
              step={5}
              value={speedMs}
              onChange={(e) => setSpeedMs(Number(e.target.value))}
              className="w-full accent-cyan-400 cursor-pointer"
            />

            <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
              <button onClick={() => setSpeedMs(30)} className="hover:text-cyan-300">Ultra (30ms)</button>
              <button onClick={() => setSpeedMs(60)} className="hover:text-cyan-300">Fast (60ms)</button>
              <button onClick={() => setSpeedMs(100)} className="hover:text-cyan-300 font-bold text-slate-300">Balanced (100ms)</button>
              <button onClick={() => setSpeedMs(200)} className="hover:text-cyan-300">Stable (200ms)</button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={() => setIsTransmitting(!isTransmitting)}
              className={`flex-1 py-2.5 px-4 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all shadow-lg ${
                isTransmitting
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                  : 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:brightness-110 shadow-cyan-500/25'
              }`}
            >
              {isTransmitting ? <><Pause size={16} /> Pause Pulse</> : <><Play size={16} /> Resume Pulse</>}
            </button>

            <button
              onClick={() => {
                setTransmissionMode(m => m === 'loop' ? 'shuffle' : 'loop');
              }}
              className={`p-2.5 rounded-xl border transition-all text-xs font-mono flex items-center gap-1.5 ${
                transmissionMode === 'shuffle'
                  ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
              title="Shuffle Mode: Randomizes chunk order to maximize transmission reception"
            >
              <Shuffle size={15} />
              <span>{transmissionMode === 'shuffle' ? 'Shuffle' : 'Loop'}</span>
            </button>

            <button
              onClick={() => {
                setCurrentFrameIndex(0);
                setCycleCount(0);
                sounds.playStart();
              }}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl transition-all"
              title="Restart from Chunk #1"
            >
              <RotateCcw size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Right Column: Media & Data Selector */}
      <div className="w-full lg:w-1/2 flex flex-col gap-5">
        {/* Navigation Tabs */}
        <div className="flex bg-slate-900 border border-slate-800 p-1.5 rounded-2xl">
          <button
            onClick={() => setActiveTab('presets')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'presets' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles size={14} /> Presets
          </button>
          <button
            onClick={() => setActiveTab('file')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'file' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Upload size={14} /> Any File
          </button>
          <button
            onClick={() => setActiveTab('text')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'text' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText size={14} /> Text/Data
          </button>
          <button
            onClick={() => setActiveTab('mic')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'mic' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Mic size={14} /> Voice
          </button>
          <button
            onClick={() => {
              setActiveTab('camera');
              startCamera();
            }}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'camera' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Camera size={14} /> Snap
          </button>
        </div>

        {/* Tab Content Panes */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
          {/* PRESETS TAB */}
          {activeTab === 'presets' && (
            <div className="space-y-3">
              <div className="text-xs font-mono text-slate-400 uppercase tracking-wider mb-2">
                Select Instant Test Payloads:
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {SAMPLE_PRESETS.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => loadPreset(item)}
                    className={`p-3.5 rounded-xl border text-left transition-all relative overflow-hidden group ${
                      metadata?.filename === item.filename
                        ? 'bg-cyan-500/15 border-cyan-500/50 shadow-md shadow-cyan-500/10'
                        : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-200 group-hover:text-cyan-300 transition-colors">
                        {item.title}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-cyan-400">
                        {item.category}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-2">
                      {item.description}
                    </p>
                    {metadata?.filename === item.filename && (
                      <div className="mt-2 text-[10px] text-cyan-400 font-mono flex items-center gap-1">
                        <Check size={12} /> Currently Transmitting
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* FILE UPLOAD TAB */}
          {activeTab === 'file' && (
            <div className="space-y-4">
              <label className="border-2 border-dashed border-slate-700 hover:border-cyan-400/60 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all bg-slate-950/50 group">
                <div className="p-3 bg-cyan-500/10 text-cyan-400 rounded-2xl mb-3 group-hover:scale-110 transition-transform">
                  <Upload size={28} />
                </div>
                <span className="text-sm font-semibold text-slate-200 mb-1">Choose any media or file to beam</span>
                <span className="text-xs text-slate-400 text-center max-w-xs">
                  Images (PNG/JPG), Audio clips, Documents, PDFs, or ZIP archives. Compressed automatically with Deflate.
                </span>
                <input
                  type="file"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              {selectedFile && (
                <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-cyan-500/20 text-cyan-300 rounded-lg">
                      <FileText size={18} />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-200">{selectedFile.name}</div>
                      <div className="text-[10px] font-mono text-slate-400">
                        {(selectedFile.data.length / 1024).toFixed(1)} KB • {selectedFile.mime}
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-mono px-2 py-1 bg-cyan-500/20 text-cyan-300 rounded-md">
                    {packets.length} QR Chunks
                  </span>
                </div>
              )}
            </div>
          )}

          {/* TEXT & DATA TAB */}
          {activeTab === 'text' && (
            <div className="space-y-3">
              <label className="text-xs font-mono text-slate-400 block">
                Type or Paste Secret Messages, API Keys, or Code:
              </label>
              <textarea
                rows={5}
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="Enter text, markdown, or JSON..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500/60"
              />
              <button
                onClick={handleCompileText}
                className="w-full py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:brightness-110 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-md"
              >
                <Zap size={14} /> Update Optical QR Stream
              </button>
            </div>
          )}

          {/* VOICE MIC TAB */}
          {activeTab === 'mic' && (
            <div className="flex flex-col items-center justify-center p-6 space-y-4">
              <div className={`p-6 rounded-full transition-all ${
                isRecording 
                  ? 'bg-rose-500/20 text-rose-400 ring-8 ring-rose-500/20 animate-pulse'
                  : 'bg-slate-950 text-cyan-400 border border-slate-800'
              }`}>
                <Mic size={36} />
              </div>
              <div className="text-center">
                <div className="text-sm font-semibold text-slate-200">
                  {isRecording ? 'Recording Voice Message...' : 'Record Voice Audio Note'}
                </div>
                <div className="text-xs text-slate-400 mt-1 max-w-xs">
                  Speak a quick voice memo. We'll compress and transmit it over optical QR code pulses!
                </div>
              </div>
              <div className="flex gap-3">
                {!isRecording ? (
                  <button
                    onClick={startRecording}
                    className="py-2.5 px-6 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-2 transition-all"
                  >
                    <Mic size={14} /> Start Voice Memo
                  </button>
                ) : (
                  <button
                    onClick={stopRecording}
                    className="py-2.5 px-6 bg-rose-500 hover:bg-rose-400 text-white font-bold rounded-xl text-xs flex items-center gap-2 transition-all animate-bounce"
                  >
                    <MicOff size={14} /> Stop & Broadcast Audio
                  </button>
                )}
              </div>
            </div>
          )}

          {/* CAMERA SNAP TAB */}
          {activeTab === 'camera' && (
            <div className="flex flex-col items-center space-y-3">
              <div className="relative w-full aspect-square max-w-[280px] bg-slate-950 rounded-xl overflow-hidden border border-slate-800">
                <video
                  ref={videoSnapRef}
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                {!isCameraActive && (
                  <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-xs">
                    Camera paused
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={capturePhoto}
                  disabled={!isCameraActive}
                  className="py-2 px-5 bg-gradient-to-r from-cyan-500 to-blue-600 disabled:opacity-50 text-white text-xs font-semibold rounded-xl flex items-center gap-2 shadow-lg"
                >
                  <Camera size={14} /> Snap & Beam Photo
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Transmission Diagnostics & Tuning Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">
              Optical Stream Diagnostics
            </span>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              ID: {metadata?.id || '----'}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            <div className="p-2.5 bg-slate-950/80 rounded-xl border border-slate-800">
              <div className="text-[10px] font-mono text-slate-500">PAYLOAD SIZE</div>
              <div className="text-xs font-mono font-bold text-slate-200">
                {metadata ? `${(metadata.originalSize / 1024).toFixed(1)} KB` : '0 KB'}
              </div>
            </div>

            <div className="p-2.5 bg-slate-950/80 rounded-xl border border-slate-800">
              <div className="text-[10px] font-mono text-slate-500">TOTAL CHUNKS</div>
              <div className="text-xs font-mono font-bold text-cyan-300">
                {metadata?.totalChunks || 0} Frames
              </div>
            </div>

            <div className="p-2.5 bg-slate-950/80 rounded-xl border border-slate-800">
              <div className="text-[10px] font-mono text-slate-500">COMPRESSION</div>
              <div className="text-xs font-mono font-bold text-emerald-400">
                {metadata?.compressed ? 'Deflate (Active)' : 'Raw (1:1)'}
              </div>
            </div>

            <div className="p-2.5 bg-slate-950/80 rounded-xl border border-slate-800">
              <div className="text-[10px] font-mono text-slate-500">EST. CYCLE TIME</div>
              <div className="text-xs font-mono font-bold text-amber-300">
                {metadata ? `${((metadata.totalChunks * speedMs) / 1000).toFixed(1)}s` : '0s'}
              </div>
            </div>
          </div>

          {/* QR Density / Chunk Size Selector */}
          <div className="pt-2 border-t border-slate-800">
            <div className="flex justify-between items-center text-xs mb-1.5">
              <span className="text-slate-400 font-mono text-[11px]">QR Module Density (Bytes Per Frame)</span>
              <span className="text-cyan-400 font-mono text-xs">{chunkSize} chars</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Low (160 B)', val: 160, desc: 'Best for low-res cameras' },
                { label: 'Medium (240 B)', val: 240, desc: 'Recommended default' },
                { label: 'High (360 B)', val: 360, desc: 'Fastest transfer' }
              ].map(opt => (
                <button
                  key={opt.val}
                  onClick={() => setChunkSize(opt.val)}
                  className={`py-1.5 px-2 rounded-lg text-xs font-mono transition-all text-left ${
                    chunkSize === opt.val
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      : 'bg-slate-950 text-slate-400 border border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="font-semibold">{opt.label}</div>
                  <div className="text-[9px] text-slate-500">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
