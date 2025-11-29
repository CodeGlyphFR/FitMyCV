'use client';

import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

/**
 * Background animé élégant - Framer Motion avancé
 * SSR-safe: Uses useState + useEffect to handle window.innerHeight
 */

// Factory function to create blobs based on viewport height
const createBlobs = (viewportHeight) => [
  {
    id: 1,
    initial: { x: 0, y: 0, scale: 1, opacity: 0 },
    position: { top: '10%', left: '5%' },
    size: viewportHeight * 0.6,
    gradient: 'radial-gradient(circle, rgba(14, 165, 233, 0.45) 0%, rgba(14, 165, 233, 0.25) 35%, transparent 65%)',
    blur: 70,
  },
  {
    id: 2,
    initial: { x: 0, y: 0, scale: 1, opacity: 0 },
    position: { top: '5%', right: '1%' },
    size: viewportHeight * 0.5,
    gradient: 'radial-gradient(circle, rgba(56, 189, 248, 0.42) 0%, rgba(56, 189, 248, 0.22) 35%, transparent 65%)',
    blur: 75,
  },
  {
    id: 3,
    initial: { x: 0, y: 0, scale: 1, opacity: 0 },
    position: { bottom: '1%', left: '15%' },
    size: viewportHeight * 0.4,
    gradient: 'radial-gradient(circle, rgba(14, 165, 233, 0.38) 0%, rgba(16, 185, 129, 0.18) 40%, transparent 65%)',
    blur: 80,
  },
];

const blobVariants = {
  animate: (i) => ({
    x: [
      0,
      Math.sin(i * 0.5) * 200,
      Math.cos(i * 0.7) * -150,
      Math.sin(i * 0.3) * 180,
      Math.cos(i * 0.9) * -120,
      0,
    ],
    y: [
      0,
      Math.cos(i * 0.6) * -180,
      Math.sin(i * 0.4) * 150,
      Math.cos(i * 0.8) * -100,
      Math.sin(i * 0.5) * 120,
      0,
    ],
    scale: [
      1,
      1 + Math.sin(i * 0.2) * 0.3,
      1 - Math.cos(i * 0.3) * 0.25,
      1 + Math.sin(i * 0.4) * 0.2,
      1 - Math.cos(i * 0.6) * 0.15,
      1,
    ],
    rotate: [
      0,
      Math.sin(i * 0.3) * 15,
      Math.cos(i * 0.5) * -10,
      Math.sin(i * 0.2) * 12,
      Math.cos(i * 0.4) * -8,
      0,
    ],
    opacity: [
      0.6,
      0.6 + Math.sin(i * 0.4) * 0.25,
      0.6 + Math.cos(i * 0.6) * 0.2,
      0.6 + Math.sin(i * 0.3) * 0.22,
      0.6 + Math.cos(i * 0.5) * 0.15,
      0.6,
    ],
    transition: {
      duration: 25 + i * 3,
      repeat: Infinity,
      ease: 'easeInOut',
      times: [0, 0.2, 0.4, 0.6, 0.8, 1],
    },
  }),
};

export default function GlobalBackground() {
  // Initialize with default height (600px fallback for SSR)
  const [blobs, setBlobs] = useState(() => createBlobs(600));

  useEffect(() => {
    // Update blobs with actual window height on client
    setBlobs(createBlobs(window.innerHeight));

    // Handle viewport resize for responsive behavior
    const handleResize = () => {
      setBlobs(createBlobs(window.innerHeight));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-0">
      {/* Base background */}
      <div className="absolute inset-0 bg-app-bg" />

      {/* Blobs animés avec variants avancés */}
      {blobs.map((blob, i) => (
        <motion.div
          key={blob.id}
          custom={i}
          variants={blobVariants}
          initial={blob.initial}
          animate="animate"
          className="absolute rounded-full"
          style={{
            ...blob.position,
            width: blob.size,
            height: blob.size,
            background: blob.gradient,
            filter: `blur(${blob.blur}px)`,
            willChange: 'transform, opacity',
          }}
        />
      ))}
    </div>
  );
}
