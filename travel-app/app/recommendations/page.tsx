"use client";

import { useState } from "react";
import { Sparkles, MapPin, Compass, RefreshCw } from "lucide-react";
import { getCurrentUser } from "aws-amplify/auth";

type Recommendation = {
  city: string;
  country: string;
  reason: string;
};

type Status = "idle" | "loading" | "error" | "loaded";

export default function Recommendations() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [similar, setSimilar] = useState<Recommendation[]>([]);
  const [different, setDifferent] = useState<Recommendation[]>([]);

  async function getRecommendations() {
    setStatus("loading");
    setError(null);
    try {
      const { userId } = await getCurrentUser();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/recommendations`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
        },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSimilar(data.similarTrips ?? []);
      setDifferent(data.differentTrips ?? []);
      setStatus("loaded");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setStatus("error");
    }
  }

  return (
    <div className="min-h-screen bg-base-100">
      <div className="pt-24 pb-20">
        <div className="container mx-auto px-4 sm:px-6">
          {/* Header */}
          <div className="mb-12">
            <h1 className="text-4xl sm:text-5xl font-serif font-bold mb-2 text-base-content">
              Recommendations
            </h1>
            <p className="text-lg text-base-content/70">
              Discover destinations picked just for you, based on your travel
              history.
            </p>
          </div>

          {/* Idle: empty state with CTA */}
          {status === "idle" && (
            <div className="card bg-base-200 shadow-xl">
              <div className="card-body items-center text-center p-12">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Sparkles className="h-10 w-10 text-primary" />
                </div>
                <h3 className="card-title text-2xl font-serif">
                  Ready for your next adventure?
                </h3>
                <p className="text-base-content/70 max-w-md">
                  We&apos;ll look at the trips you&apos;ve already taken and
                  suggest a handful of destinations we think you&apos;ll love.
                </p>
                <button
                  onClick={getRecommendations}
                  className="btn btn-primary btn-lg gap-2 mt-4"
                >
                  <Sparkles className="h-5 w-5" />
                  Get My Recommendations
                </button>
              </div>
            </div>
          )}

          {/* Loading */}
          {status === "loading" && (
            <div className="card bg-base-200 shadow-xl">
              <div className="card-body items-center text-center p-12">
                <span className="loading loading-spinner loading-lg text-accent"></span>
                <p className="mt-4 text-base-content/70">
                  Consulting your travel history...
                </p>
              </div>
            </div>
          )}

          {/* Error */}
          {status === "error" && (
            <div className="space-y-4">
              <div className="alert alert-error">
                <span>
                  Could not load recommendations
                  {error ? `: ${error}` : ""}
                </span>
              </div>
              <button
                onClick={getRecommendations}
                className="btn btn-primary gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Try again
              </button>
            </div>
          )}

          {/* Loaded */}
          {status === "loaded" && (
            <div className="space-y-16">
              {/* Similar */}
              <section>
                <div className="flex items-center gap-3 mb-6">
                  <Sparkles className="h-6 w-6 text-primary" />
                  <h2 className="text-2xl sm:text-3xl font-serif font-bold text-base-content">
                    More like your style
                  </h2>
                </div>
                {similar.length > 0 ? (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
                    {similar.map((rec, i) => (
                      <RecommendationCard
                        key={`similar-${i}`}
                        rec={rec}
                        badgeLabel="Similar"
                        badgeClass="badge-primary"
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-base-content/60">
                    No similar recommendations were returned.
                  </p>
                )}
              </section>

              {/* Different */}
              <section>
                <div className="flex items-center gap-3 mb-6">
                  <Compass className="h-6 w-6 text-accent" />
                  <h2 className="text-2xl sm:text-3xl font-serif font-bold text-base-content">
                    Something a little different
                  </h2>
                </div>
                {different.length > 0 ? (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
                    {different.map((rec, i) => (
                      <RecommendationCard
                        key={`different-${i}`}
                        rec={rec}
                        badgeLabel="Adventurous"
                        badgeClass="badge-accent"
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-base-content/60">
                    No adventurous recommendations were returned.
                  </p>
                )}
              </section>

              {/* Re-roll */}
              <div className="flex justify-center">
                <button
                  onClick={getRecommendations}
                  className="btn btn-outline gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Get new recommendations
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RecommendationCard({
  rec,
  badgeLabel,
  badgeClass,
}: {
  rec: Recommendation;
  badgeLabel: string;
  badgeClass: string;
}) {
  return (
    <div className="card bg-base-100 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 border border-base-300">
      <div className="card-body">
        <div className="flex items-start gap-2">
          <MapPin className="h-5 w-5 mt-1 text-primary shrink-0" />
          <h3 className="card-title text-xl font-serif">
            {rec.city}
            {rec.country ? `, ${rec.country}` : ""}
          </h3>
        </div>
        {rec.reason && (
          <p className="text-base-content/70 mt-2">{rec.reason}</p>
        )}
        <div className="card-actions justify-end mt-4">
          <span className={`badge ${badgeClass}`}>{badgeLabel}</span>
        </div>
      </div>
    </div>
  );
}
