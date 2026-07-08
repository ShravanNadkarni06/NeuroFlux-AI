import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { Coordinates, PollutionReport, MapLayerMode, Hotspot, GridPoint } from '../types';
import { getCachedLocationName } from './LocationDisplay';
import MapInspectorPopup from './MapInspectorPopup';

interface MapContainerProps {
  userCoords: Coordinates;
  inspectedCoords?: Coordinates | null;
  currentAqi: 1 | 2 | 3 | 4 | 5;
  reports: PollutionReport[];
  hotspots?: Hotspot[];
  layerMode: MapLayerMode;
  gridPoints?: GridPoint[] | null;
  satelliteFires?: Array<{
    latitude: number;
    longitude: number;
    distanceKm: number;
    brightness: number;
    confidence: string;
  }>;
  onMapClick?: (coords: Coordinates) => void;
  onCloseInspector?: () => void;
}

// Haversine formula for real-time precise distance calculation
function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Radius of the Earth in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Linear interpolation between two hex colors based on a factor (0 to 1)
function interpolateColor(color1: string, color2: string, factor: number): string {
  const f = Math.max(0, Math.min(1, factor));
  const parseHex = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return [r, g, b];
  };
  const [r1, g1, b1] = parseHex(color1);
  const [r2, g2, b2] = parseHex(color2);
  const r = Math.round(r1 + f * (r2 - r1));
  const g = Math.round(g1 + f * (g2 - g1));
  const b = Math.round(b1 + f * (b2 - b1));
  const toHex = (val: number) => val.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export default function MapContainer({
  userCoords,
  inspectedCoords = null,
  currentAqi,
  reports,
  hotspots = [],
  layerMode,
  gridPoints = null,
  satelliteFires = [],
  onMapClick,
  onCloseInspector,
}: MapContainerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const reportLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const hotspotLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const gridLayerGroupRef = useRef<L.LayerGroup | null>(null);

  const hdSatelliteLayerRef = useRef<L.TileLayer | null>(null);
  const thermalLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const inspectionMarkerRef = useRef<L.Marker | null>(null);

  const getYesterdayDateString = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const yesterdayStr = getYesterdayDateString();

  const [isSatellite, setIsSatellite] = React.useState(false);
  const [currentZoom, setCurrentZoom] = React.useState(15);
  const [hasEsriError, setHasEsriError] = React.useState(false);
  const [isThermalAnomalies, setIsThermalAnomalies] = React.useState(true);
  const [pixelPosition, setPixelPosition] = React.useState<{ x: number; y: number } | null>(null);

  // Position calculation effect to lock the floating window to geographic map coordinates
  useEffect(() => {
    if (!inspectedCoords || !leafletMapRef.current) {
      setPixelPosition(null);
      return;
    }

    const map = leafletMapRef.current;
    const updatePosition = () => {
      const pt = map.latLngToContainerPoint([inspectedCoords.latitude, inspectedCoords.longitude]);
      setPixelPosition({ x: pt.x, y: pt.y });
    };

    updatePosition();

    map.on('move zoom viewreset resize', updatePosition);
    return () => {
      map.off('move zoom viewreset resize', updatePosition);
    };
  }, [inspectedCoords]);

  const onMapClickRef = useRef(onMapClick);
  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);

  // Helper to get color code matching current AQI
  const getAqiColor = (aqi: number): string => {
    switch (aqi) {
      case 1: return '#00FF95'; // Neon Good
      case 2: return '#f59e0b'; // Amber
      case 3: return '#f97316'; // Orange
      case 4: return '#f43f5e'; // Rose
      case 5: return '#a855f7'; // Purple
      default: return '#0ea5e9'; // Cyan default
    }
  };

  // First initialization
  useEffect(() => {
    if (!mapContainerRef.current || leafletMapRef.current) return;

    // Create Map centered at user location
    const map = L.map(mapContainerRef.current, {
      center: [userCoords.latitude, userCoords.longitude],
      zoom: 15,
      zoomControl: true,
      fadeAnimation: true,
      markerZoomAnimation: true,
    });

    leafletMapRef.current = map;
    setCurrentZoom(map.getZoom());

    // Track map zoom levels dynamically
    map.on('zoomend', () => {
      setCurrentZoom(map.getZoom());
    });
    map.on('moveend', () => {
      setCurrentZoom(map.getZoom());
    });

    // Use CartoDB Dark Matter tile layer (beautiful dark basemap)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 20,
    }).addTo(map);

    // Initialize Esri World Imagery with CORRECT {z}/{y}/{x} template structure
    const hdSatelliteLayer = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
        maxZoom: 19,
      }
    );

    hdSatelliteLayer.on('tileerror', (errEvent) => {
      console.warn('[AeroSense Diagnostics] Esri World Imagery Tile load error:', errEvent);
      setHasEsriError(true);
    });

    hdSatelliteLayer.on('tileload', () => {
      setHasEsriError(false);
    });

    hdSatelliteLayerRef.current = hdSatelliteLayer;

    // Create layer group for NASA Thermal Anomalies
    const thermalLayerGroup = L.layerGroup().addTo(map);
    thermalLayerGroupRef.current = thermalLayerGroup;

    // Create layer group for citizen reports
    const reportLayerGroup = L.layerGroup().addTo(map);
    reportLayerGroupRef.current = reportLayerGroup;

    // Create layer group for AI hotspots
    const hotspotLayerGroup = L.layerGroup().addTo(map);
    hotspotLayerGroupRef.current = hotspotLayerGroup;

    // Create layer group for interpolated grid heatmap
    const gridLayerGroup = L.layerGroup().addTo(map);
    gridLayerGroupRef.current = gridLayerGroup;

    // Create user neon marker
    const color = getAqiColor(currentAqi);
    const pulseIcon = L.divIcon({
      className: 'custom-neon-marker',
      html: `
        <div class="relative flex h-10 w-10 items-center justify-center">
          <div class="absolute h-10 w-10 animate-ping rounded-full opacity-35" style="background-color: ${color}"></div>
          <div class="absolute h-6 w-6 rounded-full opacity-20 blur-sm" style="background-color: ${color}"></div>
          <div class="relative h-4 w-4 rounded-full border-2 border-white shadow-[0_0_10px_${color}]" style="background-color: ${color}"></div>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });

    const marker = L.marker([userCoords.latitude, userCoords.longitude], {
      icon: pulseIcon,
    });

    markerRef.current = marker;

    // Add a subtle accuracy circle that matches the neon look
    const circle = L.circle([userCoords.latitude, userCoords.longitude], {
      radius: 200,
      color: color,
      fillColor: color,
      fillOpacity: 0.08,
      weight: 1.5,
      dashArray: '4, 6',
    });

    circleRef.current = circle;

    // Initial layer state check
    const showUser = layerMode === 'aqi' || layerMode === 'both';
    if (showUser) {
      marker.addTo(map);
      circle.addTo(map);
    }

    // Bind custom neon-styled popup
    marker.bindPopup(`
      <div class="bg-black/90 text-white border border-white/10 p-2.5 rounded-lg font-sans text-xs min-w-[140px]">
        <div class="font-bold text-[9px] uppercase tracking-wider text-[#00FF95]">Your Location</div>
        <div class="text-[10px] text-white/60 mt-1 uppercase font-semibold">Coordinates:</div>
        <div class="font-mono text-[9px] text-white/40 mt-0.5">
          ${userCoords.latitude.toFixed(5)}°N, ${userCoords.longitude.toFixed(5)}°E
        </div>
        <div class="flex items-center gap-1.5 mt-2 pt-1.5 border-t border-white/10">
          <span class="inline-block h-2 w-2 rounded-full animate-pulse" style="background-color: ${color}"></span>
          <span class="text-[10px] text-white/80 font-medium">Local AQI: ${currentAqi}</span>
        </div>
      </div>
    `, {
      className: 'custom-leaflet-popup',
      closeButton: false,
    });

    // Register interactive click-to-inspect handler on the Leaflet map object
    map.on('click', (e) => {
      if (onMapClickRef.current) {
        onMapClickRef.current({
          latitude: e.latlng.lat,
          longitude: e.latlng.lng,
        });
      }
    });

    // Cleanup map on unmount
    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, []);

  // Update layers when layerMode, reports, or coordinates change
  useEffect(() => {
    const map = leafletMapRef.current;
    const marker = markerRef.current;
    const circle = circleRef.current;
    const reportLayerGroup = reportLayerGroupRef.current;
    if (!map) return;

    const latLng: L.LatLngExpression = [userCoords.latitude, userCoords.longitude];
    const color = getAqiColor(currentAqi);

    // 1. Manage User Location Layer (AQI / Sensor Layer)
    const showUser = layerMode === 'aqi' || layerMode === 'both';
    if (showUser) {
      if (marker) {
        if (!map.hasLayer(marker)) marker.addTo(map);
        marker.setLatLng(latLng);

        const updatedIcon = L.divIcon({
          className: 'custom-neon-marker',
          html: `
            <div class="relative flex h-10 w-10 items-center justify-center">
              <div class="absolute h-10 w-10 animate-ping rounded-full opacity-35" style="background-color: ${color}"></div>
              <div class="absolute h-6 w-6 rounded-full opacity-20 blur-sm" style="background-color: ${color}"></div>
              <div class="relative h-4 w-4 rounded-full border-2 border-white shadow-[0_0_10px_${color}]" style="background-color: ${color}"></div>
            </div>
          `,
          iconSize: [40, 40],
          iconAnchor: [20, 20],
        });

        const userLocName = getCachedLocationName(userCoords.latitude, userCoords.longitude) || 'RESOLVING NAME...';
        marker.setIcon(updatedIcon);
        marker.setPopupContent(`
          <div class="bg-black/90 text-white border border-white/10 p-2.5 rounded-lg font-sans text-xs min-w-[160px] max-w-[220px]">
            <div class="font-bold text-[9px] uppercase tracking-wider text-[#00FF95]">Your Location</div>
            <div class="text-[10px] text-white font-semibold mt-1 truncate" title="${userLocName}">${userLocName}</div>
            <div class="text-[8px] text-white/40 uppercase font-semibold mt-1">Coordinates:</div>
            <div class="font-mono text-[8px] text-white/30 mt-0.5">
              ${userCoords.latitude.toFixed(5)}°N, ${userCoords.longitude.toFixed(5)}°E
            </div>
            <div class="flex items-center gap-1.5 mt-2 pt-1.5 border-t border-white/10">
              <span class="inline-block h-2 w-2 rounded-full animate-pulse" style="background-color: ${color}"></span>
              <span class="text-[10px] text-white/80 font-medium">Local AQI: ${currentAqi}</span>
            </div>
          </div>
        `);
      }

      if (circle) {
        if (!map.hasLayer(circle)) circle.addTo(map);
        circle.setLatLng(latLng);
        circle.setStyle({
          color: color,
          fillColor: color,
        });
      }
    } else {
      if (marker && map.hasLayer(marker)) map.removeLayer(marker);
      if (circle && map.hasLayer(circle)) map.removeLayer(circle);
    }

    // 2. Manage Citizen Reports Layer
    if (reportLayerGroup) {
      reportLayerGroup.clearLayers();

      const showReports = layerMode === 'reports' || layerMode === 'both';
      if (showReports) {
        reports.forEach((report) => {
          // Custom color-coding based on severity
          let severityColor = '#0ea5e9'; // low = Cyan
          if (report.severity === 'high') severityColor = '#f43f5e'; // high = Rose
          else if (report.severity === 'medium') severityColor = '#f59e0b'; // medium = Amber

          const isHigh = report.severity === 'high';
          const iconHtml = `
            <div class="relative flex h-10 w-10 items-center justify-center">
              <div class="absolute h-10 w-10 ${isHigh ? 'animate-ping' : 'animate-pulse'} rounded-full opacity-40" 
                style="background-color: ${severityColor}; animation-duration: ${isHigh ? '1.2s' : '2.5s'};"></div>
              <div class="absolute h-6 w-6 rounded-full opacity-20 blur-sm" style="background-color: ${severityColor}"></div>
              <div class="relative h-5 w-5 rounded-full border-2 border-white shadow-[0_0_12px_${severityColor}] flex items-center justify-center text-white" 
                style="background-color: ${severityColor}">
                <span class="text-[9px] font-black font-mono">${isHigh ? '!' : 'i'}</span>
              </div>
            </div>
          `;

          const reportIcon = L.divIcon({
            className: 'custom-report-marker',
            html: iconHtml,
            iconSize: [40, 40],
            iconAnchor: [20, 20],
          });

          // Calculate direct distance
          const distMeters = getDistanceInMeters(userCoords.latitude, userCoords.longitude, report.latitude, report.longitude);
          const distText = distMeters < 1000 ? `${Math.round(distMeters)}m` : `${(distMeters / 1000).toFixed(2)}km`;

          // Futuristic high-tech glass-panel popup
          const popupHtml = `
            <div class="bg-black/95 text-[#c9d5ff] border border-white/20 p-3 rounded-xl font-sans text-xs min-w-[220px] max-w-[240px] shadow-2xl overflow-hidden">
              <div class="relative h-28 w-full rounded-lg overflow-hidden border border-white/10 mb-2 bg-black/50">
                <img src="${report.photo}" class="h-full w-full object-cover" />
                <div class="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase tracking-wider" 
                  style="background-color: ${severityColor}33; border: 1px solid ${severityColor}; color: ${severityColor}">
                  ${report.severity.toUpperCase()}
                </div>
              </div>
              <div class="font-bold text-[10px] uppercase tracking-widest text-[#00D4FF] truncate mb-1">
                ${report.classification.toUpperCase()}
              </div>
              <p class="text-[9px] text-white/70 italic mt-0.5 line-clamp-2 leading-relaxed">
                "${report.description || 'No diagnostic context description provided.'}"
              </p>
              <div class="mt-2.5 pt-2 border-t border-white/10 space-y-1 font-mono text-[8px] text-white/50">
                <div class="flex justify-between items-center gap-1">
                  <span>LOCATION:</span>
                  <span class="text-white font-bold truncate max-w-[140px]" title="${report.locationName || 'Resolving...'}">${report.locationName || 'RESOLVING...'}</span>
                </div>
                <div class="flex justify-between items-center">
                  <span>UPLINK DIST:</span>
                  <span class="text-[#00FF95] font-bold">${distText.toUpperCase()} AWAY</span>
                </div>
                <div class="flex justify-between items-center">
                  <span>TIMESTAMP:</span>
                  <span>${new Date(report.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                </div>
                <div class="flex justify-between items-center">
                  <span>COORDINATES:</span>
                  <span class="text-[#00D4FF]/85">${report.latitude.toFixed(4)}°N, ${report.longitude.toFixed(4)}°E</span>
                </div>
              </div>
            </div>
          `;

          const reportMarker = L.marker([report.latitude, report.longitude], {
            icon: reportIcon,
          }).bindPopup(popupHtml, {
            className: 'custom-leaflet-popup',
            closeButton: false,
          });

          reportLayerGroup.addLayer(reportMarker);
        });
      }
    }

    // 2b. Manage Interpolated Hyperlocal Heatmap Grid
    const gridLayerGroup = gridLayerGroupRef.current;
    if (gridLayerGroup) {
      gridLayerGroup.clearLayers();

      const showAqi = layerMode === 'aqi' || layerMode === 'both';
      if (showAqi && gridPoints && gridPoints.length > 0) {
        // Find bounding box coordinates of our 3x3 sampling points
        const latitudes = gridPoints.map(p => p.latitude);
        const longitudes = gridPoints.map(p => p.longitude);
        const minLat = Math.min(...latitudes);
        const maxLat = Math.max(...latitudes);
        const minLon = Math.min(...longitudes);
        const maxLon = Math.max(...longitudes);

        // Grid resolution (15x15 gives 225 cells - extremely smooth yet super performant)
        const resolution = 15;
        const latStep = (maxLat - minLat) / (resolution - 1);
        const lonStep = (maxLon - minLon) / (resolution - 1);

        // Helper to get color code matching current interpolated AQI
        const getInterpolatedColor = (aqi: number): string => {
          if (aqi <= 1) return '#00FF95'; // Good (Neon Green)
          if (aqi >= 5) return '#a855f7'; // Very Poor (Purple)
          if (aqi < 2) return interpolateColor('#00FF95', '#f59e0b', aqi - 1);
          if (aqi < 3) return interpolateColor('#f59e0b', '#f97316', aqi - 2);
          if (aqi < 4) return interpolateColor('#f97316', '#f43f5e', aqi - 3);
          return interpolateColor('#f43f5e', '#a855f7', aqi - 4);
        };

        // Render each cell in our 15x15 fine grid
        for (let r = 0; r < resolution; r++) {
          for (let c = 0; c < resolution; c++) {
            const cellCenterLat = minLat + r * latStep;
            const cellCenterLon = minLon + c * lonStep;

            // Calculate cell boundaries (overlapping slightly to prevent gaps)
            const cellMinLat = minLat + (r - 0.5) * latStep;
            const cellMaxLat = minLat + (r + 0.5) * latStep;
            const cellMinLon = minLon + (c - 0.5) * lonStep;
            const cellMaxLon = minLon + (c + 0.5) * lonStep;

            // Compute Inverse Distance Weighting (IDW) interpolation
            let sumWeights = 0;
            let sumAqi = 0;
            let exactMatch = false;
            let exactAqi = 1;

            for (const pt of gridPoints) {
              const d = getDistanceInMeters(cellCenterLat, cellCenterLon, pt.latitude, pt.longitude);
              if (d < 5) { // very close, direct assignment
                exactMatch = true;
                exactAqi = pt.aqi;
                break;
              }
              const weight = 1 / (d * d); // inverse squared distance
              sumWeights += weight;
              sumAqi += pt.aqi * weight;
            }

            const interpolatedAqi = exactMatch 
              ? exactAqi 
              : (sumWeights > 0 ? sumAqi / sumWeights : 1);

            const heatColor = getInterpolatedColor(interpolatedAqi);
            
            // Dynamic opacity: higher pollution is denser, but keep it readable (0.12 to 0.45)
            const fillOpacity = 0.12 + Math.max(0, Math.min(4, interpolatedAqi - 1)) * 0.0825;

            // Render a smooth Leaflet rectangle
            const cellRect = L.rectangle(
              [[cellMinLat, cellMinLon], [cellMaxLat, cellMaxLon]],
              {
                stroke: false,
                fillColor: heatColor,
                fillOpacity: fillOpacity,
                interactive: false
              }
            );

            gridLayerGroup.addLayer(cellRect);
          }
        }
      }
    }

    // 3. Manage Hotspots Layer (Glowing radial heat zones)
    const hotspotLayerGroup = hotspotLayerGroupRef.current;
    if (hotspotLayerGroup) {
      hotspotLayerGroup.clearLayers();

      const showHotspots = layerMode === 'hotspots' || layerMode === 'both';
      if (showHotspots && hotspots && hotspots.length > 0) {
        hotspots.forEach((hotspot) => {
          let color = '#0ea5e9'; // Low
          if (hotspot.score >= 75) color = '#f43f5e'; // Severe
          else if (hotspot.score >= 50) color = '#f97316'; // High
          else if (hotspot.score >= 25) color = '#eab308'; // Moderate

          // Create a beautiful glowing radial heat zone with overlapping concentric circles
          // 1. Core high-intensity epicenter
          const coreCircle = L.circle([hotspot.latitude, hotspot.longitude], {
            radius: hotspot.radius * 0.3,
            color: color,
            fillColor: color,
            fillOpacity: 0.35,
            weight: 0.5,
          });

          // 2. Main impact radial boundary
          const mainCircle = L.circle([hotspot.latitude, hotspot.longitude], {
            radius: hotspot.radius,
            color: color,
            fillColor: color,
            fillOpacity: 0.15,
            weight: 1.5,
            dashArray: '4, 8',
          });

          // 3. Outer thermal drift halo
          const haloCircle = L.circle([hotspot.latitude, hotspot.longitude], {
            radius: hotspot.radius * 1.5,
            color: color,
            fillColor: color,
            fillOpacity: 0.05,
            weight: 0,
          });

          const distMeters = getDistanceInMeters(userCoords.latitude, userCoords.longitude, hotspot.latitude, hotspot.longitude);
          const distText = distMeters < 1000 ? `${Math.round(distMeters)}m` : `${(distMeters / 1000).toFixed(2)}km`;

          const popupHtml = `
            <div class="bg-black/95 text-[#c9d5ff] border border-white/20 p-3 rounded-xl font-sans text-xs min-w-[200px] max-w-[240px] shadow-[0_0_20px_${color}40] overflow-hidden">
              <div class="flex items-center gap-2 mb-2 pb-2 border-b border-white/10">
                <span class="inline-block h-2.5 w-2.5 rounded-full animate-ping" style="background-color: ${color}"></span>
                <span class="font-bold text-[10px] uppercase tracking-widest text-[#00D4FF]">AI HOTSPOT MODULE</span>
              </div>
              <div class="space-y-1.5 text-[9px] font-mono text-white/70">
                <div class="flex justify-between">
                  <span class="text-white/40">SOURCE CLASSIF:</span>
                  <span class="font-bold text-white">${hotspot.sourceType.toUpperCase()}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-white/40">HOTSPOT RISK:</span>
                  <span class="font-bold font-mono" style="color: ${color}">${hotspot.score}/100</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-white/40">DRIFT RADIUS:</span>
                  <span>${hotspot.radius}M</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-white/40">STATION PROX:</span>
                  <span class="text-[#00FF95] font-bold">${distText.toUpperCase()}</span>
                </div>
              </div>
              <p class="text-[9px] text-white/80 italic mt-2.5 border-t border-white/10 pt-2 leading-relaxed">
                "${hotspot.description}"
              </p>
            </div>
          `;

          mainCircle.bindPopup(popupHtml, {
            className: 'custom-leaflet-popup',
            closeButton: false,
          });

          coreCircle.bindPopup(popupHtml, { className: 'custom-leaflet-popup', closeButton: false });

          hotspotLayerGroup.addLayer(coreCircle);
          hotspotLayerGroup.addLayer(mainCircle);
          hotspotLayerGroup.addLayer(haloCircle);
        });
      }
    }

    // 4. Manage Satellite Basemap layer
    const hdSatLayer = hdSatelliteLayerRef.current;
    if (hdSatLayer) {
      if (isSatellite) {
        if (!map.hasLayer(hdSatLayer)) {
          hdSatLayer.addTo(map);
        }
      } else {
        if (map.hasLayer(hdSatLayer)) {
          map.removeLayer(hdSatLayer);
        }
      }
    }

    // 5. Manage NASA Thermal Anomalies layer
    const thermalGroup = thermalLayerGroupRef.current;
    if (thermalGroup) {
      thermalGroup.clearLayers();
      if (isThermalAnomalies && satelliteFires && satelliteFires.length > 0) {
        satelliteFires.forEach(fire => {
          const fireIcon = L.divIcon({
            className: 'custom-fire-marker',
            html: `
              <div class="relative flex h-8 w-8 items-center justify-center">
                <div class="absolute h-8 w-8 animate-ping rounded-full bg-orange-500 opacity-60" style="animation-duration: 1.5s"></div>
                <div class="absolute h-5 w-5 rounded-full bg-red-600 opacity-40 blur-[2px]"></div>
                <div class="relative h-3 w-3 rounded-full border border-white bg-orange-500 shadow-[0_0_12px_#f97316]" style="box-shadow: 0 0 12px #f97316"></div>
              </div>
            `,
            iconSize: [32, 32],
            iconAnchor: [16, 16]
          });

          const fireMarker = L.marker([fire.latitude, fire.longitude], { icon: fireIcon });
          
          const firePopupHtml = `
            <div class="bg-black/95 text-orange-200 border border-orange-500/30 p-3 rounded-xl font-sans text-xs min-w-[180px] shadow-[0_0_15px_rgba(249,115,22,0.3)]">
              <div class="flex items-center gap-1.5 mb-1.5 pb-1.5 border-b border-orange-500/10">
                <span class="inline-block h-2 w-2 rounded-full bg-orange-500 animate-pulse"></span>
                <span class="font-bold text-[9px] uppercase tracking-wider text-orange-400">NASA FIRMS Active Fire</span>
              </div>
              <div class="space-y-1 text-[8px] font-mono text-white/70">
                <div class="flex justify-between">
                  <span>DETECT INSTR:</span>
                  <span class="font-bold text-white">SUOMI VIIRS</span>
                </div>
                <div class="flex justify-between">
                  <span>BRIGHTNESS:</span>
                  <span class="font-bold text-orange-400 font-mono">${fire.brightness.toFixed(1)} K</span>
                </div>
                <div class="flex justify-between">
                  <span>CONFIDENCE:</span>
                  <span class="text-[#00FF95] font-black uppercase">${fire.confidence === 'h' ? 'High' : fire.confidence === 'n' ? 'Nominal' : 'Low/Mod'}</span>
                </div>
                <div class="flex justify-between">
                  <span>STATION PROX:</span>
                  <span>${fire.distanceKm.toFixed(2)} KM</span>
                </div>
                <div class="flex justify-between">
                  <span>COORDINATES:</span>
                  <span class="text-orange-300/80">${fire.latitude.toFixed(4)}°N, ${fire.longitude.toFixed(4)}°E</span>
                </div>
                ${(fire as any).isDemoSimulated ? `
                <div class="mt-2 text-center text-[7px] text-amber-300 bg-amber-500/15 border border-amber-500/30 px-1 py-0.5 rounded font-black uppercase tracking-widest animate-pulse">
                  [DEMO SIMULATION]
                </div>
                ` : `
                <div class="mt-2 text-center text-[7px] text-[#00FF95] bg-emerald-500/10 border border-emerald-500/20 px-1 py-0.5 rounded font-mono uppercase">
                  VERIFIED ORBITER DATA
                </div>
                `}
              </div>
              <p class="text-[8px] text-white/50 italic mt-2 pt-1.5 border-t border-orange-500/10 leading-relaxed">
                *Detected thermal anomaly pixel. Confirmed high-temperature signal.
              </p>
            </div>
          `;
          fireMarker.bindPopup(firePopupHtml, { className: 'custom-leaflet-popup', closeButton: false });
          thermalGroup.addLayer(fireMarker);
        });
      }
    }

    // 6. Manage Map Click Inspection Marker
    if (inspectedCoords) {
      const inspectLatLng: L.LatLngExpression = [inspectedCoords.latitude, inspectedCoords.longitude];
      if (inspectionMarkerRef.current) {
        inspectionMarkerRef.current.setLatLng(inspectLatLng);
        if (!map.hasLayer(inspectionMarkerRef.current)) {
          inspectionMarkerRef.current.addTo(map);
        }
      } else {
        const inspectionIcon = L.divIcon({
          className: 'custom-inspection-marker',
          html: `
            <div class="relative flex h-12 w-12 items-center justify-center">
              <div class="absolute h-12 w-12 animate-spin rounded-full border border-cyan-500/40 border-dashed" style="animation-duration: 4s"></div>
              <div class="absolute h-8 w-8 rounded-full border border-[#00D4FF]/50 animate-ping" style="animation-duration: 2s"></div>
              <div class="absolute h-2.5 w-2.5 bg-[#00D4FF] rounded-full shadow-[0_0_8px_#00D4FF]"></div>
              <div class="absolute h-6 w-[1px] bg-[#00D4FF]/80"></div>
              <div class="absolute w-6 h-[1px] bg-[#00D4FF]/80"></div>
            </div>
          `,
          iconSize: [48, 48],
          iconAnchor: [24, 24],
        });

        const inspectMarker = L.marker(inspectLatLng, { icon: inspectionIcon });
        inspectionMarkerRef.current = inspectMarker;
        inspectMarker.addTo(map);
      }

      inspectionMarkerRef.current.setPopupContent(`
        <div class="bg-black/95 text-cyan-200 border border-cyan-500/30 p-2.5 rounded-lg font-sans text-xs min-w-[150px]">
          <div class="font-bold text-[9px] uppercase tracking-wider text-[#00D4FF] flex items-center gap-1">
            <span class="inline-block h-2 w-2 bg-[#00D4FF] animate-pulse rounded-full"></span>
            Inspection Target
          </div>
          <div class="text-[9px] text-white/60 mt-1 uppercase">Coordinates:</div>
          <div class="font-mono text-[9px] text-white/50">
            ${inspectedCoords.latitude.toFixed(5)}°N, ${inspectedCoords.longitude.toFixed(5)}°E
          </div>
          <div class="text-[8px] text-white/40 mt-1.5 italic">
            *Click HUD "Reset" to return to live GPS.
          </div>
        </div>
      `);
      if (!inspectionMarkerRef.current.getPopup()) {
        inspectionMarkerRef.current.bindPopup("", { className: 'custom-leaflet-popup', closeButton: false });
      }
    } else {
      if (inspectionMarkerRef.current) {
        if (map.hasLayer(inspectionMarkerRef.current)) {
          map.removeLayer(inspectionMarkerRef.current);
        }
        inspectionMarkerRef.current = null;
      }
    }

    // Pan map to new user coordinates if user is shown and we aren't in manual inspection
    if (showUser && !inspectedCoords) {
      map.panTo(latLng);
    }
  }, [userCoords.latitude, userCoords.longitude, inspectedCoords?.latitude, inspectedCoords?.longitude, currentAqi, reports, hotspots, layerMode, gridPoints, isSatellite, isThermalAnomalies, satelliteFires]);

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden border border-white/10 shadow-inner">
      <div ref={mapContainerRef} className="w-full h-full" id="neuroflux-map" />
      
      {/* Top Center HUD Status Banner */}
      {(isSatellite || isThermalAnomalies) && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[400] px-4 py-2 bg-black/90 backdrop-blur-md border border-cyan-500/40 rounded-xl shadow-[0_0_25px_rgba(0,212,255,0.2)] flex flex-col gap-1 items-center select-none min-w-[320px] max-w-[90vw] pointer-events-none transition-all duration-300">
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_6px_#00d4ff]" />
            <span className="text-[8px] font-bold tracking-widest font-mono text-[#00D4FF] uppercase">
              SATELLITE & TELEMETRY CONTROL COUPLER
            </span>
          </div>
          <div className="flex flex-col items-center gap-1 text-center font-mono w-full">
            {isSatellite && (
              <div className="flex flex-col gap-0.5 items-center w-full">
                <span className={`text-[9px] font-semibold ${hasEsriError ? 'text-red-400' : 'text-cyan-300'}`}>
                  {hasEsriError ? '⚠️ Esri World Imagery Offline / CORS Blocked' : '🛰️ Active: Ultra-HD Esri World Imagery (High-Res)'}
                </span>
              </div>
            )}
            {isThermalAnomalies && (
              satelliteFires && satelliteFires.length > 0 ? (
                <span className="text-[9px] text-[#00FF95] font-bold uppercase animate-pulse">
                  🔥 ACTIVE THERMAL ANOMALIES SYNCD: {satelliteFires.length} POINTS
                </span>
              ) : (
                <span className="text-[9px] text-white/40 uppercase">
                  📡 No active thermal hotspots detected for {yesterdayStr}
                </span>
              )
            )}
          </div>
        </div>
      )}

      {/* High-tech Satellite and Thermal overlay controls */}
      <div className="absolute top-4 right-4 z-[400] flex flex-col gap-2 max-w-[200px]">
        {/* Layer Toggles Panel */}
        <div className="p-3 bg-black/85 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl select-none">
          <div className="text-[8px] font-bold tracking-widest font-mono text-white/40 uppercase mb-2 border-b border-white/5 pb-1">
            Telemetry Overlays
          </div>
          <div className="space-y-2">
            {/* Satellite Toggle */}
            <div className="flex flex-col gap-1.5">
              <label className="flex items-center gap-2 cursor-pointer text-[9px] font-mono text-white/80 hover:text-white transition-colors">
                <input 
                  type="checkbox" 
                  checked={isSatellite} 
                  onChange={(e) => setIsSatellite(e.target.checked)}
                  className="rounded border-white/10 bg-black/50 text-cyan-500 focus:ring-0 focus:ring-offset-0 h-3 w-3 cursor-pointer"
                />
                <span>SATELLITE IMAGERY</span>
              </label>
            </div>

            {/* Thermal anomalies Toggle */}
            <label className="flex items-center gap-2 cursor-pointer text-[9px] font-mono text-white/80 hover:text-white transition-colors">
              <input 
                type="checkbox" 
                checked={isThermalAnomalies} 
                onChange={(e) => setIsThermalAnomalies(e.target.checked)}
                className="rounded border-white/10 bg-black/50 text-orange-500 focus:ring-0 focus:ring-offset-0 h-3 w-3 cursor-pointer"
              />
              <span className="flex items-center gap-1">
                NASA THERMAL ZONE
                {satelliteFires && satelliteFires.length > 0 && (
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-orange-500 animate-ping shrink-0" />
                )}
              </span>
            </label>
          </div>
        </div>

        {/* Legend Panel */}
        <div className="p-2.5 bg-black/85 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl select-none text-[8px] font-mono text-white/50 space-y-1.5">
          <div className="text-[8px] font-bold tracking-widest text-white/40 uppercase border-b border-white/5 pb-1">
            Map Legend
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
            <span>THERMAL STATION</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#00FF95]" />
            <span>GRID HIGH POLLUTION</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-orange-500 animate-pulse" />
            <span>SATELLITE FIRE (NASA)</span>
          </div>
          {satelliteFires && satelliteFires.length > 0 && (
            <div className="text-[7px] text-[#00FF95] border-t border-white/5 pt-1 mt-1 uppercase font-bold animate-pulse">
              ● {satelliteFires.length} Satellite Fire(s) Online
            </div>
          )}
        </div>
      </div>

      {/* Visual coordinates indicator on bottom left of map */}
      <div className="absolute bottom-4 left-4 z-[400] px-3 py-1.5 bg-black/80 backdrop-blur border border-white/10 rounded-lg text-[9px] font-mono text-white/60 select-none shadow-md">
        <span className="text-[#00FF95] mr-1">{inspectedCoords ? "Inspected Target" : "Live GPS"}:</span> {(inspectedCoords || userCoords).latitude.toFixed(5)}°N, {(inspectedCoords || userCoords).longitude.toFixed(5)}°E
      </div>

      {/* Floating high-tech Map Inspector Popup */}
      {inspectedCoords && pixelPosition && (
        <MapInspectorPopup
          latitude={inspectedCoords.latitude}
          longitude={inspectedCoords.longitude}
          pixelPosition={pixelPosition}
          onClose={onCloseInspector || (() => {})}
        />
      )}
    </div>
  );
}
