'use client';

import { useState, useEffect } from 'react';
import { KPICard } from './KPICard';
import { CustomSelect } from './CustomSelect';
import { Toast } from './Toast';
import { ConfirmDialog } from './ConfirmDialog';

export function FeedbackTab({ period, userId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [bugFilter, setBugFilter] = useState('all');
  const [selectedFeedback, setSelectedFeedback] = useState(null);
  const [toast, setToast] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);

  useEffect(() => {
    fetchData();
  }, [period, userId, statusFilter, bugFilter]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        period,
        status: statusFilter,
        isBugReport: bugFilter,
      });

      if (userId) {
        params.append('userId', userId);
      }

      const response = await fetch(`/api/analytics/feedbacks?${params}`);
      if (!response.ok) throw new Error('Failed to fetch data');
      const result = await response.json();
      setData(result);
      setError(null);
    } catch (err) {
      console.error('Error fetching feedback data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (feedbackId, newStatus) => {
    try {
      const response = await fetch('/api/analytics/feedbacks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedbackId, status: newStatus }),
      });

      if (!response.ok) throw new Error('Failed to update status');

      // Refresh data
      await fetchData();
    } catch (err) {
      console.error('Error updating feedback status:', err);
      setToast({ type: 'error', message: 'Erreur lors de la mise à jour du statut' });
    }
  };

  const handleDeleteFeedback = async (feedbackId) => {
    setConfirmDialog({
      title: 'Supprimer ce feedback ?',
      message: 'Cette action est irréversible.',
      type: 'danger',
      confirmText: 'Supprimer',
      cancelText: 'Annuler',
      onConfirm: async () => {
        try {
          const response = await fetch(`/api/analytics/feedbacks?id=${encodeURIComponent(feedbackId)}`, {
            method: 'DELETE',
          });

          if (!response.ok) throw new Error('Failed to delete feedback');

          setToast({ type: 'success', message: 'Feedback supprimé avec succès' });
          // Refresh data
          await fetchData();
        } catch (err) {
          console.error('Error deleting feedback:', err);
          setToast({ type: 'error', message: 'Erreur lors de la suppression du feedback' });
        }
      }
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-white/60">Chargement des feedbacks...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-red-400">Erreur : {error}</div>
      </div>
    );
  }

  if (!data) return null;

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getRatingColor = (rating) => {
    if (rating >= 4) return 'text-green-400';
    if (rating >= 3) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getStatusBadge = (status) => {
    const styles = {
      new: 'bg-blue-500/20 text-blue-400',
      reviewed: 'bg-yellow-500/20 text-yellow-400',
      resolved: 'bg-green-500/20 text-green-400',
    };
    const labels = {
      new: 'Nouveau',
      reviewed: 'En cours',
      resolved: 'Résolu',
    };
    return (
      <span className={`px-2 py-1 text-xs rounded ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  const newFeedbacksCount = data.byStatus.find(s => s.status === 'new')?.count || 0;

  return (
    <div className="space-y-6 pb-8">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          icon="💬"
          label="Total feedbacks"
          value={data.total.count}
          trend={null}
          description="Nombre total de retours utilisateurs reçus sur la période sélectionnée"
        />
        <KPICard
          icon="⭐"
          label="Note moyenne"
          value={data.total.avgRating.toFixed(1) + '/5'}
          trend={null}
          description="Note de satisfaction moyenne attribuée par les utilisateurs sur une échelle de 1 à 5"
        />
        <KPICard
          icon="🐛"
          label="Bugs reportés"
          value={data.total.bugReports}
          subtitle={`${((data.total.bugReports / data.total.count) * 100 || 0).toFixed(0)}% des feedbacks`}
          description="Nombre de feedbacks marqués comme bug ou problème technique, nécessitant une investigation"
        />
        <KPICard
          icon="🔔"
          label="Non traités"
          value={newFeedbacksCount}
          subtitle="À traiter"
          description="Feedbacks avec le statut 'nouveau' qui n'ont pas encore été examinés ou traités par l'équipe"
        />
      </div>

      {/* Filters */}
      <div className="bg-white/5 backdrop-blur-xl rounded-lg border border-white/10 p-4">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <label className="text-white/60 text-sm">Statut:</label>
            <div className="w-40">
              <CustomSelect
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { value: 'all', label: 'Tous' },
                  { value: 'new', label: 'Nouveau' },
                  { value: 'reviewed', label: 'En cours' },
                  { value: 'resolved', label: 'Résolu' },
                ]}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-white/60 text-sm">Type:</label>
            <div className="w-52">
              <CustomSelect
                value={bugFilter}
                onChange={setBugFilter}
                options={[
                  { value: 'all', label: 'Tous' },
                  { value: 'true', label: 'Bugs uniquement' },
                  { value: 'false', label: 'Feedbacks uniquement' },
                ]}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Rating Distribution */}
      <div className="bg-white/5 backdrop-blur-xl rounded-lg border border-white/10 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Répartition des notes</h3>
        <div className="space-y-3">
          {[5, 4, 3, 2, 1].map(rating => {
            const ratingData = data.byRating.find(r => r.rating === rating);
            const count = ratingData?.count || 0;
            const percentage = data.total.count > 0 ? (count / data.total.count) * 100 : 0;

            return (
              <div key={rating} className="flex items-center gap-4">
                <div className="flex items-center gap-1 w-20">
                  <span className={`font-medium ${getRatingColor(rating)}`}>{rating}</span>
                  <span className="text-yellow-400">★</span>
                </div>
                <div className="flex-1">
                  <div className="h-6 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${rating >= 4 ? 'bg-green-500' : rating >= 3 ? 'bg-yellow-500' : 'bg-red-500'}`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
                <div className="w-20 text-right">
                  <span className="text-white font-medium">{count}</span>
                  <span className="text-white/60 text-sm ml-1">({percentage.toFixed(0)}%)</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top Users */}
      {data.topUsers && data.topUsers.length > 0 && (
        <div className="bg-white/5 backdrop-blur-xl rounded-lg border border-white/10 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Top 10 utilisateurs par nombre de feedbacks</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-white/60 text-sm border-b border-white/10">
                  <th className="pb-3">Utilisateur</th>
                  <th className="pb-3 text-right">Feedbacks</th>
                  <th className="pb-3 text-right">Note moyenne</th>
                </tr>
              </thead>
              <tbody>
                {data.topUsers.map((user, index) => (
                  <tr key={index} className="border-b border-white/5 text-white">
                    <td className="py-3">
                      <div>
                        <span className="font-medium">{user.email}</span>
                        {user.name && (
                          <span className="block text-sm text-white/60">{user.name}</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 text-right text-white/80">
                      {user.feedbackCount}
                    </td>
                    <td className="py-3 text-right">
                      <span className={`font-medium ${getRatingColor(user.avgRating)}`}>
                        {user.avgRating.toFixed(1)} ★
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Feedbacks List */}
      <div className="bg-white/5 backdrop-blur-xl rounded-lg border border-white/10 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">
          Liste des feedbacks ({data.feedbacks.length})
        </h3>
        <div className="space-y-3">
          {data.feedbacks.map((feedback) => (
            <div
              key={feedback.id}
              className="p-4 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition cursor-pointer"
              onClick={() => setSelectedFeedback(selectedFeedback?.id === feedback.id ? null : feedback)}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`text-lg font-bold ${getRatingColor(feedback.rating)}`}>
                      {feedback.rating} ★
                    </span>
                    {feedback.isBugReport && (
                      <span className="px-2 py-1 text-xs bg-red-500/20 text-red-400 rounded">
                        🐛 Bug
                      </span>
                    )}
                    {getStatusBadge(feedback.status)}
                    <span className="text-white/60 text-sm">
                      {formatDate(feedback.createdAt)}
                    </span>
                  </div>

                  <div className="text-white/80 text-sm mb-2">
                    <span className="font-medium">{feedback.user.email}</span>
                    {feedback.user.name && (
                      <span className="text-white/60"> • {feedback.user.name}</span>
                    )}
                  </div>

                  <p className="text-white mb-2">{feedback.comment}</p>

                  {selectedFeedback?.id === feedback.id && (
                    <div className="mt-4 pt-4 border-t border-white/10 space-y-2">
                      {feedback.currentCvFile && (
                        <div className="text-sm">
                          <span className="text-white/60">CV:</span>
                          <span className="text-white ml-2">{feedback.currentCvFile}</span>
                        </div>
                      )}
                      {feedback.pageUrl && (
                        <div className="text-sm">
                          <span className="text-white/60">Page:</span>
                          <span className="text-white ml-2 break-all">{feedback.pageUrl}</span>
                        </div>
                      )}
                      {feedback.userAgent && (
                        <div className="text-sm">
                          <span className="text-white/60">Navigateur:</span>
                          <span className="text-white/80 ml-2 text-xs break-all">{feedback.userAgent}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
                  <div className="w-28">
                    <CustomSelect
                      value={feedback.status}
                      onChange={(newStatus) => handleStatusChange(feedback.id, newStatus)}
                      options={[
                        { value: 'new', label: 'Nouveau' },
                        { value: 'reviewed', label: 'En cours' },
                        { value: 'resolved', label: 'Résolu' },
                      ]}
                    />
                  </div>
                  <button
                    onClick={() => handleDeleteFeedback(feedback.id)}
                    className="px-3 py-1.5 text-xs bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded transition w-28"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            </div>
          ))}

          {data.feedbacks.length === 0 && (
            <div className="text-center py-12 text-white/60">
              Aucun feedback pour cette période
            </div>
          )}
        </div>
      </div>

      {/* Status Summary */}
      <div className="bg-white/5 backdrop-blur-xl rounded-lg border border-white/10 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Statut des feedbacks</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {data.byStatus.map((statusItem) => {
            const percentage = data.total.count > 0
              ? ((statusItem.count / data.total.count) * 100).toFixed(0)
              : 0;
            const labels = {
              new: { label: 'Nouveaux', icon: '🔔', color: 'blue' },
              reviewed: { label: 'En cours', icon: '👀', color: 'yellow' },
              resolved: { label: 'Résolus', icon: '✅', color: 'green' },
            };
            const config = labels[statusItem.status] || { label: statusItem.status, icon: '📊', color: 'gray' };

            return (
              <div key={statusItem.status} className={`p-4 bg-${config.color}-500/10 border border-${config.color}-500/20 rounded-lg`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">{config.icon}</span>
                  <span className="text-white/60 text-sm">{config.label}</span>
                </div>
                <div className="text-3xl font-bold text-white mb-1">
                  {statusItem.count}
                </div>
                <div className="text-white/60 text-sm">
                  {percentage}% du total
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Toast and Confirm Dialog */}
      <Toast toast={toast} onClose={() => setToast(null)} />
      <ConfirmDialog dialog={confirmDialog} onClose={() => setConfirmDialog(null)} />
    </div>
  );
}
