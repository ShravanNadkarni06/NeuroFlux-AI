import React, { useState, useEffect, useRef } from 'react';
import { 
  Activity, 
  MapPin, 
  AlertCircle, 
  Loader2, 
  RefreshCw, 
  Navigation,
  CloudSun,
  ShieldAlert,
  Radio,
  Cpu,
  Info,
  Bell,
  BellOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Coordinates, AirPollutionItem, WeatherData, GeolocationStatus, PollutionReport, MapLayerMode, Hotspot, HotspotRiskAssessment, AQIPrediction, GridPoint } from './types';
import { db } from './lib/firebase';
import { collection, onSnapshot, setDoc, doc, query, orderBy } from 'firebase/firestore';
import LocationPrompt from './components/LocationPrompt';
import AqiPanel from './components/AqiPanel';
import MapContainer from './components/MapContainer';
import WeatherStats from './components/WeatherStats';
import SciFiBackground from './components/SciFiBackground';
import CitizenReportingCard from './components/CitizenReportingCard';
import ReportingModal from './components/ReportingModal';
import IntelligencePanel from './components/IntelligencePanel';
import MunicipalCommandConsole from './components/MunicipalCommandConsole';
import { AQI_MAPPING } from './utils/aqiHelper';
import FloatingChatbot from './components/FloatingChatbot';
import LocationDisplay from './components/LocationDisplay';
import AboutModal from './components/AboutModal';

export default function App() {
  const [userCoords, setUserCoords] = useState<Coordinates | null>(null);
  const [inspectedCoords, setInspectedCoords] = useState<Coordinates | null>(null);
  const [geoStatus, setGeoStatus] = useState<GeolocationStatus>('idle');
  const [geoError, setGeoError] = useState<string | null>(null);

  const [configStatus, setConfigStatus] = useState<{ openWeatherKeyConfigured: boolean; geminiKeyConfigured: boolean } | null>(null);

  const [pollutionData, setPollutionData] = useState<AirPollutionItem | null>(null);
  const [gridPoints, setGridPoints] = useState<GridPoint[] | null>(null);
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [apiLoading, setApiLoading] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const watchRef = useRef<number | null>(null);

  // Citizen Reporting and Layer Management states
  const [reports, setReports] = useState<PollutionReport[]>([]);
  const [layerMode, setLayerMode] = useState<MapLayerMode>('both');
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
  const [activeSection, setActiveSection] = useState<'aqi' | 'reports' | 'weather' | 'intelligence'>('aqi');
  const [viewMode, setViewMode] = useState<'citizen' | 'municipal'>('citizen');
  const [isAboutOpen, setIsAboutOpen] = useState<boolean>(false);

  // AI Hotspot and 24-Hour Prediction states
  const [hotspotAssessment, setHotspotAssessment] = useState<HotspotRiskAssessment | null>(null);
  const [aqiPrediction, setAqiPrediction] = useState<AQIPrediction | null>(null);
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const [demoMode, setDemoMode] = useState<boolean>(false);
  const [aiQuotaExhausted, setAiQuotaExhausted] = useState<boolean>(false);
  const [lastSuccessfulAi, setLastSuccessfulAi] = useState<{
    hotspots: HotspotRiskAssessment;
    prediction: AQIPrediction;
    timestamp: number;
  } | null>(() => {
    try {
      const cached = localStorage.getItem('aerosense_last_successful_ai');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });

  // Global Municipal Notification Alerts
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  const [unresolvedAlertCount, setUnresolvedAlertCount] = useState<number>(0);
  const [globalAlert, setGlobalAlert] = useState<Hotspot | null>(null);
  const prevHotspotsRef = useRef<Hotspot[]>([]);

  const [logs, setLogs] = useState<Array<{ time: string; type: 'INFO' | 'FETCH' | 'GEOL' | 'DATA'; text: string; color: string }>>([
    {
      time: new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      type: 'INFO',
      text: 'Initializing station monitoring...',
      color: 'text-cyan-400/80'
    }
  ]);

  useEffect(() => {
    if (!userCoords) return;
    const timeStr = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const newLog = {
      time: timeStr,
      type: 'GEOL' as const,
      text: `watchPosition: Lock [${userCoords.latitude.toFixed(4)}°N, ${userCoords.longitude.toFixed(4)}°W]`,
      color: 'text-[#00D4FF]/80'
    };
    setLogs(prev => {
      if (prev.length > 0 && prev[0].text === newLog.text) return prev;
      return [newLog, ...prev].slice(0, 10);
    });
  }, [userCoords]);

  // Request browser Notification API permission
  const requestNotificationPermission = async () => {
    if (typeof Notification !== 'undefined') {
      try {
        const permission = await Notification.requestPermission();
        setNotificationPermission(permission);
      } catch (e) {
        console.error("Error requesting notification permission:", e);
      }
    }
  };

  // Web Audio API custom synthesizer alert generator
  const playGlobalAlertSound = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const now = ctx.currentTime;
      
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
      console.warn("Failed to play global alert sound due to user-interaction restrictions:", err);
    }
  };

  // Real-time tracking of new high-severity hotspots across any view mode
  useEffect(() => {
    const currentHotspots = hotspotAssessment?.hotspots || [];
    if (currentHotspots.length === 0) {
      prevHotspotsRef.current = [];
      return;
    }

    const isFirstLoad = prevHotspotsRef.current.length === 0;

    if (!isFirstLoad) {
      // Find hotspots in current list with score >= 70 that were not in prevHotspotsRef
      const newHighRisk = currentHotspots.find(h => {
        const alreadySeen = prevHotspotsRef.current.some(
          prev => Math.abs(prev.latitude - h.latitude) < 0.0001 && Math.abs(prev.longitude - h.longitude) < 0.0001
        );
        return !alreadySeen && h.score >= 70;
      });

      if (newHighRisk) {
        setGlobalAlert(newHighRisk);
        setUnresolvedAlertCount(prev => prev + 1);
        playGlobalAlertSound();

        // Trigger native browser push notification if permitted
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          try {
            new Notification(`🚨 AeroSense ALERT: High-Severity Hotspot Detected`, {
              body: `[${newHighRisk.sourceType}] Risk: ${newHighRisk.score}/100\n📍 Location: ${newHighRisk.locationName || 'Near User'}\nRecommended action: ${newHighRisk.recommendedAction}`,
              requireInteraction: true
            });
          } catch (e) {
            console.error("Failed to trigger browser push notification:", e);
          }
        }

        // Add to telemetry log trace
        setLogs(prev => [
          {
            time: new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            type: 'DATA' as const,
            text: `⚠️ CRITICAL FIELD ALERT: New ${newHighRisk.sourceType} detected! Score: ${newHighRisk.score}/100`,
            color: 'text-red-400 animate-pulse'
          },
          ...prev
        ].slice(0, 10));
      }
    }

    prevHotspotsRef.current = currentHotspots;
  }, [hotspotAssessment?.hotspots]);

  // Reset unresolved alert count when municipal panel is opened
  useEffect(() => {
    if (viewMode === 'municipal') {
      setUnresolvedAlertCount(0);
    }
  }, [viewMode]);

  useEffect(() => {
    if (!lastUpdated || !pollutionData) return;
    const timeStr = lastUpdated.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const aqiVal = pollutionData?.main?.aqi ?? 1;
    const meta = AQI_MAPPING[aqiVal];
    
    const dataLog = {
      time: timeStr,
      type: 'DATA' as const,
      text: `Confirmed AQI: ${aqiVal} (${meta?.label || 'Unknown'})`,
      color: 'text-[#00FF95]/85'
    };
    
    const fetchLog = {
      time: timeStr,
      type: 'FETCH' as const,
      text: `Environmental query success (200 OK)`,
      color: 'text-blue-400/70'
    };
    
    setLogs(prev => [dataLog, fetchLog, ...prev].slice(0, 10));
  }, [lastUpdated, pollutionData]);

  // Citizen Reporting handlers
  const handleAddReport = async (newReport: PollutionReport) => {
    try {
      const reportRef = doc(db, 'citizen_reports', newReport.id);
      await setDoc(reportRef, {
        ...newReport,
        timestamp: newReport.timestamp || new Date().toISOString()
      });
    } catch (e) {
      console.error("Error writing citizen report to Firestore:", e);
      // Fallback: update state locally if offline
      setReports((prev) => [newReport, ...prev]);
    }
  };

  const handleAddSystemLog = (
    type: 'INFO' | 'FETCH' | 'GEOL' | 'DATA',
    text: string,
    color: string
  ) => {
    const timeStr = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLogs((prev) => [
      { time: timeStr, type, text, color },
      ...prev
    ].slice(0, 10));
  };

  // Request user's location via navigator.geolocation
  const requestLocation = () => {
    setGeoStatus('requesting');
    setGeoError(null);

    if (!navigator.geolocation) {
      setGeoStatus('unavailable');
      setGeoError("Your browser does not support location services.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setUserCoords(coords);
        setGeoStatus('tracking');
        fetchWeatherData(coords);

        // Start watchPosition for continuous tracking
        if (watchRef.current !== null) {
          navigator.geolocation.clearWatch(watchRef.current);
        }

        const watchId = navigator.geolocation.watchPosition(
          (updatedPos) => {
            const updatedCoords = {
              latitude: updatedPos.coords.latitude,
              longitude: updatedPos.coords.longitude,
            };
            setUserCoords(updatedCoords);
          },
          (watchErr) => {
            console.warn("watchPosition warning:", watchErr);
          },
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
        );

        watchRef.current = watchId;
      },
      (err) => {
        console.error("getCurrentPosition error:", err);
        if (err.code === err.PERMISSION_DENIED) {
          setGeoStatus('denied');
        } else {
          setGeoStatus('error');
          setGeoError(err.message || "An error occurred while fetching your current coordinates.");
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  // Fetch air pollution and weather metrics from our Express API proxies
  const fetchWeatherData = async (coords: Coordinates, silent = false) => {
    if (!silent) setApiLoading(true);
    setApiError(null);
    setIsRefreshing(true);

    try {
      const cacheBuster = Date.now();
      const [pollutionResponse, weatherResponse, gridResponse] = await Promise.all([
        fetch(`/api/pollution?lat=${coords.latitude}&lon=${coords.longitude}&t=${cacheBuster}`, { cache: 'no-store' }),
        fetch(`/api/weather?lat=${coords.latitude}&lon=${coords.longitude}&t=${cacheBuster}`, { cache: 'no-store' }),
        fetch(`/api/pollution-grid?lat=${coords.latitude}&lon=${coords.longitude}&t=${cacheBuster}`, { cache: 'no-store' })
      ]);

      if (!pollutionResponse.ok) {
        const errData = await pollutionResponse.json();
        throw new Error(errData.error || "Failed to fetch air pollution data.");
      }

      if (!weatherResponse.ok) {
        const errData = await weatherResponse.json();
        throw new Error(errData.error || "Failed to fetch weather data.");
      }

      const pollutionResult = await pollutionResponse.json();
      const weatherResult = await weatherResponse.json();

      if (pollutionResult.list && pollutionResult.list.length > 0) {
        console.log("[AeroSense Client] Parsed AQI from list[0].main.aqi:", pollutionResult.list[0].main.aqi, "Full item:", pollutionResult.list[0]);
        setPollutionData(pollutionResult.list[0]);
      } else {
        throw new Error("No air pollution data returned for these coordinates.");
      }

      setWeatherData(weatherResult);

      if (gridResponse.ok) {
        const gridData = await gridResponse.json();
        if (gridData && gridData.points) {
          setGridPoints(gridData.points);
          
          // Log high-tech feedback of the grid status
          const gridLog = {
            time: new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            type: 'DATA' as const,
            text: `Hyperlocal Mesh Online: Synced ${gridData.points.length} neighbourhood coordinates.`,
            color: 'text-indigo-400'
          };
          setLogs(prev => [gridLog, ...prev].slice(0, 10));
        }
      } else {
        console.warn("Failed to fetch pollution grid");
      }

      setLastUpdated(new Date());
    } catch (err: any) {
      console.error("API Fetch error:", err);
      setApiError(err.message || "Unable to retrieve environmental data. Please try again.");
    } finally {
      setApiLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    requestLocation();

    // Query server configuration credentials status
    fetch("/api/config-status")
      .then((res) => {
        if (!res.ok) throw new Error("Config endpoint returned error status");
        return res.json();
      })
      .then((data) => {
        setConfigStatus(data);
        if (!data.openWeatherKeyConfigured) {
          console.warn("⚠️  [AeroSense HUD Startup Alert] OPENWEATHER_API_KEY is undefined on the server! Weather spectrometry/inspections will fail.");
        }
        if (!data.geminiKeyConfigured) {
          console.warn("⚠️  [AeroSense HUD Startup Alert] GEMINI_API_KEY is undefined on the server! Automated dispatch and risk predictions will fail.");
        }
      })
      .catch((err) => {
        console.error("Failed to check server configuration credentials status:", err);
      });

    return () => {
      if (watchRef.current !== null) {
        navigator.geolocation.clearWatch(watchRef.current);
      }
    };
  }, []);

  // Real-time synchronization for multi-user reports & hotspots
  useEffect(() => {
    try {
      // 1. Listen to real-time citizen reports in Firestore
      const reportsQuery = query(collection(db, "citizen_reports"), orderBy("timestamp", "desc"));
      const unsubscribeReports = onSnapshot(reportsQuery, (snapshot) => {
        const updatedReports: PollutionReport[] = [];
        snapshot.forEach((docSnap) => {
          updatedReports.push(docSnap.data() as PollutionReport);
        });
        setReports(updatedReports);
      }, (error) => {
        console.error("Firestore reports listener error:", error);
      });

      // 2. Listen to real-time detected hotspots in Firestore
      const hotspotsQuery = query(collection(db, "detected_hotspots"), orderBy("detectedAt", "desc"));
      const unsubscribeHotspots = onSnapshot(hotspotsQuery, (snapshot) => {
        const updatedHotspots: Hotspot[] = [];
        snapshot.forEach((docSnap) => {
          updatedHotspots.push(docSnap.data() as Hotspot);
        });
        
        setHotspotAssessment(prev => {
          const count = updatedHotspots.length;
          const avgScore = count > 0 
            ? Math.round(updatedHotspots.reduce((sum, h) => sum + h.score, 0) / count)
            : 0;
          
          let riskLabel: 'Low' | 'Moderate' | 'High' | 'Severe' = 'Low';
          if (avgScore >= 75) {
            riskLabel = 'Severe';
          } else if (avgScore >= 50) {
            riskLabel = 'High';
          } else if (avgScore >= 25) {
            riskLabel = 'Moderate';
          }

          return {
            riskScore: avgScore || prev?.riskScore || 0,
            riskLabel: riskLabel,
            sourceType: prev?.sourceType || "Crowdsourced Telemetry Mesh",
            explanation: prev?.explanation || (count > 0 ? "Real-time crowdsourced hotspot telemetry aggregated across the neighbourhood mesh." : "No active hotspots currently detected in immediate neighborhood telemetry."),
            hotspots: updatedHotspots,
            satelliteFires: prev?.satelliteFires || []
          };
        });
      }, (error) => {
        console.error("Firestore hotspots listener error:", error);
      });

      return () => {
        unsubscribeReports();
        unsubscribeHotspots();
      };
    } catch (e) {
      console.error("Error setting up Firestore snapshot listeners:", e);
    }
  }, []);

  // Automatically resolve location names for citizen reports
  useEffect(() => {
    let changed = false;
    const promises = reports.map(async (report) => {
      if (!report.locationName) {
        try {
          const res = await fetch(`/api/reverse-geocode?lat=${report.latitude}&lon=${report.longitude}`);
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
              const place = data[0];
              const parts = [place.name];
              if (place.state) parts.push(place.state);
              if (place.country) parts.push(place.country);
              report.locationName = parts.filter(Boolean).join(', ');
              changed = true;
            }
          }
        } catch (e) {
          console.error("Geocoding report failed:", e);
        }
        if (!report.locationName) {
          report.locationName = `${report.latitude.toFixed(4)}°N, ${report.longitude.toFixed(4)}°E (exact place name unavailable)`;
          changed = true;
        }
      }
    });

    if (reports.length > 0 && reports.some(r => !r.locationName)) {
      Promise.all(promises).then(() => {
        if (changed) {
          setReports([...reports]);
        }
      });
    }
  }, [reports]);

  // Automatically resolve location names for hotspots
  useEffect(() => {
    if (!hotspotAssessment || !hotspotAssessment.hotspots || hotspotAssessment.hotspots.length === 0) return;
    
    let changed = false;
    const promises = hotspotAssessment.hotspots.map(async (h) => {
      if (!h.locationName) {
        try {
          const res = await fetch(`/api/reverse-geocode?lat=${h.latitude}&lon=${h.longitude}`);
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
              const place = data[0];
              const parts = [place.name];
              if (place.state) parts.push(place.state);
              if (place.country) parts.push(place.country);
              h.locationName = parts.filter(Boolean).join(', ');
              changed = true;
            }
          }
        } catch (e) {
          console.error("Geocoding hotspot failed:", e);
        }
        if (!h.locationName) {
          h.locationName = `${h.latitude.toFixed(4)}°N, ${h.longitude.toFixed(4)}°E (exact place name unavailable)`;
          changed = true;
        }
      }
    });

    if (hotspotAssessment.hotspots.some(h => !h.locationName)) {
      Promise.all(promises).then(() => {
        if (changed) {
          setHotspotAssessment(prev => prev ? { ...prev, hotspots: [...prev.hotspots] } : null);
        }
      });
    }
  }, [hotspotAssessment?.hotspots]);

  // Keep track of active/target coordinates via a Ref to ensure our background interval uses the absolute freshest parameters
  const activeCoordsRef = useRef<Coordinates | null>(null);
  useEffect(() => {
    activeCoordsRef.current = inspectedCoords || userCoords;
  }, [inspectedCoords, userCoords]);

  useEffect(() => {
    // This interval is registered exactly once, fully immune to watchPosition's transient state re-renders, preventing interval lock/reset bugs
    const intervalId = setInterval(() => {
      if (activeCoordsRef.current) {
        console.log("[AeroSense Poller] Running background data sync for coords:", activeCoordsRef.current);
        fetchWeatherData(activeCoordsRef.current, true);
      }
    }, 180000); // 3 minutes

    return () => clearInterval(intervalId);
  }, []);

  const handleManualRefresh = () => {
    const target = inspectedCoords || userCoords;
    if (target) {
      fetchWeatherData(target, false);
      computeAiIntelligence(true); // Always force AI computation on manual refresh
    }
  };

  const handleMapClick = (coords: Coordinates) => {
    console.log("[AeroSense MapClick] Directing inspection vector to:", coords);
    setInspectedCoords(coords);
    fetchWeatherData(coords, false);
  };

  const handleResetInspection = () => {
    console.log("[AeroSense Reset] Returning inspection HUD focus back to live GPS coordinates.");
    setInspectedCoords(null);
    if (userCoords) {
      fetchWeatherData(userCoords, false);
    }
  };

  // Core Intelligence Layer: Fetch AI Hotspot Assessment and 24-Hour Prediction from backend
  const lastAqiRef = useRef<number | null>(null);
  const lastReportsCountRef = useRef<number | null>(null);
  const lastCoordsRef = useRef<Coordinates | null>(null);
  const lastRunTimeRef = useRef<number>(0);

  const computeAiIntelligence = async (force: boolean = false) => {
    const activeCoords = inspectedCoords || userCoords;
    if (!activeCoords || !pollutionData || !weatherData) return;

    const currentAqi = pollutionData?.main?.aqi ?? 1;
    const currentReportsCount = reports.length;
    const now = Date.now();

    // Check for material changes to conserve API quota unless forced (e.g., manual trigger or location changes)
    if (!force) {
      const coordsChanged = !lastCoordsRef.current || 
        Math.abs(lastCoordsRef.current.latitude - activeCoords.latitude) > 0.005 || 
        Math.abs(lastCoordsRef.current.longitude - activeCoords.longitude) > 0.005;
      const aqiChanged = lastAqiRef.current !== currentAqi;
      const reportsChanged = lastReportsCountRef.current !== currentReportsCount;
      const timeElapsed = now - lastRunTimeRef.current;
      
      // If no material changes and less than 15 minutes have passed, skip to conserve quota
      if (!coordsChanged && !aqiChanged && !reportsChanged && timeElapsed < 15 * 60 * 1000) {
        console.log("[AeroSense AI] Telemetry stable. No material changes detected; skipping recomputation to conserve API quota.");
        return;
      }
    }

    setAiLoading(true);
    setAiError(null);

    const timeStr = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const aiStartLog = {
      time: timeStr,
      type: 'INFO' as const,
      text: 'AeroSense AI: Synthesizing real-time hotspots & 24h predictions...',
      color: 'text-purple-400/80'
    };
    setLogs(prev => [aiStartLog, ...prev].slice(0, 10));

    try {
      // Strip photos from reports to minimize packet size before sending
      const cleanReports = reports.map(({ photo, ...rest }) => rest);

      const [hotspotsResponse, predictionResponse] = await Promise.all([
        fetch("/api/detect-hotspots", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lat: activeCoords.latitude,
            lon: activeCoords.longitude,
            currentAqi: currentAqi,
            pollutants: pollutionData?.components ?? { pm2_5: 0, pm10: 0, no2: 0, o3: 0, so2: 0, co: 0 },
            wind: weatherData?.wind ?? { speed: 0, deg: 0 },
            reports: cleanReports,
            demoMode: demoMode // Forward UI demo mode state to the backend
          }),
        }),
        fetch("/api/predict-aqi", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lat: activeCoords.latitude,
            lon: activeCoords.longitude,
            currentAqi: currentAqi,
            pollutants: pollutionData?.components ?? { pm2_5: 0, pm10: 0, no2: 0, o3: 0, so2: 0, co: 0 },
            wind: weatherData?.wind ?? { speed: 0, deg: 0 },
            reports: cleanReports,
            localTime: new Date().toISOString(),
          }),
        }),
      ]);

      if (hotspotsResponse.status === 429 || predictionResponse.status === 429) {
        throw new Error("QuotaLimitReached");
      }

      if (!hotspotsResponse.ok) {
        throw new Error("Failed to compute hotspot risk assessment.");
      }
      if (!predictionResponse.ok) {
        throw new Error("Failed to compute 24-hour AQI prediction.");
      }

      const hotspotsResult: HotspotRiskAssessment = await hotspotsResponse.json();
      const predictionResult: AQIPrediction = await predictionResponse.json();

      setHotspotAssessment(hotspotsResult);
      setAqiPrediction(predictionResult);
      setAiQuotaExhausted(false);

      // Save to success cache & local storage
      const successPayload = {
        hotspots: hotspotsResult,
        prediction: predictionResult,
        timestamp: Date.now()
      };
      setLastSuccessfulAi(successPayload);
      try {
        localStorage.setItem('aerosense_last_successful_ai', JSON.stringify(successPayload));
      } catch (e) {
        console.error("Local storage write failed:", e);
      }

      // Update change tracking refs
      lastAqiRef.current = currentAqi;
      lastReportsCountRef.current = currentReportsCount;
      lastCoordsRef.current = activeCoords;
      lastRunTimeRef.current = now;

      // Write hotspots to Firestore detected_hotspots so they are shared in real-time
      if (hotspotsResult.hotspots && hotspotsResult.hotspots.length > 0) {
        for (const hotspot of hotspotsResult.hotspots) {
          try {
            const hotspotId = `hs_${hotspot.latitude.toFixed(4)}_${hotspot.longitude.toFixed(4)}`;
            const hotspotRef = doc(db, 'detected_hotspots', hotspotId);
            await setDoc(hotspotRef, {
              ...hotspot,
              id: hotspotId,
              detectedAt: new Date().toISOString()
            });
          } catch (e) {
            console.error("Error writing hotspot to Firestore:", e);
          }
        }
      }

      const aiSuccessLog = {
        time: new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        type: 'DATA' as const,
        text: `AI Intelligence Layer online: Risk is ${hotspotsResult.riskLabel} (${hotspotsResult.riskScore}/100)`,
        color: 'text-purple-300'
      };
      setLogs(prev => [aiSuccessLog, ...prev].slice(0, 10));

    } catch (err: any) {
      console.error("AI computation error:", err);
      
      if (err.message === "QuotaLimitReached" || err.message?.includes("429") || err.message?.includes("Quota")) {
        setAiQuotaExhausted(true);
        setLogs(prev => [
          {
            time: new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            type: 'DATA' as const,
            text: `⚠️ Gemini API Quota Exhausted! Reverting to last successful intelligence cache.`,
            color: 'text-red-400 animate-pulse'
          },
          ...prev
        ].slice(0, 10));

        // Use last successful AI cache if available to prevent UI breakage
        if (lastSuccessfulAi) {
          setHotspotAssessment(lastSuccessfulAi.hotspots);
          setAqiPrediction(lastSuccessfulAi.prediction);
        }
      } else {
        setAiError(err.message || "Failed to generate AI environmental intelligence.");
      }
    } finally {
      setAiLoading(false);
    }
  };

  // Recompute intelligence layer automatically when new real weather data or citizen reports arrive
  useEffect(() => {
    if (pollutionData && weatherData) {
      computeAiIntelligence(false); // background auto run: respects material-change checks and 15m throttle
    }
  }, [pollutionData, weatherData, reports]);

  // Force recompute when demoMode changes
  useEffect(() => {
    if (pollutionData && weatherData) {
      computeAiIntelligence(true); // force run when demo mode is toggled
    }
  }, [demoMode]);

  // 1. Location permission requested / denied states
  if (geoStatus === 'idle' || geoStatus === 'requesting' || geoStatus === 'denied' || geoStatus === 'unavailable' || geoStatus === 'error') {
    return (
      <div className="relative w-full h-screen overflow-hidden">
        <SciFiBackground />
        <LocationPrompt 
          status={geoStatus} 
          errorMessage={geoError} 
          onRequestLocation={requestLocation} 
        />
      </div>
    );
  }

  // 2. Initial Loading Screen with blue-glow holo shimmers
  if (apiLoading && !pollutionData) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden">
        <SciFiBackground />
        <div className="absolute inset-0 bg-[#030611]/45 backdrop-blur-sm" />
        
        <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-[#00D4FF]/20 bg-black/60 p-8 text-center shadow-2xl glass-panel glow-blue-border">
          <div className="scanner-line opacity-30" />
          
          <div className="relative flex h-16 w-16 items-center justify-center rounded-xl bg-[#00D4FF]/10 border border-[#00D4FF]/30 text-[#00D4FF] mx-auto mb-6">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>

          <h2 className="font-display text-xl font-bold text-white tracking-widest uppercase mb-2">
            GRID LINKING IN PROGRESS
          </h2>
          
          <p className="text-xs text-white/60 leading-relaxed max-w-sm mx-auto mb-6">
            Interrogating regional air sensors. Synthesizing particulate streams (PM2.5, PM10) and chemical densities...
          </p>

          {/* Blueprint style high-tech placeholder details */}
          <div className="space-y-2 mt-4 text-left border-t border-white/10 pt-4 font-mono text-[10px] text-white/30">
            <div className="flex justify-between items-center">
              <span>LATITUDE LOCK:</span>
              <span className="text-[#00D4FF] font-bold">CALCULATING...</span>
            </div>
            <div className="flex justify-between items-center">
              <span>LONGITUDE LOCK:</span>
              <span className="text-[#00D4FF] font-bold">CALCULATING...</span>
            </div>
            <div className="flex justify-between items-center">
              <span>NODE RESPONSES:</span>
              <span className="text-amber-500 animate-pulse font-bold">WAIT_LINK_OK</span>
            </div>
            {/* Shimmer loading bar */}
            <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden mt-3">
              <div className="h-full w-2/3 rounded-full holo-shimmer bg-[#00D4FF]" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 3. API Connection Error State with cyberpunk styling
  if (apiError && !pollutionData) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden">
        <SciFiBackground />
        <div className="absolute inset-0 bg-[#030611]/50 backdrop-blur-sm" />

        <div className="relative w-full max-w-md rounded-2xl border border-red-500/20 bg-black/60 p-8 text-center shadow-2xl glass-panel">
          <div className="scanner-line opacity-30" style={{ background: 'linear-gradient(90deg, transparent, rgba(239, 68, 68, 0.8), transparent)' }} />
          
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-red-500/10 border border-red-500/30 text-red-400">
            <ShieldAlert className="h-7 w-7 animate-pulse" />
          </div>
          
          <h2 className="font-display text-xl font-bold tracking-widest text-white uppercase">
            TELEMETRY LINK FAULT
          </h2>
          
          <p className="mt-3 text-xs text-white/60 leading-relaxed">
            Failed to establishing stable connection with OpenWeather telemetry servers:
          </p>

          <div className="mt-4 p-4 rounded-xl bg-black/80 border border-red-500/20 text-left font-mono text-xs text-red-400/90 break-words">
            {apiError}
          </div>

          <button
            onClick={() => userCoords && fetchWeatherData(userCoords)}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-white/5 hover:bg-red-500/10 border border-white/10 hover:border-red-500/20 px-5 py-3 text-xs font-mono font-semibold text-white tracking-widest uppercase transition-all duration-300"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>RE-ENGAGE SYSTEM ANTENNA</span>
          </button>
        </div>
      </div>
    );
  }

  // 4. Main Futuristic Command Deck Layout
  return (
    <div className="flex flex-col h-screen bg-[#030611] overflow-hidden text-[#c9d5ff] font-sans relative">
      
      {/* Dynamic Animated Starfield Background Layer */}
      <SciFiBackground />

      {/* Dynamic API Configuration Status Banner */}
      {configStatus && (!configStatus.openWeatherKeyConfigured || !configStatus.geminiKeyConfigured) && (
        <div className="bg-amber-950/90 border-b border-amber-500/30 text-amber-300 px-4 py-1.5 text-center text-[10px] font-mono flex items-center justify-center gap-2 relative z-50 select-none shrink-0 animate-pulse">
          <AlertCircle className="h-4 w-4 text-amber-400 shrink-0" />
          <span>
            <strong>TELEMETRY RESTRICTION DETECTED:</strong>{' '}
            {!configStatus.openWeatherKeyConfigured && 'OPENWEATHER_API_KEY is missing (map spectrometry inactive). '}
            {!configStatus.geminiKeyConfigured && 'GEMINI_API_KEY is missing (AI dispatch summaries & predictions inactive). '}
            Please configure your secrets in Settings {">"} Secrets or the .env file.
          </span>
        </div>
      )}

      {/* AI Quota Exhausted / API Warning Banner */}
      {aiQuotaExhausted && (
        <div className="bg-red-950/95 border-b border-red-500/30 text-red-300 px-4 py-2 text-center text-[10px] font-mono flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-3 relative z-[100] select-none shrink-0 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
          <div className="flex items-center gap-1.5">
            <AlertCircle className="h-4 w-4 text-red-400 shrink-0 animate-bounce" />
            <span className="font-extrabold uppercase tracking-wide text-red-200">
              [GEMINI API QUOTA LIMIT REACHED]
            </span>
          </div>
          <span className="text-white/80">
            AeroSense AI analysis temporarily unavailable due to heavy load.
            {lastSuccessfulAi ? (
              <span> Displaying last successful AI assessment from <strong>{new Date(lastSuccessfulAi.timestamp).toLocaleTimeString()}</strong> ({Math.round((Date.now() - lastSuccessfulAi.timestamp) / 60000)}m ago).</span>
            ) : (
              <span> Real-time AI prediction has been temporarily degraded to safety cache levels.</span>
            )}
          </span>
          <button 
            onClick={() => {
              setAiQuotaExhausted(false);
              computeAiIntelligence(true); // force retry
            }}
            className="px-2 py-0.5 rounded bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-[9px] uppercase font-bold text-white transition-all cursor-pointer"
          >
            [Retry Now]
          </button>
        </div>
      )}

      {/* Demo Mode Simulated Signal Banner */}
      {demoMode && (
        <div className="bg-amber-950/95 border-b border-amber-500/30 text-amber-300 px-4 py-1.5 text-center text-[9px] font-mono flex items-center justify-center gap-2 relative z-50 select-none shrink-0 animate-pulse">
          <ShieldAlert className="h-4 w-4 text-amber-400 shrink-0 animate-spin" />
          <span>
            <strong>DEMO MODE ACTIVE:</strong> Satellite thermal sensor confirmation signals are currently simulated using active citizen high-severity fire reports.
          </span>
        </div>
      )}
      
      {/* Top Cockpit Telemetry Header */}
      <header className="relative flex h-16 shrink-0 items-center justify-between border-b border-white/10 bg-[#050d21]/60 px-6 backdrop-blur-md z-10 select-none">
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#00D4FF]/30 to-transparent" />
        
        {/* Logo and Sentinel Core Light */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="relative flex h-5 w-5 items-center justify-center shrink-0">
              <div className="absolute h-5 w-5 rounded-full border border-cyan-400/30 animate-spin" />
              <div className="absolute h-3.5 w-3.5 rounded-full border border-cyan-500/40 animate-ping" />
              <div className="h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#00D4FF]" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-lg font-bold tracking-widest text-white font-display">
                AEROSENSE<span className="text-[#00D4FF]">HUD</span>
              </h1>
            </div>
          </div>

          {/* Mode Selector Toggle */}
          <div className="flex bg-black/45 border border-white/10 rounded-lg p-0.5 font-mono text-[8.5px] select-none shadow-[0_0_10px_rgba(0,212,255,0.05)]">
            <button
              onClick={() => setViewMode('citizen')}
              className={`px-2 py-0.5 rounded transition-all cursor-pointer font-black tracking-widest uppercase ${
                viewMode === 'citizen'
                  ? 'bg-cyan-500/15 text-[#00D4FF] border border-cyan-500/30 shadow-[0_0_8px_rgba(6,182,212,0.15)]'
                  : 'text-white/40 hover:text-white/70'
              }`}
            >
              Citizen View
            </button>
            <button
              onClick={() => setViewMode('municipal')}
              className={`px-2 py-0.5 rounded transition-all cursor-pointer font-black tracking-widest uppercase relative ${
                viewMode === 'municipal'
                  ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30 shadow-[0_0_8px_rgba(168,85,247,0.15)]'
                  : 'text-white/40 hover:text-white/70'
              }`}
            >
              Municipal View
              {unresolvedAlertCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[8px] font-black text-white border border-black/50 shadow-[0_0_8px_#ef4444] animate-pulse">
                  {unresolvedAlertCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Dynamic Tactile Navigation Bar / Section Switcher */}
        {viewMode === 'citizen' ? (
          <nav className="flex items-center gap-1 bg-black/50 border border-white/10 p-1 rounded-xl shadow-inner mx-2">
            {/* AQI SENSORS */}
            <button
              onClick={() => setActiveSection('aqi')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-mono uppercase font-black tracking-widest transition-all duration-300 cursor-pointer ${
                activeSection === 'aqi'
                  ? 'bg-cyan-500/15 text-[#00D4FF] border border-[#00D4FF]/35 shadow-[0_0_12px_rgba(0,212,255,0.2)]'
                  : 'text-white/40 hover:text-white/70 hover:bg-white/5 border border-transparent'
              }`}
            >
              <Activity className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sensors</span>
            </button>

            {/* CITIZEN REPORTS */}
            <button
              onClick={() => setActiveSection('reports')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-mono uppercase font-black tracking-widest transition-all duration-300 cursor-pointer ${
                activeSection === 'reports'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/35 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                  : 'text-white/40 hover:text-white/70 hover:bg-white/5 border border-transparent'
              }`}
            >
              <Radio className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Reports</span>
            </button>

            {/* ATMOSPHERIC STATS */}
            <button
              onClick={() => setActiveSection('weather')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-mono uppercase font-black tracking-widest transition-all duration-300 cursor-pointer ${
                activeSection === 'weather'
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/35 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                  : 'text-white/40 hover:text-white/70 hover:bg-white/5 border border-transparent'
              }`}
            >
              <CloudSun className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Atmosphere</span>
            </button>

            {/* AI INTELLIGENCE */}
            <button
              onClick={() => setActiveSection('intelligence')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-mono uppercase font-black tracking-widest transition-all duration-300 cursor-pointer ${
                activeSection === 'intelligence'
                  ? 'bg-purple-500/15 text-purple-300 border border-purple-500/35 shadow-[0_0_12px_rgba(168,85,247,0.25)]'
                  : 'text-white/40 hover:text-white/70 hover:bg-white/5 border border-transparent'
              }`}
            >
              <Cpu className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Intelligence</span>
            </button>
          </nav>
        ) : (
          <div className="hidden md:flex items-center gap-2 bg-purple-500/10 border border-purple-500/30 px-3 py-1.5 rounded-xl font-mono text-[9px] text-purple-300 shadow-[0_0_10px_rgba(168,85,247,0.15)] select-none">
            <Radio className="h-3 w-3 animate-pulse text-purple-400" />
            <span className="font-extrabold tracking-widest uppercase">MUNICIPAL STATUS: COMMAND MODULE ONLINE</span>
          </div>
        )}

        {/* Live GPS Coordinates and Satellite Quality Indicators */}
        <div className="flex items-center gap-3 md:gap-6">
          
          {/* Signal Indicator */}
          <div className="hidden lg:flex items-center gap-3 bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg font-mono text-[9px] text-white/50">
            <span>SAT_LINK_STRENGTH</span>
            <div className="flex gap-0.5 items-end h-3">
              <div className="w-0.5 h-1.5 bg-[#00FF95]" />
              <div className="w-0.5 h-2 bg-[#00FF95]" />
              <div className="w-0.5 h-2.5 bg-[#00FF95]" />
              <div className="w-0.5 h-3.5 bg-[#00FF95] shadow-[0_0_4px_#00FF95]" />
            </div>
          </div>

          {/* Coordinates readout */}
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg font-mono text-[9px]">
            <Navigation className="h-3 w-3 text-[#00D4FF] animate-pulse shrink-0" />
            <span className="text-[#00D4FF] font-bold uppercase flex items-center gap-1">
              {inspectedCoords ? "INSPECTED TARGET" : "LIVE GPS"}: <LocationDisplay latitude={(inspectedCoords || userCoords)!.latitude} longitude={(inspectedCoords || userCoords)!.longitude} showCoordinates={true} className="text-[#00D4FF] font-mono" />
            </span>
          </div>

          {/* Notification Permission Request Button */}
          {typeof Notification !== 'undefined' && (
            <button
              onClick={requestNotificationPermission}
              className={`flex h-7.5 w-7.5 items-center justify-center rounded-lg transition-all cursor-pointer shadow-[0_0_10px_rgba(0,212,255,0.05)] border ${
                notificationPermission === 'granted'
                  ? 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/20 text-emerald-400'
                  : notificationPermission === 'denied'
                  ? 'bg-red-500/10 border-red-500/20 text-red-400/70'
                  : 'bg-white/5 hover:bg-[#00D4FF]/20 border-white/10 hover:border-[#00D4FF]/30 text-white/50 hover:text-white'
              }`}
              title={
                notificationPermission === 'granted'
                  ? 'Desktop push notifications active'
                  : notificationPermission === 'denied'
                  ? 'Desktop push notifications blocked'
                  : 'Enable desktop push alerts for new high-severity hotspots'
              }
              aria-label="Desktop notification settings"
            >
              {notificationPermission === 'granted' ? (
                <Bell className="h-4 w-4 animate-bounce" />
              ) : (
                <BellOff className="h-4 w-4" />
              )}
            </button>
          )}

          {/* DEMO MODE — SIMULATED SIGNAL Toggle */}
          <button
            onClick={() => setDemoMode(prev => !prev)}
            className={`flex items-center gap-1.5 h-7.5 px-2.5 rounded-lg border font-mono text-[8px] font-black uppercase tracking-widest transition-all cursor-pointer shadow-[0_0_10px_rgba(245,158,11,0.05)] ${
              demoMode
                ? 'bg-amber-500/15 hover:bg-amber-500/25 border-amber-500/40 text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.2)] animate-pulse'
                : 'bg-white/5 hover:bg-white/10 border-white/10 text-white/40 hover:text-white/70'
            }`}
            title="Toggle Demo Mode: Simulates NASA VIIRS Satellite Thermal signals using high-severity burning reports"
          >
            <div className={`h-1.5 w-1.5 rounded-full ${demoMode ? 'bg-amber-400 animate-ping' : 'bg-white/30'}`} />
            <span>DEMO MODE</span>
          </button>

          {/* About / Info Documentation Toggle Button */}
          <button
            onClick={() => setIsAboutOpen(true)}
            className="flex h-7.5 w-7.5 items-center justify-center rounded-lg bg-white/5 hover:bg-[#00D4FF]/20 border border-white/10 hover:border-[#00D4FF]/30 text-white/70 hover:text-white transition-all cursor-pointer shadow-[0_0_10px_rgba(0,212,255,0.05)]"
            title="AeroSense HUD Documentation & About"
            aria-label="AeroSense HUD Documentation & About"
          >
            <Info className="h-4 w-4" />
          </button>

        </div>
      </header>

      {/* Main Responsive Grid Workspace */}
      {/* Desktop: Full-screen Map with absolute floating Glass HUD cards */}
      {/* Mobile: Clean stacked single-column layout */}
      <main className="flex-1 relative flex flex-col md:block overflow-hidden min-h-0 z-10">
        
        {/* Full-screen absolute Map Container (Desktop centerpiece) */}
        <div className="relative md:absolute md:inset-0 w-full h-[300px] md:h-full z-0 bg-black/20">
          {userCoords && pollutionData && (
            <MapContainer 
              userCoords={userCoords}
              inspectedCoords={inspectedCoords}
              currentAqi={pollutionData?.main?.aqi ?? 1} 
              reports={reports}
              hotspots={hotspotAssessment?.hotspots || []}
              layerMode={layerMode}
              gridPoints={gridPoints}
              satelliteFires={hotspotAssessment?.satelliteFires || []}
              onMapClick={handleMapClick}
              onCloseInspector={handleResetInspection}
            />
          )}

          {/* Floating System Activity Log Overlay (Desktop only) */}
          <div className="hidden lg:flex absolute bottom-5 right-5 z-[400] w-80 bg-[#050c20]/80 backdrop-blur-md border border-white/10 rounded-2xl p-5 flex-col overflow-hidden max-h-48 pointer-events-auto">
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#00D4FF]/20 to-transparent" />
            <div className="flex justify-between items-center mb-3 select-none">
              <h3 className="text-[9px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-1.5">
                <Cpu className="h-3 w-3 text-[#00D4FF]" />
                SYSTEM ACTIVITY MATRIX
              </h3>
              <span className="text-[8px] font-mono text-[#00D4FF]/60 bg-[#00D4FF]/5 px-1 py-0.2 rounded border border-[#00D4FF]/20">
                MONITORING
              </span>
            </div>
            <div className="flex-1 space-y-2 font-mono text-[9px] overflow-y-auto scrollbar-none">
              {logs.map((log, idx) => (
                <div key={idx} className="flex gap-2">
                  <span className="text-white/20 shrink-0">{log.time}</span>
                  <span className="text-[#00D4FF]/50 shrink-0">[{log.type}]</span>
                  <span className={`${log.color} break-all`}>{log.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Floating Glass Controls Shelf (Desktop Float Layout) */}
        {/* This HUD container ignores clicks itself (pointer-events-none) allowing click-throughs to the Leaflet map below it. */}
        {/* Its child cards re-enable clicks (pointer-events-auto) so scroll, hover, tilt, and buttons are fully interactive! */}
        <div className="relative md:absolute md:top-4 md:left-4 z-10 w-full md:max-w-[450px] md:h-[calc(100%-32px)] flex flex-col gap-4 p-4 md:p-0 pointer-events-none overflow-y-auto md:overflow-visible">
          
          {viewMode === 'municipal' ? (
            <div className="flex-1 min-h-0 pointer-events-auto">
              <MunicipalCommandConsole 
                hotspots={hotspotAssessment?.hotspots || []}
                reports={reports}
                pollutionData={pollutionData}
                onRefresh={computeAiIntelligence}
                loading={aiLoading}
              />
            </div>
          ) : (
            <div id="hud-controls-shelf" className="flex-1 flex flex-col gap-4 pointer-events-auto md:h-full md:overflow-y-auto pr-0 md:pr-1 pb-4 md:pb-0 scrollbar-thin">
              
              {/* Global Predictive Spike Warning Banner */}
              {aqiPrediction && (aqiPrediction.willSpike || aqiPrediction.predictions?.some(p => p.aqi >= 3.5)) && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mx-0 p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 shadow-[0_0_20px_rgba(244,63,94,0.25)] flex gap-3 relative overflow-hidden select-none"
                >
                  <div className="absolute top-0 left-0 h-full w-1 bg-rose-500" />
                  <div className="shrink-0 h-8 w-8 rounded-lg bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
                    <AlertCircle className="h-4 w-4 animate-bounce" />
                  </div>
                  <div className="space-y-0.5">
                    <h4 className="text-[10px] font-black tracking-widest text-rose-400 font-mono uppercase flex items-center gap-1.5">
                      COGNITIVE PROJECTION: AQI SPIKE DETECTED
                      <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-ping inline-block" />
                    </h4>
                    <p className="text-[9px] text-white/80 leading-relaxed font-sans">
                      {aqiPrediction.spikeReason || "Predictive models forecast a dangerous rise in air particulates over the next 24 hours."}
                    </p>
                    <button 
                      onClick={() => setActiveSection('intelligence')}
                      className="mt-1.5 text-[8px] font-mono font-bold text-rose-400 hover:text-rose-300 transition-colors cursor-pointer uppercase flex items-center gap-1"
                    >
                      <span>ANALYZE PROJECTION VECTOR &rarr;</span>
                    </button>
                  </div>
                </motion.div>
              )}

              <AnimatePresence mode="wait">
                {activeSection === 'aqi' && pollutionData && (
                  <motion.div
                    key="aqi"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                    className="flex-1 min-h-0 flex flex-col"
                  >
                    <AqiPanel 
                      pollutionItem={pollutionData} 
                      weatherData={weatherData}
                      lastUpdated={lastUpdated}
                      isRefreshing={isRefreshing}
                      onManualRefresh={handleManualRefresh}
                      inspectedCoords={inspectedCoords}
                      onResetInspection={handleResetInspection}
                    />
                  </motion.div>
                )}

                {activeSection === 'reports' && (
                  <motion.div
                    key="reports"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                    className="shrink-0"
                  >
                    <CitizenReportingCard 
                      layerMode={layerMode}
                      onLayerModeChange={setLayerMode}
                      onOpenReportModal={() => setIsReportModalOpen(true)}
                      reports={reports}
                    />
                  </motion.div>
                )}

                {activeSection === 'weather' && weatherData && (
                  <motion.div
                    key="weather"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                    className="shrink-0"
                  >
                    <WeatherStats weather={weatherData} currentAqi={pollutionData?.main?.aqi} />
                  </motion.div>
                )}

                {activeSection === 'intelligence' && (
                  <motion.div
                    key="intelligence"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                    className="shrink-0 flex-1 flex flex-col min-h-0"
                  >
                    <IntelligencePanel 
                      hotspotAssessment={hotspotAssessment}
                      aqiPrediction={aqiPrediction}
                      currentAqi={pollutionData?.main?.aqi || 1}
                      loading={aiLoading}
                      error={aiError}
                      onRefresh={computeAiIntelligence}
                      layerMode={layerMode}
                      onLayerModeChange={setLayerMode}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

            </div>
          )}

        </div>

      </main>

      {/* Visual Report Submission Modal overlay */}
      {isReportModalOpen && userCoords && (
        <ReportingModal 
          userCoords={userCoords}
          onClose={() => setIsReportModalOpen(false)}
          onSubmitReport={handleAddReport}
          onAddSystemLog={handleAddSystemLog}
        />
      )}

      {/* Visual About & Documentation Modal overlay */}
      {isAboutOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <AboutModal onClose={() => setIsAboutOpen(false)} />
        </div>
      )}

      {/* Global Real-time Hotspot Notification Banner */}
      <AnimatePresence>
        {globalAlert && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            className="fixed bottom-24 right-6 left-6 md:left-auto md:right-6 md:w-96 z-[3000] p-4 rounded-2xl bg-[#1a0505]/95 border border-red-500/40 shadow-[0_0_35px_rgba(239,68,68,0.4)] backdrop-blur-md pointer-events-auto flex flex-col gap-3"
          >
            <div className="flex gap-3 items-center justify-between">
              <div className="flex gap-2.5 items-center">
                <div className="shrink-0 h-8 w-8 rounded-lg bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400">
                  <AlertCircle className="h-4 w-4 animate-bounce" />
                </div>
                <div className="space-y-0.5">
                  <h4 className="text-[10px] font-black tracking-widest text-red-400 font-mono uppercase">
                    CRITICAL FIELD SENSOR TRIGGER
                  </h4>
                  <p className="text-[8px] text-white/50 font-mono">
                    [REAL-TIME DISPATCH ADVISORY]
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setGlobalAlert(null)}
                className="text-white/40 hover:text-white/80 font-mono text-[9px] uppercase cursor-pointer bg-white/5 hover:bg-white/10 px-1.5 py-0.5 rounded border border-white/10"
              >
                [Dismiss]
              </button>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center text-[10px] font-mono font-bold text-white">
                <span className="truncate">Type: {globalAlert.sourceType}</span>
                <span className="text-red-400 shrink-0">Score: {globalAlert.score}/100</span>
              </div>
              <p className="text-[9.5px] text-white/70 bg-black/40 p-2 rounded-lg border border-white/5 leading-normal">
                "{globalAlert.description}"
              </p>
              {globalAlert.locationName && (
                <div className="text-[8.5px] font-mono text-cyan-300">
                  📍 {globalAlert.locationName}
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-1">
              <button
                onClick={() => {
                  setViewMode('municipal');
                  setGlobalAlert(null);
                }}
                className="flex-1 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-[9px] font-mono text-red-300 hover:text-white transition-all cursor-pointer text-center font-bold uppercase tracking-wider"
              >
                LAUNCH COMMAND CONSOLE
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating AI Chatbot Assistant */}
      <FloatingChatbot 
        coords={inspectedCoords || userCoords}
        aqi={pollutionData?.main?.aqi || null}
        pollutants={pollutionData?.components || null}
        wind={weatherData?.wind || null}
        hotspots={hotspotAssessment?.hotspots || []}
        prediction={aqiPrediction}
        reports={reports}
      />

    </div>
  );
}
