"use client";
import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useReview } from "@/components/providers/ReviewProvider";
import ChangeReviewPopover from "./ChangeReviewPopover";
import SkillsReviewActions from "@/components/cv-review/SkillsReviewActions";
import { Info } from "lucide-react";

/**
 * Composant pour surligner un item individuel de skill (ajouté/supprimé)
 * Utilisé pour les hard_skills, soft_skills, tools, methodologies
 *
 * Usage:
 * <SkillItemHighlight section="skills" field="hard_skills" itemName="Python">
 *   <span>Python</span>
 * </SkillItemHighlight>
 */
/**
 * Composant InfoButton - Bouton "i" pour afficher la raison d'un skill "kept"
 */
function InfoButton({ onClick, position, buttonRef }) {
  if (position === "corner") {
    return (
      <button
        ref={buttonRef}
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 z-10"
      >
        <Info className="w-3.5 h-3.5 text-blue-400 hover:text-blue-300 transition-colors" />
      </button>
    );
  }
  // Position "inline" - après le texte
  return (
    <button
      ref={buttonRef}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="inline-flex items-center ml-1"
    >
      <Info className="w-3.5 h-3.5 text-blue-400 hover:text-blue-300 transition-colors" />
    </button>
  );
}

/**
 * Composant InfoPopover - Popover simple pour afficher la raison (sans boutons review)
 */
function InfoPopover({ reason, onClose, anchorRef }) {
  const popoverRef = useRef(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    const updatePosition = () => {
      if (!anchorRef?.current) return;
      const rect = anchorRef.current.getBoundingClientRect();
      const popoverWidth = 256; // max-w-xs = 20rem = 320px, mais on prend une marge
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Position verticale : sous le bouton (fixed = relatif au viewport, pas de scrollY)
      let top = rect.bottom + 8;

      // Si le popover dépasse en bas, le mettre au-dessus
      if (top + 100 > viewportHeight) {
        top = rect.top - 8 - 100; // Approximation de la hauteur du popover
      }

      // Position horizontale : aligné à gauche du bouton
      let left = rect.left;

      // Si le popover dépasse à droite, le décaler
      if (left + popoverWidth > viewportWidth - 16) {
        left = viewportWidth - popoverWidth - 16;
      }

      // S'assurer qu'il ne dépasse pas à gauche
      if (left < 16) {
        left = 16;
      }

      setPosition({ top, left });
    };

    updatePosition();

    // Recalculer lors du scroll ou resize
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [anchorRef]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={popoverRef}
      style={{ top: position.top, left: position.left }}
      className="fixed z-50 max-w-xs p-3 rounded-lg bg-slate-800 border border-white/10 shadow-xl"
    >
      <p className="text-sm text-white/90">{reason}</p>
    </div>,
    document.body
  );
}

export default function SkillItemHighlight({
  children,
  section,
  field,
  itemName,
  expIndex, // Optionnel: index de l'expérience pour les skills_used dans experience
  allowRemovedType = false, // Si true, permet le highlight des skills "removed" (utilisé par RemovedSkillsDisplay)
  className = "",
  infoPosition = null, // "inline" | "corner" | null - Position du bouton info pour les skills "kept"
}) {
  const [showPopover, setShowPopover] = useState(false);
  const [showInfoPopover, setShowInfoPopover] = useState(false);
  const highlightRef = useRef(null);
  const infoRef = useRef(null);

  const {
    pendingChanges,
    keptSkillReasons,
    isLatestVersion,
    acceptChange,
    rejectChange,
  } = useReview();

  // Trouver le changement correspondant à CET item spécifique
  const change = pendingChanges.find((c) => {
    if (c.section !== section || c.field !== field) return false;
    if (c.itemName?.toLowerCase() !== itemName?.toLowerCase()) return false;
    // Ignorer les changements "removed" sauf si allowRemovedType est true
    // Les skills supprimés sont gérés exclusivement par RemovedSkillsDisplay
    if (c.changeType === "removed" && !allowRemovedType) return false;
    // Si expIndex est fourni, vérifier qu'il correspond
    if (expIndex !== undefined && c.expIndex !== undefined && c.expIndex !== expIndex) return false;
    return true;
  });

  // Déterminer si on doit afficher la surbrillance
  const isPending = change?.status === "pending";
  const shouldHighlight = isLatestVersion && isPending;

  // Vérifier si ce skill a une raison "kept" (pour le bouton info)
  const keptReason = keptSkillReasons?.[field]?.find(
    k => k.name?.toLowerCase() === itemName?.toLowerCase()
  )?.reason;

  // Vérifier s'il reste des changements pending dans la section skills
  // Le bouton info n'est affiché que tant qu'il y a des changements à reviewer
  const hasSkillsPending = pendingChanges.some(
    c => c.section === "skills" && c.status === "pending"
  );

  // Afficher le bouton info seulement si:
  // - Il y a une raison "kept" ET
  // - infoPosition est défini ET
  // - Il reste des changements pending dans la section skills ET
  // - Ce skill n'est PAS en cours de highlight (pas pending)
  const showInfoButton = infoPosition && keptReason && hasSkillsPending && !shouldHighlight && isLatestVersion;

  // Si pas de surbrillance ET pas de bouton info, afficher le contenu normalement
  if (!shouldHighlight && !showInfoButton) {
    return <span className={className}>{children}</span>;
  }

  const isAdded = change?.changeType === "added";
  const isRemoved = change?.changeType === "removed";
  const isLevelAdjusted = change?.changeType === "level_adjusted";
  const isModified = change?.changeType === "modified";
  const isMultiRenamed = change?.changeType === "multi_renamed";

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

  // Cas: uniquement le bouton info (pas de highlight)
  if (!shouldHighlight && showInfoButton) {
    return (
      <>
        <span className={`${infoPosition === "corner" ? "relative inline-block" : ""} ${className}`}>
          {children}
          {infoPosition === "corner" && (
            <InfoButton
              onClick={() => setShowInfoPopover(true)}
              position="corner"
              buttonRef={infoRef}
            />
          )}
        </span>
        {infoPosition === "inline" && (
          <InfoButton
            onClick={() => setShowInfoPopover(true)}
            position="inline"
            buttonRef={infoRef}
          />
        )}
        {showInfoPopover && (
          <InfoPopover
            reason={keptReason}
            onClose={() => setShowInfoPopover(false)}
            anchorRef={infoRef}
          />
        )}
      </>
    );
  }

  // Cas: highlight normal (avec ou sans bouton info)
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
            : isLevelAdjusted || isModified || isMultiRenamed
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
          showBeforeText={isModified && !isMultiRenamed}
        />
      )}
    </>
  );
}

/**
 * Hook pour récupérer les items supprimés pour une section/field
 */
export function useRemovedItems(section, field, expIndex) {
  const { pendingChanges, isLatestVersion } = useReview();

  if (!isLatestVersion) return [];

  return pendingChanges.filter((c) => {
    if (c.section !== section || c.field !== field) return false;
    if (c.changeType !== "removed" || c.status !== "pending") return false;
    if (expIndex !== undefined && c.expIndex !== undefined && c.expIndex !== expIndex) return false;
    return true;
  });
}

/**
 * Hook pour filtrer les items qui ont un changement "removed" en attente
 * Retourne les items qui ne sont PAS marqués comme supprimés
 *
 * @param {Array} items - Tableau d'items (skills, tools, etc.)
 * @param {string} section - Section du CV (ex: "skills")
 * @param {string} field - Champ dans la section (ex: "hard_skills")
 * @param {function} getItemName - Fonction pour extraire le nom de l'item
 * @returns {Array} Items filtrés (sans les items supprimés)
 */
export function useFilterRemovedItems(items, section, field, getItemName) {
  const removedItems = useRemovedItems(section, field);

  if (!items || items.length === 0) return items;
  if (removedItems.length === 0) return items;

  // Créer un Set des noms supprimés (lowercase pour comparaison insensible à la casse)
  const removedNames = new Set(
    removedItems.map(c => c.itemName?.toLowerCase())
  );

  return items.filter(item => {
    const name = getItemName(item);
    return !removedNames.has(name?.toLowerCase());
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
            allowRemovedType={true}
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
          allowRemovedType={true}
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
        <SkillsReviewActions field={field} />
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
      <div className="flex items-center justify-end mb-1">
        <SkillsReviewActions field={field} />
      </div>
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
