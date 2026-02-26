/**
 * Client PostHog côté serveur (singleton)
 *
 * No-op silencieux si POSTHOG_API_KEY ou POSTHOG_HOST ne sont pas définis,
 * ce qui permet de travailler en dev local sans configuration.
 */

import { PostHog } from 'posthog-node';

let posthogClient = null;

function getClient() {
  if (posthogClient) return posthogClient;

  const apiKey = process.env.POSTHOG_API_KEY || process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.POSTHOG_HOST || process.env.NEXT_PUBLIC_POSTHOG_HOST;

  if (!apiKey || !host) return null;

  posthogClient = new PostHog(apiKey, { host });
  return posthogClient;
}

/**
 * Envoie un événement au serveur PostHog (envoi immédiat, sans queue)
 * @param {string} distinctId - Identifiant unique de l'utilisateur
 * @param {string} event - Nom de l'événement
 * @param {object} properties - Propriétés de l'événement
 */
export function trackServerEvent(distinctId, event, properties = {}) {
  const client = getClient();
  if (!client) return;

  client.captureImmediate({ distinctId, event, properties }).catch(() => {});
}
