"use client";
import React from "react";
import { motion } from "framer-motion";
import { X, Save, Plus, Trash2, MapPin, Calendar, Briefcase, FileText, GraduationCap, BookOpen, FolderKanban, Link2, Code } from "lucide-react";
import clsx from "clsx";

// ============================================
// CONSTANTES DE STYLE - VERSION COMPACTE
// ============================================
const inputBaseClass = "w-full rounded-md border border-white/20 bg-white/5 px-2.5 py-1.5 text-sm text-white placeholder:text-white/40 transition-all duration-200 hover:bg-white/10 hover:border-white/30 focus:bg-white/10 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/30 focus:outline-none";

const selectBaseClass = "w-full rounded-md border border-white/20 bg-white/5 px-2.5 py-1.5 text-sm text-white transition-all duration-200 hover:bg-white/10 hover:border-white/30 focus:bg-white/10 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/30 focus:outline-none appearance-none cursor-pointer [&>option]:bg-slate-900 [&>option]:text-white";

const textareaBaseClass = "w-full rounded-md border border-white/20 bg-white/5 px-2.5 py-1.5 text-sm text-white placeholder:text-white/40 transition-all duration-200 hover:bg-white/10 hover:border-white/30 focus:bg-white/10 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/30 focus:outline-none resize-none";

// ============================================
// SECTION - Groupe de champs avec titre
// ============================================
export function ModalSection({ title, icon: Icon, children, className, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay }}
      className={clsx("relative", className)}
    >
      {/* Titre de section - compact */}
      {title && (
        <div className="flex items-center gap-1.5 mb-2">
          {Icon && (
            <Icon className="w-3 h-3 text-emerald-400/70" />
          )}
          <span className="text-[10px] font-medium uppercase tracking-wider text-white/50">
            {title}
          </span>
          <div className="flex-1 h-px bg-white/10" />
        </div>
      )}

      {/* Contenu */}
      <div className="space-y-2">
        {children}
      </div>
    </motion.div>
  );
}

// ============================================
// FIELD - Label + Input wrapper
// ============================================
export function FormField({ label, required, error, children, className }) {
  return (
    <div className={clsx("space-y-1", className)}>
      {label && (
        <label className="block text-[10px] font-medium uppercase tracking-wide text-white/60">
          {label}
          {required && <span className="text-emerald-400 ml-0.5">*</span>}
        </label>
      )}
      {children}
      {error && (
        <motion.p
          initial={{ opacity: 0, y: -2 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-[10px] text-red-400"
        >
          {error}
        </motion.p>
      )}
    </div>
  );
}

// ============================================
// INPUT - Champ texte amélioré
// ============================================
export function Input({ className, ...props }) {
  return (
    <input
      className={clsx(inputBaseClass, className)}
      {...props}
    />
  );
}

// ============================================
// TEXTAREA - Zone de texte améliorée
// ============================================
export function Textarea({ className, ...props }) {
  return (
    <textarea
      className={clsx(textareaBaseClass, className)}
      {...props}
    />
  );
}

// ============================================
// SELECT - Dropdown amélioré
// ============================================
export function Select({ className, children, ...props }) {
  return (
    <div className="relative">
      <select
        className={clsx(selectBaseClass, className)}
        {...props}
      >
        {children}
      </select>
      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
        <svg className="w-4 h-4 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  );
}

// ============================================
// CHECKBOX - Case à cocher stylée
// ============================================
export function Checkbox({ label, checked, onChange, className }) {
  return (
    <label className={clsx("inline-flex items-center gap-2 cursor-pointer group", className)}>
      <div className="relative">
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          className="sr-only peer"
        />
        <div className="w-4 h-4 rounded border border-white/30 bg-white/5 transition-all duration-150 peer-checked:bg-emerald-500 peer-checked:border-emerald-500 group-hover:border-white/50">
        </div>
        {checked && (
          <svg
            className="absolute inset-0 w-full h-full text-white p-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={3}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
      <span className="text-xs text-white/70 group-hover:text-white transition-colors">
        {label}
      </span>
    </label>
  );
}

// ============================================
// GRID - Grille responsive
// ============================================
export function Grid({ cols = 2, gap = 3, className, children }) {
  const colsClass = {
    1: "grid-cols-1",
    2: "grid-cols-1 md:grid-cols-2",
    3: "grid-cols-1 md:grid-cols-3",
    4: "grid-cols-2 md:grid-cols-4",
  }[cols] || "grid-cols-1 md:grid-cols-2";

  const gapClass = {
    2: "gap-2",
    3: "gap-3",
    4: "gap-4",
  }[gap] || "gap-3";

  return (
    <div className={clsx("grid", colsClass, gapClass, className)}>
      {children}
    </div>
  );
}

// ============================================
// DIVIDER - Séparateur visuel
// ============================================
export function Divider({ className }) {
  return (
    <div className={clsx("h-px bg-white/10 my-3", className)} />
  );
}

// ============================================
// MODAL FOOTER - Boutons d'action
// ============================================
export function ModalFooter({ onCancel, onSave, saveLabel, cancelLabel, saveIcon: SaveIcon = Save, isLoading, disabled }) {
  return (
    <div className="flex items-center justify-end gap-2 pt-3 mt-1 border-t border-white/10">
      <button
        type="button"
        onClick={onCancel}
        disabled={isLoading}
        className="px-3 py-1.5 text-sm text-white/50 hover:text-white transition-colors disabled:opacity-50"
      >
        {cancelLabel || "Annuler"}
      </button>

      <button
        type="button"
        onClick={onSave}
        disabled={isLoading || disabled}
        className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium bg-emerald-500 hover:bg-emerald-400 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        ) : (
          <SaveIcon className="w-3.5 h-3.5" />
        )}
        {saveLabel || "Sauvegarder"}
      </button>
    </div>
  );
}

// ============================================
// MODAL FOOTER DELETE - Pour confirmation suppression
// ============================================
export function ModalFooterDelete({ onCancel, onDelete, deleteLabel, cancelLabel, isLoading }) {
  return (
    <div className="flex items-center justify-end gap-2 pt-3">
      <button
        type="button"
        onClick={onCancel}
        disabled={isLoading}
        className="px-3 py-1.5 text-sm text-white/50 hover:text-white transition-colors disabled:opacity-50"
      >
        {cancelLabel || "Annuler"}
      </button>

      <button
        type="button"
        onClick={onDelete}
        disabled={isLoading}
        className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        ) : (
          <Trash2 className="w-3.5 h-3.5" />
        )}
        {deleteLabel || "Supprimer"}
      </button>
    </div>
  );
}

// Export des icônes pour usage externe
export { Briefcase, Calendar, MapPin, FileText, GraduationCap, BookOpen, FolderKanban, Link2, Code };
