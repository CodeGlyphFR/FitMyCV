"use client";
import React, { useState, useRef } from "react";
import { useHighlight } from "./HighlightProvider";
import ChangeReviewPopover from "./ChangeReviewPopover";
import InlineDiff from "./InlineDiff";

/**
 * Composant pour surligner un bullet individuel (responsabilité/résultat)
 * Gère les types: added, removed, modified
 *
 * Usage:
 * <BulletHighlight
 *   section="experience"
 *   field="responsibilities"
 *   expIndex={0}
 *   bulletText="Développer des fonctionnalités..."
 * >
 *   <li>Développer des fonctionnalités...</li>
 * </BulletHighlight>
 */
export default function BulletHighlight({
  children,
  section,
  field,
  expIndex,
  bulletText,
  className = "",
}) {
  const [showPopover, setShowPopover] = useState(false);
  const highlightRef = useRef(null);

  const {
    pendingChanges,
    isLatestVersion,
    acceptChange,
    rejectChange,
  } = useHighlight();

  // Normaliser le texte pour comparaison
  const normalizeBullet = (text) => {
    if (!text || typeof text !== 'string') return '';
    return text.toLowerCase().trim().replace(/[.,:;!?]+$/, '').trim();
  };

  // Trouver le changement correspondant à CE bullet
  const change = pendingChanges.find((c) => {
    if (c.section !== section || c.field !== field) return false;
    if (c.expIndex !== expIndex) return false;

    // Comparer le texte du bullet
    const changeText = c.afterValue || c.itemValue || c.itemName || '';
    const targetText = bulletText || '';

    // Match par texte normalisé ou par début
    const normalizedChange = normalizeBullet(changeText);
    const normalizedTarget = normalizeBullet(targetText);

    return normalizedChange === normalizedTarget ||
           normalizedTarget.startsWith(normalizedChange.substring(0, 50)) ||
           normalizedChange.startsWith(normalizedTarget.substring(0, 50));
  });

  const isPending = change?.status === "pending";
  const shouldHighlight = isLatestVersion && isPending;

  if (!shouldHighlight) {
    return <>{children}</>;
  }

  const isAdded = change?.changeType === "added";
  const isRemoved = change?.changeType === "removed";
  const isModified = change?.changeType === "modified";

  const handleClick = (e) => {
    e.stopPropagation();
    setShowPopover(true);
  };

  const handleAccept = async () => {
    await acceptChange(change.id);
    setShowPopover(false);
  };

  const handleReject = async () => {
    await rejectChange(change.id);
    setShowPopover(false);
  };

  // Pour les bullets modifiés, afficher le diff inline
  if (isModified && change.beforeValue && change.afterValue) {
    return (
      <>
        <span
          ref={highlightRef}
          onClick={handleClick}
          className={`relative cursor-pointer inline ${className}`}
        >
          {/* Diff inline */}
          <InlineDiff
            beforeText={change.beforeValue}
            afterText={change.afterValue}
            showRemoved={true}
            className="leading-relaxed"
          />
        </span>

        {showPopover && (
          <ChangeReviewPopover
            change={change}
            onAccept={handleAccept}
            onReject={handleReject}
            onClose={() => setShowPopover(false)}
            anchorRef={highlightRef}
          />
        )}
      </>
    );
  }

  // Pour les bullets ajoutés/supprimés
  return (
    <>
      <span
        ref={highlightRef}
        onClick={handleClick}
        className={`relative cursor-pointer inline transition-all duration-200 ${
          isAdded
            ? "bg-emerald-500/15 hover:bg-emerald-500/25 rounded px-1 -mx-1"
            : isRemoved
            ? "bg-red-500/15 hover:bg-red-500/25 rounded px-1 -mx-1 line-through opacity-70"
            : ""
        } ${className}`}
      >
        {children}
      </span>

      {showPopover && (
        <ChangeReviewPopover
          change={change}
          onAccept={handleAccept}
          onReject={handleReject}
          onClose={() => setShowPopover(false)}
          anchorRef={highlightRef}
        />
      )}
    </>
  );
}

/**
 * Composant pour afficher les bullets supprimés d'une expérience
 * Ces bullets ne sont plus dans le tableau actuel mais doivent être affichés barrés
 * Rendus comme des <li> pour avoir le point de liste
 */
export function RemovedBulletsDisplay({ section, field, expIndex }) {
  const { pendingChanges, isLatestVersion } = useHighlight();

  if (!isLatestVersion) return null;

  // Filtrer les bullets supprimés pour cette expérience et ce field
  const removedBullets = pendingChanges.filter(
    (c) =>
      c.section === section &&
      c.field === field &&
      c.expIndex === expIndex &&
      c.changeType === "removed" &&
      c.status === "pending"
  );

  if (removedBullets.length === 0) return null;

  return (
    <>
      {removedBullets.map((change, i) => (
        <li key={`removed-${change.id || i}`}>
          <BulletHighlight
            section={section}
            field={field}
            expIndex={expIndex}
            bulletText={change.itemValue || change.beforeValue}
          >
            {change.itemValue || change.beforeValue || change.itemName}
          </BulletHighlight>
        </li>
      ))}
    </>
  );
}
