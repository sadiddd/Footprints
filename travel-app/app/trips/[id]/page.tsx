"use client";

import { useState, useEffect } from "react";
import { MapPin, ArrowLeft, Calendar, Heart } from "lucide-react";
import { useRouter, useParams } from "next/navigation";
import { getCurrentUser } from "aws-amplify/auth";
import Link from "next/link";

interface Trip {
  TripID: string;
  Title: string;
  Location: string;
  Description: string;
  StartDate: string;
  EndDate: string;
  Visibility: string;
  ImageUrls?: string[];
}

export default function TripDetails() {
  const router = useRouter();
  const params = useParams();
  const tripId = params.id as string;

  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchTrip();
  }, [tripId]);

  const fetchTrip = async () => {
    try {
      const currentUser = await getCurrentUser();
      const userId = currentUser.userId;
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/Trips/${tripId}?userId=${userId}`
      );

      if (!res.ok) throw new Error(`HTTP Error ${res.status}`);

      const data = await res.json();
      console.log("Trip data received:", data);
      setTrip(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background paper-texture flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-terracotta mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading trip details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background paper-texture flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">Error: {error}</p>
          <Link
            href="/trips"
            className="mt-4 inline-block text-terracotta hover:underline"
          >
            Back to trips
          </Link>
        </div>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="min-h-screen bg-background paper-texture flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Trip not found</p>
          <Link
            href="/trips"
            className="mt-4 inline-block text-terracotta hover:underline"
          >
            Back to trips
          </Link>
        </div>
      </div>
    );
  }

  // Placeholder image - replace with actual AWS S3 images later
  const placeholderImage =
    "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&auto=format&fit=crop";

  return (
    <div className="min-h-screen bg-background paper-texture">
      <main className="pb-16">
        {/* Back button */}
        <div className="container mx-auto px-4 py-6">
          <Link
            href="/trips"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            Back to journal
          </Link>
        </div>

        {/* Hero image */}
        <div className="container mx-auto px-4 mb-8">
          <div className="relative aspect-[21/9] rounded-sm overflow-hidden polaroid-shadow">
            <img
              src={placeholderImage}
              alt={trip.Title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-ink/60 via-transparent to-transparent" />

            {/* Title overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10">
              <h1 className="font-serif text-3xl md:text-5xl text-polaroid mb-4 drop-shadow-lg">
                {trip.Title}
              </h1>
              <div className="flex items-center gap-4 text-polaroid/90">
                <span className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  {trip.Location}
                </span>
                <span className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  {trip.StartDate &&
                    new Date(trip.StartDate).toLocaleDateString()}{" "}
                  -{" "}
                  {trip.EndDate && new Date(trip.EndDate).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Content section */}
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            {/* Journal entry content */}
            <article className="bg-polaroid p-6 md:p-10 polaroid-shadow mb-12">
              <div className="prose prose-lg max-w-none">
                {trip.Description?.split("\n\n").map((paragraph, index) => (
                  <p
                    key={index}
                    className="text-ink-light font-sans leading-relaxed mb-4 last:mb-0"
                  >
                    {paragraph}
                  </p>
                ))}
              </div>

              {/* Like button */}
              <div className="mt-8 pt-6 border-t border-paper-dark flex items-center justify-between">
                <button className="flex items-center gap-2 text-muted-foreground hover:text-terracotta transition-colors group">
                  <Heart className="w-5 h-5 transition-transform group-hover:scale-110" />
                  <span className="font-sans text-sm">Add to favorites</span>
                </button>
                <span className="text-sm text-muted-foreground font-sans italic">
                  {trip.StartDate &&
                    new Date(trip.StartDate).toLocaleDateString()}
                </span>
              </div>
            </article>

            {/* Image gallery placeholder */}
            {trip.ImageUrls && trip.ImageUrls.length > 0 && (
              <section>
                <h2 className="font-serif text-2xl text-foreground mb-6">
                  Photo Gallery
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {trip.ImageUrls.map((image, index) => (
                    <div
                      key={index}
                      className="relative aspect-square rounded-sm overflow-hidden polaroid-shadow"
                    >
                      <img
                        src={placeholderImage}
                        alt={`${trip.Title} - Photo ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
