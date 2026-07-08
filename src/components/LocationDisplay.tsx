import React, { useEffect, useState } from 'react';
import { MapPin } from 'lucide-react';

interface LocationDisplayProps {
  latitude: number;
  longitude: number;
  className?: string;
  showCoordinates?: boolean;
}

// Module-level cache to share geocoding results across all component instances.
// Stores either the resolved name string or the pending Promise.
const geocodeCache: Record<string, string | Promise<string>> = {};

// Public getter so that parent components can synchronously query a cached name
export function getCachedLocationName(latitude: number, longitude: number): string | null {
  const key = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
  const val = geocodeCache[key];
  return typeof val === 'string' ? val : null;
}

export default function LocationDisplay({
  latitude,
  longitude,
  className = '',
  showCoordinates = true,
}: LocationDisplayProps) {
  const [resolvedName, setResolvedName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const cacheKey = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;

    const fetchName = async () => {
      const cached = geocodeCache[cacheKey];
      if (cached) {
        if (typeof cached === 'string') {
          setResolvedName(cached);
          setLoading(false);
          return;
        } else {
          try {
            setLoading(true);
            const name = await cached;
            setResolvedName(name);
          } catch (e) {
            setResolvedName(`${latitude.toFixed(4)}°N, ${longitude.toFixed(4)}°E (exact place name unavailable)`);
          } finally {
            setLoading(false);
          }
          return;
        }
      }

      setLoading(true);
      const promise = (async () => {
        try {
          const res = await fetch(`/api/reverse-geocode?lat=${latitude}&lon=${longitude}`);
          if (!res.ok) throw new Error('Geocoding request failed');
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            const place = data[0];
            const parts = [place.name];
            if (place.state) parts.push(place.state);
            if (place.country) parts.push(place.country);
            return parts.filter(Boolean).join(', ');
          }
          throw new Error('No place details returned');
        } catch (err) {
          console.error('[LocationDisplay] Failed to geocode coordinates:', latitude, longitude, err);
          return `${latitude.toFixed(4)}°N, ${longitude.toFixed(4)}°E (exact place name unavailable)`;
        }
      })();

      geocodeCache[cacheKey] = promise;

      try {
        const name = await promise;
        geocodeCache[cacheKey] = name;
        setResolvedName(name);
      } catch (err) {
        setResolvedName(`${latitude.toFixed(4)}°N, ${longitude.toFixed(4)}°E (exact place name unavailable)`);
      } finally {
        setLoading(false);
      }
    };

    fetchName();
  }, [latitude, longitude]);

  if (loading && !resolvedName) {
    return (
      <span className={`inline-flex items-center gap-1 text-white/50 animate-pulse font-mono ${className}`}>
        <MapPin className="h-3 w-3 text-cyan-400 shrink-0" />
        RESOLVING LOCATION...
      </span>
    );
  }

  const displayName = resolvedName || `${latitude.toFixed(4)}°N, ${longitude.toFixed(4)}°E`;

  return (
    <span className={`inline-flex items-center gap-1 ${className}`} title={`${latitude.toFixed(6)}°N, ${longitude.toFixed(6)}°E`}>
      <span>{displayName}</span>
      {showCoordinates && resolvedName && !resolvedName.includes('unavailable') && (
        <span className="text-[8px] font-mono text-white/40 ml-1 select-all">
          ({latitude.toFixed(4)}°N, {longitude.toFixed(4)}°E)
        </span>
      )}
    </span>
  );
}
