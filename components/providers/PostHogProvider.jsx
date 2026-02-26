"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider, usePostHog } from "posthog-js/react";
import { useSession } from "next-auth/react";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, Suspense } from "react";
import { getConsent, COOKIE_CATEGORIES } from "@/lib/cookies/consent";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST;

if (typeof window !== "undefined" && POSTHOG_KEY && process.env.NODE_ENV === "production") {
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    cross_subdomain_cookie: true,
    capture_pageview: false,
    capture_pageleave: true,
    disable_session_recording: true,
  });

  const consent = getConsent();
  if (consent && consent[COOKIE_CATEGORIES.ANALYTICS] === false) {
    posthog.opt_out_capturing();
  }
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

function ConsentListener() {
  const ph = usePostHog();

  useEffect(() => {
    if (!ph || typeof BroadcastChannel === "undefined") return;

    const channel = new BroadcastChannel("cookie_consent_channel");
    channel.addEventListener("message", (event) => {
      if (event.data?.type === "consent-updated") {
        const consent = event.data.consent;
        if (consent && consent[COOKIE_CATEGORIES.ANALYTICS] === true) {
          ph.opt_in_capturing();
        } else {
          ph.opt_out_capturing();
        }
      }
    });

    return () => channel.close();
  }, [ph]);

  return null;
}

export default function PostHogProvider({ children }) {
  if (!POSTHOG_KEY || process.env.NODE_ENV !== "production") {
    return <>{children}</>;
  }

  return (
    <PHProvider client={posthog}>
      <PostHogIdentifier />
      <ConsentListener />
      <Suspense fallback={null}>
        <PageviewTracker />
      </Suspense>
      {children}
    </PHProvider>
  );
}
