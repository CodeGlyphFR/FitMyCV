'use client';

import { getPlanColor } from '@/lib/admin/planColors';

/**
 * Role badge component
 */
export function RoleBadge({ role }) {
  if (role === 'ADMIN') {
    return (
      <span className="px-2 py-1 text-xs bg-purple-500/20 text-purple-400 rounded font-medium">
        ADMIN
      </span>
    );
  }
  return (
    <span className="px-2 py-1 text-xs bg-blue-500/20 text-blue-400 rounded font-medium">
      USER
    </span>
  );
}

/**
 * Email status badge component
 */
export function EmailStatusBadge({ emailVerified }) {
  if (emailVerified) {
    return (
      <span className="px-2 py-1 text-xs bg-green-500/20 text-green-400 rounded flex items-center gap-1">
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1.1.5.10-1.414-1.414L9 10.586 7.707 9.293a1.1.5.10-1.414 1.414l2 2a1.1.5.101.414 0l4-4z" clipRule="evenodd" />
        </svg>
        Vérifié
      </span>
    );
  }
  return (
    <span className="px-2 py-1 text-xs bg-orange-500/20 text-orange-400 rounded flex items-center gap-1">
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1.1.5.10.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
      </svg>
      En attente
    </span>
  );
}

/**
 * OAuth badge component
 */
export function OAuthBadge({ oauthProviders }) {
  if (!oauthProviders || oauthProviders.length === 0) return null;

  const icons = {
    google: '🔵',
    github: '⚫',
    apple: '🍎'
  };

  const providerIcons = oauthProviders.map(p => icons[p] || '🔑').join(' ');

  return (
    <span className="px-2 py-1 text-xs bg-indigo-500/20 text-indigo-400 rounded font-medium flex items-center gap-1">
      <span>{providerIcons}</span>
      OAuth
    </span>
  );
}

/**
 * Subscription plan badge component
 */
export function PlanBadge({ subscription }) {
  if (!subscription?.plan) {
    return <span className="px-2 py-0.5 text-xs rounded bg-gray-500/20 text-gray-300">🆓 Gratuit</span>;
  }

  const style = getPlanColor(subscription.plan.tier);

  return (
    <span className={`px-2 py-0.5 text-xs rounded ${style.bg} ${style.text}`}>
      {style.icon} {subscription.plan.name}
    </span>
  );
}

/**
 * Billing period badge component
 */
export function BillingPeriodBadge({ subscription }) {
  if (!subscription?.billingPeriod) return null;

  return (
    <span className="px-2 py-0.5 text-xs rounded bg-emerald-500/20 text-emerald-400">
      {subscription.billingPeriod === 'monthly' ? '📅 Mensuel' : '📅 Annuel'}
    </span>
  );
}

/**
 * Credits badge component
 */
export function CreditsBadge({ credits }) {
  if (!credits || credits <= 0) return null;

  return (
    <span className="px-2 py-0.5 text-xs rounded bg-yellow-500/20 text-yellow-400">
      💎 {credits} crédit{credits > 1 ? 's' : ''}
    </span>
  );
}
