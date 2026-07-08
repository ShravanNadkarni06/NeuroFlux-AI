import React, { useState } from 'react';
import { ShieldCheck, Info, RefreshCw, Layers, Radio, ShieldAlert } from 'lucide-react';
import { AirPollutionItem, WeatherData, Coordinates } from '../types';
import { AQI_MAPPING, POLLUTANT_DETAILS, getPollutantRating } from '../utils/aqiHelper';

interface AqiPanelProps {
  pollutionItem: AirPollutionItem;
  weatherData: WeatherData | null;
  lastUpdated: Date | null;
  isRefreshing: boolean;
  onManualRefresh: () => void;
  inspectedCoords?: Coordinates | null;
  onResetInspection?: () => void;
}

export default function AqiPanel({
  pollutionItem,
  weatherData,
  lastUpdated,
  isRefreshing,
  onManualRefresh,
  inspectedCoords = null,
  onResetInspection,
}: AqiPanelProps) {
  const aqi = pollutionItem?.main?.aqi ?? 1;
  const components = pollutionItem?.components ?? { pm2_5: 0, pm10: 0, no2: 0, o3: 0, so2: 0, co: 0 };
  const meta = AQI_MAPPING[aqi];

  // Hover states for 3D tilt effects
  const [tiltIndex, setTiltIndex] = useState<number | null>(null);
  const [tiltCoords, setTiltCoords] = useState({ x: 0, y: 0 });

  // Calculate percentage of pollutant value against maximum rating limit for visualization
  const getPollutantPercent = (key: string, val: number): number => {
    const limits = POLLUTANT_DETAILS[key];
    if (!limits) return 0;
    return Math.min(100, Math.round((val / limits.poor) * 100));
  };

  const activePollutants = [
    { key: 'pm2_5', name: 'PM2.5', label: 'Fine Particles', value: components?.pm2_5 ?? 0 },
    { key: 'pm10', name: 'PM10', label: 'Coarse Dust', value: components?.pm10 ?? 0 },
    { key: 'no2', name: 'NO₂', label: 'Nitrogen Dioxide', value: components?.no2 ?? 0 },
    { key: 'o3', name: 'O₃', label: 'Ozone Layer', value: components?.o3 ?? 0 },
    { key: 'so2', name: 'SO₂', label: 'Sulfur Dioxide', value: components?.so2 ?? 0 },
    { key: 'co', name: 'CO', label: 'Carbon Monoxide', value: components?.co ?? 0 },
  ];

  // Handles mouse movement to create a high-precision 3D tilt effect on the cards
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>, index: number) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5; // range -0.5 to 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5; // range -0.5 to 0.5
    setTiltIndex(index);
    setTiltCoords({ x: x * 15, y: y * -15 }); // multiplier for degrees of rotation
  };

  const handleMouseLeave = () => {
    setTiltIndex(null);
  };

  // Maps AQI value (1-5) to colors matching the sci-fi scheme
  const getSeverityHexColor = (aqiValue: number): string => {
    switch (aqiValue) {
      case 1: return '#00FF95'; // Neon Good
      case 2: return '#F1C40F'; // Yellow
      case 3: return '#E67E22'; // Orange
      case 4: return '#E74C3C'; // Red
      case 5: return '#9B59B6'; // Purple
      default: return '#00D4FF';
    }
  };

  const activeColor = getSeverityHexColor(aqi);

  return (
    <div className="flex flex-col h-full bg-[#050d21]/60 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden transition-all duration-500 relative">
      <div className="scanner-line opacity-10" />
      
      {/* Top Header Controls */}
      <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between select-none bg-black/20">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-[#00D4FF]" />
          <span className="text-[10px] font-mono uppercase tracking-widest text-white/40 font-bold">
            ATMOSPHERIC DATA DECK
          </span>
        </div>
        <button
          onClick={onManualRefresh}
          disabled={isRefreshing}
          className="flex h-8 w-8 items-center justify-center rounded bg-white/5 hover:bg-[#00D4FF]/20 border border-white/10 hover:border-[#00D4FF]/30 text-white/70 hover:text-white transition-all duration-200 disabled:opacity-40"
          title="Force update data nodes"
          aria-label="Force update data nodes"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Main Interactive Work Area */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 scrollbar-thin relative bg-gradient-to-b from-[#050c20]/40 via-transparent to-[#050c20]/60 border-x border-white/5 shadow-inner">
        
        {/* Click-to-Inspect HUD State alert banner */}
        {inspectedCoords && (
          <div className="bg-[#00D4FF]/10 border border-[#00D4FF]/25 px-4 py-3 rounded-xl flex items-center justify-between text-[10px] font-mono select-none">
            <div className="flex items-center gap-2 text-[#00D4FF] font-bold">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00D4FF] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00D4FF]"></span>
              </span>
              <span>INSPECTION HUD: {inspectedCoords.latitude.toFixed(4)}°N, {inspectedCoords.longitude.toFixed(4)}°E</span>
            </div>
            <button
              onClick={onResetInspection}
              className="px-2.5 py-1 rounded bg-white/5 hover:bg-[#00D4FF]/20 border border-white/10 hover:border-[#00D4FF]/35 text-[#00D4FF] hover:text-white transition-all text-[8px] font-bold tracking-wider cursor-pointer uppercase"
            >
              Reset to GPS
            </button>
          </div>
        )}

        {/* HERO AQI GAUGE SECTION */}
        <div className="flex flex-col lg:flex-row items-center justify-between gap-6 bg-white/5 border border-white/10 p-5 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 h-32 w-32 rounded-full opacity-25 blur-3xl" style={{ backgroundColor: activeColor }} />
          
          {/* Cybernetic Radial SVG Gauge */}
          <div className="relative flex items-center justify-center h-32 w-32 shrink-0 select-none">
            {/* Background radar sweeps */}
            <div className="absolute inset-0 rounded-full border border-white/5 animate-ping opacity-10" />
            <div className="absolute h-28 w-28 rounded-full border border-[#00D4FF]/10 animate-pulse" />
            
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              {/* Outer boundary ticks */}
              <circle 
                cx="50" 
                cy="50" 
                r="46" 
                stroke="rgba(0, 212, 255, 0.05)" 
                strokeWidth="1" 
                fill="none" 
              />
              {/* 5 segments of different thresholds */}
              {[...Array(5)].map((_, i) => (
                <circle
                  key={i}
                  cx="50"
                  cy="50"
                  r="41"
                  stroke={i + 1 <= aqi ? activeColor : 'rgba(255, 255, 255, 0.05)'}
                  strokeWidth="4"
                  strokeDasharray="12 4"
                  strokeDashoffset={-((i * 16) + 12)}
                  fill="none"
                  className="transition-all duration-1000"
                  style={{ opacity: i + 1 <= aqi ? 0.8 : 0.2 }}
                />
              ))}
              
              {/* Spinning scanning beacon */}
              <circle
                cx="50"
                cy="50"
                r="35"
                stroke="url(#radarSweep)"
                strokeWidth="1.5"
                fill="none"
                className="origin-center"
                style={{ animation: 'spin 6s linear infinite' }}
              />

              <defs>
                <linearGradient id="radarSweep" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#00D4FF" stopOpacity="0.8" />
                  <stop offset="40%" stopColor="#00D4FF" stopOpacity="0.1" />
                  <stop offset="100%" stopColor="#00D4FF" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>

            {/* Glowing active rating number inside */}
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-4xl font-extralight tracking-tighter text-white font-display leading-none">
                {aqi}
              </span>
              <span className="text-[8px] font-mono font-bold mt-1 uppercase" style={{ color: activeColor }}>
                {meta?.label || 'UNKNOWN'}
              </span>
              <span className="text-[6.5px] font-mono text-[#00D4FF] tracking-wider uppercase mt-1 bg-[#00D4FF]/10 px-1.5 py-0.5 rounded border border-[#00D4FF]/20">
                AQI (1-5 SCALE)
              </span>
            </div>
          </div>

          {/* Rating Status and Details */}
          <div className="flex-1 text-center lg:text-left">
            <div className="flex items-center justify-center lg:justify-start gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: activeColor }} />
                <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: activeColor }} />
              </span>
              <h2 className="font-display text-xl font-bold tracking-tight text-white uppercase select-none">
                {meta?.label || 'Unknown Level'}
              </h2>
            </div>
            <p className="text-xs text-white/60 leading-relaxed mt-2 font-sans">
              {meta?.description}
            </p>
            <div className="flex items-center justify-center lg:justify-start gap-1.5 mt-3 font-mono text-[9px] text-[#00D4FF] select-none">
              <Radio className="h-3 w-3 animate-pulse" />
              <span>HYPERLOCAL TELEMETRY (1-5 STANDARD SCALE)</span>
            </div>
            {lastUpdated && (
              <div className="inline-flex items-center gap-1.5 mt-2.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-mono rounded select-none animate-pulse">
                <span className="relative flex h-1.5 w-1.5 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400"></span>
                </span>
                <span>SYNC FRESHNESS SECURED: {lastUpdated.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
              </div>
            )}
          </div>
        </div>

        {/* HEALTH RECOMENDATIONS BLOCK */}
        <div className="rounded-2xl bg-[#0b1b36]/40 border border-white/10 p-4 relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1 h-full bg-[#00D4FF] opacity-60" />
          <div className="flex items-start gap-3">
            {aqi >= 4 ? (
              <ShieldAlert className="h-5 w-5 shrink-0 text-red-400 mt-0.5 animate-bounce" />
            ) : (
              <ShieldCheck className="h-5 w-5 shrink-0 text-[#00D4FF] mt-0.5" />
            )}
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider select-none">
                Command Recommendations
              </h4>
              <p className="text-xs text-white/70 leading-relaxed mt-1 font-sans">
                {meta?.advice}
              </p>
            </div>
          </div>
        </div>

        {/* POLLUTANTS DECK GRID */}
        <div>
          <div className="flex justify-between items-center mb-3 select-none">
            <h3 className="font-display text-[10px] font-bold text-white/40 uppercase tracking-widest">
              POLLUTANTS SCANNER MATRIX
            </h3>
            <span className="text-[9px] font-mono text-white/30">
              6-AXIS TELEMETRY
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {activePollutants.map((pollutant, idx) => {
              const rating = getPollutantRating(pollutant.key, pollutant.value);
              const pct = getPollutantPercent(pollutant.key, pollutant.value);
              const colorHex = getSeverityHexColor(rating.label === 'Good' ? 1 : rating.label === 'Fair' ? 2 : rating.label === 'Moderate' ? 3 : rating.label === 'Poor' ? 4 : 5);
              
              // 3D Tilt parameters if active
              const isTilted = tiltIndex === idx;
              const transformStyle = isTilted 
                ? `rotateX(${tiltCoords.y}deg) rotateY(${tiltCoords.x}deg) scale(1.03)`
                : 'rotateX(0deg) rotateY(0deg) scale(1)';

              return (
                <div
                  key={pollutant.key}
                  onMouseMove={(e) => handleMouseMove(e, idx)}
                  onMouseLeave={handleMouseLeave}
                  className="relative p-3.5 rounded-2xl bg-[#09152e]/50 border border-white/10 group overflow-hidden transition-all duration-300 ease-out select-none cursor-crosshair"
                  style={{ 
                    transform: transformStyle,
                    perspective: '1000px',
                    borderColor: isTilted ? `${colorHex}66` : 'rgba(255, 255, 255, 0.1)',
                    boxShadow: isTilted ? `0 10px 25px -5px rgba(0,0,0,0.5), 0 0 15px -3px ${colorHex}25` : 'none'
                  }}
                >
                  {/* Subtle Severity Glow Halo on Card */}
                  <div 
                    className="absolute -top-10 -right-10 h-20 w-20 rounded-full opacity-10 group-hover:opacity-20 blur-xl transition-opacity"
                    style={{ backgroundColor: colorHex }}
                  />
                  
                  {/* Title and Badge */}
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-white/90 font-display">
                      {pollutant.name}
                    </span>
                    <span 
                      className="text-[8px] font-mono px-1 py-0.2 rounded font-bold uppercase tracking-wider"
                      style={{ 
                        color: colorHex, 
                        backgroundColor: `${colorHex}15`,
                        border: `1px solid ${colorHex}25`
                      }}
                    >
                      {rating.label}
                    </span>
                  </div>

                  {/* Value unit */}
                  <div className="font-mono text-[10px] text-white/40 mb-1">
                    {pollutant.label}
                  </div>
                  
                  <div className="flex items-baseline gap-1 mt-2 mb-3">
                    <span className="text-lg font-bold text-white tracking-tight leading-none font-display">
                      {pollutant.value.toFixed(1)}
                    </span>
                    <span className="text-[9px] font-mono text-white/40">
                      {POLLUTANT_DETAILS[pollutant.key]?.unit}
                    </span>
                  </div>

                  {/* Level percentage visual bar */}
                  <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden relative">
                    <div
                      className="h-full rounded-full transition-all duration-1000"
                      style={{ 
                        width: `${pct}%`,
                        backgroundColor: colorHex,
                        boxShadow: `0 0 8px ${colorHex}`
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* Futuristic status bar footer */}
      {lastUpdated && (
        <div className="px-6 py-3.5 bg-black/40 border-t border-white/10 flex items-center justify-between text-[9px] font-mono text-white/40 uppercase tracking-wider select-none">
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
            </span>
            <span>GRID LINK: ACTIVE</span>
          </div>
          <span>
            UPDATED {lastUpdated.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </div>
      )}
    </div>
  );
}
