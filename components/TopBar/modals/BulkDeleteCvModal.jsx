import React from "react";
import Modal from "@/components/ui/Modal";
import { getCvIcon } from "../utils/cvUtils";
import DefaultCvIcon from "@/components/ui/DefaultCvIcon";
import ItemLabel from "../components/ItemLabel";

// Types de CV disponibles pour le filtrage
const CV_TYPES = [
  { id: "generate-cv", key: "generate-cv" },
  { id: "import-pdf", key: "import-pdf" },
  { id: "manual", key: "manual" },
  { id: "translate-cv", key: "translate-cv" },
  { id: "improve-cv", key: "improve-cv" },
  { id: "generate-cv-job-title", key: "generate-cv-job-title" },
  { id: "create-template", key: "create-template" },
];

/**
 * Détermine le type effectif d'un CV pour le filtrage
 */
function getEffectiveType(item) {
  // Si c'est traduit, le type est translate-cv
  if (item.isTranslated || item.createdBy === "translate-cv") {
    return "translate-cv";
  }
  // Si pas de createdBy, c'est manuel
  if (!item.createdBy) {
    return "manual";
  }
  return item.createdBy;
}

/**
 * Modal de suppression multiple de CVs
 * Permet de sélectionner plusieurs CVs et de les supprimer en une seule action
 */
export default function BulkDeleteCvModal({
  open,
  onClose,
  onConfirm,
  items,
  currentFile,
  t,
}) {
  const [selectedFiles, setSelectedFiles] = React.useState([]);
  const [selectedTypes, setSelectedTypes] = React.useState([]);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [showConfirm, setShowConfirm] = React.useState(false);

  // Tous les items sont supprimables (y compris le CV actuel)
  const deletableItems = React.useMemo(() => {
    return items;
  }, [items]);

  // Calculer les types disponibles parmi les items supprimables
  const availableTypes = React.useMemo(() => {
    const types = new Set();
    deletableItems.forEach((item) => {
      types.add(getEffectiveType(item));
    });
    return CV_TYPES.filter((type) => types.has(type.id));
  }, [deletableItems]);

  // Filtrer les items selon les types sélectionnés
  const filteredItems = React.useMemo(() => {
    if (selectedTypes.length === 0) {
      return deletableItems;
    }
    return deletableItems.filter((item) => {
      const effectiveType = getEffectiveType(item);
      return selectedTypes.includes(effectiveType);
    });
  }, [deletableItems, selectedTypes]);

  // Reset la sélection quand le modal s'ouvre/se ferme
  React.useEffect(() => {
    if (open) {
      setSelectedFiles([]);
      setSelectedTypes([]);
      setShowConfirm(false);
    }
  }, [open]);

  const toggleFile = (file) => {
    setSelectedFiles((prev) =>
      prev.includes(file)
        ? prev.filter((f) => f !== file)
        : [...prev, file]
    );
  };

  const toggleType = (typeId) => {
    setSelectedTypes((prev) =>
      prev.includes(typeId)
        ? prev.filter((t) => t !== typeId)
        : [...prev, typeId]
    );
    // Reset la sélection de fichiers quand on change les filtres
    setSelectedFiles([]);
  };

  const toggleAll = () => {
    if (selectedFiles.length === filteredItems.length) {
      setSelectedFiles([]);
    } else {
      setSelectedFiles(filteredItems.map((item) => item.file));
    }
  };

  const handleDelete = async () => {
    if (!showConfirm) {
      setShowConfirm(true);
      return;
    }

    setIsDeleting(true);
    try {
      await onConfirm(selectedFiles);
      onClose();
    } finally {
      setIsDeleting(false);
      setShowConfirm(false);
    }
  };

  const handleClose = () => {
    if (showConfirm) {
      setShowConfirm(false);
    } else {
      onClose();
    }
  };

  const allSelected = filteredItems.length > 0 && selectedFiles.length === filteredItems.length;
  const someSelected = selectedFiles.length > 0;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={showConfirm ? t("deleteModal.title") : t("bulkDeleteModal.title")}
    >
      <div className="space-y-4">
        {showConfirm ? (
          // Écran de confirmation
          <div className="space-y-3">
            <p className="text-sm text-white drop-shadow">
              {t("bulkDeleteModal.confirmMessage", { count: selectedFiles.length })}
            </p>
            <p className="text-xs text-white/70 drop-shadow">
              {t("deleteModal.warning")}{" "}
              <strong className="text-red-400">{t("deleteModal.irreversible")}</strong>.
            </p>
          </div>
        ) : (
          // Écran de sélection
          <>
            <p className="text-sm text-white/80 drop-shadow">
              {t("bulkDeleteModal.selectCvs")}
            </p>

            {deletableItems.length === 0 ? (
              <p className="text-sm text-white/60 text-center py-4">
                {t("bulkDeleteModal.noCvsToDelete")}
              </p>
            ) : (
              <>
                {/* Filtres par type */}
                {availableTypes.length > 1 && (
                  <div className="flex flex-wrap items-center gap-2 pb-2">
                    {availableTypes.map((type) => {
                      const isActive = selectedTypes.includes(type.id);
                      return (
                        <button
                          key={type.id}
                          type="button"
                          onClick={() => toggleType(type.id)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition-colors ${
                            isActive
                              ? "bg-emerald-500/30 border border-emerald-500/50 text-emerald-300"
                              : "bg-white/10 border border-white/20 text-white/70 hover:bg-white/20 hover:text-white"
                          }`}
                        >
                          <span className="flex-shrink-0">
                            {getCvIcon(type.id, null, "h-3.5 w-3.5", type.id === "translate-cv") || (
                              <DefaultCvIcon className="h-3.5 w-3.5" size={14} />
                            )}
                          </span>
                          <span>{t(`topbar.cvTypes.${type.key}`)}</span>
                        </button>
                      );
                    })}
                    {/* Bouton effacer les filtres */}
                    {selectedTypes.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTypes([]);
                          setSelectedFiles([]);
                        }}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        <span>{t("topbar.filterClearAll")}</span>
                      </button>
                    )}
                  </div>
                )}

                {/* Header avec select all */}
                <div className="flex items-center gap-2 pb-2 border-b border-white/10">
                  <button
                    type="button"
                    onClick={toggleAll}
                    className="flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
                  >
                    <span
                      className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                        allSelected
                          ? "bg-emerald-500 border-emerald-500"
                          : "border-white/40 hover:border-white/60"
                      }`}
                    >
                      {allSelected && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                    {allSelected ? t("bulkDeleteModal.deselectAll") : t("bulkDeleteModal.selectAll")}
                  </button>
                  <span className="ml-auto text-xs text-white/60">
                    {t("bulkDeleteModal.selected", { count: selectedFiles.length })}
                    {selectedTypes.length > 0 && (
                      <span className="text-white/40"> / {filteredItems.length}</span>
                    )}
                  </span>
                </div>

                {/* Liste des CVs */}
                <ul className="max-h-[300px] overflow-y-auto custom-scrollbar space-y-1">
                  {filteredItems.length === 0 ? (
                    <li className="text-sm text-white/60 text-center py-4">
                      {t("topbar.filterNoResults")}
                    </li>
                  ) : (
                    filteredItems.map((item) => {
                      const isSelected = selectedFiles.includes(item.file);
                      return (
                        <li key={item.file}>
                          <button
                            type="button"
                            onClick={() => toggleFile(item.file)}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                              isSelected
                                ? "bg-red-500/20 border border-red-500/40"
                                : "hover:bg-white/10 border border-transparent"
                            }`}
                          >
                            {/* Checkbox */}
                            <span
                              className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                                isSelected
                                  ? "bg-red-500 border-red-500"
                                  : "border-white/40"
                              }`}
                            >
                              {isSelected && (
                                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </span>

                            {/* Icon CV */}
                            <span className="flex-shrink-0">
                              {getCvIcon(item.createdBy, item.originalCreatedBy, "h-4 w-4", item.isTranslated) || (
                                <DefaultCvIcon className="h-4 w-4" size={16} />
                              )}
                            </span>

                            {/* Label CV */}
                            <span className="min-w-0 flex-1">
                              <ItemLabel
                                item={item}
                                className="leading-tight"
                                withHyphen={false}
                              />
                            </span>
                          </button>
                        </li>
                      );
                    })
                  )}
                </ul>
              </>
            )}
          </>
        )}

        {/* Boutons */}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2.5 text-sm text-slate-400 hover:text-white transition-colors"
            disabled={isDeleting}
          >
            {showConfirm ? t("deleteModal.no") : t("bulkDeleteModal.cancel")}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={!someSelected || isDeleting}
            className={`px-6 py-2.5 rounded-lg text-white text-sm font-semibold transition-colors ${
              !someSelected || isDeleting
                ? "bg-gray-500/30 border border-gray-500/50 cursor-not-allowed opacity-50"
                : "bg-red-500/30 hover:bg-red-500/40 border border-red-500/50"
            }`}
          >
            {isDeleting
              ? t("bulkDeleteModal.deleting")
              : showConfirm
              ? t("deleteModal.yes")
              : `${t("bulkDeleteModal.delete")} (${selectedFiles.length})`}
          </button>
        </div>
      </div>
    </Modal>
  );
}
