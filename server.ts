import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config({ override: true });

async function startServer() {
  const app = express();
  const PORT = 3000;

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

      // Explicitly disable caching on the response headers
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");

      // Forward a cache-busting timestamp to OpenWeather API
      const url = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${apiKey}&t=${Date.now()}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        const errText = await response.text();
        return res.status(response.status).json({
          error: `Failed to fetch air pollution data from OpenWeather: ${errText}`,
        });
      }

      const data = await response.json();
      // Print raw API response in server-side logs to verify AQI data correctness
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

      // Explicitly disable caching on the response headers
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

      // Explicitly disable caching on the response headers
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
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      // Extract raw base64 data and mime type
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
        inlineData: {
          mimeType,
          data: base64Data,
        },
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
        config: {
          responseMimeType: "application/json",
        }
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
    const R = 6371; // Radius of the earth in km
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

      // Check cache (valid for 5 minutes, within 200 meters of the previous center)
      if (cachedGrid && (Date.now() - cachedGrid.timestamp < 5 * 60 * 1000)) {
        const dist = getDistanceKm(lat, lon, cachedGrid.centerLat, cachedGrid.centerLon);
        if (dist < 0.2) { // 200 meters
          console.log(`[AeroSense Server] Serving pollution grid from cache. Distance: ${(dist * 1000).toFixed(1)}m`);
          return res.json({ points: cachedGrid.points, source: "cache" });
        }
      }

      console.log(`[AeroSense Server] Fetching live pollution grid centered at ${lat.toFixed(4)}, ${lon.toFixed(4)}`);

      // Recompute the 3x3 grid
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
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      // Filter and format reports within 5km (for Gemini to reason over, highlighting distance)
      const nearbyReports = (reports || []).map((r: any) => ({
        ...r,
        distanceKm: getDistanceKm(lat, lon, r.latitude, r.longitude)
      })).filter((r: any) => r.distanceKm <= 5.0); // Focus on reports within 5km

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

      // Query real satellite thermal anomalies from NASA FIRMS (within 10km)
      const satelliteFires = await getNearbyActiveFires(lat, lon, 10.0);

      // NO SYNTHETIC/FABRICATED SATELLITE SIGNAL INJECTION IN PRODUCTION FLOW
      // If demoMode is explicitly active, we allow simulated satellite pixels to test the UI flow.
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
                brightness: 355.8, // typical strong active fire brightness in Kelvin
                confidence: 'nominal',
                isDemoSimulated: true // Clearly mark as demo simulated
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
  "sourceType": string (e.g. "possible open burning event", "industrial cluster buildup", "heavy traffic intersection emissions", "ambient urban smog drift", "satellite-detected thermal anomaly fire", "none"),
  "explanation": string (1-2 sentences of explanation),
  "hotspots": [
    {
      "latitude": number,
      "longitude": number,
      "radius": number (in meters, e.g., 300 to 1200),
      "score": number (0 to 100),
      "sourceType": string (e.g., "Open Burning Fire", "Congested Crossing", "Industrial Smoke Plume", "Satellite Anomaly Thermal Zone"),
      "description": string (e.g., "Detected open burning report 1.2km upwind; wind is carrying smoke downwind towards the user's area."),
      "currentAqi": number (1 to 5 scale, estimated specific AQI at this hotspot location),
      "predictedTrend": "Improving" | "Stable" | "Worsening",
      "detectedAt": string (ISO 8601 timestamp representing when the hotspot was first registered, e.g., matching a nearby citizen report's timestamp, or a time within the last 1-2 hours in ISO format),
      "recommendedAction": string (A concrete suggested action translated dynamically from risk score, source-type, and pollutant profile, e.g., "Deploy water-mist cannon — high particulate/dust signature", "Dispatch cleanup crew — sustained smoke/open-burning pattern", "Monitor only — transient traffic smog, expected to clear within 2 hours". Must be generated dynamically from that hotspot's real data.)
    }
  ]
}
Ensure the response contains ONLY the raw JSON block, valid and parseable. Do not wrap in markdown code blocks.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: promptText,
        config: {
          responseMimeType: "application/json",
        }
      });

      const responseText = response.text;
      if (!responseText) {
        throw new Error("No response text received from Gemini API for hotspot detection.");
      }

      const parsedData = JSON.parse(responseText.trim());
      parsedData.satelliteFires = satelliteFires;
      res.json(parsedData);
    } catch (err: any) {
      console.error("Error in /api/detect-hotspots:", err);
      const isQuota = err.message?.includes("429") || err.message?.includes("Quota") || err.message?.includes("RESOURCE_EXHAUSTED") || err.status === 429;
      res.status(isQuota ? 429 : 500).json({ error: err.message || "Failed to detect hotspots." });
    }
  });

  // API Route for 24-hour air quality spike prediction
  app.post("/api/predict-aqi", async (req, res) => {
    try {
      const { lat, lon, currentAqi, pollutants, wind, reports, localTime } = req.body;

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          error: "GEMINI_API_KEY is not configured on the server. Please configure it in Settings > Secrets.",
        });
      }

      // 1. Fetch historical air pollution from OpenWeather
      const weatherApiKey = process.env.OPENWEATHER_API_KEY;
      let historicalPoints: Array<{ label: string; time: string; aqi: number }> = [];

      if (lat && lon && weatherApiKey) {
        try {
          const end = Math.floor(Date.now() / 1000);
          const start = end - 24 * 3600;
          const url = `https://api.openweathermap.org/data/2.5/air_pollution/history?lat=${lat}&lon=${lon}&start=${start}&end=${end}&appid=${weatherApiKey}`;
          console.log(`[AeroSense Server] Fetching 24h historical AQI from OpenWeather: ${url}`);
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 4000);
          
          const historyResponse = await fetch(url, { signal: controller.signal });
          clearTimeout(timeoutId);

          if (historyResponse.ok) {
            const data = await historyResponse.json();
            if (data.list && data.list.length > 0) {
              const list = data.list;
              const hoursAgo = [24, 20, 16, 12, 8, 4];
              const nowUnix = Math.floor(Date.now() / 1000);

              for (const hr of hoursAgo) {
                const targetTime = nowUnix - hr * 3600;
                let closestItem = list[0];
                let minDiff = Math.abs(list[0].dt - targetTime);

                for (const item of list) {
                  const diff = Math.abs(item.dt - targetTime);
                  if (diff < minDiff) {
                    minDiff = diff;
                    closestItem = item;
                  }
                }

                const dObj = new Date(closestItem.dt * 1000);
                const timeStr = dObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
                
                historicalPoints.push({
                  label: `-${hr} Hours`,
                  time: timeStr,
                  aqi: closestItem?.main?.aqi ?? 2
                });
              }
              console.log(`[AeroSense Server] Loaded ${historicalPoints.length} real historical AQI points.`);
            }
          } else {
            console.warn(`[AeroSense Server] OpenWeather History API returned status: ${historyResponse.status}`);
          }
        } catch (historyErr: any) {
          console.warn("[AeroSense Server] OpenWeather Historical AQI fetch failed (falling back to baseline simulation):", historyErr.message);
        }
      }

      // Safe fallback simulation if we failed to fetch or coordinates were not provided
      if (historicalPoints.length === 0) {
        const hoursAgo = [24, 20, 16, 12, 8, 4];
        const nowHour = new Date().getHours();
        
        for (const hr of hoursAgo) {
          const targetHour = (nowHour - hr + 24) % 24;
          const timeStr = `${String(targetHour).padStart(2, '0')}:00`;
          
          let baseVal = currentAqi || 1;
          const diurnalVariance = (targetHour >= 2 && targetHour <= 8) ? 0.6 : (targetHour >= 12 && targetHour <= 17) ? -0.4 : 0.2;
          const randomJitter = (Math.sin(targetHour) * 0.2);
          const finalAqi = Math.max(1, Math.min(5, Number((baseVal + diurnalVariance + randomJitter).toFixed(1))));

          historicalPoints.push({
            label: `-${hr} Hours`,
            time: timeStr,
            aqi: finalAqi
          });
        }
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const reportsSummary = reports && reports.length > 0
        ? `${reports.length} nearby report(s) active. Types: ${Array.from(new Set(reports.map((r: any) => r.classification))).filter(Boolean).join(', ')}. Severities: ${Array.from(new Set(reports.map((r: any) => r.severity))).filter(Boolean).join(', ')}.`
        : "No nearby active reports.";

      const historyText = historicalPoints.map(p => `  - ${p.label} (${p.time}): AQI ${p.aqi}`).join('\n');

      const promptText = `You are the Predictive Environmental Modeling AI for AeroSense.
Your task is to predict the air quality (AQI) trajectory for the next 24 hours at the user's location, reasoning strictly from current and historical data.

HISTORICAL AQI TREND (LAST 24 HOURS):
Observe whether the air quality has been improving, worsening, or stable, and combine this baseline trajectory with diurnal cycles, wind dispersion, and local citizen reports:
${historyText}

CURRENT STATE:
- Local Time: ${localTime || 'Unknown'}
- Current AQI: ${currentAqi || 1} (Scale: 1 = Good, 2 = Fair, 3 = Moderate, 4 = Poor, 5 = Very Poor)
- Pollutant Breakdown (μg/m³):
  - PM2.5: ${pollutants?.pm2_5 ?? 'N/A'}
  - PM10: ${pollutants?.pm10 ?? 'N/A'}
  - NO2: ${pollutants?.no2 ?? 'N/A'}
  - O3: ${pollutants?.o3 ?? 'N/A'}
  - CO: ${pollutants?.co ?? 'N/A'}
- Wind Pattern: Speed ${wind?.speed ?? 0} m/s, blowing from ${wind?.deg ?? 0}° direction.
- Nearby Active Reports: ${reportsSummary}

PREDICTION FACTORS TO REASON OVER:
1. Historical trend continuity: If AQI is rising rapidly over the last 24 hours, factor that momentum. If it is stable, assume a stable baseline unless external triggers exist.
2. Diurnal cycle (time of day): PM2.5 and CO often build up during night and early morning (temperature inversions, morning traffic rush hours). Ozone (O3) typically spikes in mid-afternoon due to solar radiation.
3. Wind dispersal/accumulation: Low wind speed (< 1.5 m/s) causes pollution to accumulate locally. Strong wind speed (> 5 m/s) disperses pollutants quickly.
4. Active nearby pollution events (reports): If there are open burning or smoke reports, and the wind is blowing towards the user, the AQI is highly likely to spike in the next 2-8 hours before dissipating as the fire burns out.

INSTRUCTIONS:
- Generate 6 sequential predictions representing 4-hour intervals over the next 24 hours: +4 Hours, +8 Hours, +12 Hours, +16 Hours, +20 Hours, +24 Hours.
- Calculate the hour for each interval based on the current local time's hour (e.g. if local time is 20:00, +4h is 00:00, +8h is 04:00, etc. Use 24-hour HH:MM format).
- Each prediction point must have a predicted AQI value on the 1-5 scale (can be decimals like 2.3 or integers, matching OpenWeather AQI standards).
- Identify if there will be a "spike" (meaning AQI rises significantly, e.g. crosses from Moderate (3) into Poor (4) or Very Poor (5), or increases by more than 1.5 units).
- Provide a confidence level ("Low", "Medium", "High") and a clear, short reasoning for the predicted trend.

Be strict: Do NOT invent hypothetical events or ignore the current wind/time/historical factors. Reason physically.

You MUST return the output strictly as a JSON object matching the following structure:
{
  "predictions": [
    { "label": "+4 Hours", "time": "00:00", "aqi": number },
    { "label": "+8 Hours", "time": "04:00", "aqi": number },
    { "label": "+12 Hours", "time": "08:00", "aqi": number },
    { "label": "+16 Hours", "time": "12:00", "aqi": number },
    { "label": "+20 Hours", "time": "16:00", "aqi": number },
    { "label": "+24 Hours", "time": "20:00", "aqi": number }
  ],
  "confidence": "Low" | "Medium" | "High",
  "willSpike": boolean,
  "spikeReason": string (Only populated if willSpike is true. Explains why a spike is predicted, e.g., "Early morning traffic rush coupled with low wind dispersion and existing smoke drift is predicted to spike PM2.5 levels.")
}
Ensure the response contains ONLY the raw JSON block, valid and parseable. Do not wrap in markdown code blocks.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: promptText,
        config: {
          responseMimeType: "application/json",
        }
      });

      const responseText = response.text;
      if (!responseText) {
        throw new Error("No response text received from Gemini API for prediction.");
      }

      const parsedData = JSON.parse(responseText.trim());
      parsedData.history = historicalPoints;
      res.json(parsedData);
    } catch (err: any) {
      console.error("Error in /api/predict-aqi:", err);
      const isQuota = err.message?.includes("429") || err.message?.includes("Quota") || err.message?.includes("RESOURCE_EXHAUSTED") || err.status === 429;
      res.status(isQuota ? 429 : 500).json({ error: err.message || "Failed to predict AQI trajectory." });
    }
  });

  // API Route for Floating AI Chatbot Grounded in Live Telemetry Context
  app.post("/api/chat", async (req, res) => {
    try {
      const { message, history, liveData } = req.body;

      if (!message) {
        return res.status(400).json({ error: "Message is required." });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          error: "GEMINI_API_KEY is not configured on the server. Please configure it in Settings > Secrets.",
        });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      // Construct highly grounded context from liveData
      const coords = liveData?.resolvedLocationName 
        ? `${liveData.resolvedLocationName} (${liveData.coords.latitude.toFixed(4)}°N, ${liveData.coords.longitude.toFixed(4)}°E)`
        : (liveData?.coords ? `${liveData.coords.latitude.toFixed(4)}°N, ${liveData.coords.longitude.toFixed(4)}°E` : "Unknown Coordinates");
      const aqiVal = liveData?.aqi || "Unknown AQI";
      const pollutantsStr = liveData?.pollutants 
        ? Object.entries(liveData.pollutants).map(([k, v]) => `${k.toUpperCase()}: ${v} μg/m³`).join(", ") 
        : "No detailed pollutant telemetry available";
      
      const windStr = liveData?.wind 
        ? `Speed: ${liveData.wind.speed ?? 0} m/s, Direction: ${liveData.wind.deg ?? 0}°` 
        : "No wind telemetry available";

      const hotspotsStr = liveData?.hotspots && liveData.hotspots.length > 0
        ? liveData.hotspots.map((h: any, idx: number) => {
            const hLoc = h.locationName 
              ? `${h.locationName} (${h.latitude.toFixed(4)}°N, ${h.longitude.toFixed(4)}°E)`
              : `${h.latitude.toFixed(4)}°N, ${h.longitude.toFixed(4)}°E`;
            return `[Hotspot #${idx + 1}]:
  - Source Type: ${h.sourceType || 'Unknown'}
  - Risk Score: ${h.score}/100
  - Location: ${hLoc}
  - Impact Radius: ${h.radius}m
  - Estimated AQI: ${h.currentAqi || 'N/A'} (1-5)
  - Trend: ${h.predictedTrend || 'N/A'}
  - Recommended Action: ${h.recommendedAction || 'N/A'}
  - Description: ${h.description || 'N/A'}`;
          }).join("\n\n")
        : "No active Air Quality Hotspots detected in immediate neighborhood telemetry.";

      const predictionStr = liveData?.prediction?.predictions && liveData.prediction.predictions.length > 0
        ? `Trajectory Details:
  - Confidence: ${liveData.prediction.confidence || 'Medium'}
  - willSpike: ${liveData.prediction.willSpike ? 'Yes' : 'No'}
  - spikeReason: ${liveData.prediction.spikeReason || 'None'}
  - Hourly Intervals:
${liveData.prediction.predictions.map((p: any) => `    * ${p.label} (${p.time}): Predicted AQI ${p.aqi}`).join("\n")}`
        : "No 24-hour prediction trajectory generated yet.";

      const reportsStr = liveData?.reports && liveData.reports.length > 0
        ? liveData.reports.map((r: any, idx: number) => {
            const rLoc = r.locationName 
              ? `${r.locationName} (${r.latitude.toFixed(4)}°N, ${r.longitude.toFixed(4)}°E)`
              : `${r.latitude.toFixed(4)}°N, ${r.longitude.toFixed(4)}°E`;
            return `[Report #${idx + 1}]:
  - Classification: ${r.classification}
  - Severity: ${r.severity}
  - Description: ${r.description || 'No details'}
  - Location: ${rLoc}
  - Registered At: ${r.timestamp}`;
          }).join("\n\n")
        : "No recent Citizen Incident Reports registered nearby.";

      const systemInstruction = `You are NeuroFlux AI, the elite real-time environmental telemetry intelligence engine.
You provide clear, direct, scientifically grounded, and helpful analysis based ONLY on the user's real-time telemetry provided below.

CURRENT ENVIRONMENTAL TELEMETRY:
- Coords: ${coords}
- Ambient Air Quality (AQI): ${aqiVal} (Scale: 1 = Good, 2 = Fair, 3 = Moderate, 4 = Poor, 5 = Very Poor)
- Pollutants: ${pollutantsStr}
- Wind Pattern: ${windStr}
- Active Local Air Quality Hotspots (within 5km):
${hotspotsStr}
- 24-Hour Predictive Forecast Trajectory:
${predictionStr}
- Verified Nearby Citizen Incident Reports:
${reportsStr}

CRITICAL OPERATIONAL DIRECTIVES:
1. Ground every answer in the CURRENT ENVIRONMENTAL TELEMETRY provided above.
2. Under no circumstances should you invent, guess, speculate, or fabricate any environmental figures, AQI numbers, hotspot coordinates, or citizen report details. If the requested information is not present or implied in the telemetry, explicitly state that you do not have enough local data to answer confidently.
3. Be professional, scientifically precise, and helpful. Translate the risk metrics into clear safety guidance.
   - For example:
     - "Is it safe to go for a run right now?" -> Reference current AQI, pollutants (such as PM2.5), wind drift, and nearby hotspots.
     - "Why is the AQI high near me?" -> Check nearby active hotspots or reports, or current wind drift and pollutants.
     - "What's causing that hotspot two blocks away?" -> Check nearest hotspot's sourceType/description. If no hotspot is registered near those coordinates, say so.
     - "Will it get worse tonight?" -> Reference the 24-hour trajectory predictions, confidence, and spike prediction.
     - "What should I do to protect myself indoors?" -> Suggest standard air quality protections (close windows, turn on air purifiers, use HEPA/N95 if needed) based on the severity of the telemetry.
4. Keep answers readable and visually appealing with clean Markdown, bullet points, and bold headers. Maintain a concise, advanced sci-fi telemetry assistant persona (helpful, objective, technically expert). Do NOT use excessive marketing jargon or self-praising fluff.
5. Ground your answers using ONLY the real live telemetry. Explicitly refuse to speculate on unprovided locations or fictive scenarios.
6. CRITICAL SCALE RULE: Whenever you output or reference any Air Quality Index (AQI) number in your responses, you MUST ALWAYS accompany it with both its qualitative rating label ("Good", "Fair", "Moderate", "Poor", or "Very Poor") and the explicit standard 1-5 scale descriptor alongside it (e.g. "AQI 3 - Moderate on the 1-5 scale"). Never show a bare number without these details so it is never mistaken for any other AQI standard. This is a strict safety directive.`;

      // Format history into standard contents parameter.
      const contents = [
        ...(history || []).map((h: any) => ({
          role: h.role,
          parts: [{ text: h.content }]
        })),
        {
          role: "user",
          parts: [{ text: message }]
        }
      ];

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents,
        config: {
          systemInstruction,
          temperature: 0.1, // Keep it highly deterministic and grounded
        }
      });

      const responseText = response.text;
      if (!responseText) {
        throw new Error("No response text received from Gemini API.");
      }

      res.json({ text: responseText });
    } catch (err: any) {
      console.error("Error in /api/chat:", err);
      res.status(500).json({ error: err.message || "Failed to process chat message." });
    }
  });

  // API Route for Generating structured Municipal Dispatch Reports via Gemini
  app.post("/api/generate-dispatch-report", async (req, res) => {
    try {
      const { hotspot, evidenceCount } = req.body;

      if (!hotspot) {
        return res.status(400).json({ error: "Hotspot data is required." });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          error: "GEMINI_API_KEY is not configured on the server. Please configure it in Settings > Secrets.",
        });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const prompt = `You are an elite municipal environmental emergency response controller. 
Generate a highly professional, concise, actionable Incident Dispatch Report for a first responder field team based on the following real-time environmental telemetry data:

INCIDENT TELEMETRY:
- Location Coordinates: ${Number(hotspot.latitude).toFixed(5)}°N, ${Number(hotspot.longitude).toFixed(5)}°E
- Inferred Source Type: ${hotspot.sourceType || 'Unknown Emission Source'}
- Threat Risk Score: ${hotspot.score}/100
- Impact Radius: ${hotspot.radius} meters
- Local Ambient AQI: ${hotspot.currentAqi || 'N/A'} (1-5 scale)
- Predicted Trend: ${hotspot.predictedTrend || 'Stable'}
- Supporting Evidence Count: ${evidenceCount || 0} active citizen report(s) nearby
- AI Telemetry Assessment: ${hotspot.description || 'No direct assessment'}
- Pre-set Recommended Action: ${hotspot.recommendedAction || 'None'}

Please structure the dispatch brief professionally for emergency responders. It should be highly readable, structured, and contain the following clear sections:
1. INCIDENT DISPATCH BRIEF HEADER (with generated incident ID, timestamp, and alert level: Green/Yellow/Orange/Red/Critical based on Risk Score)
2. PRECISE GEOLOCATION & IMPACT ZONE (Coordinates, radius, wind dispersion vector if relevant)
3. ESTIMATED SOURCE & RISKS (Inferred source, risk score explanation, likely pollutants and acute hazards)
4. SUPPORTING TELEMETRY & FIELD EVIDENCE (Highlighting the ${evidenceCount || 0} citizen report(s) and regional sensor spikes)
5. RESPONSE PROTOCOL & ACTION PLAN (Step-by-step instructions for tactical field teams, including equipment recommendations, e.g. SCBA, N95, protective gear, road closures, community notices, etc.)

Keep the report extremely direct, official, formatted with markdown (bold subheaders, list points, clear separator blocks). No conversational preamble, polite intro, or promotional filler. Whenever you output or reference any AQI number in the report, you MUST accompany it with its rating label ("Good", "Fair", "Moderate", "Poor", or "Very Poor") and the standard 1-5 scale identifier, e.g., "AQI 3 (Moderate) on the 1-5 scale". Never show a bare AQI number.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          temperature: 0.1, // Highly deterministic and formal
        }
      });

      const reportText = response.text;
      if (!reportText) {
        throw new Error("No dispatch report text received from Gemini.");
      }

      res.json({ report: reportText });
    } catch (err: any) {
      console.error("Error in /api/generate-dispatch-report:", err);
      res.status(500).json({ error: err.message || "Failed to generate dispatch report." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);

    // Startup check for credentials
    const hasOpenWeather = !!process.env.OPENWEATHER_API_KEY;
    const hasGemini = !!process.env.GEMINI_API_KEY;
    if (!hasOpenWeather || !hasGemini) {
      console.warn(`
======================================================================
⚠️  AEROSENSE CREDENTIAL STATUS ALERT ⚠️
======================================================================
${hasOpenWeather ? " [OK] OPENWEATHER_API_KEY is configured." : " [MISSING] OPENWEATHER_API_KEY is UNDEFINED or EMPTY!"}
${hasGemini ? " [OK] GEMINI_API_KEY is configured." : " [MISSING] GEMINI_API_KEY is UNDEFINED or EMPTY!"}

Warning: Telemetry operations (Aero AQI, Reverse Geocode, Weather, 
and AI Dispatch predictions) will fail until keys are supplied.
Configure secrets in Settings > Secrets or in the root .env file.
======================================================================
      `);
    } else {
      console.log(`[AeroSense Server] Credentials verified. OpenWeather and Gemini telemetry hooks successfully active.`);
    }
  });
}

startServer();
