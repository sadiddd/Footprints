"use client";

import { signIn, signUp, confirmSignUp } from "aws-amplify/auth";
import "@aws-amplify/ui-react/styles.css";

import { Footprints } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Auth() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isSignUp) {
        await signUp({
          username: email,
          password,
          options: {
            userAttributes: {
              email,
              name,
            },
          },
        });
        setNeedsVerification(true);
      } else {
        await signIn({
          username: email,
          password,
        });
        // Small delay to ensure auth state is propagated
        await new Promise((resolve) => setTimeout(resolve, 100));
        router.push("/");
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "An error occurred";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await confirmSignUp({
        username: email,
        confirmationCode: verificationCode,
      });
      alert("Email verified! You can now sign in.");
      setNeedsVerification(false);
      setIsSignUp(false);
      setVerificationCode("");
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Verification failed";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (needsVerification) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center p-4 pt-24">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <Footprints className="w-16 h-16 mx-auto mb-4 text-primary" />
            <h1 className="text-4xl font-serif text-base-content mb-2">
              Verify Your Email
            </h1>
            <p className="text-base-content/70">
              We sent a verification code to {email}
            </p>
          </div>

          <fieldset className="fieldset bg-base-100 border-base-300 rounded-box w-full border p-6 shadow-xl">
            <legend className="fieldset-legend text-xl font-serif">
              Enter Code
            </legend>

            <form onSubmit={handleVerification} className="space-y-4">
              {error && (
                <div className="alert alert-error">
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="label">
                  <span className="label-text">Verification Code</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered w-full"
                  placeholder="123456"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  required
                />
              </div>

              <button
                type="submit"
                className="btn btn-accent w-full mt-6"
                disabled={loading}
              >
                {loading ? "Verifying..." : "Verify Email"}
              </button>

              <button
                type="button"
                className="btn btn-ghost w-full"
                onClick={() => setNeedsVerification(false)}
              >
                Back to Sign In
              </button>
            </form>
          </fieldset>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-200 flex items-center justify-center p-4 pt-24">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Footprints className="w-16 h-16 mx-auto mb-4 text-primary" />
          <h1 className="text-4xl font-serif text-base-content mb-2">
            Footprints
          </h1>
          <p className="text-base-content/70">Your adventures await</p>
        </div>

        <div className="flex justify-center gap-2 mb-6">
          <button
            className={`btn ${!isSignUp ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setIsSignUp(false)}
          >
            Sign In
          </button>
          <button
            className={`btn ${isSignUp ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setIsSignUp(true)}
          >
            Sign Up
          </button>
        </div>

        <fieldset className="fieldset bg-base-100 border-base-300 rounded-box w-full border p-6 shadow-xl">
          <legend className="fieldset-legend text-xl font-serif">
            {isSignUp ? "Create Account" : "Login"}
          </legend>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="alert alert-error">
                <span>{error}</span>
              </div>
            )}

            {isSignUp && (
              <>
                <div className="mb-2 text-sm text-base-content/70">
                  We will send a code to verify your account
                </div>
                <div>
                  <label className="label">
                    <span className="label-text">Name</span>
                  </label>
                  <input
                    type="text"
                    className="input input-bordered w-full"
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
              </>
            )}

            <div>
              <label className="label">
                <span className="label-text">Email</span>
              </label>
              <input
                type="email"
                className="input input-bordered w-full"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="label">
                <span className="label-text">Password</span>
              </label>
              <input
                type="password"
                className="input input-bordered w-full"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>

            <button
              type="submit"
              className="btn btn-accent w-full mt-6"
              disabled={loading}
            >
              {loading ? "Loading..." : isSignUp ? "Create Account" : "Sign In"}
            </button>
          </form>
        </fieldset>
      </div>
    </div>
  );
}
