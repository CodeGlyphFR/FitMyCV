"use client";
import React, { useState, useRef } from "react";
import { useHighlight } from "./HighlightProvider";
import ChangeReviewPopover from "./ChangeReviewPopover";

/**
 * Composant pour surligner un item individuel de skill (ajouté/supprimé)
 * Utilisé pour les hard_skills, soft_skills, tools, methodologies
 *
 * Usage:
 * <SkillItemHighlight section="skills" field="hard_skills" itemName="Python">
 *   <span>Python</span>
 * </SkillItemHighlight>
 */
export default function SkillItemHighlight({
  children,
  section,
  field,
  itemName,
  expIndex, // Optionnel: index de l'expérience pour les skills_used dans experience
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

  // Trouver le changement correspondant à CET item spécifique
  const change = pendingChanges.find((c) => {
    if (c.section !== section || c.field !== field) return false;
    if (c.itemName?.toLowerCase() !== itemName?.toLowerCase()) return false;
    // Si expIndex est fourni, vérifier qu'il correspond
    if (expIndex !== undefined && c.expIndex !== undefined && c.expIndex !== expIndex) return false;
    return true;
  });

  // Déterminer si on doit afficher la surbrillance
  const isPending = change?.status === "pending";
  const shouldHighlight = isLatestVersion && isPending;

  // Si pas de surbrillance, afficher le contenu normalement
  if (!shouldHighlight) {
    return <span className={className}>{children}</span>;
  }

  const isAdded = change?.changeType === "added";
  const isRemoved = change?.changeType === "removed";

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

  return (
    <>
      <span
        ref={highlightRef}
        onClick={handleClick}
        className={`relative inline cursor-pointer transition-all duration-200 ${
          isAdded
            ? "text-emerald-300 bg-emerald-500/20 rounded"
            : isRemoved
            ? "line-through text-red-400/70 bg-red-500/10 rounded font-semibold"
            : ""
        } ${className}`}
      >
        {children}
      </span>

      {/* Popover de review */}
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
 * Composant pour afficher les items supprimés
 * Ces items ne sont plus dans le tableau actuel mais doivent être affichés barrés
 * Le rendu s'adapte au type de champ (hard_skills, tools avec niveau, soft_skills/methodologies en tags)
 */
export function RemovedSkillsDisplay({ section, field, expIndex }) {
  const { pendingChanges, isLatestVersion } = useHighlight();

  if (!isLatestVersion) return null;

  // Filtrer les items supprimés pour cette section/field (et expIndex si fourni)
  const removedItems = pendingChanges.filter((c) => {
    if (c.section !== section || c.field !== field) return false;
    if (c.changeType !== "removed" || c.status !== "pending") return false;
    // Si expIndex est fourni, vérifier qu'il correspond
    if (expIndex !== undefined && c.expIndex !== undefined && c.expIndex !== expIndex) return false;
    return true;
  });

  if (removedItems.length === 0) return null;

  // Pour soft_skills, methodologies et skills_used, afficher comme tags inline
  const isTagStyle = field === "soft_skills" || field === "methodologies" || field === "skills_used";

  return (
    <>
      {removedItems.map((change, i) => (
        isTagStyle ? (
          // Tags inline (soft_skills, methodologies, skills_used)
          <SkillItemHighlight
            key={`removed-${change.id || i}`}
            section={section}
            field={field}
            itemName={change.itemName}
            expIndex={expIndex}
          >
            <span className="inline-block rounded border border-white/15 px-1.5 py-0.5 text-[11px] opacity-90">
              {change.itemName}
            </span>
          </SkillItemHighlight>
        ) : (
          // Hard skills et tools - wrapper dans un div comme les skills existants
          <div key={`removed-${change.id || i}`} className="text-sm">
            <SkillItemHighlight
              section={section}
              field={field}
              itemName={change.itemName}
              expIndex={expIndex}
            >
              <span className="font-semibold">{change.itemName}</span>
            </SkillItemHighlight>
          </div>
        )
      ))}
    </>
  );
}
