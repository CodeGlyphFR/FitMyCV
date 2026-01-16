'use client';

import { useState, useEffect, useMemo } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { ToggleSwitch } from './ToggleSwitch';
import { CustomSelect } from './CustomSelect';
import { Toast } from './Toast';
import {
  getCategoryLabel,
  getSettingLabel,
  isHierarchicalCategory,
  isCreditsCategory,
  isPdfImportCategory,
  isCvDisplayCategory,
  getAIModelsStructure,
  getCreditsStructure,
  AVAILABLE_AI_MODELS,
} from '@/lib/admin/settingsConfig';
import { PdfImportSettings } from './settings/PdfImportSettings';
import { SectionOrderSettings } from './settings/SectionOrderSettings';
import { SettingsNav, useIsMobile, CATEGORY_CONFIG } from './settings/SettingsNav';
import { SettingsFooter } from './settings/SettingsHeader';
import { SettingsDangerZone } from './settings/SettingsDangerZone';
import { SettingsSubscriptionMode } from './settings/SettingsSubscriptionMode';
import { MaintenanceConfirmModal } from './settings/MaintenanceConfirmModal';

// Ordre des catégories affiché
const CATEGORY_ORDER = ['ai_models', 'credits', 'features', 'system', 'pdf_import', 'cv_display', 'danger'];

export function SettingsTab({ refreshKey }) {
  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modifiedSettings, setModifiedSettings] = useState({});
  const [toast, setToast] = useState(null);
  const [availableModels, setAvailableModels] = useState(AVAILABLE_AI_MODELS);

  // Navigation
  const [activeCategory, setActiveCategory] = useState('ai_models');
  const [expandedCategory, setExpandedCategory] = useState(null); // Fermé par défaut sur mobile
  const [expandedSubcategories, setExpandedSubcategories] = useState({});
  const isMobile = useIsMobile(1024);

  // Mode maintenance
  const [showMaintenanceConfirm, setShowMaintenanceConfirm] = useState(false);
  const [maintenanceInfo, setMaintenanceInfo] = useState(null);
  const [pendingMaintenanceSetting, setPendingMaintenanceSetting] = useState(null);

  // Mode abonnement
  const [subscriptionMode, setSubscriptionMode] = useState({
    enabled: true,
    paidSubscribersCount: 0,
    loading: true,
  });

  const hasChanges = Object.keys(modifiedSettings).length > 0;
  const modifiedCount = Object.keys(modifiedSettings).length;

  useEffect(() => {
    fetchSettings();
    fetchAvailableModels();
    fetchSubscriptionMode();
  }, [refreshKey]);

  // Grouper les settings par catégorie
  const settingsByCategory = useMemo(() => {
    const excludedSettings = ['subscription_mode_enabled'];
    return settings.reduce((acc, setting) => {
      if (excludedSettings.includes(setting.settingName)) return acc;
      if (!acc[setting.category]) acc[setting.category] = [];
      acc[setting.category].push(setting);
      return acc;
    }, {});
  }, [settings]);

  // Compter les modifications par catégorie
  const modifiedCounts = useMemo(() => {
    const counts = {};
    Object.entries(modifiedSettings).forEach(([settingId]) => {
      const setting = settings.find((s) => s.id === settingId);
      if (setting) {
        counts[setting.category] = (counts[setting.category] || 0) + 1;
      }
    });
    return counts;
  }, [modifiedSettings, settings]);

  // Catégories disponibles (avec 'danger' toujours à la fin)
  const categories = useMemo(() => {
    const available = Object.keys(settingsByCategory).filter((c) =>
      CATEGORY_ORDER.includes(c)
    );
    // Trier selon l'ordre défini et ajouter 'danger'
    const sorted = CATEGORY_ORDER.filter(
      (c) => available.includes(c) || c === 'danger'
    );
    return sorted;
  }, [settingsByCategory]);

  // Liste des modifications pour affichage dans la sidebar
  const modifiedSettingsList = useMemo(() => {
    return Object.entries(modifiedSettings).map(([settingId, newValue]) => {
      const setting = settings.find((s) => s.id === settingId);
      if (!setting) return null;
      const label = getSettingLabel(setting.settingName);
      const oldValue = setting.value;
      return {
        label: `${label}: ${oldValue} → ${newValue}`,
        settingName: setting.settingName,
      };
    }).filter(Boolean);
  }, [modifiedSettings, settings]);

  async function fetchAvailableModels() {
    try {
      const res = await fetch('/api/admin/openai-pricing');
      const data = await res.json();
      if (data.pricings?.length > 0) {
        const models = data.pricings.filter((p) => p.isActive).map((p) => p.modelName);
        if (models.length > 0) setAvailableModels(models);
      }
    } catch (error) {
      console.error('Error fetching available models:', error);
    }
  }

  async function fetchSettings() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/settings');
      const data = await res.json();
      setSettings(data.settings);
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchActiveSessionsCount() {
    try {
      const res = await fetch('/api/admin/maintenance/active-sessions');
      return await res.json();
    } catch (error) {
      console.error('Error fetching active sessions:', error);
      return null;
    }
  }

  async function fetchSubscriptionMode() {
    try {
      const res = await fetch('/api/admin/subscription-mode');
      const data = await res.json();
      setSubscriptionMode({
        enabled: data.subscriptionModeEnabled,
        paidSubscribersCount: data.paidSubscribersCount || 0,
        loading: false,
      });
    } catch (error) {
      console.error('Error fetching subscription mode:', error);
      setSubscriptionMode((prev) => ({ ...prev, loading: false }));
    }
  }

  async function handleSubscriptionModeToggle(enabled) {
    try {
      const res = await fetch('/api/admin/subscription-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) throw new Error('Failed to update subscription mode');
      setSubscriptionMode((prev) => ({ ...prev, enabled }));
      setToast({
        type: 'success',
        message: enabled ? 'Mode abonnement activé' : 'Mode crédits uniquement activé',
      });
      fetchSubscriptionMode();
    } catch (error) {
      console.error('Error toggling subscription mode:', error);
      setToast({ type: 'error', message: 'Erreur lors du changement de mode' });
    }
  }

  async function handleCancelAllSubscriptions() {
    try {
      const res = await fetch('/api/admin/cancel-all-subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmationCode: 'CANCEL_ALL_SUBSCRIPTIONS' }),
      });
      if (!res.ok) throw new Error('Failed to cancel subscriptions');
      const data = await res.json();
      setToast({
        type: 'success',
        message: data.message || 'Abonnements annulés avec succès',
      });
      fetchSubscriptionMode();
    } catch (error) {
      console.error('Error cancelling subscriptions:', error);
      setToast({ type: 'error', message: "Erreur lors de l'annulation des abonnements" });
    }
  }

  async function handleValueChange(settingId, newValue) {
    const setting = settings.find((s) => s.id === settingId);

    // Activation du mode maintenance : afficher confirmation
    if (setting?.settingName === 'maintenance_enabled' && newValue === '1') {
      const sessionInfo = await fetchActiveSessionsCount();
      setMaintenanceInfo(sessionInfo);
      setPendingMaintenanceSetting({ settingId, newValue });
      setShowMaintenanceConfirm(true);
      return;
    }

    // Désactivation du mode maintenance : appliquer directement
    if (setting?.settingName === 'maintenance_enabled' && newValue === '0') {
      try {
        const res = await fetch(`/api/admin/settings/${settingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: newValue }),
        });
        if (res.ok) {
          setToast({
            type: 'success',
            message: 'Mode maintenance désactivé. Le site est de nouveau accessible.',
          });
          await fetchSettings();
        } else {
          setToast({ type: 'error', message: 'Erreur lors de la désactivation du mode maintenance' });
        }
      } catch (error) {
        console.error('Error disabling maintenance mode:', error);
        setToast({ type: 'error', message: 'Erreur lors de la désactivation du mode maintenance' });
      }
      return;
    }

    setModifiedSettings((prev) => ({ ...prev, [settingId]: newValue }));
  }

  async function confirmMaintenanceToggle() {
    if (pendingMaintenanceSetting) {
      try {
        const res = await fetch(`/api/admin/settings/${pendingMaintenanceSetting.settingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: pendingMaintenanceSetting.newValue }),
        });
        if (res.ok) {
          setToast({
            type: 'success',
            message: `Mode maintenance activé ! ${maintenanceInfo?.recentActiveUsers || 0} utilisateurs seront déconnectés.`,
          });
          await fetchSettings();
        } else {
          setToast({ type: 'error', message: "Erreur lors de l'activation du mode maintenance" });
        }
      } catch (error) {
        console.error('Error enabling maintenance mode:', error);
        setToast({ type: 'error', message: "Erreur lors de l'activation du mode maintenance" });
      }
    }
    setShowMaintenanceConfirm(false);
    setPendingMaintenanceSetting(null);
    setMaintenanceInfo(null);
  }

  function cancelMaintenanceToggle() {
    setShowMaintenanceConfirm(false);
    setPendingMaintenanceSetting(null);
    setMaintenanceInfo(null);
  }

  function getCurrentValue(setting) {
    return modifiedSettings[setting.id] !== undefined ? modifiedSettings[setting.id] : setting.value;
  }

  function isBinaryValue(value) {
    return value === '0' || value === '1';
  }

  async function handleSaveAll() {
    if (!hasChanges) return;
    setSaving(true);
    try {
      const maintenanceSettingId = settings.find((s) => s.settingName === 'maintenance_enabled')?.id;
      const maintenanceChanged = maintenanceSettingId && modifiedSettings[maintenanceSettingId] !== undefined;
      const maintenanceEnabled = modifiedSettings[maintenanceSettingId] === '1';

      const promises = Object.entries(modifiedSettings).map(([id, value]) =>
        fetch(`/api/admin/settings/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value }),
        })
      );

      const results = await Promise.all(promises);
      const allSuccess = results.every((res) => res.ok);

      if (allSuccess) {
        if (maintenanceChanged) {
          if (maintenanceEnabled) {
            const sessionInfo = await fetchActiveSessionsCount();
            setToast({
              type: 'success',
              message: `Mode maintenance activé ! ${sessionInfo?.recentActiveUsers || 0} utilisateurs seront déconnectés.`,
            });
          } else {
            setToast({
              type: 'success',
              message: 'Mode maintenance désactivé. Le site est de nouveau accessible.',
            });
          }
        } else {
          setToast({ type: 'success', message: 'Paramètres sauvegardés avec succès !' });
        }
        setModifiedSettings({});
        await fetchSettings();
      } else {
        setToast({ type: 'error', message: 'Erreur lors de la sauvegarde de certains paramètres' });
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      setToast({ type: 'error', message: 'Erreur lors de la sauvegarde' });
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setModifiedSettings({});
  }

  async function handleDeleteAllAnalytics() {
    const response = await fetch('/api/admin/telemetry/cleanup', { method: 'DELETE' });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to delete data');
    }
    const result = await response.json();
    setToast({
      type: 'success',
      message: `${result.deleted.total} enregistrements supprimés avec succès`,
    });
  }

  function handleToggleExpand(categoryId) {
    setExpandedCategory(expandedCategory === categoryId ? null : categoryId);
  }

  function toggleSubcategory(categoryId, subcategoryKey) {
    const key = `${categoryId}:${subcategoryKey}`;
    setExpandedSubcategories((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }

  function isSubcategoryExpanded(categoryId, subcategoryKey) {
    const key = `${categoryId}:${subcategoryKey}`;
    return expandedSubcategories[key] ?? false;
  }

  // Composant pour afficher un setting individuel
  function SettingRow({ setting, indent = false }) {
    const currentValue = getCurrentValue(setting);
    const isBinary = isBinaryValue(setting.value);
    const isAIModel = setting.category === 'ai_models';
    const isModified = modifiedSettings[setting.id] !== undefined;

    const modelOptions = availableModels.map((model) => ({
      value: model,
      label: model,
    }));

    return (
      <div
        className={`p-3 rounded-lg transition-colors ${
          isModified ? 'bg-blue-500/10 border border-blue-400/30' : 'bg-white/5'
        } ${indent ? 'ml-4' : ''}`}
      >
        {isBinary ? (
          <>
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-white">
                    {getSettingLabel(setting.settingName)}
                  </span>
                  {isModified && (
                    <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-300 border border-blue-400/30 rounded">
                      modifié
                    </span>
                  )}
                </div>
              </div>
              <div className="flex-shrink-0">
                <ToggleSwitch
                  enabled={currentValue === '1'}
                  onChange={(enabled) => handleValueChange(setting.id, enabled ? '1' : '0')}
                />
              </div>
            </div>
            {setting.description && (
              <p className="text-xs text-white/60 mt-2">{setting.description}</p>
            )}
          </>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-white">
                    {getSettingLabel(setting.settingName)}
                  </span>
                  {isModified && (
                    <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-300 border border-blue-400/30 rounded">
                      modifié
                    </span>
                  )}
                </div>
              </div>
              <div className="flex-shrink-0 w-full sm:w-auto">
                {isAIModel ? (
                  <CustomSelect
                    value={currentValue}
                    onChange={(value) => handleValueChange(setting.id, value)}
                    options={modelOptions}
                    className="w-full sm:w-56"
                  />
                ) : (
                  <input
                    type="text"
                    value={currentValue}
                    onChange={(e) => handleValueChange(setting.id, e.target.value)}
                    className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/50 backdrop-blur-xl w-full sm:w-56 font-mono"
                  />
                )}
              </div>
            </div>
            {setting.description && (
              <p className="text-xs text-white/60 mt-2">{setting.description}</p>
            )}
          </>
        )}
      </div>
    );
  }

  // Rendu des modèles IA avec structure hiérarchique (sous-catégories collapsibles)
  function renderAIModels(categorySettings) {
    const aiStructure = getAIModelsStructure();
    const settingsByName = categorySettings.reduce((acc, setting) => {
      acc[setting.settingName] = setting;
      return acc;
    }, {});

    return (
      <div className="space-y-2">
        {Object.entries(aiStructure).map(([groupLabel, settingNames]) => {
          const isExpanded = isSubcategoryExpanded('ai_models', groupLabel);
          const groupModifiedCount = settingNames.filter(
            (name) => settingsByName[name] && modifiedSettings[settingsByName[name].id] !== undefined
          ).length;

          return (
            <div key={groupLabel} className="rounded-lg border border-white/10 overflow-hidden">
              {/* Header de sous-catégorie cliquable */}
              <button
                onClick={() => toggleSubcategory('ai_models', groupLabel)}
                className={`w-full flex items-center justify-between px-4 py-3 transition-all text-left ${
                  isExpanded
                    ? 'bg-blue-500/10 border-b border-white/10'
                    : 'bg-white/5 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="w-1 h-4 bg-blue-400 rounded"></span>
                  <span className="text-sm font-medium text-white">{groupLabel}</span>
                  {groupModifiedCount > 0 && (
                    <span className="text-xs px-1.5 py-0.5 bg-blue-500/30 text-blue-300 rounded-full">
                      {groupModifiedCount}
                    </span>
                  )}
                </div>
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-white/50" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-white/50" />
                )}
              </button>

              {/* Contenu collapsible */}
              {isExpanded && (
                <div className="p-3 space-y-2 bg-white/5">
                  {settingNames.map((settingName) => {
                    const setting = settingsByName[settingName];
                    return setting ? <SettingRow key={setting.id} setting={setting} /> : null;
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // Rendu des crédits avec structure hiérarchique (sous-catégories collapsibles)
  function renderCreditsSettings(categorySettings) {
    const creditsStructure = getCreditsStructure();
    const settingsByName = categorySettings.reduce((acc, setting) => {
      acc[setting.settingName] = setting;
      return acc;
    }, {});

    return (
      <div className="space-y-4">
        {/* Section Mode Abonnement */}
        <SettingsSubscriptionMode
          subscriptionMode={subscriptionMode}
          onToggle={handleSubscriptionModeToggle}
          onCancelAll={handleCancelAllSubscriptions}
        />

        {/* Note explicative */}
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
          <p className="text-xs text-amber-300">
            <strong>Note :</strong> Une valeur de <code className="bg-white/10 px-1 rounded">0</code>{' '}
            signifie que la fonctionnalité est{' '}
            {subscriptionMode.enabled ? (
              <>
                réservée aux abonnés <strong>Premium</strong>
              </>
            ) : (
              <strong>gratuite</strong>
            )}
            .
          </p>
        </div>

        {/* Sous-catégories de crédits */}
        <div className="space-y-2">
          {Object.entries(creditsStructure).map(([groupLabel, settingNames]) => {
            const isExpanded = isSubcategoryExpanded('credits', groupLabel);
            const groupModifiedCount = settingNames.filter(
              (name) => settingsByName[name] && modifiedSettings[settingsByName[name].id] !== undefined
            ).length;

            return (
              <div key={groupLabel} className="rounded-lg border border-white/10 overflow-hidden">
                {/* Header de sous-catégorie cliquable */}
                <button
                  onClick={() => toggleSubcategory('credits', groupLabel)}
                  className={`w-full flex items-center justify-between px-4 py-3 transition-all text-left ${
                    isExpanded
                      ? 'bg-emerald-500/10 border-b border-white/10'
                      : 'bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-1 h-4 bg-emerald-400 rounded"></span>
                    <span className="text-sm font-medium text-white">{groupLabel}</span>
                    {groupModifiedCount > 0 && (
                      <span className="text-xs px-1.5 py-0.5 bg-emerald-500/30 text-emerald-300 rounded-full">
                        {groupModifiedCount}
                      </span>
                    )}
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-white/50" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-white/50" />
                  )}
                </button>

                {/* Contenu collapsible */}
                {isExpanded && (
                  <div className="p-3 space-y-2 bg-white/5">
                    {settingNames.map((settingName) => {
                      const setting = settingsByName[settingName];
                      if (!setting) return null;

                      const currentValue = getCurrentValue(setting);
                      const isModified = modifiedSettings[setting.id] !== undefined;
                      const isPremiumOnly = currentValue === '0';

                      return (
                        <div
                          key={setting.id}
                          className={`p-3 rounded-lg transition-colors ${
                            isModified ? 'bg-blue-500/10 border border-blue-400/30' : 'bg-white/5'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium text-white">
                                  {getSettingLabel(setting.settingName)}
                                </span>
                                {isModified && (
                                  <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-300 border border-blue-400/30 rounded">
                                    modifié
                                  </span>
                                )}
                                {isPremiumOnly && (
                                  <span
                                    className={`text-xs px-2 py-0.5 rounded ${
                                      subscriptionMode.enabled
                                        ? 'bg-amber-500/20 text-amber-300 border border-amber-400/30'
                                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                                    }`}
                                  >
                                    {subscriptionMode.enabled ? 'Premium' : 'Gratuit'}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <input
                                type="number"
                                min="0"
                                value={currentValue}
                                onChange={(e) => handleValueChange(setting.id, e.target.value)}
                                className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/50 backdrop-blur-xl w-20 text-center font-mono"
                              />
                              <span className="text-sm text-white/60">crédit(s)</span>
                            </div>
                          </div>
                          {setting.description && (
                            <p className="text-xs text-white/60 mt-2">{setting.description}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Rendu des settings simples
  function renderSimpleSettings(categorySettings) {
    return (
      <div className="space-y-3">
        {categorySettings.map((setting) => (
          <SettingRow key={setting.id} setting={setting} />
        ))}
      </div>
    );
  }

  // Rendu du contenu d'une catégorie
  function renderCategoryContent(categoryId) {
    if (categoryId === 'danger') {
      return <SettingsDangerZone onDeleteAnalytics={handleDeleteAllAnalytics} />;
    }

    const categorySettings = settingsByCategory[categoryId];
    if (!categorySettings) return null;

    if (isPdfImportCategory(categoryId)) {
      return (
        <PdfImportSettings
          settings={categorySettings}
          modifiedSettings={modifiedSettings}
          onValueChange={handleValueChange}
          getCurrentValue={getCurrentValue}
        />
      );
    }

    if (isCvDisplayCategory(categoryId)) {
      return (
        <SectionOrderSettings
          settings={categorySettings}
          modifiedSettings={modifiedSettings}
          onValueChange={handleValueChange}
          getCurrentValue={getCurrentValue}
        />
      );
    }

    if (isCreditsCategory(categoryId)) {
      return renderCreditsSettings(categorySettings);
    }

    if (isHierarchicalCategory(categoryId)) {
      return renderAIModels(categorySettings);
    }

    return renderSimpleSettings(categorySettings);
  }

  if (loading) {
    return (
      <div className="p-8 text-center text-white">
        <div className="animate-pulse">Chargement des paramètres...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">

      {/* Layout principal : sidebar + contenu sur desktop, accordéons sur mobile */}
      {isMobile ? (
        // Mobile : Accordéons
        <SettingsNav
          categories={categories}
          activeCategory={activeCategory}
          onCategoryChange={setActiveCategory}
          modifiedCounts={modifiedCounts}
          isMobile={true}
          expandedCategory={expandedCategory}
          onToggleExpand={handleToggleExpand}
        >
          {(categoryId) => renderCategoryContent(categoryId)}
        </SettingsNav>
      ) : (
        // Desktop : Sidebar + Contenu
        <div className="flex gap-6">
          {/* Sidebar navigation */}
          <div className="w-64 flex-shrink-0">
            <div className="sticky top-4">
              <SettingsNav
                categories={categories}
                activeCategory={activeCategory}
                onCategoryChange={setActiveCategory}
                modifiedCounts={modifiedCounts}
                isMobile={false}
                hasChanges={hasChanges}
                saving={saving}
                onSave={handleSaveAll}
                onCancel={handleCancel}
                modifiedSettingsList={modifiedSettingsList}
              />
            </div>
          </div>

          {/* Contenu principal */}
          <div className="flex-1 min-w-0">
            <div className="bg-white/10 backdrop-blur-xl rounded-lg shadow-lg p-6 border border-white/20">
              <h4 className="text-lg font-semibold text-white mb-6 pb-3 border-b border-white/10 flex items-center gap-3">
                {CATEGORY_CONFIG[activeCategory] && (
                  <>
                    {(() => {
                      const Icon = CATEGORY_CONFIG[activeCategory].icon;
                      return <Icon className="w-5 h-5 text-white/70" />;
                    })()}
                  </>
                )}
                {CATEGORY_CONFIG[activeCategory]?.label || getCategoryLabel(activeCategory)}
              </h4>
              {renderCategoryContent(activeCategory)}
            </div>
          </div>
        </div>
      )}

      {settings.length === 0 && (
        <div className="text-center text-white/60 py-8 bg-white/10 backdrop-blur-xl rounded-lg">
          Aucun paramètre trouvé
        </div>
      )}

      {/* Footer avec boutons Sauvegarder/Annuler (mobile uniquement) */}
      {isMobile && (
        <SettingsFooter
          hasChanges={hasChanges}
          saving={saving}
          onSave={handleSaveAll}
          onCancel={handleCancel}
        />
      )}

      {/* Modal confirmation maintenance */}
      <MaintenanceConfirmModal
        show={showMaintenanceConfirm}
        maintenanceInfo={maintenanceInfo}
        onConfirm={confirmMaintenanceToggle}
        onCancel={cancelMaintenanceToggle}
      />

      {/* Toast */}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
