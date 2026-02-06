'use client';

import { CustomSelect } from '../CustomSelect';
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
  onRoleChange,
  onEdit,
  onValidateEmail,
  onDelete,
}) {
  return (
    <div className="p-4 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition">
      <div className="flex items-start justify-between gap-4">
        {/* Infos utilisateur */}
        <div className="flex items-center gap-4 flex-1 min-w-0">
          {/* Avatar */}
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
            {user.name?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase() || '?'}
          </div>

          {/* Détails */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-white font-medium truncate">
                {user.name || 'Sans nom'}
              </span>
              <RoleBadge role={user.role} />
              <OAuthBadge oauthProviders={user.oauthProviders} />
              <EmailStatusBadge emailVerified={user.emailVerified} />
            </div>

            {/* Abonnement et crédits */}
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <PlanBadge subscription={user.subscription} />
              <BillingPeriodBadge subscription={user.subscription} />
              <CreditsBadge credits={user.credits} />
            </div>

            <div className="text-white/60 text-sm truncate mb-1">
              {user.email}
            </div>

            <div className="flex items-center gap-4 text-xs text-white/40 flex-wrap">
              <span>📄 {user.cvCount} CV{user.cvCount > 1 ? 's' : ''}</span>
              <span>📅 Inscrit le {formatDate(user.createdAt)}</span>
              <span>🕐 Dernière activité : {formatDateTime(user.lastActivity)}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 flex-shrink-0">
          {/* Modifier rôle */}
          <div className="w-28">
            <CustomSelect
              value={user.role}
              onChange={(newRole) => !updating && onRoleChange(user.id, newRole)}
              options={[
                { value: 'USER', label: 'USER' },
                { value: 'ADMIN', label: 'ADMIN' },
              ]}
            />
          </div>

          {/* Éditer utilisateur */}
          <button
            onClick={() => !updating && onEdit(user)}
            disabled={updating}
            className="px-3 py-1.5 text-xs bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-sm transition w-28 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Éditer
          </button>

          {/* Valider email (si non vérifié) */}
          {!user.emailVerified && (
            <button
              onClick={() => onValidateEmail(user.id)}
              disabled={updating}
              className="px-3 py-1.5 text-xs bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-sm transition w-28 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Valider email
            </button>
          )}

          {/* Supprimer */}
          <button
            onClick={() => !updating && onDelete(user)}
            disabled={updating}
            className="px-3 py-1.5 text-xs bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-sm transition w-28 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Supprimer
          </button>
        </div>
      </div>
    </div>
  );
}
