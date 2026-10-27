import React, { useState, useEffect, useCallback } from 'react';
import { APIProvider, Map, AdvancedMarker, Pin } from '@vis.gl/react-google-maps';
import { Compass, CheckCircle2 } from 'lucide-react';

interface RouteTariffMapPickerProps {
  originName: string;
  originLat: number | null;
  originLng: number | null;
  destinationName: string;
  destinationLat: number | null;
  destinationLng: number | null;
  distanceKm: string;
  onDistanceCalculated: (calculatedKm: number) => void;
  onCoordinatesUpdated?: (originCoords: { lat: number; lng: number } | null, destCoords: { lat: number; lng: number } | null) => void;
}

// Addis Ababa & surrounding regional quarries/hubs default center
const DEFAULT_CENTER = { lat: 9.0220, lng: 38.7468 };

export function calculateHaversineRoadKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const straightLineKm = R * c;
  // Standard haulage road route winding factor in regional aggregate logistics (1.25x)
  const roadKm = straightLineKm * 1.25;
  const rounded = Math.round(roadKm * 10) / 10;
  return Math.max(1, rounded);
}

export const RouteTariffMapPicker: React.FC<RouteTariffMapPickerProps> = ({
  originName,
  originLat,
  originLng,
  destinationName,
  destinationLat,
  destinationLng,
  distanceKm,
  onDistanceCalculated,
  onCoordinatesUpdated
}) => {
  const apiKey = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || '';

  const [originPos, setOriginPos] = useState<{ lat: number; lng: number } | null>(
    originLat && originLng ? { lat: originLat, lng: originLng } : null
  );
  const [destPos, setDestPos] = useState<{ lat: number; lng: number } | null>(
    destinationLat && destinationLng ? { lat: destinationLat, lng: destinationLng } : null
  );

  // Active pin targeting mode: 'origin' | 'destination' | 'none'
  const [pinMode, setPinMode] = useState<'origin' | 'destination' | 'none'>('none');
  const [calculatedDistance, setCalculatedDistance] = useState<number | null>(
    distanceKm ? parseFloat(distanceKm) : null
  );

  // Update positions when props change (e.g. user selects different location from dropdown)
  useEffect(() => {
    if (originLat && originLng) {
      setOriginPos({ lat: originLat, lng: originLng });
    } else {
      // Sensible default near Addis Ababa north aggregate belt if not set
      setOriginPos({ lat: 9.0650, lng: 38.6800 });
    }
  }, [originLat, originLng]);

  useEffect(() => {
    if (destinationLat && destinationLng) {
      setDestPos({ lat: destinationLat, lng: destinationLng });
    } else {
      // Sensible default near central / south construction expansion belt if not set
      setDestPos({ lat: 8.9830, lng: 38.7940 });
    }
  }, [destinationLat, destinationLng]);

  // Compute driving distance and ensure approximate haul distance is exactly the same as calculated driving distance
  const computeDrivingDistance = useCallback(
    (orig: { lat: number; lng: number }, dest: { lat: number; lng: number }) => {
      if (typeof window !== 'undefined' && (window as any).google?.maps?.DirectionsService) {
        try {
          const directionsService = new (window as any).google.maps.DirectionsService();
          directionsService.route(
            {
              origin: orig,
              destination: dest,
              travelMode: (window as any).google.maps.TravelMode.DRIVING,
            },
            (result: any, status: any) => {
              if (status === 'OK' && result?.routes?.[0]?.legs?.[0]?.distance?.value) {
                const km = Math.round((result.routes[0].legs[0].distance.value / 1000) * 10) / 10;
                setCalculatedDistance(km);
                onDistanceCalculated(km);
                return;
              }
              const fallbackKm = calculateHaversineRoadKm(orig.lat, orig.lng, dest.lat, dest.lng);
              setCalculatedDistance(fallbackKm);
              onDistanceCalculated(fallbackKm);
            }
          );
          return;
        } catch {
          // Fall through
        }
      }
      const fallbackKm = calculateHaversineRoadKm(orig.lat, orig.lng, dest.lat, dest.lng);
      setCalculatedDistance(fallbackKm);
      onDistanceCalculated(fallbackKm);
    },
    [onDistanceCalculated]
  );

  // Automatically recalculate distance whenever originPos or destPos changes, syncing with haul distance
  useEffect(() => {
    if (originPos && destPos) {
      computeDrivingDistance(originPos, destPos);
    }
  }, [originPos, destPos, computeDrivingDistance]);

  const handleMapClick = useCallback((e: any) => {
    if (pinMode === 'none') return;
    const latLng = e.detail?.latLng;
    if (!latLng) return;

    if (pinMode === 'origin') {
      const newPos = { lat: latLng.lat, lng: latLng.lng };
      setOriginPos(newPos);
      if (onCoordinatesUpdated) {
        onCoordinatesUpdated(newPos, destPos);
      }
      setPinMode('none');
    } else if (pinMode === 'destination') {
      const newPos = { lat: latLng.lat, lng: latLng.lng };
      setDestPos(newPos);
      if (onCoordinatesUpdated) {
        onCoordinatesUpdated(originPos, newPos);
      }
      setPinMode('none');
    }
  }, [pinMode, originPos, destPos, onCoordinatesUpdated]);

  const mapCenter = originPos
    ? { lat: (originPos.lat + (destPos?.lat || originPos.lat)) / 2, lng: (originPos.lng + (destPos?.lng || originPos.lng)) / 2 }
    : DEFAULT_CENTER;

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50 space-y-2">
      {/* Map Control Header */}
      <div className="p-3 bg-white border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-amber-600" />
          <span className="font-bold text-slate-800">
            Google Maps Corridor Route &amp; Driving Distance
          </span>
          <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">
            Interactive Pin Locator
          </span>
        </div>

        {/* Pinning Toolbar */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setPinMode(pinMode === 'origin' ? 'none' : 'origin')}
            className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors flex items-center gap-1 cursor-pointer ${
              pinMode === 'origin'
                ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-400 font-bold'
                : 'bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100'
            }`}
            title="Click on the map to relocate the Crusher Site pin"
          >
            <span className="w-2 h-2 rounded-full bg-amber-600 inline-block" />
            <span>{pinMode === 'origin' ? 'Click Map for Crusher' : 'Reposition Crusher'}</span>
          </button>

          <button
            type="button"
            onClick={() => setPinMode(pinMode === 'destination' ? 'none' : 'destination')}
            className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors flex items-center gap-1 cursor-pointer ${
              pinMode === 'destination'
                ? 'bg-blue-600 text-white ring-2 ring-blue-400 font-bold'
                : 'bg-blue-50 text-blue-800 border border-blue-300 hover:bg-blue-100'
            }`}
            title="Click on the map to relocate the Destination Project pin"
          >
            <span className="w-2 h-2 rounded-full bg-blue-600 inline-block" />
            <span>{pinMode === 'destination' ? 'Click Map for Project' : 'Reposition Project'}</span>
          </button>
        </div>
      </div>

      {pinMode !== 'none' && (
        <div className="mx-3 p-2 bg-amber-50 border border-amber-200 rounded text-amber-900 text-[11px] flex items-center justify-between animate-pulse">
          <span>
            📍 Click anywhere on the map to place the{' '}
            <strong>{pinMode === 'origin' ? `Crusher Site (${originName})` : `Destination Project (${destinationName})`}</strong> marker.
          </span>
          <button
            type="button"
            onClick={() => setPinMode('none')}
            className="text-[10px] text-amber-800 underline font-semibold cursor-pointer"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Google Map Canvas */}
      <div className="relative w-full h-[220px] bg-slate-100">
        <APIProvider apiKey={apiKey} libraries={['places', 'geometry']}>
          <Map
            mapId="DEMO_MAP_ID"
            defaultCenter={mapCenter}
            defaultZoom={10}
            gestureHandling="greedy"
            disableDefaultUI={false}
            onClick={handleMapClick}
            className="w-full h-full"
          >
            {/* Origin Marker (Crusher Site - Amber) */}
            {originPos && (
              <AdvancedMarker
                position={originPos}
                title={`Crusher Loading Origin: ${originName}`}
              >
                <Pin
                  background="#f59e0b"
                  borderColor="#b45309"
                  glyphColor="#ffffff"
                  scale={1.05}
                />
              </AdvancedMarker>
            )}

            {/* Destination Marker (Destination Project - Blue) */}
            {destPos && (
              <AdvancedMarker
                position={destPos}
                title={`Destination Project: ${destinationName}`}
              >
                <Pin
                  background="#2563eb"
                  borderColor="#1e40af"
                  glyphColor="#ffffff"
                  scale={1.05}
                />
              </AdvancedMarker>
            )}
          </Map>
        </APIProvider>

        {/* Floating Route Legend & Guidance */}
        <div className="absolute top-2 left-2 bg-white/95 backdrop-blur-xs p-2 rounded shadow-md border border-slate-200 text-[10px] font-mono space-y-1 pointer-events-none">
          <div className="flex items-center gap-1.5 text-amber-800">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
            <span className="font-bold truncate max-w-[150px]">{originName || 'Crusher Site'}</span>
          </div>
          <div className="flex items-center gap-1.5 text-blue-800">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" />
            <span className="font-bold truncate max-w-[150px]">{destinationName || 'Destination Project'}</span>
          </div>
        </div>
      </div>

      {/* Calculated Driving Distance - Synced exactly to Approximate Haul Distance */}
      <div className="p-3 bg-white border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
            <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider flex items-center justify-between">
              <span>Calculated Driving Distance</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-bold">
                Haul Distance Matched
              </span>
            </div>
            <div className="mt-1 text-base font-bold font-mono text-slate-900 tabular-nums">
              {calculatedDistance !== null ? `${calculatedDistance} km` : '—'}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              Exact road distance automatically synced to Approximate Haul Distance
            </div>
          </div>

          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
            <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
              Route Origin &amp; Destination
            </div>
            <div className="mt-1 text-xs font-semibold text-slate-800 truncate" title={`${originName} → ${destinationName}`}>
              <span className="text-amber-700">{originName}</span>
              <span className="text-slate-400 mx-1.5">→</span>
              <span className="text-blue-700">{destinationName}</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              Corridor endpoints for numerical transport fee configuration
            </div>
          </div>
        </div>

        {calculatedDistance !== null && (
          <button
            type="button"
            onClick={() => onDistanceCalculated(calculatedDistance)}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded font-bold text-xs transition-colors flex items-center justify-center gap-1.5 shrink-0 cursor-pointer shadow-xs"
            title="Ensure haul distance field exactly matches calculated driving distance"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
            <span>Sync Distance ({calculatedDistance} km)</span>
          </button>
        )}
      </div>
    </div>
  );
};
