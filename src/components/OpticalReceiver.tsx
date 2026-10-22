import React, { useState, useEffect, useRef, useCallback } from 'react';
import jsQR from 'jsqr';
import confetti from 'canvas-confetti';
import { 
  Camera, CameraOff, Download, CheckCircle2, AlertCircle, 
  RefreshCw, Volume2, VolumeX, Copy, Check, FileDown, 
  Music, Image as ImageIcon, FileText, Zap, ShieldCheck, Sparkles
} from 'lucide-react';
import { parsePacket, TransferReassembler } from '../utils/protocol';
import { sounds } from '../utils/sound';

interface ReceivedItem {
  id: string;
  filename: string;
  mime: string;
  size: number;
  objectUrl: string;
  textPreview?: string;
  timestamp: Date;
}

export const OpticalReceiver: React.FC = () => {
  // Camera & Stream State
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Optical Reassembler State
  const reassemblerRef = useRef<TransferReassembler>(new TransferReassembler());
  const [transferId, setTransferId] = useState<string>('');
  const [totalChunks, setTotalChunks] = useState<number>(0);
  const [receivedCount, setReceivedCount] = useState<number>(0);
  const [progressPct, setProgressPct] = useState<number>(0);
  const [missingIndices, setMissingIndices] = useState<number[]>([]);
  const [receivedSet, setReceivedSet] = useState<Set<number>>(new Set());
  const [currentFileMeta, setCurrentFileMeta] = useState<{ filename: string; mime: string; originalSize: number } | null>(null);

  // Current Completed Output & History
  const [completedItem, setCompletedItem] = useState<ReceivedItem | null>(null);
  const [history, setHistory] = useState<ReceivedItem[]>([]);
  const [hasCopiedText, setHasCopiedText] = useState<boolean>(false);

  // Scanner Stats
  const [scanFps, setScanFps] = useState<number>(0);
  const [lastScannedPacketTime, setLastScannedPacketTime] = useState<number>(0);

  // DOM references
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const barcodeDetectorRef = useRef<any>(null);

  // FPS tracking
  const scanCountRef = useRef<number>(0);
  const lastFpsCalcRef = useRef<number>(Date.now());

  // Check BarcodeDetector support
  useEffect(() => {
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      try {
        const BD = (window as any).BarcodeDetector;
        barcodeDetectorRef.current = new BD({ formats: ['qr_code'] });
      } catch (e) {
        console.warn('Native BarcodeDetector initialization skipped:', e);
      }
    }
  }, []);

  // Enumerate video devices
  const getCameraDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter(d => d.kind === 'videoinput');
      setAvailableDevices(videoInputs);
      if (videoInputs.length > 0 && !selectedDeviceId) {
        // Prefer back camera if available
        const backCam = videoInputs.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('rear') || d.label.toLowerCase().includes('environment'));
        setSelectedDeviceId(backCam ? backCam.deviceId : videoInputs[0].deviceId);
      }
    } catch (e) {
      console.warn('Could not list cameras:', e);
    }
  };

  useEffect(() => {
    getCameraDevices();
  }, []);

  // Start Camera Stream
  const startCamera = async () => {
    try {
      setCameraError(null);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }

      const constraints: MediaStreamConstraints = {
        video: selectedDeviceId 
          ? { deviceId: { exact: selectedDeviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
      }

      setIsScanning(true);
      sounds.playStart();
      getCameraDevices();
    } catch (err: any) {
      console.error('Camera access error:', err);
      setCameraError(err.message || 'Unable to access camera. Please allow camera permissions.');
      setIsScanning(false);
    }
  };

  // Stop Camera Stream
  const stopCamera = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsScanning(false);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Process a Scanned QR String
  const handleScannedString = useCallback((rawString: string) => {
    const packet = parsePacket(rawString);
    if (!packet) return;

    setLastScannedPacketTime(Date.now());
    const reasm = reassemblerRef.current;

    // Check if new transfer session
    if (reasm.id !== packet.id) {
      reasm.initFromPacket(packet);
      setTransferId(packet.id);
      setTotalChunks(packet.n);
      setCurrentFileMeta({
        filename: packet.fn || 'download',
        mime: packet.m || 'application/octet-stream',
        originalSize: packet.s || 0
      });
      setCompletedItem(null);
    }

    const isNewChunk = reasm.addChunk(packet);

    if (isNewChunk) {
      const count = reasm.chunks.size;
      const pct = reasm.getProgress();

      setReceivedCount(count);
      setProgressPct(pct);
      setMissingIndices(reasm.getMissingChunkIndices());
      setReceivedSet(new Set(reasm.chunks.keys()));

      // Play chime tone scaled by capture progress
      sounds.playBlip(count);

      // Check if reassembly completed
      if (reasm.completed) {
        try {
          const assembled = reasm.assemble();
          const item: ReceivedItem = {
            id: reasm.id,
            filename: assembled.filename,
            mime: assembled.mime,
            size: assembled.size,
            objectUrl: assembled.objectUrl,
            textPreview: assembled.textPreview,
            timestamp: new Date()
          };

          setCompletedItem(item);
          setHistory(prev => [item, ...prev]);
          sounds.playSuccess();

          // Confetti celebratory burst
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 }
          });
        } catch (assembleError) {
          console.error('Failed to assemble reconstructed payload:', assembleError);
        }
      }
    }
  }, []);

  // Continuous Camera Scanning Loop
  useEffect(() => {
    if (!isScanning) return;

    let isProcessingFrame = false;

    const scanLoop = async () => {
      const video = videoRef.current;
      if (!video || video.readyState < 2) {
        animationFrameRef.current = requestAnimationFrame(scanLoop);
        return;
      }

      // Track scan FPS
      scanCountRef.current++;
      const now = Date.now();
      if (now - lastFpsCalcRef.current >= 1000) {
        setScanFps(Math.round((scanCountRef.current * 1000) / (now - lastFpsCalcRef.current)));
        scanCountRef.current = 0;
        lastFpsCalcRef.current = now;
      }

      if (!isProcessingFrame) {
        isProcessingFrame = true;

        try {
          // Attempt 1: Native Hardware BarcodeDetector
          if (barcodeDetectorRef.current) {
            try {
              const barcodes = await barcodeDetectorRef.current.detect(video);
              if (barcodes && barcodes.length > 0) {
                for (const bc of barcodes) {
                  if (bc.rawValue) {
                    handleScannedString(bc.rawValue);
                  }
                }
              }
            } catch {
              // fallback to canvas jsQR
            }
          }

          // Attempt 2: jsQR scan via canvas
          let canvas = offscreenCanvasRef.current;
          if (!canvas) {
            canvas = document.createElement('canvas');
            offscreenCanvasRef.current = canvas;
          }

          // Scale down slightly for ultra-fast processing
          const width = Math.min(640, video.videoWidth || 640);
          const height = Math.min(480, video.videoHeight || 480);
          if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
          }

          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(video, 0, 0, width, height);
            const imageData = ctx.getImageData(0, 0, width, height);
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: 'dontInvert'
            });

            if (code && code.data) {
              handleScannedString(code.data);
            }
          }
        } catch {
          // Ignore individual frame decoding errors
        } finally {
          isProcessingFrame = false;
        }
      }

      animationFrameRef.current = requestAnimationFrame(scanLoop);
    };

    animationFrameRef.current = requestAnimationFrame(scanLoop);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [isScanning, handleScannedString]);

  // Reset transfer session
  const resetTransfer = () => {
    reassemblerRef.current = new TransferReassembler();
    setTransferId('');
    setTotalChunks(0);
    setReceivedCount(0);
    setProgressPct(0);
    setMissingIndices([]);
    setReceivedSet(new Set());
    setCurrentFileMeta(null);
    setCompletedItem(null);
  };

  // Copy text helper
  const copyText = (txt: string) => {
    navigator.clipboard.writeText(txt).then(() => {
      setHasCopiedText(true);
      setTimeout(() => setHasCopiedText(false), 2000);
    });
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start">
      {/* Left Column: Camera Scanner & HUD Viewfinder */}
      <div className="w-full lg:w-1/2 flex flex-col bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
        {/* Top Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isScanning ? 'bg-emerald-400 opacity-75' : 'bg-slate-500 opacity-40'}`}></span>
              <span className={`relative inline-flex rounded-full h-3 w-3 ${isScanning ? 'bg-emerald-500' : 'bg-slate-600'}`}></span>
            </span>
            <span className="text-xs font-mono font-semibold tracking-wider uppercase text-emerald-300">
              {isScanning ? 'Continuous Optical Scanner Active' : 'Optical Scanner Idle'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {transferId && (
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                Session: {transferId}
              </span>
            )}
            <button
              onClick={() => {
                const next = !soundEnabled;
                setSoundEnabled(next);
                sounds.enabled = next;
              }}
              className="p-1.5 text-slate-400 hover:text-emerald-400 transition-colors rounded-lg hover:bg-slate-800"
              title={soundEnabled ? 'Mute Audio' : 'Unmute Audio'}
            >
              {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>
            <button
              onClick={resetTransfer}
              className="p-1.5 text-slate-400 hover:text-emerald-400 transition-colors rounded-lg hover:bg-slate-800"
              title="Reset Transfer Session"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        {/* Viewfinder Video Frame */}
        <div className="relative aspect-video w-full bg-slate-950 rounded-2xl overflow-hidden border-2 border-slate-800 flex items-center justify-center group">
          <video
            ref={videoRef}
            playsInline
            muted
            className={`w-full h-full object-cover transition-opacity duration-300 ${isScanning ? 'opacity-100' : 'opacity-20'}`}
          />

          {/* Idle Placeholder */}
          {!isScanning && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center space-y-3 z-10 bg-slate-950/80">
              <div className="p-4 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20">
                <Camera size={36} />
              </div>
              <div className="text-sm font-semibold text-slate-200">Optical Scanner Camera Offline</div>
              <p className="text-xs text-slate-400 max-w-xs">
                Activate your camera to read rapid pulsing QR codes from another screen, monitor, or phone.
              </p>
              <button
                onClick={startCamera}
                className="py-2.5 px-6 bg-gradient-to-r from-emerald-500 to-teal-600 hover:brightness-110 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20"
              >
                <Camera size={15} /> Turn On Camera Scanner
              </button>
            </div>
          )}

          {/* HUD Target Overlays When Scanning */}
          {isScanning && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
              {/* Target Aim Box */}
              <div className="relative w-56 h-56 sm:w-64 sm:h-64 border-2 border-emerald-400/50 rounded-2xl animate-pulse-ring">
                {/* Corner reticles */}
                <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
                <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
                <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
                <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />

                {/* Laser scan line */}
                <div className="w-full h-1 bg-emerald-400/80 blur-[1px] animate-scanline" />
              </div>

              {/* Bottom scan status badge */}
              <div className="absolute bottom-4 px-3 py-1 bg-slate-950/80 text-emerald-300 backdrop-blur-md rounded-full text-xs font-mono border border-emerald-500/30 flex items-center gap-2">
                <Zap size={13} className="text-emerald-400 animate-pulse" />
                <span>Scanning at {scanFps} FPS</span>
                {lastScannedPacketTime > 0 && (
                  <>
                    <span className="text-slate-500">•</span>
                    <span className="text-slate-300">Burst Active</span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Camera Error Message */}
          {cameraError && (
            <div className="absolute inset-x-4 bottom-4 p-3 bg-rose-500/20 border border-rose-500/50 rounded-xl flex items-center gap-2 text-rose-300 text-xs">
              <AlertCircle size={16} />
              <span>{cameraError}</span>
            </div>
          )}
        </div>

        {/* Camera Selector & Toggle */}
        <div className="flex flex-col sm:flex-row items-center gap-3 mt-4">
          {availableDevices.length > 1 && (
            <select
              value={selectedDeviceId}
              onChange={(e) => {
                setSelectedDeviceId(e.target.value);
                if (isScanning) startCamera();
              }}
              className="w-full sm:w-auto flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-300 focus:outline-none"
            >
              {availableDevices.map((dev, idx) => (
                <option key={dev.deviceId || idx} value={dev.deviceId}>
                  {dev.label || `Camera ${idx + 1}`}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={isScanning ? stopCamera : startCamera}
            className={`w-full sm:w-auto py-2 px-5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
              isScanning
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30'
                : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold'
            }`}
          >
            {isScanning ? <><CameraOff size={15} /> Stop Camera</> : <><Camera size={15} /> Start Camera</>}
          </button>
        </div>

        {/* Real-Time Packet Collector Grid Matrix */}
        <div className="w-full mt-5 bg-slate-950/70 p-4 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-xs font-mono mb-2">
            <span className="text-slate-400">CHUNK REASSEMBLY MATRIX</span>
            <span className="text-emerald-400 font-bold">
              {receivedCount} / {totalChunks || 0} ({progressPct}%)
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden mb-3">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-all duration-150"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          {/* Matrix visual blocks */}
          {totalChunks > 0 ? (
            <div className="flex gap-1 flex-wrap justify-center max-h-24 overflow-y-auto p-1">
              {Array.from({ length: totalChunks }).map((_, idx) => {
                const isCaptured = receivedSet.has(idx);
                return (
                  <div
                    key={idx}
                    className={`w-4 h-4 rounded text-[9px] font-mono flex items-center justify-center transition-all ${
                      isCaptured
                        ? 'bg-emerald-400 text-slate-950 font-bold scale-105 shadow-sm shadow-emerald-500/50'
                        : 'bg-slate-800 text-slate-500 border border-slate-700/50'
                    }`}
                  >
                    {idx + 1}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-4 text-xs font-mono text-slate-500">
              Point camera at pulsing QR codes to begin packet capture
            </div>
          )}

          {/* Missing Chunks indicator */}
          {totalChunks > 0 && missingIndices.length > 0 && !completedItem && (
            <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono">
              <span className="text-slate-400">Waiting for chunks:</span>
              <span className="text-amber-400">
                {missingIndices.slice(0, 8).map(i => `#${i + 1}`).join(', ')}
                {missingIndices.length > 8 ? ` +${missingIndices.length - 8} more` : ''}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Reconstructed Media & Data Output */}
      <div className="w-full lg:w-1/2 flex flex-col gap-5">
        {/* COMPLETED MEDIA VIEWER */}
        {completedItem ? (
          <div className="bg-slate-900 border-2 border-emerald-500/50 rounded-2xl p-6 shadow-2xl space-y-5 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 pointer-events-none opacity-20 text-emerald-400">
              <Sparkles size={96} />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                <CheckCircle2 size={20} />
                <span>Media Successfully Reconstructed!</span>
              </div>
              <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                ID: {completedItem.id}
              </span>
            </div>

            {/* Media Rendering Depending on MIME */}
            <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 flex flex-col items-center justify-center">
              {/* IMAGE MEDIA */}
              {completedItem.mime.startsWith('image/') && (
                <div className="space-y-3 w-full flex flex-col items-center">
                  <div className="max-h-72 w-full flex items-center justify-center overflow-hidden rounded-xl bg-slate-900/50 p-2">
                    <img
                      src={completedItem.objectUrl}
                      alt={completedItem.filename}
                      className="max-h-64 object-contain rounded-lg shadow-lg"
                    />
                  </div>
                  <div className="text-xs font-mono text-slate-400">
                    {completedItem.filename} • {(completedItem.size / 1024).toFixed(1)} KB
                  </div>
                </div>
              )}

              {/* AUDIO MEDIA */}
              {completedItem.mime.startsWith('audio/') && (
                <div className="w-full space-y-4 py-4 flex flex-col items-center">
                  <div className="p-4 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20 animate-pulse">
                    <Music size={36} />
                  </div>
                  <div className="text-sm font-semibold text-slate-200">
                    {completedItem.filename}
                  </div>
                  <audio
                    src={completedItem.objectUrl}
                    controls
                    autoPlay
                    className="w-full rounded-lg"
                  />
                  <div className="text-xs font-mono text-slate-400">
                    Audio Format: {completedItem.mime} • {(completedItem.size / 1024).toFixed(1)} KB
                  </div>
                </div>
              )}

              {/* TEXT OR JSON MEDIA */}
              {(completedItem.mime.startsWith('text/') || completedItem.mime === 'application/json') && (
                <div className="w-full space-y-3">
                  <div className="flex justify-between items-center text-xs font-mono text-slate-400">
                    <span>{completedItem.filename}</span>
                    <button
                      onClick={() => copyText(completedItem.textPreview || '')}
                      className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 transition-colors"
                    >
                      {hasCopiedText ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy Content</>}
                    </button>
                  </div>
                  <pre className="w-full max-h-56 overflow-auto p-3 bg-slate-900/90 rounded-xl text-xs font-mono text-slate-200 whitespace-pre-wrap border border-slate-800">
                    {completedItem.textPreview}
                  </pre>
                </div>
              )}

              {/* GENERIC BINARY / OTHER FILE */}
              {!completedItem.mime.startsWith('image/') && !completedItem.mime.startsWith('audio/') && !completedItem.mime.startsWith('text/') && completedItem.mime !== 'application/json' && (
                <div className="w-full py-6 flex flex-col items-center space-y-3">
                  <div className="p-4 bg-cyan-500/10 text-cyan-400 rounded-full border border-cyan-500/20">
                    <FileDown size={36} />
                  </div>
                  <div className="text-sm font-semibold text-slate-200">
                    {completedItem.filename}
                  </div>
                  <div className="text-xs font-mono text-slate-400">
                    File Type: {completedItem.mime} • {(completedItem.size / 1024).toFixed(1)} KB
                  </div>
                </div>
              )}
            </div>

            {/* Download Action Button */}
            <div className="flex gap-3">
              <a
                href={completedItem.objectUrl}
                download={completedItem.filename}
                className="flex-1 py-3 px-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:brightness-110 text-slate-950 font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 transition-all"
              >
                <Download size={16} /> Save / Download File ({ (completedItem.size / 1024).toFixed(1) } KB)
              </a>
              <button
                onClick={resetTransfer}
                className="py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-semibold transition-all"
              >
                Scan Next File
              </button>
            </div>
          </div>
        ) : (
          /* Empty / Waiting state */
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="text-xs font-mono text-slate-400 uppercase tracking-wider">
              Incoming Stream Buffer
            </div>

            <div className="p-8 border-2 border-dashed border-slate-800 rounded-xl flex flex-col items-center justify-center text-center space-y-3">
              <div className="p-3 bg-slate-950 text-slate-500 rounded-full border border-slate-800">
                <Zap size={28} />
              </div>
              <div className="text-sm font-semibold text-slate-300">
                {currentFileMeta ? `Receiving "${currentFileMeta.filename}"...` : 'Awaiting Optical Transmission'}
              </div>
              <p className="text-xs text-slate-400 max-w-xs">
                {currentFileMeta
                  ? `Capturing ${receivedCount} of ${totalChunks} packets. Keep camera focused on the flashing QR code.`
                  : 'Point this camera at the Sender screen. The receiver will automatically lock onto the rapid QR pulses and reassemble the file in real-time.'}
              </p>
            </div>

            <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800/80 text-xs text-slate-400 space-y-2">
              <div className="flex items-center gap-2 text-slate-300 font-semibold">
                <ShieldCheck size={16} className="text-cyan-400" />
                <span>100% Air-Gapped Optical Data Transfer</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Data travels through light photons between screens and cameras. Zero Wi-Fi, Bluetooth, or internet connection required for air-gapped security.
              </p>
            </div>
          </div>
        )}

        {/* History Log of Received Items */}
        {history.length > 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">
                Session Reception History ({history.length})
              </span>
              <button
                onClick={() => setHistory([])}
                className="text-[10px] font-mono text-slate-500 hover:text-slate-300"
              >
                Clear History
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {history.map((item, idx) => (
                <div
                  key={`${item.id}-${idx}`}
                  className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl flex items-center justify-between hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-slate-800 text-emerald-400 rounded-lg">
                      {item.mime.startsWith('image/') ? <ImageIcon size={15} /> : item.mime.startsWith('audio/') ? <Music size={15} /> : <FileText size={15} />}
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-200">{item.filename}</div>
                      <div className="text-[10px] font-mono text-slate-400">
                        {(item.size / 1024).toFixed(1)} KB • {item.timestamp.toLocaleTimeString()}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <a
                      href={item.objectUrl}
                      download={item.filename}
                      className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
                      title="Download"
                    >
                      <Download size={14} />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
