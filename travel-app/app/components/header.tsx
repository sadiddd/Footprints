"use client";

import {
  Map,
  LogInIcon,
  LogOutIcon,
  Footprints,
  User,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { getCurrentUser, signOut, fetchUserAttributes } from "aws-amplify/auth";
import { Hub } from "aws-amplify/utils";
import { useRouter } from "next/navigation";

export default function Header() {
  const [user, setUser] = useState<{ name?: string; email: string } | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    checkUser();

    // Listen for auth events from Amplify Hub
    const hubListener = Hub.listen("auth", ({ payload }) => {
      switch (payload.event) {
        case "signedIn":
        case "signedOut":
          checkUser();
          break;
      }
    });

    return () => hubListener();
  }, []);

  const checkUser = async () => {
    try {
      const currentUser = await getCurrentUser();
      const attributes = await fetchUserAttributes();
      setUser({
        email: attributes.email || currentUser.signInDetails?.loginId || "",
        name: attributes.name,
      });
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      setUser(null);
      router.push("/");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <nav className="fixed top-0 w-full z-[1000] bg-neutral backdrop-blur-sm border-b border-primary-content/20">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 group">
              <Footprints className="h-6 w-6 text-accent transition-transform group-hover:rotate-12" />
              <span className="text-xl font-serif font-bold text-primary-content">
                Footprints
              </span>
            </Link>
            <Link href="/browse" className="btn btn-accent">
              <Search className="h-4 w-4" />
              Browse Trips
            </Link>
          </div>

          <div className="flex items-center gap-4">
            {!loading && user ? (
              <>
                <Link
                  href="/trips"
                  className="btn btn-accent flex items-center gap-2"
                >
                  <Map className="h-4 w-4" />
                  My Trips
                </Link>
                <div className="flex items-center gap-2 text-primary-content">
                  <User className="h-4 w-4" />
                  <span className="hidden sm:inline">
                    {user.name || user.email}
                  </span>
                </div>
                <button
                  onClick={handleSignOut}
                  className="btn btn-ghost btn-sm"
                >
                  <LogOutIcon className="h-4 w-4" />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              </>
            ) : !loading ? (
              <Link href="/auth" className="btn btn-accent">
                <LogInIcon className="h-4 w-4" />
                Sign In
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </nav>
  );
}
