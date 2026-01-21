"use client";

import React from "react";
import { usePathname } from "next/navigation";
import TopBar from "@/components/TopBar";

/**
 * Error Boundary pour TopBar - Attrape les crashes et permet la récupération automatique
 */
class TopBarErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, retryCount: 0 };
    this.retryTimeoutRef = null;
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[TopBar] Error caught by boundary:', error, errorInfo);
  }

  componentWillUnmount() {
    if (this.retryTimeoutRef) {
      clearTimeout(this.retryTimeoutRef);
    }
  }

  handleRetry = () => {
    this.setState((prev) => ({
      hasError: false,
      retryCount: prev.retryCount + 1
    }));
  };

  render() {
    if (this.state.hasError) {
      // Auto-retry après un court délai (max 3 tentatives)
      if (this.state.retryCount < 3) {
        this.retryTimeoutRef = setTimeout(this.handleRetry, 1000);
      }

      // Afficher un placeholder pendant la récupération
      return (
        <div
          className="no-print fixed top-0 left-0 right-0 z-[10001] w-full bg-white/15 backdrop-blur-md ios-optimized-blur border-b border-white/20 min-h-[60px]"
          style={{
            paddingTop: 'env(safe-area-inset-top)',
            WebkitBackfaceVisibility: 'hidden',
            backfaceVisibility: 'hidden',
            WebkitTransform: 'translate3d(0, 0, 0)',
            transform: 'translate3d(0, 0, 0)',
            pointerEvents: 'auto'
          }}
        >
          <div className="w-full p-3 flex items-center">
            <span className="text-sm text-white/60 animate-pulse">Chargement...</span>
          </div>
        </div>
      );
    }

    return <TopBar key={`topbar-${this.state.retryCount}`} />;
  }
}

export default function ConditionalTopBar() {
  const pathname = usePathname();

  // Ne pas afficher la TopBar sur les pages d'authentification et admin
  if (pathname.startsWith("/auth") || pathname.startsWith("/admin")) {
    return null;
  }

  return (
    <TopBarErrorBoundary>
      <TopBar />
    </TopBarErrorBoundary>
  );
}
