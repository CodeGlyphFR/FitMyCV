"use client";

import React from "react";
import Modal from "@/components/ui/Modal";
import { useCreditCost } from "@/hooks/useCreditCost";
import CreditCostDisplay from "@/components/ui/CreditCostDisplay";

/**
 * Modal de création d'un nouveau CV vierge
 */
export default function NewCvModal({
  open,
  onClose,
  onCreate,
  fullName,
  setFullName,
  currentTitle,
  setCurrentTitle,
  email,
  setEmail,
  error,
  setError,
  busy,
  t,
}) {
  // Récupérer les coûts en crédits
  const { showCosts, getCost } = useCreditCost();
  const createCost = getCost("create_cv_manual");

  const handleClose = () => {
    onClose();
    setFullName("");
    setCurrentTitle("");
    setEmail("");
    setError(null);
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={t("newCvModal.title")}
    >
      <div className="space-y-4">
        <div>
          <label className="text-xs font-medium uppercase tracking-wide text-white drop-shadow block mb-1">
            {t("newCvModal.fullName")}<span className="text-red-400" aria-hidden="true"> {t("newCvModal.required")}</span>
          </label>
          <input
            className="w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/50 transition-colors duration-200 hover:bg-white/10 hover:border-white/30 focus:bg-white/10 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50 focus:outline-hidden"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder={t("newCvModal.placeholders.fullName")}
            required
          />
        </div>
        <div>
          <label className="text-xs font-medium uppercase tracking-wide text-white drop-shadow block mb-1">
            {t("newCvModal.currentTitle")}<span className="text-red-400" aria-hidden="true"> {t("newCvModal.required")}</span>
          </label>
          <input
            className="w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/50 transition-colors duration-200 hover:bg-white/10 hover:border-white/30 focus:bg-white/10 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50 focus:outline-hidden"
            value={currentTitle}
            onChange={(e) => setCurrentTitle(e.target.value)}
            placeholder={t("newCvModal.placeholders.currentTitle")}
            required
          />
        </div>
        <div>
          <label className="text-xs font-medium uppercase tracking-wide text-white drop-shadow block mb-1">{t("newCvModal.email")}</label>
          <input
            className="w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/50 transition-colors duration-200 hover:bg-white/10 hover:border-white/30 focus:bg-white/10 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50 focus:outline-hidden"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("newCvModal.placeholders.email")}
          />
        </div>
        {error ? (
          <div className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{String(error)}</div>
        ) : null}

        {/* Affichage du coût en crédits (mode crédits-only uniquement, si coût > 0) */}
        {createCost > 0 && <CreditCostDisplay cost={createCost} show={showCosts} />}

        <div className="flex gap-2">
          <button
            onClick={handleClose}
            className="px-4 py-2.5 text-sm text-slate-400 hover:text-white transition-colors"
          >
            {t("newCvModal.cancel")}
          </button>
          <button
            onClick={onCreate}
            disabled={busy || !fullName.trim() || !currentTitle.trim()}
            className="px-6 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold transition-colors disabled:opacity-60"
          >
            {busy ? t("newCvModal.creating") : t("newCvModal.create")}
          </button>
        </div>
        <p className="text-xs text-white/70 drop-shadow">
          {t("newCvModal.hint")}
        </p>
      </div>
    </Modal>
  );
}
