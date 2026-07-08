import React, { useState, useEffect, useRef } from 'react';
import { 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  Shield, 
  Zap, 
  Bell, 
  Volume2, 
  VolumeX, 
  Activity, 
  FileText, 
  MapPin, 
  Users, 
  CheckCircle, 
  Sparkles,
  RefreshCw,
  Radar,
  Copy,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Hotspot, PollutionReport, AirPollutionItem } from '../types';
import { AQI_MAPPING } from '../utils/aqiHelper';
import LocationDisplay from './LocationDisplay';

interface MunicipalCommandConsoleProps {
  hotspots: Hotspot[];
  reports: PollutionReport[];
  pollutionData: AirPollutionItem | null;
  onRefresh: () => void;
  loading: boolean;
}

// Browser Audio API Synth sound creator for a sci-fi alert tone
const playAlertSound = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;
    
    // Tone 1
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now); // A5 note
    osc1.frequency.exponentialRampToValueAtTime(1320, now + 0.12); // E6 note
    
    gain1.gain.setValueAtTime(0.06, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    // Tone 2
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(440, now); // A4 note
    osc2.frequency.exponentialRampToValueAtTime(660, now + 0.18); // E5 note
    
    gain2.gain.setValueAtTime(0.03, now);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now);
    osc2.stop(now + 0.3);
  } catch (err) {
    console.warn("Audio Context playback failed or blocked:", err);
  }
};

const formatElapsedTime = (detectedAtStr?: string) => {
  if (!detectedAtStr) return "Just now";
  try {
    const detectedAt = new Date(detectedAtStr);
    const now = new Date();
    const diffMs = now.getTime() - detectedAt.getTime();
    if (isNaN(diffMs) || diffMs < 0) return "Just now";
    
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "1m ago";
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ${diffMins % 60}m ago`;
    
    return `${Math.floor(diffHours / 24)}d ago`;
  } catch {
    return "Just now";
  }
};

const getDistanceInMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371e3; // metres
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

const generateLocalFallbackReport = (hotspot: Hotspot, evidenceCount: number) => {
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
  const severity = hotspot.score >= 70 ? 'CRITICAL / RED ALERT' : hotspot.score >= 40 ? 'HIGH / ORANGE ALERT' : 'MODERATE / YELLOW ALERT';
  const aqiVal = hotspot.currentAqi || 1;
  const mapped = AQI_MAPPING[aqiVal as keyof typeof AQI_MAPPING] || AQI_MAPPING[1];
  const aqiLabel = `${aqiVal} - ${mapped.label.toUpperCase()} [1-5 SCALE]`;
  
  return `=========================================================
      NEUROFLUX ENVIRONMENTAL DISPATCH INTEL BRIEF
=========================================================
Generated At: ${timestamp}
Incident ID:  NFLX-LOC-${Math.floor(Math.random() * 90000 + 10000)}
Alert Level:  ${severity}

[1. INCIDENT HEADER]
- Threat Risk Score:   ${hotspot.score}/100
- Core Inferred Source: ${hotspot.sourceType || 'Unknown Emission Source'}
- Sensor State:         AQI ${aqiLabel}
- Predicted Trend:      ${hotspot.predictedTrend || 'Stable'}

[2. GEOLOCATION & IMPACT ZONE]
- Target Coordinates:  ${hotspot.latitude.toFixed(5)}°N, ${hotspot.longitude.toFixed(5)}°E
- Impact Radius:       ${hotspot.radius} meters
- Vector Drift:        Affected area extends radially outwards from focus point.

[3. ESTIMATED SOURCE & RISKS]
- Emission Profile:    ${hotspot.description || 'No direct telemetry analysis available.'}
- Critical Hazards:    Elevated concentration of fine particulate matters and localized sensor spikes. Highly dangerous for respiratory systems in the immediate zone.

[4. FIELD EVIDENCE & CITIZEN INTELLIGENCE]
- Supporting Feeds:    ${evidenceCount} verified citizen report(s) registered in close proximity.
- Status:              Field observations align with active airborne dispersion patterns.

[5. IMMEDIATE PROTOCOL & TACTICAL RESPONSE]
- Personal Safety:     All field teams must deploy N95 or SCBA breathing apparatus.
- Containment:         Establish perimeter boundaries within ${hotspot.radius} meters of epicenter.
- Public Safety:       Broadcast immediate "Windows Closed / Indoor Shelter" notice to citizens.
- Recommended Action:  "${hotspot.recommendedAction || 'Monitor and coordinate with local environmental teams.'}"

---------------------------------------------------------
* LOCAL TELEMETRY GROUNDED REPORT (OFFLINE PROTOCOL) *
=========================================================`;
};

export default function MunicipalCommandConsole({
  hotspots,
  reports,
  pollutionData,
  onRefresh,
  loading
}: MunicipalCommandConsoleProps) {
  const [muted, setMuted] = useState<boolean>(false);
  const [alertHotspot, setAlertHotspot] = useState<Hotspot | null>(null);
  
  const [generatingReportId, setGeneratingReportId] = useState<number | null>(null);
  const [generatedReports, setGeneratedReports] = useState<Record<number, string>>({});
  const [copiedReportId, setCopiedReportId] = useState<number | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);

  const prevHotspotsLengthRef = useRef<number>(0);
  const prevHotspotsRef = useRef<Hotspot[]>([]);

  const handleGenerateReport = async (hotspot: Hotspot, idx: number) => {
    setGeneratingReportId(idx);
    setReportError(null);

    // Calculate real supporting evidence count
    const evidenceCount = reports.filter(r => 
      getDistanceInMeters(hotspot.latitude, hotspot.longitude, r.latitude, r.longitude) <= (hotspot.radius || 2000)
    ).length;

    try {
      const response = await fetch("/api/generate-dispatch-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hotspot, evidenceCount })
      });

      if (!response.ok) {
        throw new Error("Server response was not ok");
      }

      const data = await response.json();
      if (data.report) {
        setGeneratedReports(prev => ({ ...prev, [idx]: data.report }));
      } else if (data.error) {
        throw new Error(data.error);
      } else {
        throw new Error("Failed to parse report.");
      }
    } catch (err: any) {
      console.warn("Gemini dispatcher failed. Activating local resilient backup...", err);
      // Generate highly structured local fallback brief
      const fallbackReport = generateLocalFallbackReport(hotspot, evidenceCount);
      setGeneratedReports(prev => ({ ...prev, [idx]: fallbackReport }));
      setReportError("Dynamic intelligence dispatcher offline. Resilient local fallback brief generated successfully.");
    } finally {
      setGeneratingReportId(null);
    }
  };

  const downloadReport = (reportText: string, filename: string) => {
    const element = document.createElement("a");
    const file = new Blob([reportText], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const copyToClipboard = (text: string, hotspotIdx: number) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedReportId(hotspotIdx);
      setTimeout(() => setCopiedReportId(null), 3000);
    }).catch((err) => {
      console.error("Could not copy report text: ", err);
    });
  };

  // Sound triggering and tracking of new high severity hotspots (score >= 70)
  useEffect(() => {
    if (hotspots.length === 0) {
      prevHotspotsRef.current = [];
      prevHotspotsLengthRef.current = 0;
      return;
    }

    const isFirstLoad = prevHotspotsLengthRef.current === 0;

    if (!isFirstLoad) {
      // Look for a new high-severity hotspot (score >= 70) that was not in prevHotspotsRef
      const newHighRisk = hotspots.find(h => {
        const isAlreadySeen = prevHotspotsRef.current.some(
          prev => Math.abs(prev.latitude - h.latitude) < 0.0001 && Math.abs(prev.longitude - h.longitude) < 0.0001
        );
        return !isAlreadySeen && h.score >= 70;
      });

      if (newHighRisk) {
        setAlertHotspot(newHighRisk);
        if (!muted) {
          playAlertSound();
        }
        const timer = setTimeout(() => {
          setAlertHotspot(null);
        }, 8000);
        return () => clearTimeout(timer);
      }
    }

    prevHotspotsRef.current = hotspots;
    prevHotspotsLengthRef.current = hotspots.length;
  }, [hotspots, muted]);

  // Sort hotspots descending by risk score
  const sortedHotspots = [...hotspots].sort((a, b) => b.score - a.score);

  // Computations from live state
  const activeHotspotsCount = hotspots.length;
  const reportsCount = reports.length;
  
  // Average AQI of hotspots, fallback to current ambient AQI if none
  let avgAqiVal: number = pollutionData?.main?.aqi || 1;
  if (hotspots.length > 0) {
    const aqiSum = hotspots.reduce((sum, h) => sum + (h.currentAqi || 1), 0);
    avgAqiVal = Math.max(1, Math.min(5, Math.round(aqiSum / hotspots.length)));
  }
  
  // Trend computation
  const getGeneralTrend = () => {
    if (hotspots.length === 0) return "STABLE";
    let worseningCount = 0;
    let improvingCount = 0;
    hotspots.forEach(h => {
      if (h.predictedTrend === 'Worsening') worseningCount++;
      if (h.predictedTrend === 'Improving') improvingCount++;
    });
    if (worseningCount > improvingCount) return "WORSENING";
    if (improvingCount > worseningCount) return "IMPROVING";
    return "STABLE";
  };

  const generalTrend = getGeneralTrend();

  // Helper to get AQI label and styles
  const getAqiMeta = (aqiNum: number) => {
    return AQI_MAPPING[aqiNum as 1|2|3|4|5] || {
      label: 'Good',
      color: 'text-[#00FF95]',
      bgColor: 'bg-[#00FF95]/10',
      borderColor: 'border-[#00FF95]/20'
    };
  };

  const trendMeta = {
    WORSENING: {
      color: 'text-rose-400',
      bgColor: 'bg-rose-500/10',
      borderColor: 'border-rose-500/20',
      icon: TrendingUp
    },
    IMPROVING: {
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/20',
      icon: TrendingDown
    },
    STABLE: {
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500/10',
      borderColor: 'border-cyan-500/20',
      icon: Activity
    }
  }[generalTrend];

  const TrendIcon = trendMeta.icon;

  return (
    <div id="municipal-command-console" className="relative w-full rounded-2xl border border-white/15 bg-gradient-to-b from-[#070e28]/95 to-[#040817]/98 p-5 backdrop-blur-xl shadow-[0_25px_60px_rgba(0,0,0,0.7)] flex flex-col gap-4 max-h-[600px] overflow-y-auto scrollbar-none transition-all duration-300">
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-purple-500/40 to-transparent animate-pulse" />
      
      {/* Console Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-purple-500/15 border border-purple-500/30">
            <Shield className="h-5 w-5 text-purple-400" />
            <span className="absolute -top-1 -right-1 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
            </span>
          </div>
          <div>
            <h2 className="text-[11px] font-black tracking-widest text-white uppercase font-display flex items-center gap-1.5">
              MUNICIPAL COMMAND CONSOLE
            </h2>
            <p className="text-[8.5px] font-mono text-purple-400 tracking-widest uppercase">
              REGIONAL RESPONSE CONTROLLER
            </p>
          </div>
        </div>

        {/* Audio controls & Refresh */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMuted(!muted)}
            title={muted ? "Unmute alerts" : "Mute alerts"}
            className={`flex h-7 w-7 items-center justify-center rounded bg-white/5 border transition-all duration-300 cursor-pointer ${
              muted 
                ? 'border-red-500/25 text-red-400 hover:bg-red-500/10' 
                : 'border-white/10 text-white/50 hover:text-white hover:bg-white/10'
            }`}
          >
            {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
          </button>

          <button 
            onClick={onRefresh}
            disabled={loading}
            className="flex h-7 px-2.5 items-center justify-center gap-1.5 rounded bg-purple-500/10 border border-purple-500/35 text-[9px] font-mono font-black tracking-wider text-purple-300 hover:text-white hover:bg-purple-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            <span>POLL LIVE SENSORS</span>
          </button>
        </div>
      </div>

      {/* Real-time Alert Banner */}
      <AnimatePresence>
        {alertHotspot && (
          <motion.div
            initial={{ opacity: 0, height: 0, scale: 0.95 }}
            animate={{ opacity: 1, height: 'auto', scale: 1 }}
            exit={{ opacity: 0, height: 0, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="overflow-hidden"
          >
            <div className="p-3.5 rounded-xl bg-purple-500/15 border border-purple-500/35 shadow-[0_0_20px_rgba(168,85,247,0.35)] flex gap-3 relative select-none">
              <div className="absolute top-0 left-0 h-full w-1 bg-purple-500 animate-pulse" />
              <div className="shrink-0 h-8 w-8 rounded-lg bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400 animate-bounce">
                <Bell className="h-4.5 w-4.5" />
              </div>
              <div className="space-y-0.5 flex-1 min-w-0">
                <h4 className="text-[10px] font-black tracking-widest text-purple-300 font-mono uppercase flex items-center gap-1.5">
                  CRITICAL INCIDENT ALERT
                  <span className="h-1.5 w-1.5 rounded-full bg-purple-500 animate-ping inline-block" />
                </h4>
                <p className="text-[9px] text-white font-bold truncate">
                  New {alertHotspot.sourceType} Detected (Risk: {alertHotspot.score}/100)
                </p>
                <p className="text-[8.5px] text-white/60 line-clamp-2">
                  {alertHotspot.description}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Compact Analytics Strip */}
      <div className="grid grid-cols-3 gap-2 select-none">
        {/* Count of hotspots */}
        <div className="bg-black/40 border border-white/5 rounded-xl p-3 flex flex-col justify-between h-16 relative overflow-hidden">
          <div className="absolute -right-2 -bottom-2 opacity-5">
            <Zap className="h-12 w-12 text-purple-400" />
          </div>
          <span className="text-[8px] font-mono text-purple-400/80 uppercase tracking-wider">ACTIVE HOTSPOTS</span>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold text-white font-mono">{activeHotspotsCount}</span>
            <span className="text-[8px] font-mono text-white/30">LOCATIONS</span>
          </div>
        </div>

        {/* Average city AQI trend */}
        <div className={`bg-black/40 border ${trendMeta.borderColor} rounded-xl p-3 flex flex-col justify-between h-16 relative overflow-hidden`}>
          <div className="absolute -right-2 -bottom-2 opacity-5">
            <TrendIcon className="h-12 w-12" />
          </div>
          <span className="text-[8px] font-mono text-white/40 uppercase tracking-wider">REGIONAL TREND</span>
          <div className="flex items-baseline justify-between w-full">
            <span className={`text-xs font-bold font-mono tracking-widest ${trendMeta.color}`}>{generalTrend}</span>
            <div className={`text-[8px] px-2 py-0.5 rounded font-mono flex items-center gap-1 shrink-0 ${getAqiMeta(avgAqiVal).bgColor} ${getAqiMeta(avgAqiVal).color} border ${getAqiMeta(avgAqiVal).borderColor}`} title="AQI 1-5 Scale">
              <span>AQI {avgAqiVal} ({getAqiMeta(avgAqiVal).label.toUpperCase()}) [1-5 SCALE]</span>
            </div>
          </div>
        </div>

        {/* Citizen reports received */}
        <div className="bg-black/40 border border-white/5 rounded-xl p-3 flex flex-col justify-between h-16 relative overflow-hidden">
          <div className="absolute -right-2 -bottom-2 opacity-5">
            <FileText className="h-12 w-12 text-amber-500" />
          </div>
          <span className="text-[8px] font-mono text-amber-400/80 uppercase tracking-wider">REPORT FEEDS</span>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold text-amber-300 font-mono">{reportsCount}</span>
            <span className="text-[8px] font-mono text-white/30">IN SYSTEM</span>
          </div>
        </div>
      </div>

      {/* Main content body: Prioritized Hotspot List */}
      <div className="flex-1 min-h-0 flex flex-col gap-3">
        <h3 className="text-[9px] font-mono font-bold text-white/40 uppercase tracking-widest select-none flex items-center gap-1.5">
          <Activity className="h-3 w-3 text-purple-400" />
          PRIORITIZED RESPONDER TARGET LIST
        </h3>

        {/* Hotspots Container */}
        <div className="flex-1 overflow-y-auto space-y-3.5 pr-0.5 scrollbar-thin">
          {sortedHotspots.length === 0 ? (
            /* Elegant Calm Empty State with Sci-Fi Radar */
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center border border-dashed border-white/5 rounded-2xl bg-black/25 relative overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center opacity-[0.04]">
                <Radar className="h-44 w-44 text-purple-400 animate-spin" style={{ animationDuration: '12s' }} />
              </div>
              <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 border border-purple-500/25 mb-4 text-purple-400">
                <Radar className="h-5 w-5 animate-pulse" />
              </div>
              <h4 className="text-[10px] font-mono font-black text-white uppercase tracking-widest">
                SYSTEM CALM — NO ACTIVE THREATS
              </h4>
              <p className="mt-1.5 text-[9px] text-white/40 leading-relaxed max-w-[260px] font-mono">
                Regional atmospheric sensors reporting standard ambient conditions. Core standby: Waiting for citizen uploads or telemetry spikes.
              </p>
            </div>
          ) : (
            sortedHotspots.map((h, idx) => {
              const aqiInfo = getAqiMeta(h.currentAqi || 1);
              const isHighSeverity = h.score >= 70;
              
              return (
                <div 
                  key={idx}
                  className={`group relative rounded-xl border p-4 backdrop-blur-md transition-all duration-300 bg-gradient-to-r from-white/[0.02] to-transparent ${
                    isHighSeverity 
                      ? 'border-purple-500/20 hover:border-purple-500/35 shadow-[0_4px_20px_rgba(168,85,247,0.08)]' 
                      : 'border-white/10 hover:border-cyan-500/20'
                  }`}
                >
                  {/* Subtle index glow */}
                  <div className="absolute top-3 right-3 font-mono text-[16px] font-bold text-white/5 group-hover:text-white/10 transition-colors select-none">
                    #{idx + 1}
                  </div>

                  <div className="space-y-3">
                    {/* Source, Severity and Time Info */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {isHighSeverity ? (
                          <span className="flex h-1.5 w-1.5 rounded-full bg-purple-400 animate-ping shrink-0" />
                        ) : (
                          <span className="flex h-1.5 w-1.5 rounded-full bg-cyan-400 shrink-0" />
                        )}
                        <span className="text-[11px] font-black tracking-wider text-white truncate font-display uppercase">
                          {h.sourceType}
                        </span>
                        <span 
                          className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded border uppercase shrink-0 ${aqiInfo.bgColor} ${aqiInfo.color} ${aqiInfo.borderColor}`}
                          title={`Estimated AQI level: ${h.currentAqi || 1}`}
                        >
                          AQI {h.currentAqi || 1} - {aqiInfo.label.toUpperCase()} [1-5 SCALE]
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Time elapsed */}
                        <div className="flex items-center gap-1 text-[8.5px] font-mono text-white/40">
                          <Clock className="h-2.5 w-2.5" />
                          <span>{formatElapsedTime(h.detectedAt)}</span>
                        </div>

                        {/* Trend badge */}
                        {h.predictedTrend && (
                          <div className={`flex items-center gap-0.5 text-[8px] font-mono px-1.5 py-0.2 rounded uppercase ${
                            h.predictedTrend === 'Worsening' ? 'text-rose-400 bg-rose-500/5' : 
                            h.predictedTrend === 'Improving' ? 'text-emerald-400 bg-emerald-500/5' : 'text-cyan-400 bg-cyan-500/5'
                          }`}>
                            {h.predictedTrend === 'Worsening' ? <TrendingUp className="h-2.5 w-2.5" /> : 
                             h.predictedTrend === 'Improving' ? <TrendingDown className="h-2.5 w-2.5" /> : <Activity className="h-2.5 w-2.5" />}
                            <span>{h.predictedTrend}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Coordinates & radius info */}
                    <div className="flex items-center gap-3 font-mono text-[8.5px] text-white/50 flex-wrap">
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-cyan-400 shrink-0" />
                        <span className="hover:text-cyan-300 transition-colors cursor-pointer select-all text-white font-semibold">
                          <LocationDisplay latitude={h.latitude} longitude={h.longitude} showCoordinates={true} className="font-mono text-white" />
                        </span>
                      </div>
                      <div className="w-1 h-1 rounded-full bg-white/20" />
                      <span>Impact Radius: {h.radius}m</span>
                      <div className="w-1 h-1 rounded-full bg-white/20" />
                      <div className="flex items-center gap-1">
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                        <span className="text-amber-300/90 font-bold">
                          Evidence: {reports.filter(r => getDistanceInMeters(h.latitude, h.longitude, r.latitude, r.longitude) <= (h.radius || 2000)).length} Reports Near
                        </span>
                      </div>
                    </div>

                    {/* Risk score details */}
                    <div className="space-y-1 select-none">
                      <div className="flex justify-between items-center text-[8.5px] font-mono">
                        <span className="text-white/40 uppercase">LOCAL SIGNAL INTENSITY:</span>
                        <span className={`font-bold ${isHighSeverity ? 'text-purple-400' : 'text-cyan-400'}`}>
                          {h.score}/100 Risk Score
                        </span>
                      </div>
                      <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${h.score}%` }}
                          transition={{ duration: 0.8, ease: 'easeOut' }}
                          className={`h-full rounded-full ${
                            isHighSeverity 
                              ? 'bg-gradient-to-r from-purple-500 to-indigo-500 shadow-[0_0_8px_#a855f7]' 
                              : 'bg-gradient-to-r from-cyan-500 to-blue-500'
                          }`}
                        />
                      </div>
                    </div>

                    {/* Scientific Explanation */}
                    <p className="text-[9.5px] font-mono text-white/60 leading-relaxed font-sans select-text">
                      {h.description}
                    </p>

                    {/* Recommended Response Action suggestion generated dynamically */}
                    {h.recommendedAction && (
                      <div className="p-3 rounded-lg bg-black/50 border border-purple-500/15 relative overflow-hidden select-text">
                        <div className="absolute top-0 left-0 h-full w-[2px] bg-purple-500/50" />
                        <div className="flex items-center gap-1.5 mb-1 select-none">
                          <Shield className="h-3.5 w-3.5 text-purple-400" />
                          <span className="text-[8.5px] font-mono font-black text-purple-300 tracking-wider uppercase">
                            RECOMMENDED INCIDENT ACTION
                          </span>
                        </div>
                        <p className="text-[9.5px] text-white/85 leading-relaxed italic font-mono font-medium">
                          &ldquo;{h.recommendedAction}&rdquo;
                        </p>
                      </div>
                    )}

                    {/* Dispatch Report Section */}
                    <div className="pt-2 border-t border-white/5 space-y-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <button
                          onClick={() => handleGenerateReport(h, idx)}
                          disabled={generatingReportId !== null}
                          className="flex h-8 px-3.5 items-center justify-center gap-2 rounded bg-gradient-to-r from-purple-500/10 to-indigo-500/10 hover:from-purple-500/20 hover:to-indigo-500/20 border border-purple-500/30 text-[9px] font-mono font-black tracking-wider text-purple-300 hover:text-white transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none"
                        >
                          {generatingReportId === idx ? (
                            <>
                              <RefreshCw className="h-3 w-3 animate-spin text-purple-400" />
                              <span>ANALYZING DISPATCH COGNITION...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-3 w-3 text-purple-400" />
                              <span>{generatedReports[idx] ? 'RE-GENERATE FIELD REPORT' : 'GENERATE DISPATCH REPORT'}</span>
                            </>
                          )}
                        </button>

                        {generatedReports[idx] && (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => copyToClipboard(generatedReports[idx], idx)}
                              className="flex h-7 px-2.5 items-center justify-center gap-1.5 rounded bg-white/5 border border-white/10 hover:bg-white/10 text-[8.5px] font-mono font-bold text-white/70 hover:text-white transition-all cursor-pointer select-none"
                              title="Copy Report to Clipboard"
                            >
                              {copiedReportId === idx ? (
                                <>
                                  <CheckCircle className="h-3 w-3 text-[#00FF95]" />
                                  <span className="text-[#00FF95]">COPIED</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3 w-3 text-cyan-400" />
                                  <span>COPY BRIEF</span>
                                </>
                              )}
                            </button>

                            <button
                              onClick={() => downloadReport(generatedReports[idx], `Dispatch_Brief_Hotspot_${idx+1}.txt`)}
                              className="flex h-7 px-2.5 items-center justify-center gap-1.5 rounded bg-white/5 border border-white/10 hover:bg-white/10 text-[8.5px] font-mono font-bold text-white/70 hover:text-white transition-all cursor-pointer select-none"
                              title="Download Report as text file"
                            >
                              <Download className="h-3 w-3 text-amber-400" />
                              <span>DOWNLOAD TXT</span>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Display area of generated report */}
                      {generatedReports[idx] && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="rounded-lg border border-purple-500/20 bg-[#02050f]/80 p-3 relative overflow-hidden"
                        >
                          <div className="absolute top-0 right-0 p-1.5 text-[7px] font-mono font-black text-purple-500/40 tracking-wider uppercase select-none">
                            TACTICAL RESPONSE INTEL
                          </div>
                          
                          {reportError && (
                            <div className="text-[8px] font-mono font-bold text-amber-400 bg-amber-400/5 border border-amber-400/25 p-1.5 rounded mb-2 select-text">
                              ⚠️ {reportError}
                            </div>
                          )}

                          <pre className="text-[8.5px] font-mono text-purple-200/90 leading-relaxed overflow-x-auto whitespace-pre-wrap max-h-[180px] scrollbar-thin select-text">
                            {generatedReports[idx]}
                          </pre>
                        </motion.div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
