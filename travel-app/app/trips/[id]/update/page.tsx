"use client";

import { useEffect, useState } from "react";
import { Camera, MapPin, FileText, X, Upload, Trash2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { getCurrentUser } from "aws-amplify/auth";
import { processImageFiles, isHeicFile } from "@/utils/imageConversion";
import type { LocationPin } from "@/app/components/mapPicker";
import dynamic from "next/dynamic";

const MapPicker = dynamic(() => import("@/app/components/mapPicker"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[400px] bg-gray-100 flex items-center justify-center rounded-lg">
      <p className="text-gray-500">Loading map...</p>
    </div>
  ),
});

interface Trip {
  TripID: string;
  Title: string;
  Location: string;
  Description: string;
  StartDate: string;
  EndDate: string;
  Visibility: string;
  ImageUrls?: string[];
  Locations?: LocationPin[];
}

export default function UpdateTrip() {
  const router = useRouter();
  const params = useParams();
  const tripId = params.id as string;

  const [trip, setTrip] = useState<Trip>({
    TripID: tripId,
    Title: "",
    Location: "",
    Description: "",
    StartDate: "",
    EndDate: "",
    Visibility: "public",
    ImageUrls: [],
    Locations: [],
  });
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [locations, setLocations] = useState<LocationPin[]>([]);

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
      setTrip(data);

      // Set locations if they exist
      if (data.Locations && Array.isArray(data.Locations)) {
        setLocations(data.Locations);
      }

      if (data.ImageUrls && data.ImageUrls.length > 0) {
        await fetchImageUrls(data.ImageUrls);
      }

      setLoading(false);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Unknown error occurred";
      setError(errorMessage);
      setLoading(false);
    }
  };

  const fetchImageUrls = async (keys: string[]) => {
    setImagesLoading(true);
    try {
      console.log("Raw keys from trip data:", keys);

      // Extract just the S3 key from the stored URLs
      // If they're full URLs, extract the key; if they're already keys, use as-is
      const s3Keys = keys.map((key) => {
        if (!key.startsWith("http://") && !key.startsWith("https://")) {
          return key;
        }

        try {
          const urlObj = new URL(key);
          // Remove leading slash from pathname
          return urlObj.pathname.substring(1);
        } catch {
          // Fallback: try regex extraction
          const match = key.match(/amazonaws\.com\/([^?]+)/);
          if (match) {
            return decodeURIComponent(match[1]);
          }
          console.error("Could not extract S3 key from:", key);
          return key;
        }
      });

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/image-urls`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          imageUrls: s3Keys,
        }),
      });

      if (!res.ok) throw new Error("Failed to fetch image URLs");

      const data = await res.json();

      // Extract presigned URLs from the response
      const urls = data.imageUrls
        .filter((item: { presignedUrl?: string }) => item.presignedUrl)
        .map((item: { presignedUrl: string }) => item.presignedUrl);

      setImageUrls(urls);
    } catch (err) {
      console.error("Error fetching image URLs:", err);
    } finally {
      setImagesLoading(false);
    }
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Check if there are any HEIC files that need conversion
    const hasHeicFiles = files.some((file) => isHeicFile(file));

    // Show loading immediately if we have HEIC files to convert
    if (hasHeicFiles) {
      setLoading(true);
    }

    try {
      // Convert HEIC files to JPEG before adding
      const processedFiles = await processImageFiles(files);

      // Add new files to existing ones
      const newImages = [...images, ...processedFiles];
      setImages(newImages);

      // Create previews
      const newPreviews = processedFiles.map((file) =>
        URL.createObjectURL(file)
      );
      setImagePreviews([...imagePreviews, ...newPreviews]);
    } catch (err) {
      console.error("Error processing images:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to process images. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const removeImage = (index: number) => {
    // Revoke the URL to free memory
    URL.revokeObjectURL(imagePreviews[index]);

    setImages(images.filter((_, i) => i !== index));
    setImagePreviews(imagePreviews.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const currentUser = await getCurrentUser();
      const userId = currentUser.userId;

      // Start with existing image URLs from the trip
      let finalImageUrls: string[] = trip.ImageUrls || [];

      // Upload new images if any
      if (images.length > 0) {
        // Step 1: Get presigned URLs for all new images
        const fileNames = images.map((file) => file.name);
        const presignResponse = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/upload`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId,
              tripId,
              fileNames,
            }),
          }
        );

        if (!presignResponse.ok) {
          throw new Error("Failed to get upload URLs");
        }

        const { uploadUrls } = await presignResponse.json();

        // Step 2: Upload all new images to S3 in parallel
        await Promise.all(
          uploadUrls.map(
            async (
              urlData: { uploadUrl: string; imageUrl: string },
              index: number
            ) => {
              const file = images[index];
              console.log(`Uploading ${file.name} to:`, urlData.uploadUrl);

              const uploadResponse = await fetch(urlData.uploadUrl, {
                method: "PUT",
                headers: { "Content-Type": file.type },
                body: file,
              });

              console.log(
                `Upload response for ${file.name}:`,
                uploadResponse.status,
                uploadResponse.statusText
              );

              if (!uploadResponse.ok) {
                throw new Error(
                  `Failed to upload ${file.name}: ${uploadResponse.status} ${uploadResponse.statusText}`
                );
              }
            }
          )
        );

        // Extract new image URLs and append to existing ones
        const newImageUrls = uploadUrls.map(
          (urlData: { imageUrl: string }) => urlData.imageUrl
        );
        finalImageUrls = [...finalImageUrls, ...newImageUrls];
        console.log("Image keys being stored in DynamoDB:", finalImageUrls);
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/Trips`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          UserID: userId,
          ...trip,
          ImageUrls: finalImageUrls,
          Locations: locations,
          CreatedAt: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update trip: ${response.statusText}`);
      }

      router.push("/trips");
    } catch (err) {
      console.error("Error creating trip:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to create trip. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-base-100 pt-24 pb-12">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-serif font-bold text-base-content mb-3">
            Update Trip
          </h1>
          <p className="text-base-content/70 text-lg">
            Adjust or add to an existing trip
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-base-200 rounded-3xl p-6 sm:p-10 shadow-xl">
          {/* Error Message */}
          {error && (
            <div className="alert alert-error mb-6">
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Image Upload Section */}
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-lg font-semibold text-base-content">
                <Camera className="w-5 h-5 text-accent" />
                Photos
              </label>

              {/* Image Previews - Existing and New */}
              {(imageUrls.length > 0 || imagePreviews.length > 0) && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {/* Existing images */}
                  {imageUrls.map((url, index) => (
                    <div
                      key={`existing-${index}`}
                      className="relative group aspect-square rounded-xl overflow-hidden bg-base-300"
                    >
                      <img
                        src={url}
                        alt={`Existing ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-2 left-2 bg-blue-500 text-white text-xs px-2 py-1 rounded">
                        Existing
                      </div>
                    </div>
                  ))}
                  {/* New images */}
                  {imagePreviews.map((preview, index) => (
                    <div
                      key={`new-${index}`}
                      className="relative group aspect-square rounded-xl overflow-hidden bg-base-300"
                    >
                      <img
                        src={preview}
                        alt={`New ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute top-2 right-2 btn btn-circle btn-sm btn-error opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload Button */}
              <label className="btn btn-outline btn-accent btn-lg w-full gap-3 cursor-pointer hover:scale-[1.02] transition-transform">
                <Upload className="w-5 h-5" />
                {imagePreviews.length === 0
                  ? "Upload New Photos"
                  : `Add More Photos (${imagePreviews.length} new)`}
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
              </label>
            </div>

            {/* Title Input */}
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-lg font-semibold text-base-content">
                <FileText className="w-5 h-5 text-accent" />
                Trip Title
              </label>
              <input
                type="text"
                value={trip.Title}
                onChange={(e) =>
                  setTrip((prev) => ({ ...prev, Title: e.target.value }))
                }
                className="input input-bordered input-lg w-full bg-base-100 text-base-content focus:input-accent transition-all"
                required
              />
            </div>

            {/* Location Input */}
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-lg font-semibold text-base-content">
                <MapPin className="w-5 h-5 text-accent" />
                Location
              </label>
              <input
                type="text"
                value={trip.Location}
                onChange={(e) =>
                  setTrip((prev) => ({ ...prev, Location: e.target.value }))
                }
                className="input input-bordered input-lg w-full bg-base-100 text-base-content focus:input-accent transition-all"
                required
              />

              {/* Map Picker */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-base-content/70">
                    Click on the map to add locations to your trip
                  </p>
                  {locations.length > 0 && (
                    <span className="badge badge-accent badge-lg">
                      {locations.length} location
                      {locations.length !== 1 ? "s" : ""} added
                    </span>
                  )}
                </div>

                {/* Location List */}
                {locations.length > 0 && (
                  <div className="bg-base-300 rounded-xl p-4 space-y-2 max-h-40 overflow-y-auto">
                    {locations.map((loc, index) => (
                      <div
                        key={loc.id}
                        className="flex items-center justify-between bg-base-100 rounded-lg p-3"
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <span className="badge badge-accent">
                            {index + 1}
                          </span>
                          <input
                            type="text"
                            value={loc.label}
                            onChange={(e) => {
                              const newLocations = [...locations];
                              newLocations[index] = {
                                ...loc,
                                label: e.target.value,
                              };
                              setLocations(newLocations);
                            }}
                            placeholder="Location name"
                            className="input input-sm input-bordered flex-1 bg-base-100"
                          />
                          <span className="text-xs text-base-content/60">
                            {loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setLocations(
                              locations.filter((l) => l.id !== loc.id)
                            )
                          }
                          className="btn btn-sm btn-ghost btn-circle text-error"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <MapPicker
                  locations={locations}
                  onLocationsChange={setLocations}
                />
              </div>
            </div>

            {/* Date Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-lg font-semibold text-base-content">
                  <FileText className="w-5 h-5 text-accent" />
                  Start Date
                </label>
                <input
                  type="date"
                  value={trip.StartDate}
                  onChange={(e) =>
                    setTrip((prev) => ({ ...prev, StartDate: e.target.value }))
                  }
                  className="input input-bordered input-lg w-full bg-base-100 text-base-content focus:input-accent transition-all"
                />
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-2 text-lg font-semibold text-base-content">
                  <FileText className="w-5 h-5 text-accent" />
                  End Date
                </label>
                <input
                  type="date"
                  value={trip.EndDate}
                  onChange={(e) =>
                    setTrip((prev) => ({ ...prev, EndDate: e.target.value }))
                  }
                  min={trip.StartDate}
                  className="input input-bordered input-lg w-full bg-base-100 text-base-content focus:input-accent transition-all"
                />
              </div>
            </div>

            {/* Description Textarea */}
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-lg font-semibold text-base-content">
                <FileText className="w-5 h-5 text-accent" />
                Description
              </label>
              <textarea
                value={trip.Description}
                onChange={(e) =>
                  setTrip((prev) => ({ ...prev, Description: e.target.value }))
                }
                rows={6}
                className="textarea textarea-bordered textarea-lg w-full bg-base-100 text-base-content focus:textarea-accent transition-all resize-none leading-relaxed"
                required
              />
            </div>

            {/* Privacy Settings */}
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-lg font-semibold text-base-content">
                <FileText className="w-5 h-5 text-accent" />
                Privacy
              </label>
              <select
                value={trip?.Visibility}
                onChange={(e) =>
                  setTrip((prev) => ({ ...prev, Visibility: e.target.value }))
                }
                className="select select-bordered select-lg w-full bg-base-100 text-base-content focus:select-accent transition-all"
              >
                <option value="public">
                  Public - Anyone can view this trip
                </option>
                <option value="private">
                  Private - Only you can view this trip
                </option>
              </select>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 pt-6">
              <button
                type="button"
                onClick={() => router.back()}
                className="btn btn-outline btn-lg flex-1"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-accent btn-lg flex-1 shadow-lg hover:scale-[1.02] transition-transform"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <span className="loading loading-spinner"></span>
                    Updating Trip...
                  </>
                ) : (
                  "Update Trip"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
