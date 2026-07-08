import { AQIMetadata } from '../types';

export const AQI_MAPPING: Record<1 | 2 | 3 | 4 | 5, AQIMetadata> = {
  1: {
    label: 'Good',
    color: 'text-[#00FF95]',
    bgColor: 'bg-[#00FF95]/10',
    borderColor: 'border-[#00FF95]/20',
    shadowColor: 'shadow-[#00FF95]/10',
    description: 'Air quality is satisfactory, and air pollution poses little or no risk.',
    advice: 'Perfect day for outdoor activities. No health precautions needed.',
  },
  2: {
    label: 'Fair',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/20',
    shadowColor: 'shadow-amber-500/10',
    description: 'Air quality is acceptable; however, sensitive individuals may experience symptoms.',
    advice: 'Extremely sensitive groups should consider reducing heavy outdoor exertion.',
  },
  3: {
    label: 'Moderate',
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/20',
    shadowColor: 'shadow-orange-500/10',
    description: 'Members of sensitive groups may experience health effects. General public less affected.',
    advice: 'Consider wearing a mask if sensitive. Take breaks during long outdoor exercises.',
  },
  4: {
    label: 'Poor',
    color: 'text-rose-400',
    bgColor: 'bg-rose-500/10',
    borderColor: 'border-rose-500/20',
    shadowColor: 'shadow-rose-500/10',
    description: 'Everyone may begin to experience health effects; sensitive groups may experience more serious effects.',
    advice: 'Avoid prolonged outdoor activities. Keep windows closed to prevent particulate entry.',
  },
  5: {
    label: 'Very Poor',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/20',
    shadowColor: 'shadow-purple-500/10',
    description: 'Health warnings of emergency conditions. The entire population is likely to be affected.',
    advice: 'Remain indoors. Keep air filtration running. Strictly avoid heavy physical exertion.',
  },
};

// Returns standard rating for specific pollutants
// EU or EPA Air Quality Index pollutant limits for PM2.5, PM10, NO2, O3, SO2, CO
export interface PollutantThresholds {
  name: string;
  unit: string;
  good: number;
  fair: number;
  moderate: number;
  poor: number;
}

export const POLLUTANT_DETAILS: Record<string, PollutantThresholds> = {
  pm2_5: {
    name: 'PM2.5',
    unit: 'μg/m³',
    good: 10,
    fair: 25,
    moderate: 50,
    poor: 75,
  },
  pm10: {
    name: 'PM10',
    unit: 'μg/m³',
    good: 20,
    fair: 50,
    moderate: 90,
    poor: 180,
  },
  no2: {
    name: 'NO₂',
    unit: 'μg/m³',
    good: 40,
    fair: 100,
    moderate: 150,
    poor: 200,
  },
  o3: {
    name: 'O₃',
    unit: 'μg/m³',
    good: 60,
    fair: 120,
    moderate: 180,
    poor: 240,
  },
  so2: {
    name: 'SO₂',
    unit: 'μg/m³',
    good: 20,
    fair: 80,
    moderate: 250,
    poor: 350,
  },
  co: {
    name: 'CO',
    unit: 'μg/m³',
    good: 4400,
    fair: 9400,
    moderate: 12400,
    poor: 15400,
  },
};

export function getPollutantRating(key: string, value: number): { label: string; color: string } {
  const details = POLLUTANT_DETAILS[key];
  if (!details) return { label: 'Unknown', color: 'text-slate-400' };

  if (value <= details.good) return { label: 'Good', color: 'text-[#00FF95]' };
  if (value <= details.fair) return { label: 'Fair', color: 'text-amber-400' };
  if (value <= details.moderate) return { label: 'Moderate', color: 'text-orange-400' };
  if (value <= details.poor) return { label: 'Poor', color: 'text-rose-400' };
  return { label: 'Very Poor', color: 'text-purple-400' };
}

// Helper to calculate wind direction cardinal name
export function getWindDirection(deg: number): string {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(((deg %= 360) < 0 ? deg + 360 : deg) / 22.5) % 16;
  return directions[index];
}
