"use client";
import React from "react";
import { useRouter } from "next/navigation";
import { useAdmin } from "./AdminProvider";
export default function EditableText(props){
  const {
    path,
    value,
    as: Tag = "span",
    className,
    multiline = false,
  } = props;

  const [isEditing, setIsEditing] = React.useState(false);
  const [local, setLocal] = React.useState(value == null ? "" : String(value));
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState(null);
  const router = useRouter();
  const { editing } = useAdmin();

  async function save(){
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, value: local }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError((data && data.error) || "Erreur");
      } else {
        setIsEditing(false);
        router.refresh();
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("cv:list:changed"));
        }
      }
    } catch (e) {
      setError((e && e.message) || "Erreur réseau");
    }
    setSaving(false);
  }

  if (isEditing){
    if (multiline){
      return (
        <div className={className}>
          <textarea
            className="w-full rounded border p-2 text-sm"
            rows={4}
            value={local}
            onChange={(e) => setLocal(e.target.value)}
          />
          <div className="mt-1 flex gap-2 text-xs">
            <button
              onClick={save}
              disabled={saving}
              className="rounded border px-2 py-1 hover:shadow"
            >
              {saving ? "..." : "Enregistrer"}
            </button>
            <button
              onClick={() => {
                setIsEditing(false);
                setLocal(value == null ? "" : String(value));
              }}
              className="rounded border px-2 py-1"
            >
              Annuler
            </button>
            {error ? (
              <span className="text-red-600">{String(error)}</span>
            ) : null}
          </div>
        </div>
      );
    }

    return (
      <span className={className}>
        <input
          className="rounded border px-1 py-0.5 text-sm"
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape"){
              setIsEditing(false);
              setLocal(value == null ? "" : String(value));
            }
          }}
          autoFocus
        />
        <button
          onClick={save}
          disabled={saving}
          className="ml-2 rounded border px-1.5 py-0.5 text-xs hover:shadow"
        >
          {saving ? "..." : "OK"}
        </button>
        {error ? (
          <span className="ml-2 text-xs text-red-600">{String(error)}</span>
        ) : null}
      </span>
    );
  }

  return (
    <Tag
      className={className}
      data-editable={editing ? "true" : "false"}
      onClick={(e) => {
        if (editing){
          e.preventDefault();
          setIsEditing(true);
        }
      }}
      suppressHydrationWarning
    >
      {value == null || value === ""
        ? (<span className="opacity-50 italic">(vide)</span>)
        : String(value)}
    </Tag>
  );
}
