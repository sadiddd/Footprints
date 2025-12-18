"use client";

import { useState, useEffect } from "react";
import {
  Plus,
  MapPin,
  Calendar,
  Lock as LockIcon,
  Globe,
  UnlockIcon,
} from "lucide-react";
import { getCurrentUser } from "aws-amplify/auth";
import Link from "next/link";

export default function Trips() {
  const [trips, setTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<File[]>([]); // work on this and make sure an image is acutally represented

  useEffect(() => {
    const fetchTrips = async () => {
      try {
        const currentUser = await getCurrentUser();
        const userId = currentUser.userId;

        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/Trips?userId=${userId}`
        );

        if (!res.ok) throw new Error(`HTTP error ${res.status}`);

        const data = await res.json();
        setTrips(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchTrips();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-base-100 flex items-center justify-center">
        <span className="loading loading-spinner loading-lg text-accent"></span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-base-100 pt-24">
        <div className="container mx-auto px-4">
          <div className="alert alert-error">
            <span>Error loading trips: {error}</span>
          </div>
        </div>
      </div>
    );
  }

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
                  key={trip.TripID}
                  href={`/trips/${trip.TripID}`}
                  className="card bg-base-100 shadow-xl hover:shadow-2xl transition-all duration-300 cursor-pointer hover:-translate-y-2 border border-base-300"
                >
                  <figure className="relative h-64 overflow-hidden">
                    {trip.ImageUrls && trip.ImageUrls.length > 0 ? (
                      <img
                        src={trip.ImageUrls[0]}
                        alt={trip.Title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                        <MapPin className="h-24 w-24 text-primary/40" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent"></div>
                    <div className="absolute bottom-3 right-3">
                      <span
                        className={`badge badge-sm ${
                          trip.Visibility === "private"
                            ? "badge-error"
                            : "badge-success"
                        } gap-1`}
                      >
                        {trip.Visibility === "private" ? (
                          <LockIcon className="h-3 w-3" />
                        ) : (
                          <UnlockIcon className="h-3 w-3" />
                        )}{" "}
                        {trip.Visibility}
                      </span>
                    </div>
                  </figure>

                  <div className="card-body">
                    <h3 className="card-title text-2xl font-serif">
                      {trip.Title}
                    </h3>
                    {trip.Location && (
                      <div className="flex items-center gap-2 text-base-content/70 mb-2">
                        <MapPin className="h-4 w-4" />
                        <span className="text-sm">{trip.Location}</span>
                      </div>
                    )}

                    {(trip.StartDate || trip.EndDate) && (
                      <div className="flex items-center gap-2 text-sm text-base-content/70">
                        <Calendar className="h-4 w-4" />
                        <span>
                          {trip.StartDate &&
                            new Date(trip.StartDate).toLocaleDateString()}
                          {trip.StartDate && trip.EndDate && " - "}
                          {trip.EndDate &&
                            new Date(trip.EndDate).toLocaleDateString()}
                        </span>
                      </div>
                    )}

                    {trip.Description && (
                      <p className="text-sm text-base-content/60 line-clamp-2 mt-2">
                        {trip.Description}
                      </p>
                    )}
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
                <Link href="/trips/add">
                  <button className="btn btn-accent btn-lg gap-2 mt-4">
                    <Plus className="h-5 w-5" />
                    Create Your First Trip
                  </button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
