"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider, usePostHog } from "posthog-js/react";
import { useSession } from "next-auth/react";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, Suspense } from "react";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST;

if (typeof window !== "undefined" && POSTHOG_KEY && process.env.NODE_ENV === "production") {
  posthog.init(POSTHOG_KEY, {
    api_host: "/t",
    ui_host: POSTHOG_HOST,
    cross_subdomain_cookie: true,
    capture_pageview: false,
    capture_pageleave: true,
    disable_session_recording: true,
    before_send: (event) => {
      if (window.location.pathname.startsWith("/admin")) {
        return null;
      }
      return event;
    },
  });
}

function PostHogIdentifier() {
  const { data: session, status } = useSession();
  const ph = usePostHog();
  const identifiedRef = useRef(null);

  useEffect(() => {
    if (!ph || status === "loading") return;

    if (session?.user?.id) {
      if (identifiedRef.current !== session.user.id) {
        ph.identify(session.user.id, {
          email: session.user.email,
          name: session.user.name,
        });
        identifiedRef.current = session.user.id;
      }
    } else if (status === "unauthenticated" && identifiedRef.current) {
      ph.reset();
      identifiedRef.current = null;
    }
  }, [session, status, ph]);

  return null;
}

function PageviewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const ph = usePostHog();

  useEffect(() => {
    if (pathname && ph) {
      let url = window.origin + pathname;
      const params = searchParams.toString();
      if (params) url += "?" + params;
      ph.capture("$pageview", { $current_url: url });
    }
  }, [pathname, searchParams, ph]);

  return null;
}

export default function PostHogProvider({ children }) {
  if (!POSTHOG_KEY || process.env.NODE_ENV !== "production") {
    return <>{children}</>;
  }

  return (
    <PHProvider client={posthog}>
      <PostHogIdentifier />
      <Suspense fallback={null}>
        <PageviewTracker />
      </Suspense>
      {children}
    </PHProvider>
  );
}
