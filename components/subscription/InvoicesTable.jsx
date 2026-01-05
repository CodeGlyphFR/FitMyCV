"use client";

import React from "react";
import { FileText, Download, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import CreditBalanceBanner from "./CreditBalanceBanner";

export default function InvoicesTable({ creditBalance: creditBalanceProp, currentPlan, creditsOnlyMode = false }) {
  const { t } = useLanguage();
  const [invoices, setInvoices] = React.useState([]);
  const [creditBalance, setCreditBalance] = React.useState(creditBalanceProp || 0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [page, setPage] = React.useState(0);
  const [typeFilter, setTypeFilter] = React.useState('all'); // 'all', 'subscription', 'credit_pack'
  const limit = 10;

  React.useEffect(() => {
    async function fetchInvoices() {
      try {
        setLoading(true);
        const res = await fetch('/api/subscription/invoices');

        if (!res.ok) {
          throw new Error(t('subscription.invoices.errorLoading'));
        }

        const data = await res.json();
        setInvoices(data.invoices || []);
        setCreditBalance(data.creditBalance || 0);
      } catch (err) {
        console.error('Error fetching invoices:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchInvoices();
  }, [t]);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'paid':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-green-500/20 border border-green-500/50 text-green-200 text-xs">
            {t('subscription.invoices.status.paid')}
          </span>
        );
      case 'open':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-orange-500/20 border border-orange-500/50 text-orange-200 text-xs">
            {t('subscription.invoices.status.open')}
          </span>
        );
      case 'void':
      case 'uncollectible':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-red-500/20 border border-red-500/50 text-red-200 text-xs">
            {t('subscription.invoices.status.canceled')}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-gray-500/20 border border-gray-500/50 text-gray-200 text-xs">
            {status}
          </span>
        );
    }
  };

  const getTypeBadge = (type) => {
    if (type === 'credit_pack') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-500/20 border border-blue-500/50 text-blue-200 text-xs">
          💎 {t('subscription.invoices.types.creditPack')}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-purple-500/20 border border-purple-500/50 text-purple-200 text-xs">
        👑 {t('subscription.invoices.types.subscription')}
      </span>
    );
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  // Prédicat pour vérifier si une facture a un PDF disponible
  const hasPdfUrl = React.useCallback((invoice) => Boolean(invoice.pdfUrl), []);

  /**
   * Filtrer les factures selon le type sélectionné et uniquement celles avec PDF.
   *
   * IMPORTANT: Seules les factures avec `pdfUrl` sont affichées car:
   * - Les Stripe Invoices (abonnements) ont toujours invoice_pdf
   * - Les PaymentIntents (packs de crédits) ne génèrent PAS de facture par défaut
   * - Les utilisateurs s'attendent à télécharger des PDFs dans l'onglet "Historique"
   *
   * @see app/api/subscription/invoices/route.js lignes 176, 204
   */
  const filteredInvoices = React.useMemo(() => {
    let result = invoices;

    // Filtrer par type
    if (typeFilter !== 'all') {
      result = result.filter(inv => inv.type === typeFilter);
    }

    // Filtrer uniquement les factures avec PDF
    result = result.filter(hasPdfUrl);

    return result;
  }, [invoices, typeFilter, hasPdfUrl]);

  // Calculer les compteurs pour les boutons de filtre (memoized pour performance)
  const filterCounts = React.useMemo(() => {
    const withPdf = invoices.filter(hasPdfUrl);
    return {
      all: withPdf.length,
      subscription: withPdf.filter(i => i.type === 'subscription').length,
      credit_pack: withPdf.filter(i => i.type === 'credit_pack').length,
    };
  }, [invoices, hasPdfUrl]);

  // En mode crédits-only, masquer le filtre abonnements s'il n'y a pas de factures d'abonnements
  const showSubscriptionFilter = !creditsOnlyMode || filterCounts.subscription > 0;

  // Calculer pagination
  const totalPages = Math.ceil(filteredInvoices.length / limit);
  const displayedInvoices = filteredInvoices.slice(page * limit, (page + 1) * limit);
  const startIndex = page * limit + 1;
  const endIndex = Math.min((page + 1) * limit, filteredInvoices.length);

  // Reset page quand le filtre change
  React.useEffect(() => {
    setPage(0);
  }, [typeFilter]);

  const handlePreviousPage = () => {
    setPage(prev => Math.max(0, prev - 1));
  };

  const handleNextPage = () => {
    setPage(prev => Math.min(totalPages - 1, prev + 1));
  };

  if (loading) {
    return (
      <div className="backdrop-blur-md bg-white/10 border border-white/20 rounded-xl p-6 shadow-lg">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="animate-spin text-white/60" size={24} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="backdrop-blur-md bg-white/10 border border-white/20 rounded-xl p-6 shadow-lg">
        <div className="text-center text-red-300 py-4">
          ❌ {error}
        </div>
      </div>
    );
  }

  // Gestion de l'état vide : distinguer "aucune facture" vs "aucune facture avec PDF"
  if (filteredInvoices.length === 0) {
    // Cas 1: Il y a des factures brutes mais aucune n'a de PDF
    if (invoices.length > 0) {
      return (
        <div className="backdrop-blur-md bg-white/10 border border-white/20 rounded-xl p-6 shadow-lg">
          <div className="text-center text-white/60 py-8">
            <FileText className="mx-auto mb-3 opacity-50" size={48} />
            <p className="text-white/80 font-medium mb-2">{t('subscription.invoices.noPdfInvoices')}</p>
            <p className="text-sm text-white/40">
              {t('subscription.invoices.noPdfInvoicesHint')}
            </p>
          </div>
        </div>
      );
    }

    // Cas 2: Aucune facture brute du tout
    return (
      <div className="backdrop-blur-md bg-white/10 border border-white/20 rounded-xl p-6 shadow-lg">
        <div className="text-center text-white/60 py-8">
          <FileText className="mx-auto mb-3 opacity-50" size={48} />
          <p>{t('subscription.invoices.noInvoices')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="backdrop-blur-md bg-white/10 border border-white/20 rounded-xl p-6 shadow-lg">
      <h2 className="text-xl font-semibold text-white mb-4 drop-shadow-lg flex items-center gap-2">
        <FileText size={24} />
        {t('subscription.invoices.title')}
      </h2>

      {/* Banner de crédit de facturation */}
      <CreditBalanceBanner creditBalance={creditBalance} currentPlan={currentPlan} />

      {/* Filtres par type */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setTypeFilter('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            typeFilter === 'all'
              ? 'bg-white/20 text-white border border-white/30'
              : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white border border-white/10'
          }`}
        >
          {t('subscription.invoices.filters.all', { count: filterCounts.all })}
        </button>
        {showSubscriptionFilter && (
          <button
            onClick={() => setTypeFilter('subscription')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              typeFilter === 'subscription'
                ? 'bg-purple-500/20 text-purple-200 border border-purple-500/50'
                : 'bg-white/5 text-white/60 hover:bg-purple-500/10 hover:text-purple-200 border border-white/10'
            }`}
          >
            👑 {t('subscription.invoices.filters.subscriptions', { count: filterCounts.subscription })}
          </button>
        )}
        <button
          onClick={() => setTypeFilter('credit_pack')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            typeFilter === 'credit_pack'
              ? 'bg-blue-500/20 text-blue-200 border border-blue-500/50'
              : 'bg-white/5 text-white/60 hover:bg-blue-500/10 hover:text-blue-200 border border-white/10'
          }`}
        >
          💎 {t('subscription.invoices.filters.credits', { count: filterCounts.credit_pack })}
        </button>
      </div>

      {/* Table Desktop */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/20">
              <th className="text-left text-sm font-medium text-white/70 pb-3 px-2">{t('subscription.invoices.columns.date')}</th>
              <th className="text-left text-sm font-medium text-white/70 pb-3 px-2">{t('subscription.invoices.columns.type')}</th>
              <th className="text-left text-sm font-medium text-white/70 pb-3 px-2">{t('subscription.invoices.columns.description')}</th>
              <th className="text-right text-sm font-medium text-white/70 pb-3 px-2">{t('subscription.invoices.columns.amount')}</th>
              <th className="text-center text-sm font-medium text-white/70 pb-3 px-2">{t('subscription.invoices.columns.status')}</th>
              <th className="text-center text-sm font-medium text-white/70 pb-3 px-2">{t('subscription.invoices.columns.action')}</th>
            </tr>
          </thead>
          <tbody>
            {displayedInvoices.map((invoice) => (
              <tr key={invoice.id} className="border-b border-white/10 last:border-0">
                <td className="py-3 px-2 text-sm text-white">
                  {formatDate(invoice.date)}
                </td>
                <td className="py-3 px-2 text-sm text-white">
                  {getTypeBadge(invoice.type)}
                </td>
                <td className="py-3 px-2 text-sm text-white">
                  {invoice.description}
                </td>
                <td className="py-3 px-2 text-sm text-white text-right font-medium">
                  {invoice.amount.toFixed(2)} {invoice.currency}
                </td>
                <td className="py-3 px-2 text-center">
                  {getStatusBadge(invoice.status)}
                </td>
                <td className="py-3 px-2 text-center">
                  {invoice.pdfUrl && (
                    <a
                      href={invoice.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/50 text-blue-200 text-xs transition-colors"
                    >
                      <Download size={14} />
                      {t('subscription.invoices.downloadPdf')}
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cards Mobile */}
      <div className="md:hidden space-y-3">
        {displayedInvoices.map((invoice) => (
          <div
            key={invoice.id}
            className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-2"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  {getTypeBadge(invoice.type)}
                </div>
                <div className="text-sm text-white font-medium">
                  {invoice.description}
                </div>
                <div className="text-xs text-white/60 mt-1">
                  {formatDate(invoice.date)}
                </div>
              </div>
              {getStatusBadge(invoice.status)}
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-white/10">
              <div className="text-lg font-bold text-white">
                {invoice.amount.toFixed(2)} {invoice.currency}
              </div>
              {invoice.pdfUrl && (
                <a
                  href={invoice.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/50 text-blue-200 text-xs transition-colors"
                >
                  <Download size={14} />
                  {t('subscription.invoices.downloadPdf')}
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {filteredInvoices.length > 0 && (
        <div className="mt-6 pt-4 border-t border-white/10">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Info pagination */}
            <div className="text-sm text-white/60">
              {t('subscription.invoices.pagination.showing', {
                start: startIndex,
                end: endIndex,
                total: filteredInvoices.length,
                plural: filteredInvoices.length > 1 ? 's' : ''
              })}
            </div>

            {/* Boutons pagination */}
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePreviousPage}
                  disabled={page === 0}
                  className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white/10 flex items-center gap-1"
                >
                  <ChevronLeft size={16} />
                  {t('subscription.invoices.pagination.previous')}
                </button>

                <div className="px-4 py-2 text-sm text-white/80">
                  {t('subscription.invoices.pagination.page', { current: page + 1, total: totalPages })}
                </div>

                <button
                  onClick={handleNextPage}
                  disabled={page === totalPages - 1}
                  className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white/10 flex items-center gap-1"
                >
                  {t('subscription.invoices.pagination.next')}
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
