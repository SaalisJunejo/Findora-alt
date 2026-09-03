'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
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

interface LocationPickerProps {
  onLocationSelect: (lat: number, lng: number) => void;
  selectedLat: number | null;
  selectedLng: number | null;
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

export default function LocationPickerMap({
  onLocationSelect,
  selectedLat,
  selectedLng,
}: LocationPickerProps) {
  const [center, setCenter] = useState<[number, number]>([40.7128, -74.0060]); // Default: NY
  const [hasUserLocation, setHasUserLocation] = useState(false);

  useEffect(() => {
    // Try browser geolocation if available
    if (navigator.geolocation && !selectedLat) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setCenter([lat, lng]);
          setHasUserLocation(true);
          onLocationSelect(lat, lng);
        },
        () => {
          // Fallback to default
        }
      );
    }
  }, [onLocationSelect, selectedLat]);

  const defaultPosition: [number, number] =
    selectedLat !== null && selectedLng !== null
      ? [selectedLat, selectedLng]
      : center;

  return (
    <div className="w-full h-72 rounded-xl overflow-hidden border border-slate-800 shadow-inner relative z-0">
      <MapContainer
        center={defaultPosition}
        zoom={13}
        scrollWheelZoom={true}
        className="w-full h-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapClickHandler onSelect={onLocationSelect} />
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
  );
}
