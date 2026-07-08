export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface Pollutants {
  co: number; // Carbon monoxide (μg/m³)
  no: number; // Nitrogen monoxide (μg/m³)
  no2: number; // Nitrogen dioxide (μg/m³)
  o3: number; // Ozone (μg/m³)
  so2: number; // Sulfur dioxide (μg/m³)
  pm2_5: number; // Fine particles matter (μg/m³)
  pm10: number; // Coarse particulate matter (μg/m³)
  nh3: number; // Ammonia (μg/m³)
}

export interface AirPollutionItem {
  dt: number;
  main: {
    aqi: 1 | 2 | 3 | 4 | 5; // 1 = Good, 2 = Fair, 3 = Moderate, 4 = Poor, 5 = Very Poor
  };
  components: Pollutants;
}

export interface AirPollutionResponse {
  coord: number[];
  list: AirPollutionItem[];
}

export interface WeatherData {
  name: string;
  main: {
    temp: number;
    feels_like: number;
    humidity: number;
    pressure: number;
  };
  wind: {
    speed: number;
    deg: number; // Wind direction in degrees
  };
  weather: Array<{
    id: number;
    main: string;
    description: string;
    icon: string;
  }>;
  rain?: {
    "1h"?: number;
    "3h"?: number;
  };
}

export type GeolocationStatus = 
  | 'idle'
  | 'requesting'
  | 'tracking'
  | 'denied'
  | 'unavailable'
  | 'timeout'
  | 'error';

export interface AQIMetadata {
  label: string;
  color: string; // Tailwind text color
  bgColor: string; // Tailwind bg color
  borderColor: string; // Tailwind border color
  shadowColor: string; // Custom glow shadow
  description: string;
  advice: string;
}

export interface PollutionReport {
  id: string;
  latitude: number;
  longitude: number;
  photo: string; // base64 encoded photo
  description: string;
  classification: string;
  severity: 'low' | 'medium' | 'high';
  timestamp: string;
  locationName?: string;
}

export type MapLayerMode = 'aqi' | 'reports' | 'both' | 'hotspots';

export interface Hotspot {
  latitude: number;
  longitude: number;
  radius: number; // in meters
  score: number; // 0-100
  sourceType: string;
  description: string;
  currentAqi?: number;
  predictedTrend?: 'Improving' | 'Stable' | 'Worsening';
  detectedAt?: string;
  recommendedAction?: string;
  locationName?: string;
}

export interface HotspotRiskAssessment {
  riskScore: number;
  riskLabel: 'Low' | 'Moderate' | 'High' | 'Severe';
  sourceType: string;
  explanation: string;
  hotspots: Hotspot[];
  satelliteFires?: Array<{
    latitude: number;
    longitude: number;
    distanceKm: number;
    brightness: number;
    confidence: string;
  }>;
}

export interface PredictionPoint {
  label: string;
  time: string;
  aqi: number; // 1-5 scale to match OpenWeather AQI
}

export interface AQIPrediction {
  predictions: PredictionPoint[];
  confidence: 'Low' | 'Medium' | 'High';
  willSpike: boolean;
  spikeReason: string;
  history?: Array<{ label: string; time: string; aqi: number }>;
}

export interface GridPoint {
  latitude: number;
  longitude: number;
  dy: number;
  dx: number;
  aqi: number;
  components: {
    co: number;
    no?: number;
    no2: number;
    o3: number;
    so2: number;
    pm2_5: number;
    pm10: number;
    nh3: number;
  };
}


