"use client";

import { useEffect, useState } from "react";
import {
  Camera,
  MapPin,
  FileText,
  X,
  Upload,
  UnlockKeyholeIcon,
  LockIcon,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { getCurrentUser } from "aws-amplify/auth";
import { processImageFiles } from "@/utils/imageConversion";

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

export default function UpdateTrip() {
  const router = useRouter();
  const params = useParams();
  const tripId = params.id as string;

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
  const [loading, setLoading] = useState(true);
  const [trip, setTrip] = useState<Trip | null>(null);

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
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleSubmit = () => {};

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
                        // onClick={() => removeImage(index)}
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
                  ? "Upload Photos"
                  : `Add More Photos (${imagePreviews.length} selected)`}
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  // onChange={handleImageChange}
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
                value={trip?.Title}
                onChange={(e) => setTitle(e.target.value)}
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
                value={trip?.Location}
                onChange={(e) => setLocation(e.target.value)}
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
                  value={trip?.StartDate}
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
                  value={trip?.EndDate}
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
                value={trip?.Description}
                onChange={(e) => setDescription(e.target.value)}
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
                onChange={(e) => setVisibility(e.target.value)}
                className="select select-bordered select-lg w-full bg-base-100 text-base-content focus:select-accent transition-all"
              >
                <option value="public">
                  <UnlockKeyholeIcon />
                  Public - Anyone can view this trip
                </option>
                <option value="private">
                  <LockIcon />
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
