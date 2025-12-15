"use client";

import { useState } from "react";
import { Plus, MapPin, Calendar } from "lucide-react";
import Link from "next/link";

interface Trip {
  id: number;
  destination: string;
  country: string;
  startDate: string;
  endDate: string;
  entriesCount: number;
}

export default function Trips() {
  const [trips] = useState<Trip[]>([
    {
      id: 1,
      destination: "Santorini",
      country: "Greece",
      startDate: "Jun 15, 2024",
      endDate: "Jun 22, 2024",
      entriesCount: 12,
    },
    {
      id: 2,
      destination: "Tokyo",
      country: "Japan",
      startDate: "Apr 3, 2024",
      endDate: "Apr 17, 2024",
      entriesCount: 28,
    },
    {
      id: 3,
      destination: "Patagonia",
      country: "Argentina",
      startDate: "Feb 10, 2024",
      endDate: "Feb 24, 2024",
      entriesCount: 19,
    },
  ]);

  return (
    <div className="min-h-screen bg-base-100">
      <div className="pt-24 pb-20">
        <div className="container mx-auto px-4 sm:px-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-12">
            <div>
              <h1 className="text-4xl sm:text-5xl font-serif font-bold mb-2 text-base-content">
                My Trips
              </h1>
              <p className="text-lg text-base-content/70">
                {trips.length} {trips.length === 1 ? "adventure" : "adventures"}{" "}
                documented
              </p>
            </div>
            <Link href="/trips/add">
              <button className="btn btn-accent btn-lg gap-2">
                <Plus className="h-5 w-5" />
                New Trip
              </button>
            </Link>
          </div>

          {/* Trips Grid */}
          {trips.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {trips.map((trip) => (
                <Link
                  key={trip.id}
                  href={`/trips/${trip.id}`}
                  className="card bg-base-100 shadow-xl hover:shadow-2xl transition-all duration-300 cursor-pointer hover:-translate-y-2 border border-base-300"
                >
                  <figure className="relative h-64 overflow-hidden">
                    <div className="w-full h-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                      <MapPin className="h-24 w-24 text-primary/40" />
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent"></div>
                    <div className="badge badge-accent absolute top-4 right-4">
                      {trip.entriesCount} entries
                    </div>
                  </figure>

                  <div className="card-body">
                    <h3 className="card-title text-2xl font-serif">
                      {trip.destination}
                    </h3>
                    <div className="flex items-center gap-2 text-base-content/70 mb-2">
                      <MapPin className="h-4 w-4" />
                      <span className="text-sm">{trip.country}</span>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-base-content/70">
                      <Calendar className="h-4 w-4" />
                      <span>
                        {trip.startDate} - {trip.endDate}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="card bg-base-200 shadow-xl">
              <div className="card-body items-center text-center p-12">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Plus className="h-10 w-10 text-primary" />
                </div>
                <h3 className="card-title text-2xl font-serif">No trips yet</h3>
                <p className="text-base-content/70">
                  Start your journey by creating your first trip journal
                </p>
                <button className="btn btn-accent btn-lg gap-2 mt-4">
                  <Plus className="h-5 w-5" />
                  Create Your First Trip
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
