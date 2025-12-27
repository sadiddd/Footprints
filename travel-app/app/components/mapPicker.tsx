"use client";

import { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";

// Fix Leaflet icon issue with webpack
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

export interface LocationPin {
  id: string;
  lat: number;
  lng: number;
  label: string;
}

interface MapPickerProps {
  locations: LocationPin[];
  onLocationsChange: (locations: LocationPin[]) => void;
  initialLat?: number;
  initialLng?: number;
}

interface LocationMarkersProps {
  locations: LocationPin[];
  onLocationAdd: (lat: number, lng: number) => void;
  onLocationRemove: (id: string) => void;
}

function LocationMarkers({
  locations,
  onLocationAdd,
  onLocationRemove,
}: LocationMarkersProps) {
  useMapEvents({
    click(e) {
      onLocationAdd(e.latlng.lat, e.latlng.lng);
    },
  });

  return (
    <>
      {locations.map((location) => (
        <Marker key={location.id} position={[location.lat, location.lng]}>
          <Popup>
            <div className="text-center">
              <p className="font-semibold mb-2">{location.label}</p>
              <button
                onClick={() => onLocationRemove(location.id)}
                className="btn btn-xs btn-error"
              >
                Remove
              </button>
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
}

export default function MapPicker({
  locations,
  onLocationsChange,
  initialLat = 51.0447,
  initialLng = -114.0719,
}: MapPickerProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    // Set mounted state after initial render to avoid SSR issues
    const timer = setTimeout(() => setIsMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);

  const handleLocationAdd = (lat: number, lng: number) => {
    const newLocation: LocationPin = {
      id: crypto.randomUUID(),
      lat,
      lng,
      label: `Location ${locations.length + 1}`,
    };
    onLocationsChange([...locations, newLocation]);
  };

  const handleLocationRemove = (id: string) => {
    onLocationsChange(locations.filter((loc) => loc.id !== id));
  };

  if (!isMounted) {
    return (
      <div className="w-full h-[400px] bg-gray-100 flex items-center justify-center rounded-lg">
        <p className="text-gray-500">Loading map...</p>
      </div>
    );
  }

  // Calculate center based on existing locations or use initial
  const centerLat =
    locations.length > 0
      ? locations.reduce((sum, loc) => sum + loc.lat, 0) / locations.length
      : initialLat;
  const centerLng =
    locations.length > 0
      ? locations.reduce((sum, loc) => sum + loc.lng, 0) / locations.length
      : initialLng;

  return (
    <div className="w-full h-[400px] rounded-lg overflow-hidden">
      <MapContainer
        center={[centerLat, centerLng]}
        zoom={4}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={true}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />
        <LocationMarkers
          locations={locations}
          onLocationAdd={handleLocationAdd}
          onLocationRemove={handleLocationRemove}
        />
      </MapContainer>
    </div>
  );
}
