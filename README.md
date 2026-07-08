# 🌐 AeroSense HUD

**A neighbourhood-level pollution intelligence platform that finds the hyperlocal hotspots city-wide air quality apps miss.**

> Built to address a real gap: city-level AQI apps report one number for an entire city, so a garbage-dump fire, an industrial cluster, or a smog trap at a busy junction goes unnoticed while directly harming the residents nearest to it. AeroSense HUD combines live sensor data, citizen-reported photos, and satellite imagery to surface those hidden pockets, predict where air quality is about to spike, and hand municipal responders an actionable, source-specific dispatch recommendation — not just a map full of dots.

---

## The Problem

City-level air quality apps miss hyper-local events because local authorities can't have eyes on every street. A garbage dump fire two blocks away, an industrial cluster, or a smog trap at a busy junction can go undetected for days while nearby residents breathe it in — simply because no single city-wide sensor is close enough to notice.

## The Approach

AeroSense HUD fuses three real, independent signals into one live neighbourhood view:

| Signal | Source |
|---|---|
| 🛰️ **Satellite thermal imagery** | NASA GIBS (true-color + VIIRS active-fire tiles) & NASA FIRMS (active fire pixel data) |
| 📡 **Local sensor readings** | OpenWeather Air Pollution & Weather APIs, sampled across a real geographic grid around the user |
| 📸 **Citizen-reported photos** | User-submitted smoke/dust images, classified by Gemini vision for type and severity |

These three signals are reasoned over together by Gemini to compute a live hotspot risk score, infer the likely pollution source, forecast the next 24 hours of air quality, and generate a source-specific response recommendation (e.g., water-mist cannons for a dust event vs. a cleanup crew for an open-burning event) — so a responder knows not just *where* to go, but *what to bring*.

---

## Key Features

- **Live geolocation-first design** — no hardcoded or default location anywhere; every view is centered on the user's real, current GPS position.
- **Neighbourhood-grid AQI mapping** — a sampled grid of points around the user, interpolated into a smooth, street-level pollution heatmap instead of a single city-wide number.
- **Click-anywhere inspector** — tap any point on the map for real-time AQI, pollutant breakdown, weather, and rainfall for that exact location, with the OpenWeather 1–5 AQI scale always labeled clearly.
- **Citizen reporting** — upload a photo of smoke, dust, or burning; Gemini classifies the event type and severity and factors it directly into nearby hotspot risk scoring.
- **Satellite thermal-anomaly detection** — real NASA GIBS/FIRMS data layered on the map, feeding genuine fire/thermal signals into the risk engine (with an explicit, clearly-labeled Demo Mode for testing when no real anomaly is nearby — never silently faked in the live path).
- **24-hour AQI spike prediction** — grounded in real historical AQI, current pollutant trends, and wind data, with a visible spike-warning banner when a forecast crosses an unhealthy threshold.
- **Municipal Command Console** — a responder-facing view with auto-ranked active hotspots, AI-generated dispatch briefs, and global alerts (banner, sound, and browser push notification) that fire even when that view isn't open.
- **AI chatbot assistant** — a Gemini-powered assistant grounded strictly in the app's real live data (current AQI, nearby hotspots, forecast) rather than generic advice.
- **Futuristic, fully responsive UI** — dark glassmorphism dashboard with animated data visualizations, built to reflow cleanly from desktop to mobile.

---

## Tech Stack

- **Frontend:** React + Vite, MapLibre/Leaflet for mapping
- **AI / Intelligence:** Google Gemini (vision classification, risk reasoning, prediction, dispatch generation, chatbot)
- **Environmental Data:** OpenWeather (Air Pollution, Weather, Geocoding APIs), NASA GIBS (satellite tiles), NASA FIRMS (active fire data)
- **Realtime Backend:** Firebase / Firestore (citizen reports, live multi-user hotspot sync)

---

## Getting Started

```bash
git clone https://github.com/<your-username>/aerosense-hud.git
cd aerosense-hud
npm install
```

Create a `.env.local` file (never commit this) with your own keys:

```
VITE_OPENWEATHER_API_KEY=your_openweather_key
VITE_GEMINI_API_KEY=your_gemini_key
VITE_FIREBASE_API_KEY=your_firebase_key
VITE_FIREBASE_PROJECT_ID=your_firebase_project_id
```

```bash
npm run dev
```

Grant location permission when prompted — the app has no fallback location and requires real GPS access to function.

---

## Honest Project Status

This started as a hackathon/prototype build and is transparent about where it stands:

**✅ Fully real, live data**
Live geolocation, OpenWeather AQI/weather/geocoding, NASA GIBS/FIRMS satellite data, Gemini-powered vision/reasoning/prediction, and real-time Firestore sync across users.

**⚠️ Real but constrained**
- Gemini API is currently on the free tier (~20 requests/day) — expect rate-limit banners under heavy testing; upgrading to a billed Gemini key removes this ceiling.
- API keys are bundled client-side, which is standard for this build environment but means they're visible in DevTools — fine for a demo, not for a public production launch without a backend proxy.
- NASA FIRMS data is fetched as a full global CSV and filtered client/server-side by proximity rather than queried via a true bounded geospatial API.

**🚧 Would need further work for real municipal deployment**
- No authentication/access control on the Municipal Console — anyone with the link can currently view it.
- No real integration with actual dispatch systems (SMS/email/CAD software) — alerts are in-app only.
- No hardened backend rate-limiting beyond client-side throttling.
- Firestore security rules should be audited/hardened before any public deployment.

---

## Why This Matters

Hyperlocal pollution events are, by definition, invisible to city-wide monitoring — the residents nearest to a garbage fire or an industrial leak are often the last to get an official response, simply because no one was watching that exact street. AeroSense HUD is an attempt to close that gap using signals that already exist — citizen phones, public satellite feeds, and public weather sensor networks — reasoned over by AI instead of waiting for a fixed sensor grid that will never be dense enough to cover every block.

---

