import React, { useState, useRef } from 'react';
import { X, Upload, Loader2, Navigation, AlertCircle, Sparkles, ShieldAlert } from 'lucide-react';
import { Coordinates, PollutionReport } from '../types';
import LocationDisplay from './LocationDisplay';

interface ReportingModalProps {
  userCoords: Coordinates;
  onClose: () => void;
  onSubmitReport: (report: PollutionReport) => void;
  onAddSystemLog: (type: 'INFO' | 'FETCH' | 'GEOL' | 'DATA', text: string, color: string) => void;
}

export default function ReportingModal({
  userCoords,
  onClose,
  onSubmitReport,
  onAddSystemLog,
}: ReportingModalProps) {
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [photoName, setPhotoName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Read file as Base64 helper
  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Telemetry failure: File must be a valid digital image stream.');
      return;
    }

    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPhotoBase64(reader.result);
        setPhotoName(file.name);
      }
    };
    reader.onerror = () => {
      setError('Telemetry failure: Unable to decode photo stream.');
    };
    reader.readAsDataURL(file);
  };

  // Click & File Inputs
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  // Drag and Drop implementation
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  // Reset Photo
  const handleRemovePhoto = () => {
    setPhotoBase64(null);
    setPhotoName('');
  };

  // Form Submit Action (calls server route & Gemini)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!photoBase64) {
      setError('Validation error: Visual telemetry photo is required.');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    onAddSystemLog('FETCH', 'Dispatching visual telemetry packet to Gemini network...', 'text-blue-400/80');

    try {
      const response = await fetch('/api/analyze-pollution', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          photo: photoBase64,
          description: description.trim(),
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Cognitive grid analysis returned an invalid status.');
      }

      const analysisResult = await response.json();

      // Validate Gemini's JSON structure
      if (!analysisResult.classification || !analysisResult.severity) {
        throw new Error('Analysis payload parsed incorrectly. Missing diagnostic classifications.');
      }

      // Create Report Object with coordinates strictly locked from live GPS
      const newReport: PollutionReport = {
        id: `civic_${Date.now()}`,
        latitude: userCoords.latitude,
        longitude: userCoords.longitude,
        photo: photoBase64,
        description: description.trim() || analysisResult.summary,
        classification: analysisResult.classification,
        severity: analysisResult.severity as 'low' | 'medium' | 'high',
        timestamp: new Date().toISOString(),
      };

      onSubmitReport(newReport);
      
      const severityColor = newReport.severity === 'high' ? 'text-rose-400' : newReport.severity === 'medium' ? 'text-amber-400' : 'text-cyan-400';
      onAddSystemLog(
        'DATA', 
        `SPOTTER DISPATCH CONFIRMED: ${newReport.classification.toUpperCase()} (${newReport.severity.toUpperCase()})`, 
        `${severityColor} font-bold`
      );

      // Close modal on success
      onClose();
    } catch (err: any) {
      console.error('Submission error:', err);
      setError(err.message || 'Cognitive grid uplink error. Please check server connections.');
      onAddSystemLog('INFO', `Dispatch Uplink Failure: ${err.message || 'Unknown error'}`, 'text-red-400/80');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      {/* Backdrop with extreme blur and dark tint */}
      <div className="absolute inset-0 bg-[#030611]/80 backdrop-blur-md" onClick={() => !isAnalyzing && onClose()} />

      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-[#050c20]/95 p-6 shadow-2xl glass-panel md:p-8 animate-fade-in pointer-events-auto">
        <div className="scanner-line opacity-20" />
        
        {/* Holographic header lines */}
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent" />

        {/* Modal Close Button */}
        <button
          onClick={onClose}
          disabled={isAnalyzing}
          className="absolute top-4 right-4 rounded-lg bg-white/5 p-1.5 text-white/50 hover:bg-white/10 hover:text-white transition-colors border border-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Title */}
        <div className="mb-6">
          <h2 className="font-display text-base font-bold text-white tracking-widest uppercase flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#00D4FF]" />
            CIVIC DISPATCH SENSORY UPLINK
          </h2>
          <p className="text-[10px] font-mono text-white/40 uppercase mt-0.5">UPLINK PORT: ACTIVE // SECURE SENSORY PORTAL</p>
        </div>

        {/* Live Coordinates Readout (Locked - No input box!) */}
        <div className="mb-6 bg-black/60 border border-cyan-500/20 rounded-xl p-3.5 flex items-center gap-3.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-400/10 border border-cyan-400/30 text-cyan-400 animate-pulse">
            <Navigation className="h-4.5 w-4.5" />
          </div>
          <div className="font-mono text-left">
            <div className="text-[8px] text-cyan-400 font-bold uppercase tracking-wider">GPS TELEMETRY ENCRYPT LOCK</div>
            <div className="text-xs text-white font-bold tracking-tight mt-0.5 uppercase flex flex-col gap-0.5">
              <span><LocationDisplay latitude={userCoords.latitude} longitude={userCoords.longitude} showCoordinates={false} className="text-white" /></span>
              <span className="text-[9px] text-white/40 font-mono tracking-widest mt-0.5">LAT: {userCoords.latitude.toFixed(6)}°N // LON: {userCoords.longitude.toFixed(6)}°E</span>
            </div>
          </div>
        </div>

        {/* Error State Banner */}
        {error && (
          <div className="mb-5 flex items-start gap-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300">
            <AlertCircle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
            <div className="text-[10px] font-mono uppercase leading-relaxed font-bold tracking-wide">
              {error}
            </div>
          </div>
        )}

        {/* Dispatch Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* DRAG AND DROP / FILE UPLOAD CONTAINER */}
          <div>
            <label className="block text-[9px] font-mono text-white/40 uppercase tracking-wider mb-2">
              SENSORY DISPATCH EVIDENCE PHOTO (REQUIRED)
            </label>

            {!photoBase64 ? (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={triggerFileSelect}
                className={`relative group cursor-pointer flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-6 text-center transition-all duration-300 min-h-[140px] ${
                  isDragOver
                    ? 'border-[#00D4FF] bg-cyan-500/10 shadow-[0_0_15px_rgba(6,182,212,0.1)]'
                    : 'border-white/10 hover:border-cyan-500/40 bg-black/40 hover:bg-black/60'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  className="hidden"
                />
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 border border-white/10 text-white/40 group-hover:text-cyan-400 group-hover:border-cyan-500/30 transition-all mb-3">
                  <Upload className="h-5 w-5 group-hover:scale-110 transition-transform" />
                </div>
                <div className="text-xs font-bold text-white/80 group-hover:text-white">
                  DRAG PHOTO HERE OR CLICK TO UPLOAD
                </div>
                <div className="text-[9px] font-mono text-white/40 mt-1 uppercase">
                  SUPPORTS JPEG, PNG, WEBP (MAX 10MB)
                </div>
              </div>
            ) : (
              <div className="relative rounded-2xl overflow-hidden border border-white/25 bg-black/60 p-2 flex items-center gap-4">
                <div className="h-20 w-20 rounded-xl overflow-hidden border border-white/10 shrink-0 bg-black/50">
                  <img src={photoBase64} alt="Uploaded evidence preview" className="h-full w-full object-cover" />
                </div>
                <div className="flex-1 min-w-0 pr-12 text-left">
                  <div className="text-xs font-bold text-white truncate">{photoName}</div>
                  <div className="text-[9px] font-mono text-[#00FF95]/80 uppercase mt-0.5 font-bold flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#00FF95] animate-pulse" />
                    PHOTO BUFFER READY
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 hover:border-rose-500/30 transition-all text-[10px] font-mono font-bold tracking-wider uppercase"
                >
                  REMOVE
                </button>
              </div>
            )}
          </div>

          {/* Description Textarea */}
          <div>
            <label className="block text-[9px] font-mono text-white/40 uppercase tracking-wider mb-2">
              OPTIONAL SENSORY CONTEXT (DESCRIPTION)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide a quick note of what you see (e.g. 'industrial kiln chimney blowing dark exhaust' or 'neighbor backyard bonfire blowing dust')..."
              rows={3}
              maxLength={150}
              className="w-full bg-black/60 border border-white/10 focus:border-cyan-500/50 rounded-xl p-3 text-xs text-white/80 placeholder-white/30 font-sans outline-none focus:ring-0 resize-none transition-colors"
            />
            <div className="text-right text-[8px] font-mono text-white/30 uppercase mt-1">
              {description.length}/150 CHARS MAX
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isAnalyzing}
              className="flex-1 py-3 rounded-xl border border-white/10 hover:border-white/20 text-white/60 hover:text-white bg-white/5 hover:bg-white/10 text-xs font-mono font-bold tracking-widest uppercase transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ABORT UPLINK
            </button>
            <button
              type="submit"
              disabled={!photoBase64 || isAnalyzing}
              className="flex-1 relative overflow-hidden py-3 rounded-xl bg-gradient-to-r from-[#00D4FF] to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-mono font-bold tracking-widest uppercase transition-all shadow-[0_0_15px_rgba(6,182,212,0.2)] hover:shadow-[0_0_25px_rgba(6,182,212,0.4)] disabled:from-white/5 disabled:to-white/5 disabled:text-white/20 disabled:border-white/5 disabled:shadow-none disabled:cursor-not-allowed border border-cyan-400/20"
            >
              TRANSMIT PACKET
            </button>
          </div>
        </form>

        {/* Gemini Analysing/Diagnosing Holographic Overlay */}
        {isAnalyzing && (
          <div className="absolute inset-0 z-40 bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center select-none">
            <div className="scanner-line opacity-45" />
            <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-400/10 border border-cyan-400/30 text-cyan-400 mb-5 animate-pulse">
              <Loader2 className="h-7 w-7 animate-spin text-cyan-400" />
            </div>

            <h3 className="font-display text-sm font-bold text-white tracking-widest uppercase mb-1">
              GEMINI COGNITIVE INTERROGATION
            </h3>
            
            <p className="text-[10px] font-mono text-cyan-400 animate-pulse uppercase tracking-widest mb-3">
              CONNECTING TO SENSORY DIAGNOSTICS GRID...
            </p>

            <p className="text-[10px] text-white/50 leading-relaxed max-w-xs mx-auto">
              Scanning visual stream for localized particulate density, hazardous chemical signatures, and emission type classifications...
            </p>

            {/* Simulated blueprint telemetry rows */}
            <div className="w-full max-w-xs space-y-1.5 mt-5 text-left border-t border-white/10 pt-4 font-mono text-[8px] text-white/30">
              <div className="flex justify-between items-center">
                <span>GEMINI VISION GRID:</span>
                <span className="text-[#00FF95] font-bold">ONLINE</span>
              </div>
              <div className="flex justify-between items-center">
                <span>IMAGE STREAM CONVERT:</span>
                <span className="text-[#00FF95] font-bold">BASE64_STREAM_OK</span>
              </div>
              <div className="flex justify-between items-center">
                <span>SEVERITY CLASSIFIER:</span>
                <span className="text-amber-500 animate-pulse font-bold">PROBING_DENSITY...</span>
              </div>
              {/* Shimmer loading bar */}
              <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden mt-2">
                <div className="h-full w-1/2 rounded-full holo-shimmer bg-[#00D4FF]" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
