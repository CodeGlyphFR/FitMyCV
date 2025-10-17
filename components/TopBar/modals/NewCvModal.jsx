import React from "react";
import Modal from "@/components/ui/Modal";

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
            className="w-full rounded-lg border border-white/40 bg-white/20 backdrop-blur-sm px-3 py-2 text-sm text-white placeholder:text-white/50 shadow-sm transition-all duration-200 hover:bg-white/25 hover:border-white/60 focus:bg-white/30 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50 focus:outline-none"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Ex: Jean Dupont"
            required
          />
        </div>
        <div>
          <label className="text-xs font-medium uppercase tracking-wide text-white drop-shadow block mb-1">
            {t("newCvModal.currentTitle")}<span className="text-red-400" aria-hidden="true"> {t("newCvModal.required")}</span>
          </label>
          <input
            className="w-full rounded-lg border border-white/40 bg-white/20 backdrop-blur-sm px-3 py-2 text-sm text-white placeholder:text-white/50 shadow-sm transition-all duration-200 hover:bg-white/25 hover:border-white/60 focus:bg-white/30 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50 focus:outline-none"
            value={currentTitle}
            onChange={(e) => setCurrentTitle(e.target.value)}
            placeholder="Ex: Développeur Full-Stack"
            required
          />
        </div>
        <div>
          <label className="text-xs font-medium uppercase tracking-wide text-white drop-shadow block mb-1">{t("newCvModal.email")}</label>
          <input
            className="w-full rounded-lg border border-white/40 bg-white/20 backdrop-blur-sm px-3 py-2 text-sm text-white placeholder:text-white/50 shadow-sm transition-all duration-200 hover:bg-white/25 hover:border-white/60 focus:bg-white/30 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50 focus:outline-none"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@exemple.com"
          />
        </div>
        {error ? (
          <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{String(error)}</div>
        ) : null}
        <div className="flex gap-2">
          <button
            onClick={handleClose}
            className="rounded-lg border-2 border-white/40 bg-white/20 backdrop-blur-sm px-3 py-2 text-sm font-medium text-white hover:bg-white/30 transition-all duration-200"
          >
            {t("newCvModal.cancel")}
          </button>
          <button
            onClick={onCreate}
            disabled={busy || !fullName.trim() || !currentTitle.trim()}
            className="rounded-lg border-2 border-emerald-400/50 bg-emerald-500/30 backdrop-blur-sm px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500/40 transition-all duration-200 disabled:opacity-60"
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
