'use client';

import {
  RoleBadge,
  EmailStatusBadge,
  OAuthBadge,
  PlanBadge,
  BillingPeriodBadge,
  CreditsBadge
} from './UserBadges';

/**
 * Format date for display
 */
function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Format date and time for display
 */
function formatDateTime(dateString) {
  return new Date(dateString).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Single user row component
 */
export function UserRow({
  user,
  updating,
  subscriptionMode,
  onEdit,
  onValidateEmail,
  onDelete,
}) {
  return (
    <div className="p-3 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition">
      <div className="flex items-start justify-between gap-4">
        {/* Infos utilisateur */}
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {/* Avatar */}
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 mt-0.5">
            {user.name?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase() || '?'}
          </div>

          <div className="flex-1 min-w-0">
            {/* Ligne 1 : Nom + badges */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-white font-medium text-sm truncate">
                {user.name || 'Sans nom'}
              </span>
              <RoleBadge role={user.role} />
              <OAuthBadge oauthProviders={user.oauthProviders} />
              <EmailStatusBadge emailVerified={user.emailVerified} />
              {subscriptionMode && <PlanBadge subscription={user.subscription} />}
              {subscriptionMode && <BillingPeriodBadge subscription={user.subscription} />}
              <CreditsBadge credits={user.credits} />
            </div>

            {/* Ligne 2 : Email */}
            <div className="text-white/50 text-xs truncate mt-0.5">
              {user.email}
            </div>

            {/* Ligne 3 : Méta */}
            <div className="flex items-center gap-3 text-xs text-white/40 mt-0.5">
              <span>📄 {user.cvCount} CV{user.cvCount > 1 ? 's' : ''}</span>
              <span>📅 Inscrit le {formatDate(user.createdAt)}</span>
              <span>🕐 Dernière activité : {formatDateTime(user.lastActivity)}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {!user.emailVerified && (
            <button
              onClick={() => onValidateEmail(user.id)}
              disabled={updating}
              title="Valider l'email"
              className="w-7 h-7 flex items-center justify-center bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </button>
          )}
          <button
            onClick={() => !updating && onEdit(user)}
            disabled={updating}
            title="Éditer"
            className="w-7 h-7 flex items-center justify-center bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={() => !updating && onDelete(user)}
            disabled={updating}
            title="Supprimer"
            className="w-7 h-7 flex items-center justify-center bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
