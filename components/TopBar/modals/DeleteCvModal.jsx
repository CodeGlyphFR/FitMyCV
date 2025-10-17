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
            className="rounded-lg border-2 border-white/40 bg-white/20 backdrop-blur-sm px-3 py-2 text-sm font-medium text-white hover:bg-white/30 transition-all duration-200"
          >
            {t("deleteModal.no")}
          </button>
          <button
            onClick={onConfirm}
            className="rounded-lg border-2 border-red-400/50 bg-red-500/30 backdrop-blur-sm px-3 py-2 text-sm font-medium text-white hover:bg-red-500/40 transition-all duration-200"
          >
            {t("deleteModal.yes")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
