"use client";
import React from "react";
import Section from "./Section";
import { useAdmin } from "./admin/AdminProvider";
import useMutate from "./admin/useMutate";
import Modal from "./ui/Modal";
import FormRow from "./ui/FormRow";

export default function Summary(props){
  const summary = props.summary || {};
  const title = (props.sectionTitles && props.sectionTitles.summary) || "Résumé";
  const { editing } = useAdmin();
  const { mutate } = useMutate();

  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState(summary.description || "");
  React.useEffect(()=>{ setText(summary.description || ""); }, [summary]);

  const isEmpty = !((summary.description || "").trim());

  async function save(){
    await mutate({ op:"set", path:"summary.description", value: text });
    setOpen(false);
  }

  async function clear(){
    await mutate({ op:"set", path:"summary.description", value: "" });
    setText("");
  }

  // Masquer entièrement la section si vide et pas en édition
  if (!editing && isEmpty) return null;

  return (
    <Section
      title={
        <div className="flex items-center justify-between gap-2">
          <span>{title}</span>
          {editing && (
            <div className="flex gap-2">
              <button
                onClick={()=>setOpen(true)}
                className="no-print text-xs rounded border px-2 py-0.5"
              >
                🖊️
              </button>
              {!isEmpty && (
                <button
                  onClick={clear}
                  className="no-print text-xs rounded border px-2 py-0.5 text-red-600"
                >
                  ❌
                </button>
              )}
            </div>
          )}
        </div>
      }
    >
      {isEmpty ? (
        editing ? (
          <p className="text-sm opacity-60">Aucun résumé pour le moment.</p>
        ) : null
      ) : (
        <p
          className="text-sm text-justify leading-relaxed opacity-95 whitespace-pre-line"
          suppressHydrationWarning
        >
          {summary.description}
        </p>
      )}

      <Modal open={open} onClose={()=>setOpen(false)} title="Modifier le résumé">
        <div className="space-y-2">
          <FormRow label="Résumé">
            <textarea
              className="w-full rounded border p-2 text-sm"
              rows={6}
              value={text}
              onChange={e=>setText(e.target.value)}
            />
          </FormRow>
          <div className="flex justify-end gap-2">
            <button
              onClick={save}
              className="rounded border px-3 py-1 text-sm"
            >
              Enregistrer
            </button>
          </div>
        </div>
      </Modal>
    </Section>
  );
}
