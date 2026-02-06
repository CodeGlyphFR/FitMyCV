import { useState, useEffect, useRef } from 'react';

/**
 * Hook pour animer le score avec un effet count-up
 * @param {boolean} isOpen - Si le modal est ouvert
 * @param {number|null} targetScore - Score cible à animer
 * @param {number} duration - Durée de l'animation en ms (défaut: 1500)
 */
export function useAnimatedScore(isOpen, targetScore, duration = 1500) {
  const [animatedScore, setAnimatedScore] = useState(0);
  const animationRef = useRef(null);

  useEffect(() => {
    if (isOpen && targetScore !== null) {
      const startTime = Date.now();

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing function (ease-out cubic)
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const currentScore = Math.round(easeOut * targetScore);

        setAnimatedScore(currentScore);

        if (progress < 1) {
          animationRef.current = requestAnimationFrame(animate);
        }
      };

      animationRef.current = requestAnimationFrame(animate);

      return () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      };
    } else {
      setAnimatedScore(0);
    }
  }, [isOpen, targetScore, duration]);

  return animatedScore;
}
