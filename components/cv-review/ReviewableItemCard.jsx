"use client";
import React, { useState, useRef } from "react";
import { useReview } from "@/components/providers/ReviewProvider";
import ChangeReviewPopover from "./ChangeReviewPopover";
import { Check, X } from "lucide-react";

/**
 * Composant générique pour afficher un item avec changement pending
 * Applique un style visuel selon le type de changement :
 * - added / move_to_projects → Bordure et fond verts
 * - modified / level_adjusted → Bordure et fond jaunes
 * - removed / experience_removed → Bordure et fond rouges
 *
 * @param {Object} change - Le changement pending (de pendingChanges)
 * @param {React.ReactNode} children - Contenu à afficher dans la carte
 * @param {string} variant - "card" (défaut) ou "badge" pour un style compact
 * @param {string} className - Classes CSS additionnelles
 * @param {boolean} showLabel - Afficher un label "AJOUTÉ"/"SUPPRIMÉ" (défaut: true)
 * @param {boolean} showInlineActions - Afficher les boutons Accept/Reject directement en haut à droite (défaut: false)
 */
export default function ReviewableItemCard({
  change,
  children,
  variant = "card",
  className = "",
  showLabel = true,
  showInlineActions = false,
}) {
  const [showPopover, setShowPopover] = useState(false);
  const cardRef = useRef(null);
  const { acceptChange, rejectChange, isBatchProcessing } = useReview();

  if (!change) {
    return <>{children}</>;
  }

  const changeType = change.changeType;

  // Déterminer les couleurs selon le type
  const isAdded = changeType === "added" || changeType === "move_to_projects";
  const isModified = changeType === "modified" || changeType === "level_adjusted";
  const isRemoved = changeType === "removed" || changeType === "experience_removed";

  // Classes de style selon le type
  const colorClasses = isAdded
    ? "border-emerald-500/30 bg-emerald-500/10"
    : isModified
    ? "border-amber-500/30 bg-amber-500/10"
    : isRemoved
    ? "border-red-500/30 bg-red-500/10"
    : "";

  const textColorClass = isAdded
    ? "text-emerald-400"
    : isModified
    ? "text-amber-400"
    : isRemoved
    ? "text-red-400"
    : "text-white/70";

  // Label selon le type
  const labelText = isAdded
    ? changeType === "move_to_projects" ? "DÉPLACÉ" : "AJOUTÉ"
    : isModified
    ? "MODIFIÉ"
    : isRemoved
    ? "SUPPRIMÉ"
    : "";

  const handleClick = (e) => {
    // Ne pas ouvrir le popover si on clique sur un bouton interne
    if (e.target.closest('button')) return;
    // Ne pas ouvrir le popover si showInlineActions (les boutons sont déjà visibles)
    if (showInlineActions) return;
    e.stopPropagation();
    setShowPopover(true);
  };

  const handleAccept = async () => {
    if (isBatchProcessing) return;
    await acceptChange(change.id);
    setShowPopover(false);
  };

  const handleReject = async () => {
    if (isBatchProcessing) return;
    await rejectChange(change.id);
    setShowPopover(false);
  };

  // Style pour badge (compact)
  if (variant === "badge") {
    return (
      <>
        <div
          ref={cardRef}
          onClick={handleClick}
          data-review-change-pending="true"
          data-review-change-type={changeType}
          className={`
            relative inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm
            border-2 transition-all duration-200
            ${!showInlineActions ? 'cursor-pointer hover:brightness-110' : ''}
            ${colorClasses}
            ${className}
          `}
        >
          {children}
          {/* Boutons Accept/Reject inline pour badge */}
          {showInlineActions && (
            <div className="flex items-center gap-1 ml-1">
              <button
                onClick={handleAccept}
                disabled={isBatchProcessing}
                className="p-0.5 rounded text-emerald-400 hover:text-emerald-300 transition-colors disabled:opacity-50"
                title="Accepter"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleReject}
                disabled={isBatchProcessing}
                className="p-0.5 rounded text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                title="Rejeter (restaurer)"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {showPopover && (
          <ChangeReviewPopover
            change={change}
            onAccept={handleAccept}
            onReject={handleReject}
            onClose={() => setShowPopover(false)}
            anchorRef={cardRef}
          />
        )}
      </>
    );
  }

  // Style pour carte (défaut)
  return (
    <>
      <div
        ref={cardRef}
        onClick={handleClick}
        data-review-change-pending="true"
        data-review-change-type={changeType}
        className={`
          relative rounded-xl p-3 border-2 transition-all duration-200
          ${!showInlineActions ? 'cursor-pointer hover:brightness-110' : ''}
          ${colorClasses}
          ${className}
        `}
      >
        {/* Header avec label + boutons inline */}
        <div className="flex items-center justify-between gap-2">
          {/* Label en haut à gauche */}
          {showLabel && labelText && (
            <div className={`text-[10px] font-bold tracking-wider ${textColorClass}`}>
              {labelText}
              {/* N'afficher le hint que si pas de boutons inline */}
              {!showInlineActions && change.reason && (
                <span className="ml-2 font-normal opacity-70 text-[9px]">
                  (cliquez pour voir la raison)
                </span>
              )}
            </div>
          )}

          {/* Boutons Accept/Reject inline (optionnel) */}
          {showInlineActions && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={handleAccept}
                disabled={isBatchProcessing}
                className="p-1 rounded-md flex items-center justify-center text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                title="Accepter"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={handleReject}
                disabled={isBatchProcessing}
                className="p-1 rounded-md flex items-center justify-center text-red-400 hover:text-red-300 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                title="Rejeter (restaurer)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Contenu */}
        <div className={showLabel && labelText ? 'mt-1' : ''}>
          {children}
        </div>
      </div>

      {showPopover && (
        <ChangeReviewPopover
          change={change}
          onAccept={handleAccept}
          onReject={handleReject}
          onClose={() => setShowPopover(false)}
          anchorRef={cardRef}
        />
      )}
    </>
  );
}

/**
 * Composant pour afficher une liste d'items supprimés en bas d'une section
 * Utile pour afficher les éléments qui ont été retirés par l'IA
 *
 * @param {Array} removedItems - Liste des changements de type "removed"
 * @param {Function} renderItem - Fonction pour rendre chaque item (reçoit change et props)
 * @param {string} variant - "card" ou "badge"
 */
export function RemovedItemsList({ removedItems, renderItem, variant = "card" }) {
  if (!removedItems || removedItems.length === 0) {
    return null;
  }

  return (
    <>
      {removedItems.map((change, index) => (
        <ReviewableItemCard
          key={change.id || `removed-${index}`}
          change={change}
          variant={variant}
        >
          {renderItem(change)}
        </ReviewableItemCard>
      ))}
    </>
  );
}

/**
 * Composant pour afficher une liste d'items ajoutés
 * (généralement déjà affichés, mais avec le style vert)
 *
 * @param {Array} addedItems - Liste des changements de type "added"
 * @param {Function} renderItem - Fonction pour rendre chaque item
 * @param {string} variant - "card" ou "badge"
 */
export function AddedItemsList({ addedItems, renderItem, variant = "card" }) {
  if (!addedItems || addedItems.length === 0) {
    return null;
  }

  return (
    <>
      {addedItems.map((change, index) => (
        <ReviewableItemCard
          key={change.id || `added-${index}`}
          change={change}
          variant={variant}
        >
          {renderItem(change)}
        </ReviewableItemCard>
      ))}
    </>
  );
}
