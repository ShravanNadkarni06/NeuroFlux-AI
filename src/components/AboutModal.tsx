import React, { useEffect } from 'react';
import { X, Info, ShieldAlert, Cpu, Layers, Sparkles } from 'lucide-react';

interface AboutModalProps {
  onClose: () => void;
}

export default function AboutModal({ onClose }: AboutModalProps) {
  // Support closing with Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="relative w-full max-w-2xl bg-[#050c20]/95 backdrop-blur-xl border border-cyan-500/30 rounded-2xl p-6 md:p-8 shadow-[0_0_50px_rgba(0,212,255,0.3)] select-none text-white max-h-[85vh] overflow-y-auto scrollbar-thin flex flex-col gap-6 font-sans">
      
      {/* Sci-Fi Ambient Glow Header */}
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />
      
      {/* Header and Close */}
      <div className="flex justify-between items-center border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Info className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-black tracking-widest text-white uppercase font-display">
              AEROSENSE HUD DOCUMENTATION
            </h2>
            <p className="text-[9px] font-mono text-cyan-400 tracking-wider uppercase">
              COGNITIVE AMBIENT RISK MANAGEMENT PLATFORM
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors cursor-pointer"
          title="Close documentation panel"
          aria-label="Close documentation panel"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Overview Block */}
      <div className="space-y-2.5">
        <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Layers className="h-4 w-4 text-cyan-400" />
          System Overview & Mission
        </h3>
        <p className="text-xs text-white/80 leading-relaxed font-sans">
          <strong>AeroSense HUD</strong> is a high-resolution, interactive atmospheric safety cockpit designed for both citizens and municipal command staff. It bridges local meteorological sensors, satellite pollution spectrometry, and cognitive AI reasoning to detect hazards, predict particulate drift, and coordinate community-led response dispatches in real-time.
        </p>
      </div>

      {/* Powered By Section */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Cpu className="h-4 w-4 text-cyan-400" />
          API Telemetry Network (The Core)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-3 bg-white/5 border border-white/5 rounded-xl space-y-1">
            <span className="text-[10px] font-mono font-bold text-cyan-400 uppercase">OpenWeather Air Pollution</span>
            <p className="text-[11px] text-white/75 leading-normal">
              Extracts precise concentrations of PM2.5, PM10, Carbon Monoxide, Ozone, Sulfur Dioxide, and Nitrogen Dioxide for targeted coordinates.
            </p>
          </div>
          <div className="p-3 bg-white/5 border border-white/5 rounded-xl space-y-1">
            <span className="text-[10px] font-mono font-bold text-cyan-400 uppercase">OpenWeather Weather Suite</span>
            <p className="text-[11px] text-white/75 leading-normal">
              Fetches localized meteorological stats, wind velocity vector rates, humidity metrics, and local rainfall safety markers.
            </p>
          </div>
          <div className="p-3 bg-white/5 border border-white/5 rounded-xl space-y-1">
            <span className="text-[10px] font-mono font-bold text-cyan-400 uppercase">Google Gemini AI Core</span>
            <p className="text-[11px] text-white/75 leading-normal">
              Triangulates fire hotspot risks, projects 24-hour predictive trend models, and powers the active telemetry chatbot.
            </p>
          </div>
          <div className="p-3 bg-white/5 border border-white/5 rounded-xl space-y-1">
            <span className="text-[10px] font-mono font-bold text-cyan-400 uppercase">NASA GIBS Tile Layers</span>
            <p className="text-[11px] text-white/75 leading-normal">
              Streams high-altitude geographic imagery overlays, providing clear views of active terrain contours directly onto the map.
            </p>
          </div>
        </div>
      </div>

      {/* Logic Explained */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-cyan-400" />
          Predictive Analytics & Hotspot Logic
        </h3>
        <div className="p-4 bg-cyan-950/20 border border-cyan-500/20 rounded-xl space-y-2.5 text-xs text-white/80 leading-relaxed font-sans">
          <p>
            Our predictive engines continuously analyze local air composition alongside active meteorological signals. By computing wind velocity, humidity rates, and particulate ratios, they estimate <strong>AQI fluctuations over a 24-hour horizon</strong> to warn communities before spikes manifest.
          </p>
          <p>
            The <strong>hotspot assessment engine</strong> automatically correlates high concentrations of PM2.5 or SO₂ against historical baseline samples and active satellite fire alerts. When a citizen files a new report, the engine uses wind dispersion vectors to project drift trajectories, signaling immediately to municipal services.
          </p>
        </div>
      </div>

      {/* Security Statement */}
      <div className="space-y-2.5 border-t border-white/10 pt-4">
        <h3 className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
          <ShieldAlert className="h-4 w-4" />
          Transparent Security Architecture Note
        </h3>
        <p className="text-[10.5px] text-white/60 leading-relaxed font-sans">
          This system uses a modern <strong>hybrid architecture</strong>. In a full production launch, API keys are kept safe server-side, and client requests are routed through secure, rate-limited backend proxy routers (e.g., <code className="text-white bg-white/10 px-1 rounded">/api/pollution</code>) to completely hide credentials. This developer showcase build operates behind a secure container ingress with automated server checking to assure compliance.
        </p>
      </div>

      {/* Footer Close Button */}
      <div className="flex justify-end pt-2">
        <button
          onClick={onClose}
          className="px-5 py-2.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/35 border border-cyan-500/40 hover:border-cyan-400 text-cyan-300 font-bold tracking-widest text-[10px] uppercase cursor-pointer transition-all duration-200"
        >
          Acknowledge & Close
        </button>
      </div>

    </div>
  );
}
