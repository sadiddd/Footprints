"use client";

import { useState, useEffect } from "react";
import {
  MapPin,
  ArrowLeft,
  Calendar,
  X,
  ChevronLeft,
  ChevronRight,
  Trash,
  Pencil,
} from "lucide-react";
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
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [imagesLoading, setImagesLoading] = useState(false);

  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    fetchTrip();
  }, [tripId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isViewerOpen) return;

      if (e.key === "Escape") {
        setIsViewerOpen(false);
      } else if (e.key === "ArrowLeft") {
        goToPrevious();
      } else if (e.key === "ArrowRight") {
        goToNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isViewerOpen, currentIndex, imageUrls.length]);

  const formatDate = (dateString: string) => {
    const [year, month, day] = dateString.split("-");
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const openLightbox = (index: number) => {
    setCurrentIndex(index);
    setIsViewerOpen(true);
  };

  const closeLightbox = () => {
    setIsViewerOpen(false);
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % imageUrls.length);
  };

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + imageUrls.length) % imageUrls.length);
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this trip?")) return;

    setLoading(true);
    try {
      const currentUser = await getCurrentUser();
      const userId = currentUser.userId;

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/Trips`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          UserID: userId,
          TripID: tripId,
        }),
      });

      if (!res.ok) throw new Error(`HTTP Error ${res.status}`);

      router.push("/trips");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    router.push(`/trips/${tripId}/update`);
  };

  const fetchTrip = async () => {
    try {
      const currentUser = await getCurrentUser();
      const userId = currentUser.userId;
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/Trips/${tripId}?userId=${userId}`
      );

      if (!res.ok) throw new Error(`HTTP Error ${res.status}`);

      const data = await res.json();
      setTrip(data);

      // Images come as presigned URLs from the API
      if (data.ImageUrls && data.ImageUrls.length > 0) {
        setImageUrls(data.ImageUrls);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
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
            {imageUrls[0] ? (
              <img
                src={imageUrls[0]}
                alt={trip.Title}
                className="absolute inset-0 w-full h-full object-cover"
                onError={(e) => {
                  console.error("Error loading hero image:", imageUrls[0], e);
                }}
                onLoad={() => {
                  console.log("Hero image loaded successfully:", imageUrls[0]);
                }}
              />
            ) : (
              <div className="absolute inset-0 bg-gray-200 flex items-center justify-center">
                <span className="text-muted-foreground">No image</span>
              </div>
            )}
            {imagesLoading && (
              <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
              </div>
            )}
          </div>
        </div>

        {/* Title and metadata */}
        <div className="container mx-auto px-4 mb-8">
          <div className="max-w-3xl mx-auto">
            <h1 className="font-serif text-3xl md:text-5xl text-foreground mb-4">
              {trip.Title}
            </h1>
            <div className="flex items-center gap-4 text-muted-foreground">
              <span className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                {trip.Location}
              </span>
              <span className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                {trip.StartDate && formatDate(trip.StartDate)} -{" "}
                {trip.EndDate && formatDate(trip.EndDate)}
              </span>
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
            </article>

            {trip.ImageUrls && trip.ImageUrls.length > 0 && (
              <section>
                <h2 className="font-serif text-2xl text-foreground mb-6">
                  Photo Gallery
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {imagesLoading ? (
                    <div className="col-span-full text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-terracotta mx-auto"></div>
                      <p className="mt-2 text-muted-foreground">
                        Loading images...
                      </p>
                    </div>
                  ) : (
                    imageUrls.map((imageUrl, index) => (
                      <div
                        key={index}
                        className="relative aspect-square rounded-sm overflow-hidden polaroid-shadow cursor-pointer transition-transform hover:scale-105"
                        onClick={() => openLightbox(index)}
                      >
                        <img
                          src={imageUrl}
                          alt={`${trip.Title} - Photo ${index + 1}`}
                          className="absolute inset-0 w-full h-full object-cover"
                          onError={(e) => {
                            console.error(
                              `Error loading image ${index}:`,
                              imageUrl,
                              e
                            );
                          }}
                          onLoad={() => {
                            console.log(
                              `Image ${index} loaded successfully:`,
                              imageUrl
                            );
                          }}
                        />
                      </div>
                    ))
                  )}
                </div>
              </section>
            )}
          </div>
        </div>
      </main>

      {/* Lightbox Modal */}
      {isViewerOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
          onClick={closeLightbox}
        >
          {/* Close button */}
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 z-50 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            aria-label="Close lightbox"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Previous button */}
          {imageUrls.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                goToPrevious();
              }}
              className="absolute left-4 z-50 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              aria-label="Previous image"
            >
              <ChevronLeft className="w-8 h-8" />
            </button>
          )}

          {/* Image container */}
          <div
            className="relative max-w-7xl max-h-[90vh] w-full h-full flex items-center justify-center px-16"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={imageUrls[currentIndex]}
              alt={`${trip?.Title} - Photo ${currentIndex + 1}`}
              className="max-w-full max-h-full object-contain"
            />

            {/* Image counter */}
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/50 text-white px-4 py-2 rounded-full text-sm">
              {currentIndex + 1} / {imageUrls.length}
            </div>
          </div>

          {/* Next button */}
          {imageUrls.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                goToNext();
              }}
              className="absolute right-4 z-50 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              aria-label="Next image"
            >
              <ChevronRight className="w-8 h-8" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
