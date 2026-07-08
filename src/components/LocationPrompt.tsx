import React from 'react';
import { Compass, MapPin, AlertCircle, Loader2, ShieldAlert } from 'lucide-react';
import { GeolocationStatus } from '../types';

interface LocationPromptProps {
  status: GeolocationStatus;
  errorMessage: string | null;
  onRequestLocation: () => void;
}

export default function LocationPrompt({ status, errorMessage, onRequestLocation }: LocationPromptProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0A0A0B]/95 backdrop-blur-md p-4">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-black/60 p-8 text-center shadow-2xl transition-all duration-300">
        
        {/* Glow effect */}
        <div className="absolute -top-24 -left-24 h-48 w-48 rounded-full bg-cyan-500/5 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 h-48 w-48 rounded-full bg-emerald-500/5 blur-3xl" />

        <div className="relative flex flex-col items-center">
          {/* Visual Icon */}
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-xl bg-white/5 border border-white/10 text-[#00FF95]">
            {status === 'requesting' ? (
              <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
            ) : status === 'denied' ? (
              <ShieldAlert className="h-8 w-8 text-rose-500" />
            ) : (
              <Compass className="h-8 w-8 text-[#00FF95] animate-pulse" />
            )}
          </div>

          <h1 className="mb-3 font-display text-xl font-bold tracking-tight text-white uppercase">
            {status === 'requesting' ? 'Requesting Location' : 
             status === 'denied' ? 'Location Access Denied' : 
             'Location Access Required'}
          </h1>

          <p className="mb-6 text-xs text-white/60 leading-relaxed max-w-xs mx-auto">
            {status === 'requesting' ? 'Requesting GPS coordinates from your browser. This should only take a moment...' : 
             status === 'denied' ? 'We cannot load air quality and weather data without your location. Please enable location permissions for this site in your browser settings.' : 
             'NeuroFlux provides real-time, hyperlocal air pollution and weather tracking. To begin, we need permission to access your current location.'}
          </p>

          {errorMessage && (
            <div className="mb-6 flex items-start gap-2.5 rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 text-left text-xs text-rose-400">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {status !== 'requesting' && (
            <button
              onClick={onRequestLocation}
              className="group relative flex w-full items-center justify-center gap-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 px-5 py-3 text-xs font-semibold text-white tracking-widest uppercase transition-all duration-300 hover:scale-[1.02] focus:outline-none"
            >
              <MapPin className="h-3.5 w-3.5 text-[#00FF95] transition-transform group-hover:scale-110" />
              <span>{status === 'denied' ? 'Retry Location Access' : 'Use Current Location'}</span>
            </button>
          )}

          {status === 'requesting' && (
            <div className="text-[10px] text-white/30 font-mono tracking-widest uppercase animate-pulse">
              Waiting for browser GPS...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
