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
  currentItem,
  language,
  t,
}) {
  const router = useRouter();

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

    try {
      const res = await fetch("/api/cvs", { cache: "no-store" });
      if (!res.ok) {
        throw new Error("API CV non disponible");
      }
      const data = await res.json();
      const cache = titleCacheRef.current;
      const normalizedItems = Array.isArray(data.items)
        ? data.items.map((it) => enhanceItem(it, cache, "CV"))
        : [];
      setRawItems(normalizedItems);

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
      setRawItems([]);
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
    if (!current) return;

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
      try {
        await reload();
      } catch (reloadError) {}
      emitListChanged();
      router.refresh();
    } catch (e) {
      alert(
        t("deleteModal.errors.deleteFailed") + " " + (e && e.message ? e.message : String(e))
      );
    }
  }

  return {
    reload,
    selectFile,
    deleteCurrent,
    emitListChanged,
  };
}
