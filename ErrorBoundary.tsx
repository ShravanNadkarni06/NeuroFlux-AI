import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ShieldAlert, RefreshCw, Cpu, Terminal } from 'lucide-react';
import SciFiBackground from './SciFiBackground';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary] Uncaught application fault:", error, errorInfo);
  }

  private handleReset = () => {
    // Clear state and reload the page to restore telemetry station antenna link
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-[#030611] text-[#c9d5ff] font-sans">
          <SciFiBackground />
          <div className="absolute inset-0 bg-[#030611]/70 backdrop-blur-md" />

          <div className="relative w-full max-w-2xl rounded-2xl border border-cyan-500/30 bg-black/75 p-8 text-center shadow-[0_0_50px_rgba(0,212,255,0.15)] overflow-hidden m-4">
            {/* Sci-Fi Scanner lines & corner accents */}
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
            <div className="absolute -top-10 -left-10 w-40 h-40 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
            
            {/* Tech Corner Brackets */}
            <div className="absolute top-3 left-3 w-3 h-3 border-t-2 border-l-2 border-cyan-500/40" />
            <div className="absolute top-3 right-3 w-3 h-3 border-t-2 border-r-2 border-cyan-500/40" />
            <div className="absolute bottom-3 left-3 w-3 h-3 border-b-2 border-l-2 border-cyan-500/40" />
            <div className="absolute bottom-3 right-3 w-3 h-3 border-b-2 border-r-2 border-cyan-500/40" />

            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.25)]">
              <ShieldAlert className="h-9 w-9 animate-pulse" />
            </div>

            <div className="flex items-center justify-center gap-2 mb-2">
              <Terminal className="h-4 w-4 text-cyan-400" />
              <span className="text-[10px] font-mono tracking-widest text-cyan-400 uppercase font-black">
                CORE SHIELD DEFLECTION ACTIVE
              </span>
            </div>

            <h2 className="font-display text-2xl font-black tracking-widest text-white uppercase mb-4">
              UNHANDLED SYSTEM FAULT DETECTED
            </h2>

            <p className="text-xs text-white/60 leading-relaxed max-w-lg mx-auto mb-6">
              The station cockpit experienced a critical rendering or logic breakdown. Our automated sentinel shield has captured the exception to prevent terminal process collapse.
            </p>

            <div className="p-4 rounded-xl bg-black/80 border border-cyan-500/20 text-left font-mono text-xs text-cyan-400/90 break-all max-h-48 overflow-y-auto mb-6 custom-scrollbar shadow-inner">
              <div className="flex items-center gap-1.5 border-b border-white/5 pb-1.5 mb-2 text-[9px] text-white/40">
                <Cpu className="h-3.5 w-3.5" />
                <span>DIAGNOSTIC UPLINK FAILURE OVERRIDE</span>
              </div>
              <p className="font-bold text-red-400">Exception Message:</p>
              <p className="mt-1 leading-relaxed whitespace-pre-wrap">{this.state.error?.message || String(this.state.error)}</p>
              {this.state.error?.stack && (
                <div className="mt-3">
                  <p className="font-bold text-white/40 text-[10px]">Stack Trace:</p>
                  <pre className="text-[9px] text-white/30 mt-1 overflow-x-auto whitespace-pre-wrap leading-tight font-mono max-h-24">
                    {this.state.error.stack}
                  </pre>
                </div>
              )}
            </div>

            <button
              onClick={this.handleReset}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#00D4FF]/10 hover:bg-[#00D4FF]/20 border border-[#00D4FF]/30 hover:border-[#00D4FF]/50 px-5 py-3 text-xs font-mono font-black text-[#00D4FF] tracking-widest uppercase transition-all duration-300 shadow-[0_0_15px_rgba(0,212,255,0.1)] hover:shadow-[0_0_20px_rgba(0,212,255,0.25)] cursor-pointer"
            >
              <RefreshCw className="h-4 w-4 animate-spin-slow" />
              <span>REBOOT HUD COCKPIT OVERLAY</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
