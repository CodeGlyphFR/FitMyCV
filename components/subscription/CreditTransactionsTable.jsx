"use client";

import React from "react";
import { History, Loader2, ChevronLeft, ChevronRight, ArrowUpCircle, ArrowDownCircle, RotateCcw, Gift, Plus } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";

const TYPE_ICONS = {
  purchase: ArrowUpCircle,
  usage: ArrowDownCircle,
  refund: RotateCcw,
  gift: Gift,
  cv_creation: Plus,
};

const TYPE_COLORS = {
  purchase: "text-green-300",
  usage: "text-blue-300",
  refund: "text-purple-300",
  gift: "text-yellow-300",
  cv_creation: "text-orange-300",
};

export default function CreditTransactionsTable() {
  const { t } = useLanguage();
  const [transactions, setTransactions] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(0);
  const [hasMore, setHasMore] = React.useState(false);
  const limit = 20;

  const loadTransactions = React.useCallback(async (offset = 0) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/credits/transactions?limit=${limit}&offset=${offset}`);

      if (res.ok) {
        const data = await res.json();
        setTransactions(data.transactions || []);
        setHasMore(data.transactions?.length === limit);
      }
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadTransactions(page * limit);
  }, [page, loadTransactions]);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatAmount = (amount) => {
    const sign = amount > 0 ? "+" : "";
    return `${sign}${amount}`;
  };

  if (loading && transactions.length === 0) {
    return (
      <div className="backdrop-blur-md bg-white/10 border border-white/20 rounded-xl p-6 shadow-lg">
        <div className="text-center text-white/70 py-8">
          <Loader2 className="animate-spin inline-block" size={24} />
        </div>
      </div>
    );
  }

  return (
    <div className="backdrop-blur-md bg-white/10 border border-white/20 rounded-xl p-6 shadow-lg">
      <div className="flex items-center gap-2 mb-6">
        <History className="text-white" size={24} />
        <h2 className="text-xl font-semibold text-white">{t('subscription.transactions.title')}</h2>
      </div>

      {transactions.length === 0 ? (
        <div className="text-center text-white/60 py-8">
          {t('subscription.transactions.noTransactions')}
        </div>
      ) : (
        <>
          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/20">
                  <th className="text-left py-3 px-2 text-sm font-medium text-white/70">{t('subscription.transactions.columns.type')}</th>
                  <th className="text-left py-3 px-2 text-sm font-medium text-white/70">{t('subscription.transactions.columns.details')}</th>
                  <th className="text-right py-3 px-2 text-sm font-medium text-white/70">{t('subscription.transactions.columns.amount')}</th>
                  <th className="text-right py-3 px-2 text-sm font-medium text-white/70">{t('subscription.transactions.columns.date')}</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction) => {
                  const TypeIcon = TYPE_ICONS[transaction.type] || ArrowDownCircle;
                  const typeColor = TYPE_COLORS[transaction.type] || "text-gray-300";
                  const typeLabel = t(`subscription.transactions.types.${transaction.type}`, transaction.type);

                  return (
                    <tr
                      key={transaction.id}
                      className="border-b border-white/10 hover:bg-white/5 transition-colors"
                    >
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-2">
                          <TypeIcon className={typeColor} size={18} />
                          <span className="text-sm text-white font-medium">{typeLabel}</span>
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <div className="text-sm text-white/70">
                          {transaction.featureName && (
                            <div>{transaction.featureName}</div>
                          )}
                          {transaction.refunded && (
                            <span className="text-xs text-purple-300">{t('subscription.transactions.refunded')}</span>
                          )}
                          {transaction.metadata && transaction.metadata.reason && (
                            <div className="text-xs text-white/50">{transaction.metadata.reason}</div>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-2 text-right">
                        <span
                          className={`text-sm font-semibold ${
                            transaction.amount > 0 ? "text-green-300" : "text-blue-300"
                          }`}
                        >
                          {formatAmount(transaction.amount)}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-right">
                        <span className="text-xs text-white/60">
                          {formatDate(transaction.createdAt)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/20">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} />
              {t('subscription.transactions.pagination.previous')}
            </button>

            <span className="text-sm text-white/70">
              {t('subscription.transactions.pagination.page', { page: page + 1 })}
            </span>

            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={!hasMore}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('subscription.transactions.pagination.next')}
              <ChevronRight size={16} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
