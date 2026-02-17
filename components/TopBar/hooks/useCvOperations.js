import React from "react";
import { useRouter } from "next/navigation";
import { enhanceItem } from "../utils/cvUtils";

/**
 * Pose le cookie cvFile en nettoyant d'abord tout cookie domain legacy
 * (créé par d'anciennes versions de l'extension avec domain explicite).
 * Sans ce nettoyage, deux cookies cvFile coexistent et le stale est lu en premier.
 */
function setCvFileCookie(file) {
  // Supprimer le cookie domain legacy (extension < v1.x)
  document.cookie = "cvFile=; path=/; domain=" + location.hostname + "; max-age=0";
  // Poser le cookie host-only (compatible extension + SaaS)
  document.cookie = "cvFile=" + encodeURIComponent(file) + "; path=/; max-age=31536000";
}

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
  const hasEmittedInitialSelectRef = React.useRef(false);
  const lastReloadTimeRef = React.useRef(0);
  const reloadDebounceRef = React.useRef(null);
  const RELOAD_DEBOUNCE_MS = 500; // Debounce de 500ms entre les reloads

  const emitListChanged = React.useCallback(() => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("cv:list:changed"));
    }
  }, []);

  const reload = React.useCallback(async (preferredCurrent, { immediate = false } = {}) => {
    if (!isAuthenticated) {
      setRawItems([]);
      setCurrent("");
      titleCacheRef.current.clear();
      lastSelectedRef.current = "";
      lastSelectedMetaRef.current = null;
      return;
    }

    // Debounce: ignorer si un reload récent a eu lieu (sauf si immediate=true)
    const now = Date.now();
    if (!immediate && now - lastReloadTimeRef.current < RELOAD_DEBOUNCE_MS) {
      // Planifier un reload debounced si pas déjà prévu
      if (!reloadDebounceRef.current) {
        reloadDebounceRef.current = setTimeout(() => {
          reloadDebounceRef.current = null;
          reload(preferredCurrent, { immediate: true });
        }, RELOAD_DEBOUNCE_MS);
      }
      return;
    }

    // Annuler tout debounce en attente
    if (reloadDebounceRef.current) {
      clearTimeout(reloadDebounceRef.current);
      reloadDebounceRef.current = null;
    }

    // Si un reload est déjà en cours, mémoriser la demande pour plus tard
    if (isReloadingRef.current) {
      pendingReloadRef.current = preferredCurrent !== undefined ? preferredCurrent : null;
      return;
    }

    isReloadingRef.current = true;
    lastReloadTimeRef.current = now;

    try {
      const res = await fetch("/api/cvs", { cache: "no-store" });
      if (!res.ok) {
        // 401 = session expirée, pas une vraie erreur - juste ignorer silencieusement
        if (res.status === 401) {
          setRawItems([]);
          setCurrent("");
          return;
        }
        // 429 = rate limited - ignorer silencieusement, un reload debounced suivra
        // 502 = server not ready - ignorer silencieusement
        if (res.status === 429 || res.status === 502) {
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
      } else if (hasCandidate) {
        nextCurrent = candidate;
      } else if (serverSuggested) {
        nextCurrent = serverSuggested;
      } else if (normalizedItems.length) {
        nextCurrent = normalizedItems[0].file;
      }

      if (nextCurrent) {
        const cvChanged = nextCurrent !== lastSelectedRef.current;
        setCurrent(nextCurrent);
        lastSelectedRef.current = nextCurrent;

        // Synchroniser le cookie cvFile (nécessaire pour fetchSourceInfo/fetchMatchScore)
        setCvFileCookie(nextCurrent);

        try {
          localStorage.setItem("admin:cv", nextCurrent);
        } catch (_err) {}
        if (typeof setCurrentFile === "function") setCurrentFile(nextCurrent);
        lastSelectedMetaRef.current = null;
        const matched = normalizedItems.find((it) => it.file === nextCurrent);
        if (matched) {
          lastSelectedMetaRef.current = matched;
        }

        // Dispatcher cv:selected au premier chargement (pour initialiser Header)
        // et à chaque changement réel de CV
        if ((cvChanged || !hasEmittedInitialSelectRef.current) && typeof window !== "undefined") {
          hasEmittedInitialSelectRef.current = true;
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
    setCvFileCookie(file);
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

  /**
   * Supprime plusieurs CVs en une seule requête
   * @param {string[]} files - Liste des noms de fichiers à supprimer
   * @returns {Promise<{success: boolean, deletedCount?: number}>}
   */
  async function deleteMultiple(files) {
    if (!files.length || isDeletingRef.current) return { success: false };

    isDeletingRef.current = true;

    try {
      const res = await fetch("/api/cvs/delete-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error((data && data.error) || "Erreur");

      // Actualiser la liste
      emitListChanged();
      router.refresh();

      return { success: true, deletedCount: data.deletedCount || 0 };
    } catch (e) {
      console.error('[deleteMultiple] Error:', e);
      return { success: false, error: e?.message || String(e) };
    } finally {
      isDeletingRef.current = false;
    }
  }

  return {
    reload,
    selectFile,
    deleteCurrent,
    deleteMultiple,
    emitListChanged,
  };
}
