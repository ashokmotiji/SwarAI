"use client";

import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function NavAuth() {
  const { isSignedIn, isLoaded } = useAuth();
  if (!isLoaded) {
    return <div className="h-9 w-24 animate-pulse rounded-md bg-muted" />;
  }
  if (isSignedIn) {
    return (
      <Button asChild>
        <Link href="/dashboard">Dashboard</Link>
      </Button>
    );
  }
  return (
    <>
      <Button variant="ghost" asChild>
        <Link href="/sign-in">Sign in</Link>
      </Button>
      <Button asChild>
        <Link href="/sign-up">Start free</Link>
      </Button>
    </>
  );
}
