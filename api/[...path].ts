import express from "express";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config({ override: true });

const app = express();

app.use(express.json({ limit: "15mb" }));

// API route for loading configuration status (presence of keys)
app.get("/api/config-status", (req, res) => {
  res.json({
    openWeatherKeyConfigured: !!process.env.OPENWEATHER_API_KEY,
    geminiKeyConfigured: !!process.env.GEMINI_API_KEY,
  });
});

// API route for air pollution
app.get("/api/pollution", async (req, res) => {
  try {
    const { lat, lon } = req.query;
    if (!lat || !lon) {
      return res.status(400).json({ error: "Latitude and longitude are required." });
    }

    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: "OPENWEATHER_API_KEY is not configured on the server. Please add it to your secrets.",
      });
    }

    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    const url = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${apiKey}&t=${Date.now()}`;
    const response = await fetch(url);

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({
        error: `Failed to fetch air pollution data from OpenWeather: ${errText}`,
      });
    }

    const data = await response.json();
    console.log(`[AeroSense Server] Raw OpenWeather Air Pollution Response for lat=${lat}, lon=${lon}:`, JSON.stringify(data));
    res.json(data);
  } catch (err: any) {
    console.error("Error in /api/pollution:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

// API route for current weather
app.get("/api/weather", async (req, res) => {
  try {
    const { lat, lon } = req.query;
    if (!lat || !lon) {
      return res.status(400).json({ error: "Latitude and longitude are required." });
    }

    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: "OPENWEATHER_API_KEY is not configured on the server. Please add it to your secrets.",
      });
    }

    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}&t=${Date.now()}`;
    const response = await fetch(url);

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({
        error: `Failed to fetch weather data from OpenWeather: ${errText}`,
      });
    }

    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    console.error("Error in /api/weather:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

// API route for reverse geocoding via OpenWeather Geo API
app.get("/api/reverse-geocode", async (req, res) => {
  try {
    const { lat, lon } = req.query;
    if (!lat || !lon) {
      return res.status(400).json({ error: "Latitude and longitude are required." });
    }

    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: "OPENWEATHER_API_KEY is not configured on the server. Please add it to your secrets.",
      });
    }

    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    const url = `http://api.openweathermap.org/geo/1.0/reverse?lat=${lat}&lon=${lon}&limit=1&appid=${apiKey}`;
    const response = await fetch(url);

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({
        error: `Failed to fetch geocoding data from OpenWeather: ${errText}`,
      });
    }

    const data = await response.json();
    console.log(`[AeroSense Server] Geocoding response for lat=${lat}, lon=${lon}:`, JSON.stringify(data));
    res.json(data);
  } catch (err: any) {
    console.error("Error in /api/reverse-geocode:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

// API route for citizen report pollution visual diagnostics using Gemini Flash
app.post("/api/analyze-pollution", async (req, res) => {
  try {
    const { photo, description } = req.body;
    if (!photo) {
      return res.status(400).json({ error: "Photo data is required." });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY is not configured on the server. Please configure it in Settings > Secrets.",
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
    });

    let base64Data = photo;
    let mimeType = "image/jpeg";

    if (photo.startsWith("data:")) {
      const parts = photo.split(",");
      if (parts.length === 2) {
        const meta = parts[0];
        base64Data = parts[1];
        const mimeMatch = meta.match(/data:([^;]+);/);
        if (mimeMatch) {
          mimeType = mimeMatch[1];
        }
      }
    }

    const imagePart = {
      inlineData: { mimeType, data: base64Data },
    };

    const promptText = `You are the core visual diagnostics AI for AeroSense, a futuristic hyperlocal environmental monitoring platform.
Analyze the provided photograph of a localized visual air pollution event.
${description ? `The user provided the following optional context/description: "${description}"` : ""}

Determine:
1. Classification of the pollution event. Choose EXACTLY one of: "smoke plume", "dust cloud", "open burning", "vehicular smog", "industrial emission", or "none detected".
2. Severity score of the event. Choose EXACTLY one of: "low", "medium", or "high" based on visual density, size, spread, and environmental risk.
3. A concise summary of the visual evidence and potential immediate hazard (maximum 15 words).

You MUST return the output strictly as a JSON object matching the following structure:
{
  "classification": "smoke plume" | "dust cloud" | "open burning" | "vehicular smog" | "industrial emission" | "none detected",
  "severity": "low" | "medium" | "high",
  "summary": "dense dark black smoke plume rising from localized tire fire"
}

Ensure the response contains ONLY the raw JSON block, valid and parseable. Do not wrap in markdown code blocks.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: { parts: [imagePart, { text: promptText }] },
      config: { responseMimeType: "application/json" }
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error("No response text received from Gemini API.");
    }

    const parsedData = JSON.parse(responseText.trim());
    res.json(parsedData);
  } catch (err: any) {
    console.error("Error in /api/analyze-pollution:", err);
    res.status(500).json({ error: err.message || "Failed to analyze pollution event." });
  }
});

// Distance helper using Haversine formula
function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Cache for NASA FIRMS active fires (valid for 1 hour)
let cachedFires: Array<{ latitude: number; longitude: number; brightness: number; confidence: string }> | null = null;
let lastFireFetchTime = 0;

async function fetchActiveFires(): Promise<Array<{ latitude: number; longitude: number; brightness: number; confidence: string }>> {
  const now = Date.now();
  if (cachedFires && (now - lastFireFetchTime < 60 * 60 * 1000)) {
    return cachedFires;
  }

  try {
    console.log("[AeroSense Server] Fetching latest active fire CSV from NASA FIRMS...");
    const url = "https://firms.modaps.eosdis.nasa.gov/data/active_fire/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_Global_24h.csv";

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP status ${response.status}`);
    }

    const text = await response.text();
    const lines = text.split("\n");
    if (lines.length < 2) {
      throw new Error("Empty or malformed CSV received");
    }

    const headers = lines[0].split(",");
    const latIdx = headers.indexOf("latitude");
    const lonIdx = headers.indexOf("longitude");
    const brightIdx = headers.indexOf("bright_ti1");
    const confidenceIdx = headers.indexOf("confidence");

    if (latIdx === -1 || lonIdx === -1) {
      throw new Error("Required columns missing in CSV");
    }

    const parsed: Array<{ latitude: number; longitude: number; brightness: number; confidence: string }> = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const cols = line.split(",");
      const latitude = parseFloat(cols[latIdx]);
      const longitude = parseFloat(cols[lonIdx]);

      if (!isNaN(latitude) && !isNaN(longitude)) {
        parsed.push({
          latitude,
          longitude,
          brightness: brightIdx !== -1 ? parseFloat(cols[brightIdx]) : 300,
          confidence: confidenceIdx !== -1 ? cols[confidenceIdx] : "n"
        });
      }
    }

    console.log(`[AeroSense Server] NASA FIRMS sync complete. Parsed ${parsed.length} active fires globally.`);
    cachedFires = parsed;
    lastFireFetchTime = now;
    return parsed;
  } catch (err: any) {
    console.warn("[AeroSense Server] NASA FIRMS fetch failed (using fallback or last cache):", err.message);
    if (cachedFires) {
      return cachedFires;
    }
    return [];
  }
}

async function getNearbyActiveFires(lat: number, lon: number, maxDistanceKm: number = 15) {
  const fires = await fetchActiveFires();
  const nearby: Array<{ latitude: number; longitude: number; distanceKm: number; brightness: number; confidence: string }> = [];

  for (const fire of fires) {
    const dist = getDistanceKm(lat, lon, fire.latitude, fire.longitude);
    if (dist <= maxDistanceKm) {
      nearby.push({
        latitude: fire.latitude,
        longitude: fire.longitude,
        distanceKm: dist,
        brightness: fire.brightness,
        confidence: fire.confidence
      });
    }
  }

  nearby.sort((a, b) => a.distanceKm - b.distanceKm);
  return nearby;
}

// Cache for the hyperlocal grid (valid for 5 mins, within 200m)
let cachedGrid: {
  centerLat: number;
  centerLon: number;
  timestamp: number;
  points: any[];
} | null = null;

app.get("/api/pollution-grid", async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);
    const spacing = parseFloat((req.query.spacing as string) || "350");

    if (isNaN(lat) || isNaN(lon)) {
      return res.status(400).json({ error: "Valid latitude and longitude are required." });
    }

    if (cachedGrid && (Date.now() - cachedGrid.timestamp < 5 * 60 * 1000)) {
      const dist = getDistanceKm(lat, lon, cachedGrid.centerLat, cachedGrid.centerLon);
      if (dist < 0.2) {
        console.log(`[AeroSense Server] Serving pollution grid from cache. Distance: ${(dist * 1000).toFixed(1)}m`);
        return res.json({ points: cachedGrid.points, source: "cache" });
      }
    }

    console.log(`[AeroSense Server] Fetching live pollution grid centered at ${lat.toFixed(4)}, ${lon.toFixed(4)}`);

    const apiKey = process.env.OPENWEATHER_API_KEY;
    const gridCoords: { latitude: number; longitude: number; dy: number; dx: number }[] = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const pointLat = lat + dy * (spacing / 111000);
        const pointLon = lon + dx * (spacing / (111000 * Math.cos(lat * Math.PI / 180)));
        gridCoords.push({ latitude: pointLat, longitude: pointLon, dy, dx });
      }
    }

    const promises = gridCoords.map(async ({ latitude, longitude, dy, dx }) => {
      if (!apiKey) {
        throw new Error("OPENWEATHER_API_KEY is not configured on the server.");
      }
      const url = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${latitude}&lon=${longitude}&appid=${apiKey}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Grid point fetch failed [Status ${response.status}]`);
      }
      const data = await response.json();
      return {
        latitude,
        longitude,
        dy,
        dx,
        aqi: data.list?.[0]?.main?.aqi ?? 2,
        components: data.list?.[0]?.components ?? {}
      };
    });

    const points = await Promise.all(promises);
    cachedGrid = {
      centerLat: lat,
      centerLon: lon,
      timestamp: Date.now(),
      points
    };

    res.json({ points, source: "live" });
  } catch (err: any) {
    console.error("Error in /api/pollution-grid:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

// API Route for automatic hidden hotspot detection
app.post("/api/detect-hotspots", async (req, res) => {
  try {
    const { lat, lon, currentAqi, pollutants, wind, reports, demoMode } = req.body;

    if (lat === undefined || lon === undefined) {
      return res.status(400).json({ error: "Latitude and longitude are required." });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY is not configured on the server. Please configure it in Settings > Secrets.",
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
    });

    const nearbyReports = (reports || []).map((r: any) => ({
      ...r,
      distanceKm: getDistanceKm(lat, lon, r.latitude, r.longitude)
    })).filter((r: any) => r.distanceKm <= 5.0);

    const reportsListText = nearbyReports.length > 0
      ? nearbyReports.map((r: any, idx: number) => {
          return `[Report #${idx + 1}]:
  - Classification: ${r.classification}
  - Severity: ${r.severity}
  - Description: ${r.description || 'No description'}
  - Proximity: ${r.distanceKm.toFixed(2)} km away from user
  - Coordinates: ${r.latitude}, ${r.longitude}
  - Timestamp: ${r.timestamp}`;
        }).join('\n\n')
      : "No nearby citizen reports recorded within 5km.";

    const satelliteFires = await getNearbyActiveFires(lat, lon, 10.0);

    if (demoMode) {
      if (satelliteFires.length === 0) {
        const fireReports = (reports || []).filter((r: any) => {
          const c = (r.classification || '').toLowerCase();
          const d = (r.description || '').toLowerCase();
          return r.severity === 'high' && (c.includes('fire') || c.includes('burn') || c.includes('smoke') || d.includes('fire') || d.includes('burn'));
        });

        for (const fr of fireReports) {
          const dist = getDistanceKm(lat, lon, fr.latitude, fr.longitude);
          if (dist <= 10.0) {
            satelliteFires.push({
              latitude: fr.latitude,
              longitude: fr.longitude,
              distanceKm: dist,
              brightness: 355.8,
              confidence: 'nominal',
              isDemoSimulated: true
            } as any);
          }
        }
      }
    }

    const satelliteFiresText = satelliteFires.length > 0
      ? satelliteFires.map((f: any, idx) => {
          return `[Satellite Thermal Anomaly #${idx + 1}]:
  - Coordinate: ${f.latitude}°N, ${f.longitude}°E
  - Proximity: ${f.distanceKm.toFixed(2)} km from user's center
  - Fire Radiative Power / Intensity Temperature: ${f.brightness} K (Kelvin)
  - Satellite Instrument Detection Confidence: ${f.confidence === 'h' ? 'High' : f.confidence === 'n' ? 'Nominal' : 'Low/Moderate'}
  - DATA INTEGRITY: ${f.isDemoSimulated ? 'DEMO MODE - SIMULATED TELEMETRY' : 'VERIFIED SATELLITE SOURCE'}`;
        }).join('\n\n')
      : "No active garbage-dump fires or thermal anomalies registered by NASA MODIS/VIIRS satellites within 10km of user.";

    const promptText = `You are the Core Environmental Intelligence Engine for AeroSense, a futuristic hyperlocal environmental monitoring platform.
Your task is to analyze real physical data signals for the user's current location and detect "hidden air quality hotspots" and overall hotspot risk assessment.

USER LOCATION: Latitude: ${lat}, Longitude: ${lon}

SIGNAL A: Live Ambient Air Quality (OpenWeather API):
- Ambient Air Quality Index (AQI): ${currentAqi || 1} (Scale: 1 = Good, 2 = Fair, 3 = Moderate, 4 = Poor, 5 = Very Poor)
- Pollutants (in μg/m³):
  - PM2.5 (Fine Particulate Matter): ${pollutants?.pm2_5 ?? 'N/A'}
  - PM10 (Coarse Particulate Matter): ${pollutants?.pm10 ?? 'N/A'}
  - NO2 (Nitrogen Dioxide): ${pollutants?.no2 ?? 'N/A'}
  - O3 (Ozone): ${pollutants?.o3 ?? 'N/A'}
  - CO (Carbon Monoxide): ${pollutants?.co ?? 'N/A'}
  - SO2 (Sulfur Dioxide): ${pollutants?.so2 ?? 'N/A'}
  - NH3 (Ammonia): ${pollutants?.nh3 ?? 'N/A'}

SIGNAL B: Local Wind Data:
- Wind Speed: ${wind?.speed ?? 0} m/s
- Wind Direction (degrees): ${wind?.deg ?? 0}° (where 0° is North, 90° is East, 180° is South, 270° is West. Note that wind blows FROM this direction, meaning pollution drifts DOWNWIND, which is in the opposite direction: (wind.deg + 180) % 360).

SIGNAL C: Nearby Citizen Reports:
We have a set of verified citizen reports of active air pollution events:
${reportsListText}

SIGNAL D: Satellite Active Fire & Thermal Anomalies (NASA FIRMS MODIS/VIIRS):
The following thermal anomalies / fire radiative pixels were detected nearby within 10km of user center by NASA's orbiters:
${satelliteFiresText}

INSTRUCTIONS FOR DETECTING HOTSPOTS:
1. Identify if there are any highly concentrated hotspots. A hotspot is defined as a localized area with elevated pollution risk.
2. Consider that pollution drifts downwind (opposite direction of wind angle). If there's a strong citizen report or a satellite thermal anomaly upwind of the user, that source contributes highly to the user's risk.
3. If a satellite-detected thermal anomaly is nearby (SIGNAL D), classify it as a severe hotspot, estimate its smoke drift plume impact on the user, and factor it heavily into the final "riskScore" and "riskLabel".
4. Compute an overall risk assessment score (0-100 scale) for the user's immediate neighborhood.
5. For each detected hotspot (up to 3), identify its coordinates (either matching a specific citizen report/satellite fire's real coordinates, or a calculated point if reports, satellite detections and wind drift imply a source location), its severity score (0-100), its estimated radius of impact in meters (e.g. 300 to 1200 meters), and likely source.
6. If there are NO citizen reports or satellite thermal anomalies and ambient AQI is Low, you should still return a baseline hotspot at the user's coordinates representing general ambient status if AQI > 1, or empty list of hotspots if everything is completely pristine.

Be strict and precise: reason ONLY from the real physical numbers, coordinates, wind, reports, and satellite signals provided. Do NOT invent fake places, fake coordinates, or events that aren't mentioned.

You MUST return the output strictly as a JSON object matching the following structure:
{
  "riskScore": number (0 to 100),
  "riskLabel": "Low" | "Moderate" | "High" | "Severe",
  "sourceType": string (e.g. "possible open burning event", "industrial
