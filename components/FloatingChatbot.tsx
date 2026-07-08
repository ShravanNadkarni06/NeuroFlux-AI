import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, 
  X, 
  Send, 
  Sparkles, 
  Bot, 
  User, 
  ShieldAlert, 
  HelpCircle,
  TrendingUp,
  Wind,
  Shield,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Coordinates, Pollutants, Hotspot, AQIPrediction, PollutionReport } from '../types';
import { db } from '../lib/firebase';
import { collection, doc, setDoc, getDocs, query, orderBy } from 'firebase/firestore';
import { getCachedLocationName } from './LocationDisplay';

interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: Date;
}

interface FloatingChatbotProps {
  coords: Coordinates | null;
  aqi: number | null;
  pollutants: Pollutants | null;
  wind: { speed: number; deg: number } | null;
  hotspots: Hotspot[];
  prediction: AQIPrediction | null;
  reports: PollutionReport[];
}

export default function FloatingChatbot({
  coords,
  aqi,
  pollutants,
  wind,
  hotspots,
  prediction,
  reports
}: FloatingChatbotProps) {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [sessionId, setSessionId] = useState<string>(() => {
    let id = localStorage.getItem('neuroflux_chat_session_id');
    if (!id) {
      id = `session_${Math.random().toString(36).substring(2, 15)}`;
      localStorage.setItem('neuroflux_chat_session_id', id);
    }
    return id;
  });
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'model',
      content: "Aerosense HUD Neural Core initialized. Welcome. I am **NeuroFlux AI**, your localized atmospheric safety and telemetry responder. Ask me anything about current ambient risk, local hotspots, wind dispersion drift, or future predictive projections in this neighborhood.",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [hasNewAlert, setHasNewAlert] = useState<boolean>(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Load chat history from Firestore on session setup
  useEffect(() => {
    const fetchChatHistory = async () => {
      try {
        const q = query(
          collection(db, 'chat_sessions', sessionId, 'messages'),
          orderBy('timestamp', 'asc')
        );
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const loaded: Message[] = [];
          querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            loaded.push({
              id: docSnap.id,
              role: data.role,
              content: data.content,
              timestamp: data.timestamp?.toDate() || new Date(data.timestampStr || Date.now())
            });
          });
          setMessages(loaded);
        } else {
          // If Firestore has no messages, we default to the initial greeting
          setMessages([
            {
              id: 'welcome',
              role: 'model',
              content: "Aerosense HUD Neural Core initialized. Welcome. I am **NeuroFlux AI**, your localized atmospheric safety and telemetry responder. Ask me anything about current ambient risk, local hotspots, wind dispersion drift, or future predictive projections in this neighborhood.",
              timestamp: new Date()
            }
          ]);
        }
      } catch (err) {
        console.error("Failed to load chat history from Firestore:", err);
      }
    };
    fetchChatHistory();
  }, [sessionId]);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Support closing chatbot panel with Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Alert highlight for open chat
  useEffect(() => {
    if (!isOpen && messages.length > 1) {
      setHasNewAlert(true);
    }
  }, [messages, isOpen]);

  const handleOpenToggle = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setHasNewAlert(false);
    }
  };

  const handleSendMessage = async (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed || loading) return;

    // Clear input
    setInput('');

    // Create user message
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    // Save user message to Firestore
    try {
      const userMsgRef = doc(collection(db, 'chat_sessions', sessionId, 'messages'), userMsg.id);
      await setDoc(userMsgRef, {
        role: userMsg.role,
        content: userMsg.content,
        timestamp: userMsg.timestamp,
        timestampStr: userMsg.timestamp.toISOString()
      });
      await setDoc(doc(db, 'chat_sessions', sessionId), { lastActive: new Date() }, { merge: true });
    } catch (e) {
      console.error("Error writing user message to Firestore:", e);
    }

    try {
      // Build session-level history to send to server. Exclude the first welcome message if it's there.
      const historyPayload = messages
        .filter(m => m.id !== 'welcome')
        .map(m => ({
          role: m.role,
          content: m.content
        }));

      // Gather current live data state to ground model instructions
      const liveData = {
        coords,
        resolvedLocationName: coords ? (getCachedLocationName(coords.latitude, coords.longitude) || null) : null,
        aqi,
        pollutants,
        wind,
        hotspots,
        prediction,
        reports
      };

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          history: historyPayload,
          liveData
        })
      });

      if (!response.ok) {
        throw new Error("Telemetry response link severed. Failed to communicate with core API.");
      }

      const data = await response.json();
      
      const modelMsg: Message = {
        id: `model-${Date.now()}`,
        role: 'model',
        content: data.text || "Diagnostic trace empty. No response received.",
        timestamp: new Date()
      };

      setMessages(prev => [...prev, modelMsg]);

      // Save model message to Firestore
      try {
        const modelMsgRef = doc(collection(db, 'chat_sessions', sessionId, 'messages'), modelMsg.id);
        await setDoc(modelMsgRef, {
          role: modelMsg.role,
          content: modelMsg.content,
          timestamp: modelMsg.timestamp,
          timestampStr: modelMsg.timestamp.toISOString()
        });
      } catch (e) {
        console.error("Error writing model response to Firestore:", e);
      }
    } catch (err: any) {
      console.error("Chatbot API Error:", err);
      const errMsg: Message = {
        id: `error-${Date.now()}`,
        role: 'model',
        content: `🚨 **SYSTEM LINK FAILURE:** ${err.message || "Failed to establish secure communications pipeline with the core intelligence server. Please try again."}`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendMessage(input);
  };

  // Suggestion chips
  const suggestionChips = [
    { label: "Is it safe outside?", query: "Based on current telemetry, is it safe to go for an outdoor run/exercise right now? What are the key metrics telling you?" },
    { label: "Explain nearest hotspot", query: "Can you analyze the nearest active air quality hotspot, its severity, and whether wind is carrying pollutants towards my current area?" },
    { label: "What's the 24hr forecast?", query: "What is the 24-hour predictive forecast trend? Will there be any dangerous AQI spikes and what is your model's confidence?" },
    { label: "Indoor protection advice", query: "What are the most effective safety actions and precautions I should take indoors right now based on current telemetry?" }
  ];

  // Markdown Custom Parser Helper
  const renderMarkdown = (text: string) => {
    if (!text) return null;
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      let currentLine = line;

      // Check for bullet point
      const isBullet = currentLine.trim().startsWith('* ') || currentLine.trim().startsWith('- ');
      if (isBullet) {
        currentLine = currentLine.trim().substring(2);
      }

      // Check for bold text: **text**
      const boldRegex = /\*\*(.*?)\*\*/g;
      const parts = [];
      let lastIndex = 0;
      let match;

      while ((match = boldRegex.exec(currentLine)) !== null) {
        if (match.index > lastIndex) {
          parts.push(currentLine.substring(lastIndex, match.index));
        }
        parts.push(<strong key={match.index} className="text-[#00D4FF] font-black">{match[1]}</strong>);
        lastIndex = boldRegex.lastIndex;
      }
      if (lastIndex < currentLine.length) {
        parts.push(currentLine.substring(lastIndex));
      }

      const content = parts.length > 0 ? parts : currentLine;

      if (isBullet) {
        return (
          <li key={idx} className="ml-4 list-disc text-white/85 text-[10.5px] font-mono leading-relaxed mt-1">
            {content}
          </li>
        );
      }

      // Check for empty line
      if (!currentLine.trim()) {
        return <div key={idx} className="h-2" />;
      }

      return (
        <p key={idx} className="text-white/85 text-[10.5px] font-mono leading-relaxed mt-1">
          {content}
        </p>
      );
    });
  };

  return (
    <>
      {/* Floating Glowing Launcher */}
      <button
        id="chatbot-launcher"
        onClick={handleOpenToggle}
        className={`fixed bottom-5 right-5 z-50 h-14 w-14 rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:shadow-[0_0_30px_rgba(6,182,212,0.5)] ${
          isOpen 
            ? 'bg-rose-950/90 border border-rose-500/50 text-rose-400 hover:text-rose-300' 
            : 'bg-[#040817]/90 border border-[#00D4FF]/40 hover:border-[#00D4FF] text-[#00D4FF] hover:text-[#7df2ff]'
        }`}
        title="Open Neural Core Chatbot"
        aria-label="Toggle Neural Core Chatbot"
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <X className="h-6 w-6" />
            </motion.div>
          ) : (
            <motion.div
              key="open"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="relative"
            >
              <MessageSquare className="h-6 w-6 animate-pulse" />
              {hasNewAlert && (
                <span className="absolute -top-1.5 -right-1.5 flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-cyan-500 text-[8px] font-bold text-black items-center justify-center font-mono">1</span>
                </span>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </button>

      {/* Floating Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            id="chatbot-panel"
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            className="fixed inset-x-4 bottom-24 h-[500px] md:h-[550px] md:w-[400px] md:right-5 md:left-auto z-50 rounded-2xl border border-white/15 bg-slate-950/90 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden"
          >
            {/* Top scanning HUD wire */}
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#00D4FF]/50 to-transparent animate-pulse" />

            {/* Panel Header */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-black/40">
              <div className="flex items-center gap-2.5">
                <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/15 border border-cyan-500/30">
                  <Bot className="h-4.5 w-4.5 text-[#00D4FF] animate-pulse" />
                  <span className="absolute top-0 right-0 flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-cyan-500"></span>
                  </span>
                </div>
                <div>
                  <h3 className="text-[10.5px] font-black tracking-widest text-white uppercase font-display flex items-center gap-1.5">
                    NEURAL COGNITIVE DECK
                  </h3>
                  <p className="text-[8px] font-mono text-cyan-400 tracking-wider uppercase">
                    ACTIVE TELEMETRY QUANTUM GUEST
                  </p>
                </div>
              </div>

              {/* Reset session button */}
              <button
                onClick={() => {
                  const newSid = `session_${Math.random().toString(36).substring(2, 15)}`;
                  localStorage.setItem('neuroflux_chat_session_id', newSid);
                  setSessionId(newSid);
                  setMessages([
                    {
                      id: 'welcome',
                      role: 'model',
                      content: "Aerosense HUD Neural Core reset complete. All diagnostic signals are clear. Tell me your environmental concerns.",
                      timestamp: new Date()
                    }
                  ]);
                }}
                className="text-[8px] font-mono font-bold text-white/40 hover:text-white/85 hover:bg-white/5 border border-white/10 px-1.5 py-0.5 rounded cursor-pointer transition-colors"
                title="Clear Chat History"
              >
                RESET CORE
              </button>
            </div>

            {/* Chat Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
              {messages.map((m) => {
                const isModel = m.role === 'model';
                return (
                  <div
                    key={m.id}
                    className={`flex gap-2.5 ${isModel ? 'justify-start' : 'justify-end'}`}
                  >
                    {isModel && (
                      <div className="shrink-0 h-6 w-6 rounded bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-[#00D4FF]">
                        <Bot className="h-3.5 w-3.5" />
                      </div>
                    )}
                    <div
                      className={`rounded-2xl px-3.5 py-2.5 max-w-[85%] text-left font-mono text-[10.5px] shadow-[0_4px_12px_rgba(0,0,0,0.3)] ${
                        isModel
                          ? 'bg-slate-900/60 border border-white/5 rounded-tl-none text-white/90'
                          : 'bg-cyan-500/15 border border-cyan-500/35 rounded-tr-none text-cyan-100 shadow-[0_0_12px_rgba(6,182,212,0.15)]'
                      }`}
                    >
                      {isModel ? renderMarkdown(m.content) : <p className="leading-relaxed whitespace-pre-wrap">{m.content}</p>}
                      <div className="mt-1 flex items-center justify-end text-[7px] text-white/30 font-mono">
                        {m.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    {!isModel && (
                      <div className="shrink-0 h-6 w-6 rounded bg-cyan-500/25 border border-cyan-500/40 flex items-center justify-center text-white">
                        <User className="h-3.5 w-3.5" />
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Loading Indicator */}
              {loading && (
                <div className="flex gap-2.5 justify-start">
                  <div className="shrink-0 h-6 w-6 rounded bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-[#00D4FF]">
                    <Bot className="h-3.5 w-3.5 animate-spin" />
                  </div>
                  <div className="rounded-2xl px-3.5 py-2.5 bg-slate-900/60 border border-white/5 rounded-tl-none flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#00D4FF] animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="h-1.5 w-1.5 rounded-full bg-[#00D4FF] animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="h-1.5 w-1.5 rounded-full bg-[#00D4FF] animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}
              
              <div ref={chatEndRef} />
            </div>

            {/* Quick replies suggestion chips */}
            {messages.length < 3 && !loading && (
              <div className="px-4 pb-2 pt-1 flex flex-col gap-1.5 select-none bg-black/10 border-t border-white/5">
                <span className="text-[7.5px] font-mono text-white/30 uppercase tracking-widest flex items-center gap-1">
                  <Sparkles className="h-2.5 w-2.5 text-[#00D4FF]" />
                  SELECT TELEMETRY PROMPT SUGGESTION
                </span>
                <div className="flex flex-wrap gap-1.5 max-h-[80px] overflow-y-auto scrollbar-none pb-1">
                  {suggestionChips.map((chip, i) => (
                    <button
                      key={i}
                      onClick={() => handleSendMessage(chip.query)}
                      className="px-2 py-1 rounded bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 hover:border-[#00D4FF] text-[8px] font-mono text-[#00D4FF] cursor-pointer transition-all duration-200"
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Panel Footer Form */}
            <form
              onSubmit={handleFormSubmit}
              className="p-3 border-t border-white/10 bg-black/50 flex gap-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={loading}
                placeholder={loading ? "Telemetry core compiling..." : "Query neighborhood conditions..."}
                className="flex-1 min-w-0 bg-black/65 border border-white/10 focus:border-[#00D4FF]/50 rounded-xl px-3.5 py-2 text-[10.5px] font-mono text-white placeholder-white/20 outline-none transition-colors"
                id="chatbot-input-field"
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="h-8.5 w-8.5 shrink-0 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/35 border border-cyan-500/40 hover:border-[#00D4FF] flex items-center justify-center text-[#00D4FF] disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                id="chatbot-send-button"
                aria-label="Send telemetry query"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
