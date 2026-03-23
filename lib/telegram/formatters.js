export function formatSessionEnd({ user, session }) {
  const isNew = isNewUser(user);
  const statusEmoji = isNew ? '🆕' : '🔄';
  const statusLabel = isNew ? 'Nouveau compte' : 'Utilisateur existant';
  const duration = formatDuration(session.durationMs);
  const lastVisit = formatLastVisit(user.previousLoginAt);
  const jobTitle = session.jobTitle || '_Aucun CV importé_';
  const features = session.features?.length > 0
    ? session.features.join(' · ')
    : '_Aucune_';
  const cost = session.apiCost > 0
    ? `$${session.apiCost.toFixed(4)} (${session.apiCalls} appels)`
    : '$0.00';

  return [
    `👋 *Session terminée*`,
    ``,
    `👤 *${user.name || 'Anonyme'}* — ${user.email}`,
    `${statusEmoji} ${statusLabel}`,
    ``,
    `💼 *Poste :* ${jobTitle}`,
    ``,
    `⏱ *Durée :* ${duration}`,
    `📅 *Dernière visite :* ${lastVisit}`,
    ``,
    `⚡ *Features :* ${features}`,
    `💰 *Coût API :* ${cost}`,
  ].join('\n');
}

export function formatPayment({ user, pack, balanceAfter, balanceBefore }) {
  return [
    `💳 *Achat de crédits*`,
    ``,
    `👤 *${user.name || 'Anonyme'}* — ${user.email}`,
    ``,
    `📦 *Pack :* ${pack.creditAmount} crédits`,
    `💶 *Montant :* ${pack.price.toFixed(2)} ${pack.priceCurrency}`,
    ``,
    `🏦 *Solde :* ${balanceAfter} crédits _(avait ${balanceBefore})_`,
  ].join('\n');
}

function isNewUser(user) {
  if (!user.createdAt) return false;
  const hoursSinceCreation = (Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60);
  return hoursSinceCreation < 24;
}

function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes} min ${seconds.toString().padStart(2, '0')}s`;
}

function formatLastVisit(previousLoginAt) {
  if (!previousLoginAt) return '_Première visite_';
  const daysAgo = Math.floor((Date.now() - new Date(previousLoginAt).getTime()) / (1000 * 60 * 60 * 24));
  const dateStr = new Date(previousLoginAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  if (daysAgo === 0) return `aujourd\\'hui`;
  if (daysAgo === 1) return `hier (${dateStr})`;
  return `il y a ${daysAgo} jours (${dateStr})`;
}
