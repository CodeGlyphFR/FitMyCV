"use client";
import React from "react";

export default function StarRating({ rating, setRating }) {
  const [hoverRating, setHoverRating] = React.useState(0);

  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => setRating(star)}
          onMouseEnter={() => setHoverRating(star)}
          onMouseLeave={() => setHoverRating(0)}
          className="text-3xl transition-transform duration-150 hover:scale-110 focus:outline-hidden"
          aria-label={`${star} étoile${star > 1 ? 's' : ''}`}
        >
          <span className={
            star <= (hoverRating || rating)
              ? "text-amber-300 drop-shadow"
              : "text-white/30 drop-shadow"
          }>
            ★
          </span>
        </button>
      ))}
    </div>
  );
}
