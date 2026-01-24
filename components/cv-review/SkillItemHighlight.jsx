"use client";
import React, { useState, useRef } from "react";
import { useHighlight } from "@/components/providers/HighlightProvider";
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
  const isLevelAdjusted = change?.changeType === "level_adjusted";
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

  return (
    <>
      <span
        ref={highlightRef}
        onClick={handleClick}
        className={`relative inline cursor-pointer transition-all duration-200 ${
          isAdded
            ? "text-emerald-300 bg-emerald-500/20 rounded"
            : isRemoved
            ? "text-red-400 bg-red-500/15 rounded px-1 italic"
            : isLevelAdjusted || isModified
            ? "text-amber-300 bg-amber-500/20 rounded"
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
 * Hook pour récupérer les items supprimés pour une section/field
 */
export function useRemovedItems(section, field, expIndex) {
  const { pendingChanges, isLatestVersion } = useHighlight();

  if (!isLatestVersion) return [];

  return pendingChanges.filter((c) => {
    if (c.section !== section || c.field !== field) return false;
    if (c.changeType !== "removed" || c.status !== "pending") return false;
    if (expIndex !== undefined && c.expIndex !== undefined && c.expIndex !== expIndex) return false;
    return true;
  });
}

/**
 * Composant pour afficher les items supprimés de manière condensée
 * Affiche : "X éléments supprimés : Skill1, Skill2, Skill3"
 * Chaque skill est cliquable pour review individuel
 */
export function RemovedSkillsDisplay({ section, field, expIndex }) {
  const removedItems = useRemovedItems(section, field, expIndex);

  if (removedItems.length === 0) return null;

  return (
    <div className="w-full mt-2 text-sm text-red-400/80">
      <span className="font-medium italic">Supprimé : </span>
      {removedItems.map((change, i) => (
        <span key={`removed-${change.id || i}`}>
          <SkillItemHighlight
            section={section}
            field={field}
            itemName={change.itemName}
            expIndex={expIndex}
          >
            <span className="cursor-pointer hover:text-red-300 transition-colors">
              {change.itemName}
            </span>
          </SkillItemHighlight>
          {i < removedItems.length - 1 && <span className="text-white/50">, </span>}
        </span>
      ))}
    </div>
  );
}

/**
 * Composant pour afficher les skills supprimés comme des badges individuels
 * Utilisé UNIQUEMENT pour les expériences (skills_used)
 */
export function RemovedSkillsBadges({ section, field, expIndex, badgeClassName }) {
  const removedItems = useRemovedItems(section, field, expIndex);

  if (removedItems.length === 0) return null;

  return (
    <>
      {removedItems.map((change) => (
        <SkillItemHighlight
          key={`removed-${change.id}`}
          section={section}
          field={field}
          itemName={change.itemName}
          expIndex={expIndex}
        >
          <span className={badgeClassName}>
            {change.itemName}
          </span>
        </SkillItemHighlight>
      ))}
    </>
  );
}

/**
 * Composant bloc pour afficher les items supprimés avec un titre (format liste)
 * Utilisé quand tous les items d'une catégorie ont été supprimés
 * Affiche le bloc uniquement s'il y a des items à afficher
 */
export function RemovedSkillsDisplayBlock({ field, title }) {
  const removedItems = useRemovedItems("skills", field, undefined);

  // Ne rien afficher s'il n'y a pas d'items supprimés
  if (removedItems.length === 0) return null;

  return (
    <div className="w-full rounded-2xl border border-red-500/20 bg-red-500/5 p-3">
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-semibold text-red-400/80">{title}</h3>
      </div>
      <RemovedSkillsDisplay section="skills" field={field} />
    </div>
  );
}

/**
 * Composant bloc pour afficher les items supprimés avec un titre (format badges)
 * Utilisé pour les soft skills quand tous ont été supprimés
 */
export function RemovedSkillsBadgesBlock({ field, title, badgeClassName }) {
  const removedItems = useRemovedItems("skills", field, undefined);

  // Ne rien afficher s'il n'y a pas d'items supprimés
  if (removedItems.length === 0) return null;

  return (
    <div>
      <div className="flex flex-wrap gap-1">
        <RemovedSkillsBadges
          section="skills"
          field={field}
          badgeClassName={badgeClassName}
        />
      </div>
    </div>
  );
}
