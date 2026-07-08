import React from 'react';
import { 
  Brain, 
  Cpu, 
  TrendingUp, 
  AlertTriangle, 
  Layers, 
  Sparkles,
  Info,
  Compass
} from 'lucide-react';
import { motion } from 'motion/react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  ReferenceLine,
  Dot
} from 'recharts';
import { HotspotRiskAssessment, AQIPrediction, MapLayerMode } from '../types';
import { AQI_MAPPING } from '../utils/aqiHelper';

interface IntelligencePanelProps {
  hotspotAssessment: HotspotRiskAssessment | null;
  aqiPrediction: AQIPrediction | null;
  currentAqi: number;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  layerMode: MapLayerMode;
  onLayerModeChange: (mode: MapLayerMode) => void;
}

export default function IntelligencePanel({
  hotspotAssessment,
  aqiPrediction,
  currentAqi,
  loading,
  error,
  onRefresh,
  layerMode,
  onLayerModeChange
}: IntelligencePanelProps) {

  // Get color for risk label
  const getRiskColor = (label: string) => {
    switch (label?.toLowerCase()) {
      case 'low': return { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', glow: 'shadow-[0_0_15px_rgba(16,185,129,0.35)]', ping: 'bg-emerald-400' };
      case 'moderate': return { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', glow: 'shadow-[0_0_15px_rgba(245,158,11,0.35)]', ping: 'bg-amber-400' };
      case 'high': return { text: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20', glow: 'shadow-[0_0_15px_rgba(249,115,22,0.35)]', ping: 'bg-orange-400' };
      case 'severe': return { text: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20', glow: 'shadow-[0_0_15px_rgba(244,63,94,0.35)]', ping: 'bg-rose-400' };
      default: return { text: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20', glow: 'shadow-[0_0_15px_rgba(6,182,212,0.35)]', ping: 'bg-cyan-400' };
    }
  };

  const riskStyle = hotspotAssessment ? getRiskColor(hotspotAssessment.riskLabel) : getRiskColor('low');

  // Prepare chart data combining History, Current (Now) and Predicted blocks
  const chartData = React.useMemo(() => {
    if (!aqiPrediction?.predictions) return [];

    const historyList = aqiPrediction.history || [];
    const predList = aqiPrediction.predictions || [];

    const formatted = [];

    // 1. Historical points
    for (const h of historyList) {
      formatted.push({
        name: h.label,
        actualAqi: h.aqi,
        predictedAqi: null,
        timestamp: h.time
      });
    }

    // 2. Now point (bridge point: has BOTH actual and predicted)
    formatted.push({
      name: 'Now',
      actualAqi: currentAqi,
      predictedAqi: currentAqi,
      timestamp: 'Actual'
    });

    // 3. Predicted points
    for (const p of predList) {
      formatted.push({
        name: p.label,
        actualAqi: null,
        predictedAqi: Number(p.aqi.toFixed(1)),
        timestamp: p.time
      });
    }

    return formatted;
  }, [aqiPrediction, currentAqi]);

  // Check if there is an active spike prediction
  const isSpikeRisk = React.useMemo(() => {
    if (aqiPrediction?.willSpike) return true;
    if (aqiPrediction?.predictions) {
      return aqiPrediction.predictions.some(p => p.aqi >= 3.5);
    }
    return false;
  }, [aqiPrediction]);

  // Recharts custom dot to distinguish actual from predicted
  const CustomDot = (props: any) => {
    const { cx, cy, payload, dataKey } = props;
    if (!cx || !cy) return null;

    const isPredicted = dataKey === 'predictedAqi';
    if (isPredicted && payload.name === 'Now') return null;

    if (isPredicted) {
      return (
        <svg x={cx - 4} y={cy - 4} width={8} height={8} className="overflow-visible">
          <circle cx={4} cy={4} r={3} fill="#030611" stroke="#3b82f6" strokeWidth={2} />
          <circle cx={4} cy={4} r={1.5} fill="#3b82f6" className="animate-pulse" />
        </svg>
      );
    }

    return (
      <svg x={cx - 6} y={cy - 6} width={12} height={12} className="overflow-visible">
        <circle cx={6} cy={6} r={4.5} fill="#00FF95" stroke="#ffffff" strokeWidth={1.5} className="shadow-lg" />
        {payload.name === 'Now' && (
          <circle cx={6} cy={6} r={6} fill="none" stroke="#00FF95" strokeWidth={1} className="animate-ping" style={{ transformOrigin: 'center' }} />
        )}
      </svg>
    );
  };

  return (
    <div className="relative w-full rounded-2xl border border-white/15 bg-gradient-to-b from-[#070e28]/90 to-[#040817]/95 p-5 backdrop-blur-xl shadow-[0_25px_60px_rgba(0,0,0,0.65)] select-none flex flex-col gap-4 max-h-[600px] overflow-y-auto scrollbar-none transition-all duration-300">
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-purple-500/40 to-transparent animate-pulse" />
      
      {/* Header section with Cognitive Brain Scan styling */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3.5 shadow-[0_4px_12px_rgba(0,0,0,0.15)]">
        <div className="flex items-center gap-2.5">
          <div className="relative flex h-8.5 w-8.5 items-center justify-center rounded-lg bg-purple-500/15 border border-purple-500/30">
            <Brain className="h-4.5 w-4.5 text-purple-400 animate-pulse" />
            <Sparkles className="absolute -top-1 -right-1 h-2.5 w-2.5 text-yellow-400 animate-bounce" />
          </div>
          <div>
            <h2 className="text-[11px] font-extrabold tracking-widest text-white uppercase font-display flex items-center gap-1.5">
              AEROSENSE INTELLIGENCE
            </h2>
            <p className="text-[8.5px] font-mono text-purple-400/80 tracking-widest uppercase">
              SENTINEL REASONING CORE
            </p>
          </div>
        </div>

        {/* Loading Indicator */}
        {loading && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-purple-500/10 border border-purple-500/20 font-mono text-[8px] text-purple-300 shadow-[0_0_10px_rgba(168,85,247,0.15)]">
            <Cpu className="h-3 w-3 animate-spin text-purple-400" />
            <span className="tracking-widest">SYNTHESIZING...</span>
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-center space-y-2.5 shadow-[0_0_20px_rgba(239,68,68,0.12)] relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-red-500/50 to-transparent" />
          <p className="text-[10px] font-black font-mono text-red-400 tracking-widest uppercase drop-shadow-[0_0_8px_rgba(248,113,113,0.4)]">
            SYNAPSE DESYNC FAULT
          </p>
          <p className="text-[9px] font-mono text-red-200/70 uppercase leading-relaxed tracking-wide px-1">
            {error}
          </p>
          <button 
            onClick={onRefresh}
            className="px-4 py-1.5 rounded-md bg-red-950/40 hover:bg-red-900/40 border border-red-500/40 hover:border-red-400 text-[9px] font-mono font-black tracking-widest text-white cursor-pointer transition-all duration-300 hover:shadow-[0_0_12px_rgba(239,68,68,0.25)] active:scale-95 uppercase"
          >
            RE-ENGAGE SYNAPSE
          </button>
        </div>
      )}

      {!hotspotAssessment && !aqiPrediction && !loading && !error && (
        <div className="py-12 text-center space-y-3">
          <Cpu className="h-10 w-10 text-white/20 mx-auto animate-pulse" />
          <p className="text-xs text-white/40 max-w-xs mx-auto leading-relaxed">
            AeroSense cognitive core requires live sensor packets and wind logs to calculate hotspots.
          </p>
          <button 
            onClick={onRefresh}
            className="px-4 py-1.5 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 text-[10px] font-mono font-bold uppercase tracking-wider text-purple-300 cursor-pointer transition-all duration-250"
          >
            BOOT AI COGNITION
          </button>
        </div>
      )}

      {/* AI Intelligence Outputs */}
      {(hotspotAssessment || aqiPrediction) && (
        <div className="space-y-4">
          
          {/* Active Spike Warning Banner (Dynamic Amber/Red Pulse Glow) */}
          {isSpikeRisk && aqiPrediction?.willSpike && (
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 shadow-[0_0_20px_rgba(244,63,94,0.15)] flex gap-3 relative overflow-hidden"
            >
              <div className="absolute inset-y-0 left-0 w-1 bg-rose-500" />
              <div className="relative z-10 shrink-0 h-8 w-8 rounded-lg bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
                <AlertTriangle className="h-4 w-4 animate-bounce" />
              </div>
              <div className="space-y-0.5">
                <h4 className="text-[10px] font-black tracking-wider text-rose-400 font-mono uppercase flex items-center gap-1">
                  PREDICTED AQI SPIKE WARNING
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-ping inline-block" />
                </h4>
                <p className="text-[9px] text-white/80 leading-relaxed font-sans">
                  {aqiPrediction.spikeReason || "AI engine predicts an immediate aerosol spike at this station coordinates within the next 24 hours."}
                </p>
              </div>
            </motion.div>
          )}

          {/* 1. Hotspot Risk Assessment Card */}
          {hotspotAssessment && (
            <div className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="text-[9px] font-mono text-white/40 uppercase tracking-widest">
                    Local Hotspot Risk
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-black font-mono text-white">
                      {hotspotAssessment.riskScore}
                    </span>
                    <span className="text-xs text-white/20 font-light">/100</span>
                    
                    <span className={`px-2 py-0.5 rounded text-[8px] font-mono font-bold uppercase tracking-wider ${riskStyle.bg} ${riskStyle.text} ${riskStyle.border} ${riskStyle.glow} flex items-center gap-1`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${riskStyle.ping} animate-pulse inline-block`} />
                      {hotspotAssessment.riskLabel}
                    </span>
                  </div>
                </div>

                {/* Cognitive radial visual */}
                <div className="relative h-12 w-12 flex items-center justify-center shrink-0">
                  <svg className="absolute h-12 w-12 transform -rotate-90">
                    <circle cx="24" cy="24" r="21" fill="transparent" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
                    <circle cx="24" cy="24" r="21" fill="transparent" 
                      stroke={hotspotAssessment.riskScore >= 75 ? '#f43f5e' : hotspotAssessment.riskScore >= 50 ? '#f97316' : hotspotAssessment.riskScore >= 25 ? '#eab308' : '#10b981'} 
                      strokeWidth="3.5" 
                      strokeDasharray={`${2 * Math.PI * 21}`}
                      strokeDashoffset={`${2 * Math.PI * 21 * (1 - hotspotAssessment.riskScore / 100)}`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <Cpu className="h-4.5 w-4.5 text-white/20" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2.5 border-t border-white/5 font-mono text-[9px]">
                <div className="space-y-0.5">
                  <div className="text-white/30 uppercase">INFERRED SOURCE:</div>
                  <div className="text-white font-bold tracking-tight truncate text-[10px] text-purple-300">
                    {hotspotAssessment.sourceType.toUpperCase()}
                  </div>
                </div>
                <div className="space-y-0.5">
                  <div className="text-white/30 uppercase">ACTIVE HOTSPOTS:</div>
                  <div className="text-[#00FF95] font-bold">
                    {hotspotAssessment.hotspots?.length || 0} DEPLOYED
                  </div>
                </div>
              </div>

              <p className="text-[10px] text-white/70 italic leading-relaxed pt-1.5 border-t border-white/5">
                "{hotspotAssessment.explanation}"
              </p>

              {/* Map Layer Controls in Intelligence Tab */}
              <div className="pt-2">
                <div className="text-[8px] font-mono text-white/30 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                  <Layers className="h-3 w-3" />
                  RADIAL MAP LAYER OVERLAY
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => onLayerModeChange('hotspots')}
                    className={`px-2.5 py-1.5 rounded-lg font-mono text-[8px] uppercase tracking-wider border cursor-pointer text-center transition-all duration-200 ${
                      layerMode === 'hotspots'
                        ? 'bg-purple-500/10 border-purple-500/40 text-purple-300 shadow-[0_0_8px_rgba(168,85,247,0.15)]'
                        : 'bg-black/20 border-white/5 text-white/50 hover:text-white/80 hover:bg-white/5'
                    }`}
                  >
                    AI Hotspots Only
                  </button>
                  <button
                    onClick={() => onLayerModeChange('both')}
                    className={`px-2.5 py-1.5 rounded-lg font-mono text-[8px] uppercase tracking-wider border cursor-pointer text-center transition-all duration-200 ${
                      layerMode === 'both'
                        ? 'bg-[#00D4FF]/10 border-[#00D4FF]/40 text-[#00D4FF] shadow-[0_0_8px_rgba(0,212,255,0.15)]'
                        : 'bg-black/20 border-white/5 text-white/50 hover:text-white/80 hover:bg-white/5'
                    }`}
                  >
                    Combined HUD Matrix
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 2. 24-Hour Trend & Prediction Card */}
          {aqiPrediction && (
            <div className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-3.5">
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5 text-[#3b82f6]" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-white">
                    24-Hour Predictive Trajectory
                  </span>
                </div>
                <div className="flex items-center gap-2 font-mono text-[8px]">
                  <span className="text-white/30">CONFIDENCE:</span>
                  <span className={`font-black uppercase ${
                    aqiPrediction.confidence === 'High' ? 'text-[#00FF95]' : aqiPrediction.confidence === 'Medium' ? 'text-amber-300' : 'text-rose-400'
                  }`}>
                    {aqiPrediction.confidence}
                  </span>
                </div>
              </div>

              {/* Glowing Area Chart for Predictions */}
              <div className="h-32 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                    <defs>
                      <linearGradient id="actualGlow" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00ff95" stopOpacity={0.25}/>
                        <stop offset="95%" stopColor="#00ff95" stopOpacity={0.0}/>
                      </linearGradient>
                      <linearGradient id="predictionGlow" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0}/>
                      </linearGradient>
                    </defs>
                    <XAxis 
                      dataKey="name" 
                      stroke="rgba(255,255,255,0.2)" 
                      fontSize={8}
                      fontFamily="monospace"
                      tickLine={false}
                    />
                    <YAxis 
                      domain={[1, 5]} 
                      ticks={[1, 2, 3, 4, 5]}
                      stroke="rgba(255,255,255,0.2)" 
                      fontSize={8}
                      fontFamily="monospace"
                      tickLine={false}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'rgba(3, 6, 17, 0.95)', 
                        borderColor: 'rgba(255,255,255,0.15)', 
                        borderRadius: '8px',
                        fontFamily: 'monospace',
                        fontSize: '9px',
                        color: '#c9d5ff'
                      }}
                      formatter={(value: any, name: any) => {
                        const labelWord = name === 'predictedAqi' ? 'Predicted' : 'Actual';
                        const aqiInt = Math.max(1, Math.min(5, Math.round(Number(value))));
                        const aqiLabel = AQI_MAPPING[aqiInt as 1|2|3|4|5]?.label || 'Unknown';
                        return [`AQI ${value} - ${aqiLabel.toUpperCase()} (${labelWord}) [1-5 SCALE]`];
                      }}
                    />
                    <ReferenceLine y={3} stroke="rgba(234,179,8,0.2)" strokeDasharray="3 3" />
                    <ReferenceLine y={4} stroke="rgba(244,63,94,0.3)" strokeDasharray="3 3" />
                    <Area 
                      type="monotone" 
                      dataKey="actualAqi" 
                      stroke="#00ff95" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#actualGlow)" 
                      dot={<CustomDot />}
                      connectNulls={false}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="predictedAqi" 
                      stroke="#3b82f6" 
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      fillOpacity={1} 
                      fill="url(#predictionGlow)" 
                      dot={<CustomDot />}
                      connectNulls={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Chart Legend */}
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-[8px] font-mono text-white/40 border-t border-white/5 pt-2.5 select-none">
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-1.5 w-3 rounded-sm bg-[#00ff95]" />
                  <span>24H ACTUAL TREND</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full bg-[#00ff95] animate-pulse" />
                  <span>SENSING COCKPIT (NOW)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-1.5 w-3 border-t border-dashed border-[#3b82f6] bg-transparent" />
                  <span>DASHED COGNITIVE PREDICTION</span>
                </div>
              </div>
            </div>
          )}

          {/* Wind Drift Compass Card */}
          {hotspotAssessment && (
            <div className="p-3 rounded-xl bg-[#091533]/40 border border-[#1e3a8a]/20 flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                <Compass className="h-4.5 w-4.5 text-blue-400 animate-spin" style={{ animationDuration: '30s' }} />
              </div>
              <div className="space-y-0.5">
                <span className="text-[8px] font-mono text-white/30 uppercase tracking-wider block">WIND DISPERSAL MATRIX</span>
                <p className="text-[9px] text-white/70 leading-relaxed font-sans">
                  AI tracks regional drift based on real physical wind speed. Local vectors suggest downwind particles dissipate normally under current speeds.
                </p>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
