import React from 'react';
import { Thermometer, Droplets, Wind, Navigation, CloudRain, Radio } from 'lucide-react';
import { WeatherData } from '../types';

interface WeatherStatsProps {
  weather: WeatherData;
  currentAqi?: number;
}

export default function WeatherStats({ weather, currentAqi = 1 }: WeatherStatsProps) {
  // Translate degrees into cardinal direction label
  const getWindDirection = (deg: number): string => {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(((deg %= 360) < 0 ? deg + 360 : deg) / 22.5) % 16;
    return directions[index];
  };

  const windDir = getWindDirection(weather?.wind?.deg ?? 0);

  // Extract rainfall safety
  const hasRainfall = !!(weather?.rain && (weather.rain['1h'] !== undefined || weather.rain['3h'] !== undefined));
  const rainfallAmount = weather?.rain 
    ? (weather.rain['1h'] !== undefined ? weather.rain['1h'] : (weather.rain['3h'] !== undefined ? weather.rain['3h'] : null)) 
    : null;

  // AQI colors and labels
  const getAqiColor = (aqiVal: number): string => {
    switch (aqiVal) {
      case 1: return '#00FF95'; // Neon Good
      case 2: return '#F1C40F'; // Yellow
      case 3: return '#E67E22'; // Orange
      case 4: return '#E74C3C'; // Red
      case 5: return '#9B59B6'; // Purple
      default: return '#00D4FF';
    }
  };

  const getAqiLabel = (aqiVal: number): string => {
    switch (aqiVal) {
      case 1: return 'AQI 1 - GOOD [1-5 SCALE]';
      case 2: return 'AQI 2 - FAIR [1-5 SCALE]';
      case 3: return 'AQI 3 - MODERATE [1-5 SCALE]';
      case 4: return 'AQI 4 - POOR [1-5 SCALE]';
      case 5: return 'AQI 5 - VERY POOR [1-5 SCALE]';
      default: return 'AQI 1 - GOOD [1-5 SCALE]';
    }
  };

  const aqiColor = getAqiColor(currentAqi);
  const aqiLabel = getAqiLabel(currentAqi);

  return (
    <div id="weather-stats-grid" className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-2 gap-4 p-4 bg-black/10 border border-white/5 rounded-2xl">
      
      {/* Temperature Panel */}
      <div id="weather-card-temp" className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0c1e3d] to-[#040a17] border border-cyan-500/25 p-4 shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_15px_-3px_rgba(6,182,212,0.15)] hover:border-cyan-400/50 hover:shadow-[0_8px_32px_rgba(0,0,0,0.6),0_0_20px_-3px_rgba(6,182,212,0.3)] transition-all duration-300 group">
        <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500 shadow-[0_0_8px_#00D4FF] opacity-80" />
        <div className="scanner-line opacity-20" />
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-[#00D4FF] group-hover:scale-110 transition-transform shadow-[0_0_10px_rgba(6,182,212,0.2)]">
            <Thermometer className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-widest font-mono text-white/40 font-bold select-none">
              THERMAL INDEX
            </div>
            <div className="text-base font-bold text-white tracking-tight font-display mt-0.5">
              {weather?.main?.temp !== undefined ? weather.main.temp.toFixed(1) : 'N/A'}<span className="text-cyan-400">°C</span>
            </div>
          </div>
        </div>
      </div>

      {/* Humidity Panel */}
      <div id="weather-card-humidity" className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#081a3a] to-[#030816] border border-blue-500/25 p-4 shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_15px_-3px_rgba(37,99,235,0.15)] hover:border-blue-400/50 hover:shadow-[0_8px_32px_rgba(0,0,0,0.6),0_0_20px_-3px_rgba(37,99,235,0.3)] transition-all duration-300 group">
        <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 shadow-[0_0_8px_#3b82f6] opacity-80" />
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400 group-hover:scale-110 transition-transform shadow-[0_0_10px_rgba(37,99,235,0.2)]">
            <Droplets className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-widest font-mono text-white/40 font-bold select-none">
              MOISTURE RATIO
            </div>
            <div className="text-base font-bold text-white tracking-tight font-display mt-0.5">
              {weather?.main?.humidity ?? 'N/A'}<span className="text-blue-400">%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Wind Speed Panel */}
      <div id="weather-card-wind-speed" className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#06202e] to-[#020d15] border border-emerald-500/25 p-4 shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_15px_-3px_rgba(16,185,129,0.15)] hover:border-emerald-400/50 hover:shadow-[0_8px_32px_rgba(0,0,0,0.6),0_0_20px_-3px_rgba(16,185,129,0.3)] transition-all duration-300 group">
        <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500 shadow-[0_0_8px_#10b981] opacity-80" />
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 group-hover:scale-110 transition-transform shadow-[0_0_10px_rgba(16,185,129,0.2)]">
            <Wind className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-widest font-mono text-white/40 font-bold select-none">
              VELOCITY RATE
            </div>
            <div className="text-base font-bold text-white tracking-tight font-display mt-0.5">
              {weather?.wind?.speed !== undefined ? weather.wind.speed.toFixed(1) : 'N/A'} <span className="text-emerald-400 text-xs font-mono">M/S</span>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Cyber Wind Vector Compass */}
      <div id="weather-card-wind-dir" className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#121435] to-[#060718] border border-purple-500/25 p-4 shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_15px_-3px_rgba(168,85,247,0.15)] hover:border-purple-400/50 hover:shadow-[0_8px_32px_rgba(0,0,0,0.6),0_0_20px_-3px_rgba(168,85,247,0.3)] transition-all duration-300 group">
        <div className="absolute top-0 left-0 w-1 h-full bg-purple-500 shadow-[0_0_8px_#a855f7] opacity-80" />
        <div className="flex items-center gap-3">
          {/* High-tech miniature rotating radar/compass circle */}
          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-purple-500/30 bg-purple-500/5 select-none overflow-hidden">
            {/* Radial crosshair lines */}
            <div className="absolute inset-0 border-t border-b border-purple-500/10" />
            <div className="absolute inset-0 border-l border-r border-purple-500/10" />
            
            {/* Rotating vector arrow pointer */}
            <div 
              className="absolute flex items-center justify-center transition-transform duration-1000 ease-out" 
              style={{ transform: `rotate(${weather?.wind?.deg ?? 0}deg)` }}
            >
              <Navigation className="h-5 w-5 text-purple-400 fill-purple-400/30" />
            </div>
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-widest font-mono text-white/40 font-bold select-none">
              WIND DIRECTION
            </div>
            <div className="text-xs font-bold text-white tracking-tight font-mono mt-0.5 flex items-center gap-1">
              <span>{weather?.wind?.deg ?? 0}°</span>
              <span className="text-[9px] px-1 py-0.2 rounded bg-purple-500/20 border border-purple-500/30 text-purple-300 font-bold uppercase tracking-wide">
                {windDir}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Precipitation / Rainfall Panel */}
      <div id="weather-card-rainfall" className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#051e2e] to-[#020b13] border border-[#00D4FF]/25 p-4 shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_15px_-3px_rgba(0,212,255,0.15)] hover:border-[#00D4FF]/50 hover:shadow-[0_8px_32px_rgba(0,0,0,0.6),0_0_20px_-3px_rgba(0,212,255,0.3)] transition-all duration-300 group">
        <div className="absolute top-0 left-0 w-1 h-full bg-[#00D4FF] shadow-[0_0_8px_#00D4FF] opacity-80" />
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#00D4FF]/15 border border-[#00D4FF]/30 text-[#00D4FF] group-hover:scale-110 transition-transform shadow-[0_0_10px_rgba(0,212,255,0.2)]">
            <CloudRain className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-widest font-mono text-white/40 font-bold select-none">
              PRECIPITATION RATE
            </div>
            <div className="text-sm font-bold text-white tracking-tight font-mono mt-0.5 leading-none">
              {rainfallAmount !== null ? (
                <span>{rainfallAmount.toFixed(1)} <span className="text-[#00D4FF] text-xs">MM/H</span></span>
              ) : (
                <span className="text-white/50 text-[10px] font-medium block">No rainfall currently</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Real-time Local Station AQI Panel */}
      <div id="weather-card-local-aqi" className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0c1f24] to-[#030d0d] border p-4 shadow-[0_8px_32px_rgba(0,0,0,0.5)] transition-all duration-300 group" style={{ borderColor: `${aqiColor}40` }}>
        <div className="absolute top-0 left-0 w-1 h-full shadow-lg opacity-80" style={{ backgroundColor: aqiColor, boxShadow: `0 0 8px ${aqiColor}` }} />
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border group-hover:scale-110 transition-transform shadow-md" style={{ backgroundColor: `${aqiColor}15`, borderColor: `${aqiColor}30`, color: aqiColor }}>
            <Radio className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-widest font-mono text-white/40 font-bold select-none">
              REALTIME STATION AQI
            </div>
            <div className="text-xs font-bold tracking-wider font-mono mt-1 px-1.5 py-0.5 rounded border inline-block text-center" style={{ color: aqiColor, backgroundColor: `${aqiColor}10`, borderColor: `${aqiColor}20` }}>
              {aqiLabel}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
