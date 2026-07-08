import React from 'react';
import { Radio, MapPin, Eye, Layers, ShieldAlert, FileText } from 'lucide-react';
import { MapLayerMode, PollutionReport } from '../types';

interface CitizenReportingCardProps {
  layerMode: MapLayerMode;
  onLayerModeChange: (mode: MapLayerMode) => void;
  onOpenReportModal: () => void;
  reports: PollutionReport[];
}

export default function CitizenReportingCard({
  layerMode,
  onLayerModeChange,
  onOpenReportModal,
  reports,
}: CitizenReportingCardProps) {
  // Severity counter for dashboard telemetry
  const highSeverityCount = reports.filter((r) => r.severity === 'high').length;

  return (
    <div id="citizen-reporting-card" className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-br from-[#071128] to-[#030713]/90 backdrop-blur-xl p-5 shadow-[0_12px_36px_-6px_rgba(0,0,0,0.6),0_0_15px_-3px_rgba(245,158,11,0.15)] hover:shadow-[0_12px_40px_-6px_rgba(0,0,0,0.7),0_0_20px_-3px_rgba(245,158,11,0.25)] transition-all duration-500 select-none group">
      {/* Laser horizontal header line */}
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-amber-500/60 to-transparent" />
      <div className="scanner-line opacity-10" />

      {/* Header Title with animated Radio sensor */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="relative flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-400/10 border border-cyan-400/20 text-[#00D4FF]">
            <Radio className="h-4 w-4 animate-pulse" />
          </div>
          <div>
            <h3 className="font-display text-xs font-bold text-white tracking-wider uppercase">
              CIVIC OBSERVATORY NET
            </h3>
            <p className="text-[9px] font-mono text-white/40 uppercase">Citizen Spotter Telemetry</p>
          </div>
        </div>

        {/* Counter of reported incidents */}
        <div className="flex gap-1.5 items-center bg-white/5 border border-white/10 rounded-lg px-2.5 py-1">
          <span className="font-mono text-[10px] text-cyan-400 font-bold">{reports.length}</span>
          <span className="text-[8px] font-mono text-white/40 uppercase">Reports</span>
        </div>
      </div>

      {/* Description */}
      <p className="text-[10px] text-white/60 leading-relaxed mb-4">
        Bridge satellite sensor grids with hyperlocal ground observation. Report smoke plumes, open burning, or smog events using vision diagnostics.
      </p>

      {/* 1. LAYER SELECTOR TOGGLE (AQI vs Reports vs Combined) */}
      <div className="mb-4">
        <div className="text-[9px] font-mono text-white/40 uppercase tracking-wider mb-2 flex items-center gap-1">
          <Layers className="h-3 w-3 text-cyan-400" />
          VIEW RESOLUTION MATRIX
        </div>
        
        <div className="grid grid-cols-3 gap-1.5 bg-black/40 border border-white/10 p-1 rounded-xl">
          {/* AQI Only */}
          <button
            onClick={() => onLayerModeChange('aqi')}
            className={`py-2 rounded-lg text-[9px] font-mono uppercase font-bold tracking-wider transition-all ${
              layerMode === 'aqi'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-[0_0_8px_rgba(6,182,212,0.15)]'
                : 'text-white/40 hover:text-white/70 hover:bg-white/5 border border-transparent'
            }`}
          >
            SENSORS
          </button>

          {/* Reports Only */}
          <button
            onClick={() => onLayerModeChange('reports')}
            className={`py-2 rounded-lg text-[9px] font-mono uppercase font-bold tracking-wider transition-all ${
              layerMode === 'reports'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-[0_0_8px_rgba(245,158,11,0.15)]'
                : 'text-white/40 hover:text-white/70 hover:bg-white/5 border border-transparent'
            }`}
          >
            REPORTS
          </button>

          {/* Both Combined */}
          <button
            onClick={() => onLayerModeChange('both')}
            className={`py-2 rounded-lg text-[9px] font-mono uppercase font-bold tracking-wider transition-all ${
              layerMode === 'both'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.15)]'
                : 'text-white/40 hover:text-white/70 hover:bg-white/5 border border-transparent'
            }`}
          >
            HOTSPOTS
          </button>
        </div>
      </div>

      {/* Visual Live Alert Feed if reports exist */}
      {highSeverityCount > 0 && (
        <div className="mb-4 flex items-center gap-2 px-3 py-1.5 bg-rose-500/10 border border-rose-500/20 rounded-xl animate-pulse">
          <ShieldAlert className="h-3.5 w-3.5 text-rose-400 shrink-0" />
          <span className="text-[9px] font-mono font-bold text-rose-300 uppercase tracking-widest">
            {highSeverityCount} CRITICAL THREAT HOTSPOT{highSeverityCount > 1 ? 'S' : ''} DETECTED
          </span>
        </div>
      )}

      {/* 2. REPORT TRIGGER BUTTON */}
      <button
        onClick={onOpenReportModal}
        className="w-full relative overflow-hidden group flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white px-4 py-3 text-xs font-mono font-bold tracking-widest uppercase transition-all duration-300 shadow-[0_0_15px_rgba(6,182,212,0.3)] hover:shadow-[0_0_25px_rgba(6,182,212,0.5)] border border-cyan-400/30"
      >
        <MapPin className="h-3.5 w-3.5 animate-bounce group-hover:scale-110 transition-transform" />
        <span>UPLINK VISUAL DISPATCH</span>
        
        {/* Futuristic glowing shimmer */}
        <div className="absolute top-0 -inset-full h-full w-1/2 z-5 block transform -skew-x-12 bg-gradient-to-r from-transparent to-white/20 opacity-40 group-hover:animate-shine" />
      </button>
    </div>
  );
}
