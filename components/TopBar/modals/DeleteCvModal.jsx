import React from "react";
import Modal from "@/components/ui/Modal";

/**
 * Modal de confirmation de suppression d'un CV
 */
export default function DeleteCvModal({
  open,
  onClose,
  onConfirm,
  currentItem,
  current,
  t,
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("deleteModal.title")}
    >
      <div className="space-y-3">
        <p className="text-sm text-white drop-shadow">
          {t("deleteModal.question")}{" "}
          <strong className="text-emerald-400">{currentItem ? currentItem.displayTitle : current}</strong> ?
        </p>
        <p className="text-xs text-white/70 drop-shadow">
          {t("deleteModal.warning")} <strong className="text-red-400">{t("deleteModal.irreversible")}</strong>.
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-sm text-slate-400 hover:text-white transition-colors"
          >
            {t("deleteModal.no")}
          </button>
          <button
            onClick={onConfirm}
            className="px-6 py-2.5 rounded-lg bg-red-500/30 hover:bg-red-500/40 border border-red-500/50 text-white text-sm font-semibold transition-colors"
          >
            {t("deleteModal.yes")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
