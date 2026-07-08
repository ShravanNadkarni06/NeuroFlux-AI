import React, { useEffect, useState } from 'react';
import { X, MapPin, Wind, Thermometer, Droplets, Info, RefreshCw, AlertTriangle, CloudRain } from 'lucide-react';

interface MapInspectorPopupProps {
  latitude: number;
  longitude: number;
  onClose: () => void;
  pixelPosition: { x: number; y: number };
}

interface PollutionData {
  main: { aqi: number };
  components: {
    co: number;
    no: number;
    no2: number;
    o3: number;
    so2: number;
    pm2_5: number;
    pm10: number;
    nh3: number;
  };
}

interface WeatherData {
  weather: Array<{ description: string; main: string }>;
  main: {
    temp: number;
    humidity: number;
  };
  wind: {
    speed: number;
    deg: number;
  };
  rain?: {
    "1h"?: number;
    "3h"?: number;
  };
}

const AQI_SCALE = [
  { value: 1, label: 'Good', color: '#00FF95', textClass: 'text-[#00FF95]' },
  { value: 2, label: 'Fair', color: '#C6FF00', textClass: 'text-[#C6FF00]' },
  { value: 3, label: 'Moderate', color: '#FFD600', textClass: 'text-[#FFD600]' },
  { value: 4, label: 'Poor', color: '#FF6D00', textClass: 'text-[#FF6D00]' },
  { value: 5, label: 'Very Poor', color: '#FF1744', textClass: 'text-[#FF1744]' },
];

export default function MapInspectorPopup({ latitude, longitude, onClose, pixelPosition }: MapInspectorPopupProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pollution, setPollution] = useState<PollutionData | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [locationName, setLocationName] = useState<string>('');
  const [timestamp, setTimestamp] = useState<string>('');

  const [pollutionError, setPollutionError] = useState<string | null>(null);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setPollutionError(null);
    setWeatherError(null);
    setGeoError(null);
    setPollution(null);
    setWeather(null);
    setLocationName('');

    const fetchData = async () => {
      if (!active) return;

      // 1. Fetch Air Pollution spectrometry
      let pollutionResult = null;
      try {
        const url = `/api/pollution?lat=${latitude}&lon=${longitude}`;
        const res = await fetch(url);
        if (!res.ok) {
          const bodyText = await res.text().catch(() => "N/A");
          console.error(`[MapInspectorPopup] OPENWEATHER AQI SPECTROMETRY FAILURE. URL: ${url}, Status: ${res.status}, Body: ${bodyText}`);
          throw new Error("Air quality data unavailable for this location");
        }
        const data = await res.json();
        if (data && Array.isArray(data.list) && data.list.length > 0) {
          pollutionResult = data.list[0];
        } else {
          throw new Error("Air quality data unavailable for this location");
        }
      } catch (err: any) {
        console.error('[MapInspectorPopup] Pollution spectrometry retrieval error:', err);
        if (active) {
          setPollutionError(err.message || 'Air quality data unavailable for this location');
          setError(err.message || 'Air quality data unavailable for this location');
        }
      }

      // 2. Fetch Meteorological Weather
      let weatherResult = null;
      try {
        const url = `/api/weather?lat=${latitude}&lon=${longitude}`;
        const res = await fetch(url);
        if (!res.ok) {
          const bodyText = await res.text().catch(() => "N/A");
          console.error(`[MapInspectorPopup] OPENWEATHER METAR FAILURE. URL: ${url}, Status: ${res.status}, Body: ${bodyText}`);
          throw new Error(`Weather fetch failed: Status ${res.status}`);
        }
        weatherResult = await res.json();
      } catch (err: any) {
        console.error('[MapInspectorPopup] Meteorological weather retrieval error:', err);
        if (active) {
          setWeatherError(err.message || 'Meteorological telemetry failed.');
        }
      }

      // 3. Fetch Reverse Geocoding
      let geoResult = null;
      try {
        const url = `/api/reverse-geocode?lat=${latitude}&lon=${longitude}`;
        const res = await fetch(url);
        if (!res.ok) {
          const bodyText = await res.text().catch(() => "N/A");
          console.error(`[MapInspectorPopup] GEOLOCATION RESOLVER FAILURE. URL: ${url}, Status: ${res.status}, Body: ${bodyText}`);
          throw new Error(`Reverse geocode failed: Status ${res.status}`);
        }
        geoResult = await res.json();
      } catch (err: any) {
        console.error('[MapInspectorPopup] Reverse geocoding error:', err);
        if (active) {
          setGeoError(err.message || 'Geocoding resolver failed.');
        }
      }

      if (!active) return;

      // If all three telemetry channels failed, raise a fatal alert
      if (!pollutionResult && !weatherResult && !geoResult) {
        setError('All telemetry uplink channels are offline. Verify system configuration keys.');
      } else {
        // Build resolved place name
        let resolvedName = '';
        if (geoResult && Array.isArray(geoResult) && geoResult.length > 0) {
          const place = geoResult[0];
          const parts = [place.name];
          if (place.state) parts.push(place.state);
          if (place.country) parts.push(place.country);
          resolvedName = parts.filter(Boolean).join(', ');
        } else {
          resolvedName = `${latitude.toFixed(4)}°N, ${longitude.toFixed(4)}°E (exact place name unavailable)`;
        }

        setPollution(pollutionResult);
        setWeather(weatherResult);
        setLocationName(resolvedName);
        setTimestamp(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      }
      setLoading(false);
    };

    fetchData();

    return () => {
      active = false;
    };
  }, [latitude, longitude]);

  // Support closing popup with Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Translate wind degrees to readable direction (e.g. N, NE, E...)
  const getWindDirection = (deg: number) => {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(((deg %= 360) < 0 ? deg + 360 : deg) / 22.5) % 16;
    return directions[index];
  };

  const activeAqiObj = (pollution && pollution.main && pollution.main.aqi !== undefined) 
    ? (AQI_SCALE.find(item => item.value === pollution.main.aqi) || null) 
    : null;

  const rainfallAmount = weather && weather.rain 
    ? (weather.rain['1h'] !== undefined ? weather.rain['1h'] : (weather.rain['3h'] !== undefined ? weather.rain['3h'] : null)) 
    : null;

  return (
    <div
      className="absolute z-[1000] w-[320px] bg-[#050c20]/95 backdrop-blur-lg border border-cyan-500/30 rounded-2xl p-4 shadow-[0_0_30px_rgba(0,212,255,0.25)] select-none transition-all duration-300 flex flex-col gap-3 font-sans"
      style={{
        left: `${pixelPosition.x}px`,
        top: `${pixelPosition.y}px`,
        transform: 'translate(-50%, -105%)', // Centered and sitting right above the inspection crosshair marker
        marginTop: '-12px',
      }}
    >
      {/* Sci-Fi Hologram Header */}
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#00D4FF]/50 to-transparent" />
      <div className="scanner-line opacity-20" />

      {/* Title & Close (X) */}
      <div className="flex justify-between items-start gap-2">
        <div className="flex items-center gap-1.5">
          <div className="h-1.5 w-1.5 bg-[#00D4FF] rounded-full animate-pulse shadow-[0_0_8px_#00D4FF]" />
          <span className="text-[9px] font-bold tracking-widest text-[#00D4FF] font-mono uppercase">
            TARGET SPECTROMETRY
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md hover:bg-white/10 text-white/50 hover:text-white transition-colors cursor-pointer"
          title="Close telemetry popup"
          aria-label="Close telemetry popup"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {loading ? (
        /* Dynamic Futuristic Shimmer Skeleton loading state */
        <div className="space-y-3.5 py-2 animate-pulse">
          <div className="h-4 bg-white/5 rounded w-3/4 holo-shimmer" />
          <div className="h-12 bg-white/5 rounded holo-shimmer" />
          <div className="space-y-1.5">
            <div className="h-3 bg-white/5 rounded holo-shimmer w-1/2" />
            <div className="grid grid-cols-3 gap-1.5">
              <div className="h-8 bg-white/5 rounded holo-shimmer" />
              <div className="h-8 bg-white/5 rounded holo-shimmer" />
              <div className="h-8 bg-white/5 rounded holo-shimmer" />
            </div>
          </div>
          <div className="h-8 bg-white/5 rounded holo-shimmer" />
        </div>
      ) : error ? (
        /* Real telemetry error reporting (never fabricated) */
        <div className="flex flex-col items-center justify-center p-4 border border-red-500/20 rounded-xl bg-red-500/5 text-center my-1 gap-2">
          <AlertTriangle className="h-6 w-6 text-red-400 animate-bounce" />
          <div className="text-[10px] font-mono font-bold text-red-400 uppercase tracking-wider">
            SENSOR UPLINK CORRUPTED
          </div>
          <p className="text-[9px] text-white/60 leading-relaxed max-w-full">
            {error}
          </p>
          <button
            onClick={() => {
              // Force refresh state triggers fetch effect
              setLoading(true);
              setError(null);
            }}
            className="mt-1 flex items-center gap-1 px-2 py-1 text-[8px] font-mono text-cyan-400 border border-cyan-400/20 hover:bg-cyan-400/10 rounded transition-colors"
          >
            <RefreshCw className="h-2 w-2" /> RECONNECT LINK
          </button>
        </div>
      ) : (
        /* Inspector Content */
        <div className="flex flex-col gap-2.5">
          {/* Resolved Place Name */}
          <div className="flex items-start gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-cyan-400 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-white font-bold text-xs leading-snug break-words uppercase tracking-tight" title={locationName}>
                {locationName || "Resolving name..."}
              </div>
              <div className="text-[8px] font-mono text-white/40 mt-0.5 select-all">
                COORD: {latitude.toFixed(5)}°N, {longitude.toFixed(5)}°E
              </div>
              {geoError && (
                <div className="text-[7px] font-mono text-amber-400 mt-0.5 leading-tight truncate" title={geoError}>
                  Geocode Warning: {geoError}
                </div>
              )}
            </div>
          </div>

          {/* AQI Panel with dynamic gradient bar & active value indicator */}
          <div className="p-2.5 bg-black/60 border border-white/5 rounded-xl flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <span className="text-[8px] font-bold font-mono text-white/40 uppercase">AERO AQI INDEX</span>
              {activeAqiObj ? (
                <span className={`text-[9px] font-mono font-black uppercase tracking-wider ${activeAqiObj.textClass}`}>
                  AQI {activeAqiObj.value} - {activeAqiObj.label.toUpperCase()} [1-5 SCALE]
                </span>
              ) : (
                <span className="text-[8px] font-mono font-bold text-red-400 uppercase">OFFLINE</span>
              )}
            </div>

            {pollution ? (
              /* Gradient visual bar with a physical visual pin pointing to current AQI value */
              <div className="relative mt-1 pb-4">
                {/* Gradient background bar */}
                <div className="h-1.5 w-full rounded-full bg-gradient-to-r from-[#00FF95] via-[#FFD600] to-[#FF1744] opacity-85" />
                
                {/* Markers & Labels */}
                <div className="absolute top-3 left-0 w-full flex justify-between text-[7px] font-mono text-white/40 leading-none">
                  <span>GOOD</span>
                  <span>FAIR</span>
                  <span>MOD</span>
                  <span>POOR</span>
                  <span>SEVERE</span>
                </div>

                {/* Pin indicator marker */}
                <div 
                  className="absolute -top-1 transform -translate-x-1/2 flex flex-col items-center transition-all duration-500"
                  style={{ left: `${(((pollution?.main?.aqi ?? 1) - 1) / 4) * 100}%` }}
                >
                  <div className="w-1.5 h-3 bg-white rounded-full shadow-[0_0_6px_#00D4FF] border border-cyan-500" />
                  <div className="w-[1px] h-1.5 bg-cyan-400 mt-0.5" />
                </div>
              </div>
            ) : (
              <div className="text-[9px] text-red-400/80 font-mono italic p-1 bg-red-500/5 rounded border border-red-500/10 text-center">
                {pollutionError || 'Air spectrometry feed offline.'}
              </div>
            )}
          </div>

          {/* Pollutant Spec Sheets Breakdown Grid (CO, O3, NO2, SO2, PM2.5, PM10) */}
          <div className="space-y-1">
            <div className="text-[8px] font-bold font-mono text-white/40 uppercase tracking-wider flex items-center gap-1">
              <Info className="h-2.5 w-2.5 text-cyan-400" />
              POLLUTANTS SPECTROMETRY (μg/m³)
            </div>
            {pollution ? (
              <div className="grid grid-cols-3 gap-1.5 font-mono text-[8.5px]">
                {/* PM 2.5 */}
                <div className="p-1.5 bg-white/5 border border-white/5 rounded-lg flex flex-col">
                  <span className="text-white/40 text-[7px]">PM2.5</span>
                  <span className="text-white font-bold mt-0.5">{pollution?.components?.pm2_5 !== undefined ? pollution.components.pm2_5.toFixed(1) : 'N/A'}</span>
                </div>
                {/* PM 10 */}
                <div className="p-1.5 bg-white/5 border border-white/5 rounded-lg flex flex-col">
                  <span className="text-white/40 text-[7px]">PM10</span>
                  <span className="text-white font-bold mt-0.5">{pollution?.components?.pm10 !== undefined ? pollution.components.pm10.toFixed(1) : 'N/A'}</span>
                </div>
                {/* NO2 */}
                <div className="p-1.5 bg-white/5 border border-white/5 rounded-lg flex flex-col">
                  <span className="text-white/40 text-[7px]">NO2</span>
                  <span className="text-white font-bold mt-0.5">{pollution?.components?.no2 !== undefined ? pollution.components.no2.toFixed(1) : 'N/A'}</span>
                </div>
                {/* SO2 */}
                <div className="p-1.5 bg-white/5 border border-white/5 rounded-lg flex flex-col">
                  <span className="text-white/40 text-[7px]">SO2</span>
                  <span className="text-white font-bold mt-0.5">{pollution?.components?.so2 !== undefined ? pollution.components.so2.toFixed(1) : 'N/A'}</span>
                </div>
                {/* CO */}
                <div className="p-1.5 bg-white/5 border border-white/5 rounded-lg flex flex-col">
                  <span className="text-white/40 text-[7px]">CO</span>
                  <span className="text-white font-bold mt-0.5">{pollution?.components?.co !== undefined ? (pollution.components.co / 1000).toFixed(2) : 'N/A'}m</span>
                </div>
                {/* O3 */}
                <div className="p-1.5 bg-white/5 border border-white/5 rounded-lg flex flex-col">
                  <span className="text-white/40 text-[7px]">O3</span>
                  <span className="text-white font-bold mt-0.5">{pollution?.components?.o3 !== undefined ? pollution.components.o3.toFixed(1) : 'N/A'}</span>
                </div>
              </div>
            ) : (
              <div className="text-[9px] text-red-400/80 font-mono italic p-1.5 bg-red-500/5 rounded-lg border border-red-500/10 text-center">
                Detailed molecular spectrometry unavailable
              </div>
            )}
          </div>

          {/* Real-time Atmospheric Metar details */}
          {weather ? (
            <div className="p-2 bg-white/5 border border-white/5 rounded-xl space-y-1.5">
              <div className="text-[8px] font-bold font-mono text-white/40 uppercase">ATMOSPHERICS</div>
              <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[8.5px] font-mono text-white/80">
                <div className="flex items-center gap-1">
                  <Thermometer className="h-3 w-3 text-cyan-400 shrink-0" />
                  <span>{weather?.main?.temp !== undefined ? weather.main.temp.toFixed(1) : 'N/A'}°C</span>
                </div>
                <div className="flex items-center gap-1">
                  <Droplets className="h-3 w-3 text-cyan-400 shrink-0" />
                  <span>{weather?.main?.humidity ?? 'N/A'}% RH</span>
                </div>
                <div className="flex items-center gap-1 min-w-0">
                  <Wind className="h-3 w-3 text-cyan-400 shrink-0" />
                  <span className="truncate" title={weather?.wind ? `${weather.wind.speed?.toFixed(1)} m/s ${getWindDirection(weather.wind.deg ?? 0)}` : 'N/A'}>
                    {weather?.wind ? `${weather.wind.speed?.toFixed(1)}m/s ${getWindDirection(weather.wind.deg ?? 0)}` : 'N/A'}
                  </span>
                </div>
                <div className="flex items-center gap-1 min-w-0">
                  <CloudRain className="h-3 w-3 text-cyan-400 shrink-0" />
                  <span className="truncate" title={rainfallAmount !== null ? `${rainfallAmount.toFixed(1)} mm/h` : 'No rainfall currently'}>
                    {rainfallAmount !== null ? `${rainfallAmount.toFixed(1)} mm` : 'No rainfall currently'}
                  </span>
                </div>
              </div>
              <div className="text-[8.5px] italic text-white/60 capitalize text-center border-t border-white/5 pt-1">
                Condition: {weather?.weather?.[0]?.description || 'Clear Sky'}
              </div>
            </div>
          ) : (
            <div className="p-2 bg-red-500/5 border border-red-500/10 rounded-xl space-y-1">
              <div className="text-[8px] font-bold font-mono text-red-400 uppercase">ATMOSPHERICS</div>
              <p className="text-[9px] text-red-400/80 font-mono italic">{weatherError || 'Meteorological telemetry feed offline.'}</p>
            </div>
          )}

          {/* Diagnostic Sync Status */}
          <div className="flex justify-between items-center text-[7.5px] font-mono text-white/30 border-t border-white/5 pt-1.5 mt-0.5">
            <span>UPLINK: ACTIVE SECURE</span>
            <span>FETCH_TIME: {timestamp || 'N/A'}</span>
          </div>
        </div>
      )}
    </div>
  );
}
