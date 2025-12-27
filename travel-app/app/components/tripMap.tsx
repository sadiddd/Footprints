"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

interface LocationPin {
  id: string;
  lat: number;
  lng: number;
  label: string;
}

interface Trip {
  tripId: string;
  title: string;
  location: string;
  locations?: LocationPin[];
  startDate?: string;
  endDate?: string;
}

interface TripsMapProps {
  trips: Trip[];
}

export default function TripsMap({ trips }: TripsMapProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Collect all location pins from all trips
  const allPins = trips.flatMap((trip) =>
    (trip.locations || []).map((loc) => ({
      ...loc,
      tripTitle: trip.title,
      tripLocation: trip.location,
      tripId: trip.tripId,
    }))
  );

  if (!isMounted) {
    return (
      <div className="w-full h-[400px] bg-gray-100 flex items-center justify-center rounded-lg">
        <p className="text-gray-500">Loading map...</p>
      </div>
    );
  }

  if (allPins.length === 0) {
    return (
      <div className="w-full h-[400px] bg-gray-100 flex items-center justify-center rounded-lg">
        <p className="text-gray-500">No trip locations to display</p>
      </div>
    );
  }

  // Calculate center based on all pins
  const centerLat =
    allPins.reduce((sum, pin) => sum + pin.lat, 0) / allPins.length;
  const centerLng =
    allPins.reduce((sum, pin) => sum + pin.lng, 0) / allPins.length;

  return (
    <div className="w-full h-[400px] rounded-lg overflow-hidden">
      <MapContainer
        center={[centerLat, centerLng]}
        zoom={4}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />

        {allPins.map((pin) => (
          <Marker key={`${pin.tripId}-${pin.id}`} position={[pin.lat, pin.lng]}>
            <Popup>
              <div className="min-w-[150px]">
                <h3 className="font-bold text-base">{pin.tripTitle}</h3>
                <p className="text-sm text-gray-600 mb-1">{pin.tripLocation}</p>
                <p className="text-sm font-semibold text-accent">{pin.label}</p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
