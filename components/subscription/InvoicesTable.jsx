"use client";

import React from "react";
import { FileText, Download, Loader2 } from "lucide-react";

export default function InvoicesTable() {
  const [invoices, setInvoices] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    async function fetchInvoices() {
      try {
        setLoading(true);
        const res = await fetch('/api/subscription/invoices');

        if (!res.ok) {
          throw new Error('Erreur lors du chargement des factures');
        }

        const data = await res.json();
        setInvoices(data.invoices || []);
      } catch (err) {
        console.error('Error fetching invoices:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchInvoices();
  }, []);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'paid':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-green-500/20 border border-green-500/50 text-green-200 text-xs">
            Payé
          </span>
        );
      case 'open':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-orange-500/20 border border-orange-500/50 text-orange-200 text-xs">
            En attente
          </span>
        );
      case 'void':
      case 'uncollectible':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-red-500/20 border border-red-500/50 text-red-200 text-xs">
            Annulé
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
          💎 Crédits
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-purple-500/20 border border-purple-500/50 text-purple-200 text-xs">
        👑 Abonnement
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

  if (invoices.length === 0) {
    return (
      <div className="backdrop-blur-md bg-white/10 border border-white/20 rounded-xl p-6 shadow-lg">
        <div className="text-center text-white/60 py-8">
          <FileText className="mx-auto mb-3 opacity-50" size={48} />
          <p>Aucune facture pour le moment</p>
        </div>
      </div>
    );
  }

  return (
    <div className="backdrop-blur-md bg-white/10 border border-white/20 rounded-xl p-6 shadow-lg">
      <h2 className="text-xl font-semibold text-white mb-4 drop-shadow-lg flex items-center gap-2">
        <FileText size={24} />
        Factures
      </h2>

      {/* Table Desktop */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/20">
              <th className="text-left text-sm font-medium text-white/70 pb-3 px-2">Date</th>
              <th className="text-left text-sm font-medium text-white/70 pb-3 px-2">Type</th>
              <th className="text-left text-sm font-medium text-white/70 pb-3 px-2">Description</th>
              <th className="text-right text-sm font-medium text-white/70 pb-3 px-2">Montant</th>
              <th className="text-center text-sm font-medium text-white/70 pb-3 px-2">Statut</th>
              <th className="text-center text-sm font-medium text-white/70 pb-3 px-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) => (
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
                      PDF
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
        {invoices.map((invoice) => (
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
                  PDF
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
