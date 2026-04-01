export function formatSessionEnd({ user, session }) {
  const isNew = user.isNewUser;
  const statusEmoji = isNew ? '🟢' : '🔄';
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

function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes} min ${seconds.toString().padStart(2, '0')}s`;
}

function formatLastVisit(previousLoginAt) {
  if (!previousLoginAt) return '_Première visite_';
  const date = new Date(previousLoginAt);
  const tz = 'Europe/Paris';
  const dateStr = date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: tz });
  const timeStr = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: tz });
  const daysAgo = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
  const ago = daysAgo === 0 ? "aujourd'hui" : daysAgo === 1 ? 'hier' : `il y a ${daysAgo}j`;
  return `${dateStr} à ${timeStr} (${ago})`;
}
