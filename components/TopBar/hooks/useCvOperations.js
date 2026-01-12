import React from "react";
import { useRouter } from "next/navigation";
import { enhanceItem } from "../utils/cvUtils";

/**
 * Hook pour les opérations CRUD sur les CV
 */
export function useCvOperations({
  isAuthenticated,
  setCurrentFile,
  items,
  current,
  titleCacheRef,
  lastSelectedRef,
  lastSelectedMetaRef,
  setRawItems,
  setCurrent,
  setIconRefreshKey,
  setHasLoadedOnce,
  hadItemsOnceRef,
  currentItem,
  language,
  t,
}) {
  const router = useRouter();

  // Verrou pour éviter les race conditions lors de suppressions multiples rapides
  const isReloadingRef = React.useRef(false);
  const pendingReloadRef = React.useRef(null);
  const isDeletingRef = React.useRef(false);

  const emitListChanged = React.useCallback(() => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("cv:list:changed"));
    }
  }, []);

  const reload = React.useCallback(async (preferredCurrent) => {
    if (!isAuthenticated) {
      setRawItems([]);
      setCurrent("");
      titleCacheRef.current.clear();
      lastSelectedRef.current = "";
      lastSelectedMetaRef.current = null;
      return;
    }

    // Si un reload est déjà en cours, mémoriser la demande pour plus tard
    if (isReloadingRef.current) {
      pendingReloadRef.current = preferredCurrent !== undefined ? preferredCurrent : null;
      return;
    }

    isReloadingRef.current = true;

    try {
      const res = await fetch("/api/cvs", { cache: "no-store" });
      if (!res.ok) {
        // 401 = session expirée, pas une vraie erreur - juste ignorer silencieusement
        if (res.status === 401) {
          setRawItems([]);
          setCurrent("");
          return;
        }
        // Autres erreurs HTTP
        throw new Error(`API CV error: ${res.status}`);
      }
      const data = await res.json();
      const cache = titleCacheRef.current;
      const normalizedItems = Array.isArray(data.items)
        ? data.items.map((it) => enhanceItem(it, cache, "CV"))
        : [];
      setRawItems(normalizedItems);

      // Marquer que le premier chargement est terminé
      if (typeof setHasLoadedOnce === "function") {
        setHasLoadedOnce(true);
      }

      // Tracker si on a déjà eu des items (pour le skeleton lors des race conditions)
      if (normalizedItems.length > 0 && hadItemsOnceRef) {
        hadItemsOnceRef.current = true;
      }

      const serverSuggested = data.current && normalizedItems.some((it) => it.file === data.current)
        ? data.current
        : null;
      const candidate = preferredCurrent || lastSelectedRef.current;
      const hasCandidate = candidate && normalizedItems.some((it) => it.file === candidate);

      let nextCurrent = null;
      if (preferredCurrent && normalizedItems.some((it) => it.file === preferredCurrent)) {
        nextCurrent = preferredCurrent;
      } else if (serverSuggested) {
        nextCurrent = serverSuggested;
      } else if (hasCandidate) {
        nextCurrent = candidate;
      } else if (normalizedItems.length) {
        nextCurrent = normalizedItems[0].file;
      }

      if (nextCurrent) {
        setCurrent(nextCurrent);
        lastSelectedRef.current = nextCurrent;
        try {
          localStorage.setItem("admin:cv", nextCurrent);
        } catch (_err) {}
        if (typeof setCurrentFile === "function") setCurrentFile(nextCurrent);
        lastSelectedMetaRef.current = null;
        const matched = normalizedItems.find((it) => it.file === nextCurrent);
        if (matched) {
          lastSelectedMetaRef.current = matched;
        }

        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("cv:selected", { detail: { file: nextCurrent } }));
        }
      }
    } catch (error) {
      // Ne pas vider les items sur erreur pour éviter que TopBar disparaisse
      console.error('[TopBar] Erreur reload CV list:', error);
    } finally {
      isReloadingRef.current = false;

      // Si une demande de reload était en attente, l'exécuter
      if (pendingReloadRef.current !== null) {
        const pending = pendingReloadRef.current;
        pendingReloadRef.current = null;
        // Utiliser setTimeout pour éviter la récursion synchrone
        setTimeout(() => reload(pending), 0);
      }
    }
  }, [isAuthenticated, setCurrentFile, titleCacheRef, lastSelectedRef, lastSelectedMetaRef, setRawItems, setCurrent]);

  async function selectFile(file) {
    lastSelectedMetaRef.current = null;

    const selected = items.find((it) => it.file === file);
    if (selected) {
      lastSelectedMetaRef.current = selected;
    }
    lastSelectedRef.current = file;
    document.cookie =
      "cvFile=" + encodeURIComponent(file) + "; path=/; max-age=31536000";
    try {
      localStorage.setItem("admin:cv", file);
    } catch (_err) {}
    if (typeof setCurrentFile === "function") setCurrentFile(file);
    setCurrent(file);
    setIconRefreshKey(Date.now());

    router.refresh();
    await reload(file);

    if (typeof window !== "undefined") {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("cv:selected", { detail: { file } }));
        window.dispatchEvent(new CustomEvent('realtime:cv:updated', { detail: { filename: file } }));
        window.dispatchEvent(new CustomEvent('realtime:cv:metadata:updated', { detail: { filename: file } }));
        window.dispatchEvent(new CustomEvent('realtime:cv:list:changed', { detail: { filename: file } }));
      }, 100);
    }
  }

  async function deleteCurrent() {
    // Verrou pour éviter les suppressions multiples simultanées
    if (!current || isDeletingRef.current) return;

    isDeletingRef.current = true;

    try {
      const res = await fetch("/api/cvs/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file: current }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error((data && data.error) || "Erreur");
      const next = data.nextFile || "";
      if (next) {
        document.cookie =
          "cvFile=" + encodeURIComponent(next) + "; path=/; max-age=31536000";
        setCurrent(next);
      } else {
        document.cookie = "cvFile=; path=/; max-age=0";
        setCurrent("");
      }

      // Si plus aucun CV, forcer un hard reload
      if (!next) {
        window.location.href = '/';
        return;
      }

      // emitListChanged() va déclencher reload() via l'event listener dans TopBar
      // Donc pas besoin d'appeler reload() ici directement (évite double-reload)
      emitListChanged();
      router.refresh();
    } catch (e) {
      alert(
        t("deleteModal.errors.deleteFailed") + " " + (e && e.message ? e.message : String(e))
      );
    } finally {
      isDeletingRef.current = false;
    }
  }

  return {
    reload,
    selectFile,
    deleteCurrent,
    emitListChanged,
  };
}
