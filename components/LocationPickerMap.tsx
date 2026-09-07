'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default marker icon issues in Next.js/React-Leaflet
const pinIcon = L.divIcon({
  className: 'custom-leaflet-marker',
  html: `<div style="
    width: 28px;
    height: 28px;
    background-color: #4f46e5;
    border: 3px solid #ffffff;
    border-radius: 50% 50% 50% 0;
    transform: rotate(-45deg);
    box-shadow: 0 4px 10px rgba(0,0,0,0.4);
    display: flex;
    align-items: center;
    justify-content: center;
  "></div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 28],
});

// Default view: Karachi, Pakistan
const DEFAULT_CENTER: [number, number] = [24.8607, 67.0011];
const DEFAULT_ZOOM = 12;

interface LocationPickerProps {
  onLocationSelect: (lat: number, lng: number) => void;
  selectedLat: number | null;
  selectedLng: number | null;
}

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

// Sub-component to handle click events on the map
function MapClickHandler({ onSelect }: { onSelect: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// Sub-component that smoothly flies the map to a target coordinate
function MapFlyTo({
  target,
}: {
  target: { lat: number; lng: number; zoom: number } | null;
}) {
  const map = useMap();
  useEffect(() => {
    if (target) {
      map.flyTo([target.lat, target.lng], target.zoom, { duration: 1.2 });
    }
  }, [target, map]);
  return null;
}

export default function LocationPickerMap({
  onLocationSelect,
  selectedLat,
  selectedLng,
}: LocationPickerProps) {
  const [center, setCenter] = useState<[number, number]>(DEFAULT_CENTER);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<NominatimResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // FlyTo target — set when user selects a search result
  const [flyTarget, setFlyTarget] = useState<{
    lat: number;
    lng: number;
    zoom: number;
  } | null>(null);

  // Try browser geolocation on mount (only if no pin is placed yet)
  useEffect(() => {
    if (navigator.geolocation && !selectedLat) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setCenter([lat, lng]);
          onLocationSelect(lat, lng);
        },
        () => {
          // Fallback to default Karachi center
        }
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (resultsRef.current && !resultsRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Nominatim geocoding search with 400ms debounce
  const performSearch = useCallback(async (query: string) => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(trimmed)}&limit=5`,
        {
          headers: {
            'User-Agent': 'FindoraApp/1.0 (missing-persons-reunification)',
          },
        }
      );

      if (res.ok) {
        const data: NominatimResult[] = await res.json();
        setSearchResults(data);
        setShowResults(data.length > 0);
      } else {
        setSearchResults([]);
        setShowResults(false);
      }
    } catch {
      setSearchResults([]);
      setShowResults(false);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleSearchInput = (value: string) => {
    setSearchQuery(value);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      performSearch(value);
    }, 400);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    performSearch(searchQuery);
  };

  const handleResultSelect = (result: NominatimResult) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);

    // Fly the map to the selected location (does NOT place a pin)
    setFlyTarget({ lat, lng, zoom: 15 });
    setSearchQuery(result.display_name.split(',').slice(0, 2).join(','));
    setShowResults(false);
  };

  const mapCenter: [number, number] =
    selectedLat !== null && selectedLng !== null
      ? [selectedLat, selectedLng]
      : center;

  return (
    <div className="space-y-2">
      {/* Location Search Bar */}
      <div className="relative" ref={resultsRef}>
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search for a city or area (e.g. Clifton, Karachi)"
              value={searchQuery}
              onChange={(e) => handleSearchInput(e.target.value)}
              onFocus={() => {
                if (searchResults.length > 0) setShowResults(true);
              }}
              className="w-full px-4 py-2.5 pl-9 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all placeholder:text-slate-600"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm pointer-events-none">
              🔍
            </span>
            {searching && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2">
                <span className="w-3.5 h-3.5 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin block" />
              </span>
            )}
          </div>
          <button
            type="submit"
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700/80 transition-all shrink-0"
          >
            Search
          </button>
        </form>

        {/* Search Results Dropdown */}
        {showResults && searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-[2000] max-h-48 overflow-y-auto">
            {searchResults.map((result) => (
              <button
                key={result.place_id}
                type="button"
                onClick={() => handleResultSelect(result)}
                className="w-full text-left px-4 py-2.5 text-xs text-slate-300 hover:bg-slate-800 hover:text-white transition-colors border-b border-slate-800/60 last:border-b-0 leading-relaxed"
              >
                {result.display_name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Map Container */}
      <div className="w-full h-72 rounded-xl overflow-hidden border border-slate-800 shadow-inner relative z-0">
        <MapContainer
          center={mapCenter}
          zoom={DEFAULT_ZOOM}
          scrollWheelZoom={true}
          className="w-full h-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapClickHandler onSelect={onLocationSelect} />
          <MapFlyTo target={flyTarget} />
          {selectedLat !== null && selectedLng !== null && (
            <Marker position={[selectedLat, selectedLng]} icon={pinIcon} />
          )}
        </MapContainer>

        {/* Floating Instruction Badge */}
        <div className="absolute bottom-3 left-3 right-3 z-[1000] pointer-events-none text-center">
          <div className="inline-block px-3 py-1.5 rounded-lg bg-slate-950/90 border border-slate-800 text-xs font-medium text-slate-300 shadow-md backdrop-blur-md">
            {selectedLat !== null
              ? `Selected: ${selectedLat.toFixed(5)}, ${selectedLng?.toFixed(5)}`
              : 'Click anywhere on the map to place a pin'}
          </div>
        </div>
      </div>
    </div>
  );
}
