import React, { useState, useEffect } from 'react';
import { OpticalSender } from './OpticalSender';
import { OpticalReceiver } from './OpticalReceiver';
import { ArrowLeftRight, Radio, Laptop, Smartphone } from 'lucide-react';

export const DualModeSimulator: React.FC = () => {
  const [localIp, setLocalIp] = useState<string>('');

  useEffect(() => {
    // Detect host origin for cross-device mobile sharing
    if (typeof window !== 'undefined') {
      const host = window.location.host;
      setLocalIp(`${window.location.protocol}//${host}`);
    }
  }, []);

  return (
    <div className="space-y-6">
      {/* Informative Guidance Banner */}
      <div className="p-4 bg-gradient-to-r from-cyan-950/40 via-slate-900 to-emerald-950/40 border border-slate-800 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-cyan-500/10 text-cyan-400 rounded-xl border border-cyan-500/20">
            <Radio size={20} className="animate-pulse" />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-200">
              Cross-Device Optical Beam (Two Devices or Split Testing)
            </div>
            <div className="text-xs text-slate-400">
              Open <code className="bg-slate-950 px-2 py-0.5 rounded text-cyan-300 font-mono">{localIp || 'this URL'}</code> on your mobile phone or second screen to scan across devices.
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
          <div className="flex items-center gap-1.5">
            <Laptop size={14} className="text-cyan-400" />
            <span>Screen 1: Transmit</span>
          </div>
          <ArrowLeftRight size={14} className="text-slate-600" />
          <div className="flex items-center gap-1.5">
            <Smartphone size={14} className="text-emerald-400" />
            <span>Screen 2: Scan</span>
          </div>
        </div>
      </div>

      {/* Side-by-side or stacked test view */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* TRANSMITTER SECTION */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400"></span>
              <h3 className="text-sm font-bold tracking-wide uppercase font-mono text-cyan-300">
                Transmitter Unit (High-Speed QR Pulsar)
              </h3>
            </div>
            <span className="text-[11px] font-mono text-slate-500">Air-Gapped Optical Emitter</span>
          </div>
          <OpticalSender />
        </div>

        {/* RECEIVER SECTION */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
              <h3 className="text-sm font-bold tracking-wide uppercase font-mono text-emerald-300">
                Receiver Unit (Optical Camera Sensor)
              </h3>
            </div>
            <span className="text-[11px] font-mono text-slate-500">Continuous Frame Collector</span>
          </div>
          <OpticalReceiver />
        </div>
      </div>
    </div>
  );
};
