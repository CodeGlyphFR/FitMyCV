'use client';

import { useState, useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  User,
  FileText,
  Star,
  Briefcase,
  GraduationCap,
  Globe,
  Plus,
  FolderOpen,
  GripVertical,
  RotateCcw,
} from 'lucide-react';
import { getCvSections } from '@/lib/admin/settingsConfig';

// Mapping des icônes par section
const SECTION_ICONS = {
  header: User,
  summary: FileText,
  skills: Star,
  experience: Briefcase,
  education: GraduationCap,
  languages: Globe,
  extras: Plus,
  projects: FolderOpen,
};

// Ordre par défaut
const DEFAULT_ORDER = [
  'header', 'summary', 'skills', 'experience',
  'education', 'languages', 'extras', 'projects'
];

/**
 * Composant item triable
 */
function SortableItem({ id, label, isFirst }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: isFirst });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : transition,
  };

  const Icon = SECTION_ICONS[id] || FileText;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        flex items-center gap-3 p-3 rounded-lg border transition-all select-none
        ${isDragging
          ? 'bg-sky-500/20 border-sky-400/50 shadow-lg scale-105 z-10'
          : 'bg-white/5 border-white/10 hover:bg-white/10'
        }
        ${isFirst ? 'opacity-60 cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'}
      `}
    >
      <div
        {...attributes}
        {...listeners}
        className={`flex-shrink-0 p-2 rounded ${isFirst ? 'text-white/30' : 'text-white/50 hover:text-white/80 active:bg-white/10'}`}
        style={{ touchAction: 'none' }}
      >
        <GripVertical className="w-4 h-4" />
      </div>

      <div className="flex items-center gap-3 flex-1">
        <div className={`p-2 rounded-lg ${isDragging ? 'bg-sky-500/30' : 'bg-white/10'}`}>
          <Icon className={`w-4 h-4 ${isDragging ? 'text-sky-300' : 'text-white/70'}`} />
        </div>
        <span className={`text-sm font-medium ${isDragging ? 'text-sky-200' : 'text-white'}`}>
          {label}
        </span>
      </div>

      {isFirst && (
        <span className="text-xs px-2 py-0.5 bg-white/10 text-white/50 rounded">
          fixe
        </span>
      )}
    </div>
  );
}

/**
 * Composant pour gérer l'ordre des sections CV avec drag & drop
 */
export function SectionOrderSettings({
  settings,
  modifiedSettings,
  onValueChange,
  getCurrentValue,
}) {
  const cvSections = getCvSections();

  // Trouver le setting cv_section_order
  const orderSetting = settings.find(s => s.settingName === 'cv_section_order');

  // Parser l'ordre actuel
  const currentOrder = useMemo(() => {
    if (!orderSetting) return DEFAULT_ORDER;
    const value = getCurrentValue(orderSetting);
    try {
      return JSON.parse(value);
    } catch {
      return DEFAULT_ORDER;
    }
  }, [orderSetting, getCurrentValue]);

  const isModified = orderSetting && modifiedSettings[orderSetting.id] !== undefined;

  // Configurer les sensors pour le drag & drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200, // Maintenir 200ms avant de commencer le drag
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event) {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    // Ne pas permettre de déplacer header
    if (active.id === 'header' || over.id === 'header') return;

    const oldIndex = currentOrder.indexOf(active.id);
    const newIndex = currentOrder.indexOf(over.id);

    // Ne pas permettre de placer quelque chose avant header
    if (newIndex === 0) return;

    const newOrder = arrayMove(currentOrder, oldIndex, newIndex);
    onValueChange(orderSetting.id, JSON.stringify(newOrder));
  }

  function handleReset() {
    if (orderSetting) {
      onValueChange(orderSetting.id, JSON.stringify(DEFAULT_ORDER));
    }
  }

  // Vérifier si l'ordre actuel est différent de l'ordre par défaut
  const isDefaultOrder = JSON.stringify(currentOrder) === JSON.stringify(DEFAULT_ORDER);

  if (!orderSetting) {
    return (
      <div className="text-center text-white/60 py-4">
        Setting cv_section_order non trouvé
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Note explicative */}
      <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3">
        <p className="text-xs text-purple-300">
          <strong>Note :</strong> Glissez-déposez les sections pour réorganiser
          l'affichage du CV. L'en-tête reste toujours en première position.
        </p>
      </div>

      {/* Header avec bouton reset */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white">Ordre des sections</span>
          {isModified && (
            <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-300 border border-blue-400/30 rounded">
              modifié
            </span>
          )}
        </div>
        <button
          onClick={handleReset}
          disabled={isDefaultOrder}
          className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg transition ${
            isDefaultOrder
              ? 'bg-white/5 text-white/30 cursor-not-allowed'
              : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
          }`}
        >
          <RotateCcw className="w-3 h-3" />
          Réinitialiser
        </button>
      </div>

      {/* Liste des sections triables */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={currentOrder}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {currentOrder.map((sectionId, index) => {
              const section = cvSections.find(s => s.id === sectionId);
              if (!section) return null;

              return (
                <SortableItem
                  key={sectionId}
                  id={sectionId}
                  label={section.label}
                  isFirst={index === 0}
                />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

      {/* Prévisualisation mini */}
      <div className="mt-4 p-3 bg-white/5 rounded-lg border border-white/10">
        <p className="text-xs text-white/50 mb-2">Prévisualisation :</p>
        <div className="flex flex-wrap gap-1">
          {currentOrder.map((sectionId, index) => (
            <span
              key={sectionId}
              className={`text-xs px-2 py-1 rounded ${
                index === 0
                  ? 'bg-purple-500/20 text-purple-300'
                  : 'bg-white/10 text-white/70'
              }`}
            >
              {index + 1}. {cvSections.find(s => s.id === sectionId)?.label || sectionId}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
