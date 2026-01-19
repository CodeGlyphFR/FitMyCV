"use client";
/**
 * PAGE DE DÉMO - Modal Experience Prototype
 *
 * Accès : http://localhost:3001/demo-modal
 *
 * Cette page permet de tester le nouveau design des modaux
 * avant de l'intégrer dans les vrais composants.
 */

import React, { useState } from "react";
import { ExperienceEditModal, ExperienceDeleteModal } from "@/components/ExperienceModalPrototype";
import { LanguageProvider } from "@/lib/i18n/LanguageContext";

function DemoContent() {
  // État pour les modaux
  const [editOpen, setEditOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Données de formulaire pour édition
  const [editFormData, setEditFormData] = useState({
    title: "Chef de Projet Digital",
    company: "Acme Corporation",
    department_or_client: "Direction Marketing",
    start: "2022-01",
    end: "",
    inProgress: true,
    city: "Paris",
    region: "Île-de-France",
    country_code: "FR",
    description: "Pilotage de la transformation digitale de l'entreprise, coordination des équipes techniques et métiers.",
    responsibilities: "Gestion de projet Agile\nCoordination des équipes\nSuivi budgétaire\nReporting direction",
    deliverables: "Refonte site web\nApplication mobile\nTableau de bord analytics",
    skills_used: "React, TypeScript, Agile, Jira, Figma"
  });

  // Données de formulaire pour ajout (vide)
  const [addFormData, setAddFormData] = useState({
    title: "",
    company: "",
    department_or_client: "",
    start: "",
    end: "",
    inProgress: false,
    city: "",
    region: "",
    country_code: "",
    description: "",
    responsibilities: "",
    deliverables: "",
    skills_used: ""
  });

  const handleSaveEdit = () => {
    console.log("Sauvegarde édition:", editFormData);
    setEditOpen(false);
  };

  const handleSaveAdd = () => {
    console.log("Ajout nouvelle expérience:", addFormData);
    setAddOpen(false);
    // Reset form
    setAddFormData({
      title: "",
      company: "",
      department_or_client: "",
      start: "",
      end: "",
      inProgress: false,
      city: "",
      region: "",
      country_code: "",
      description: "",
      responsibilities: "",
      deliverables: "",
      skills_used: ""
    });
  };

  const handleDelete = () => {
    console.log("Suppression confirmée");
    setDeleteOpen(false);
  };

  return (
    <div className="min-h-screen bg-[rgb(2,6,23)] text-white p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-bold text-emerald-400">
            Prototype Modal Experience
          </h1>
          <p className="text-white/60">
            Cliquez sur les boutons ci-dessous pour tester les différents modaux
          </p>
        </div>

        {/* Boutons de test */}
        <div className="flex flex-wrap justify-center gap-4">
          <button
            onClick={() => setEditOpen(true)}
            className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-semibold transition-all duration-200 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30"
          >
            Ouvrir Modal Édition
          </button>

          <button
            onClick={() => setAddOpen(true)}
            className="px-6 py-3 rounded-xl bg-blue-500 hover:bg-blue-400 text-white font-semibold transition-all duration-200 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30"
          >
            Ouvrir Modal Ajout
          </button>

          <button
            onClick={() => setDeleteOpen(true)}
            className="px-6 py-3 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 font-semibold border border-red-500/40 transition-all duration-200"
          >
            Ouvrir Modal Suppression
          </button>
        </div>

        {/* Comparaison avant/après */}
        <div className="grid md:grid-cols-2 gap-6 mt-12">
          {/* Avant */}
          <div className="rounded-xl border border-white/10 p-6 space-y-4">
            <h2 className="text-lg font-semibold text-white/80">
              Avant (Modal actuel)
            </h2>
            <ul className="space-y-2 text-sm text-white/60">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                Champs en vrac sans organisation
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                Placeholders qui disparaissent
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                Pas de sections visuelles
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                Pas d'animations
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                Checkbox basique
              </li>
            </ul>
          </div>

          {/* Après */}
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-6 space-y-4">
            <h2 className="text-lg font-semibold text-emerald-400">
              Après (Prototype)
            </h2>
            <ul className="space-y-2 text-sm text-white/80">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Sections logiques avec icônes (Poste, Période, Lieu, Contenu)
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Labels fixes au-dessus des champs
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Animations Framer Motion (fade in, stagger)
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Glow subtil au focus
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Checkbox stylée avec animation
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Boutons avec icônes et micro-animations
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Modal de suppression plus explicite
              </li>
            </ul>
          </div>
        </div>

        {/* Instructions */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-6 mt-8">
          <h3 className="text-sm font-semibold text-white/80 mb-3">
            Fichiers créés :
          </h3>
          <ul className="space-y-1 text-sm text-white/60 font-mono">
            <li>components/ui/ModalForm.jsx — Composants réutilisables</li>
            <li>components/ExperienceModalPrototype.jsx — Modal prototype</li>
            <li>app/demo-modal/page.jsx — Cette page de démo</li>
          </ul>
        </div>
      </div>

      {/* Modaux */}
      <ExperienceEditModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        formData={editFormData}
        setFormData={setEditFormData}
        onSave={handleSaveEdit}
      />

      <ExperienceEditModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        formData={addFormData}
        setFormData={setAddFormData}
        onSave={handleSaveAdd}
        isAdd={true}
      />

      <ExperienceDeleteModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        experienceTitle="Chef de Projet Digital"
      />
    </div>
  );
}

export default function DemoModalPage() {
  return (
    <LanguageProvider>
      <DemoContent />
    </LanguageProvider>
  );
}
