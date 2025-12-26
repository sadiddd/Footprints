"use client";

import { useState } from "react";
import { Camera, MapPin, FileText, X, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "aws-amplify/auth";
import { processImageFiles, isHeicFile } from "@/utils/imageConversion";

export default function AddTrip() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [visibility, setVisibility] = useState("public");
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
      // Always turn off loading when done
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
      const tripId = crypto.randomUUID();

      let imageUrls: string[] = [];

      // Only upload images if there are any
      if (images.length > 0) {
        // Step 1: Get presigned URLs for all images
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

        // Step 2: Upload all images to S3 in parallel
        const uploadResults = await Promise.all(
          uploadUrls.map(async (urlData: any, index: number) => {
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

            return urlData.imageUrl;
          })
        );

        // Extract the final image URLs
        imageUrls = uploadUrls.map((urlData: any) => urlData.imageUrl);
        console.log("Image keys being stored in DynamoDB:", imageUrls);
      }

      // Step 3: Create trip in DynamoDB
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/Trips`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          UserID: userId,
          TripID: tripId,
          Title: title,
          Location: location,
          Description: description,
          StartDate: startDate || null,
          EndDate: endDate || null,
          Visibility: visibility,
          ImageUrls: imageUrls,
          CreatedAt: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create trip: ${response.statusText}`);
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
            Create New Trip
          </h1>
          <p className="text-base-content/70 text-lg">
            Capture your adventure and share your memories
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

              {/* Loading Indicator */}
              {loading && (
                <div className="flex items-center justify-center p-6 bg-base-300 rounded-xl border-2 border-accent shadow-lg">
                  <span className="loading loading-spinner loading-lg text-accent mr-4"></span>
                  <span className="text-base-content font-medium text-lg">
                    Converting images...
                  </span>
                </div>
              )}

              {/* Image Previews */}
              {imagePreviews.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {imagePreviews.map((preview, index) => (
                    <div
                      key={index}
                      className="relative group aspect-square rounded-xl overflow-hidden bg-base-300"
                    >
                      <img
                        src={preview}
                        alt={`Preview ${index + 1}`}
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
              <label
                className={`btn btn-outline btn-accent btn-lg w-full gap-3 cursor-pointer hover:scale-[1.02] transition-transform ${
                  loading ? "opacity-50 pointer-events-none" : ""
                }`}
              >
                <Upload className="w-5 h-5" />
                {imagePreviews.length === 0
                  ? "Upload Photos"
                  : `Add More Photos (${imagePreviews.length} selected)`}
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
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Summer in Paris"
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
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g., Paris, France"
                className="input input-bordered input-lg w-full bg-base-100 text-base-content focus:input-accent transition-all"
                required
              />
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
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
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
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate}
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
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Tell us about your trip... What made it special?"
                rows={6}
                className="textarea textarea-bordered textarea-lg w-full bg-base-100 text-base-content focus:textarea-accent transition-all resize-none leading-relaxed"
                required
              />
              <p className="text-sm text-base-content/60">
                Share your favorite moments, tips, or recommendations
              </p>
            </div>

            {/* Privacy Settings */}
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-lg font-semibold text-base-content">
                <FileText className="w-5 h-5 text-accent" />
                Privacy
              </label>
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value)}
                className="select select-bordered select-lg w-full bg-base-100 text-base-content focus:select-accent transition-all"
              >
                <option value="public">
                  Public - Anyone can view this trip
                </option>
                <option value="private">
                  Private - Only you can view this trip
                </option>
              </select>
              <p className="text-sm text-base-content/60">
                You can change this setting later
              </p>
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
                    Creating Trip...
                  </>
                ) : (
                  "Create Trip"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
