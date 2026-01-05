/**
 * Email Triggers Configuration
 *
 * This file defines all available email triggers in the system.
 * Each trigger represents an action that can send an email to a user.
 *
 * To add a new trigger:
 * 1. Add it to the EMAIL_TRIGGERS array
 * 2. Run the seed to create it in the database
 * 3. Create the corresponding send function in emailService.js
 * 4. Integrate the send function where the action happens
 */

export const EMAIL_TRIGGERS = [
  // Authentication
  {
    name: 'email_verification',
    label: 'Verification Email',
    description: "Envoye lors de l'inscription pour verifier l'adresse email",
    category: 'authentication',
    icon: '✉️',
    variables: ['userName', 'verificationUrl'],
  },
  {
    name: 'password_reset',
    label: 'Reset Mot de passe',
    description: "Envoye lors d'une demande de reinitialisation du mot de passe",
    category: 'authentication',
    icon: '🔐',
    variables: ['userName', 'resetUrl'],
  },
  {
    name: 'email_change',
    label: 'Changement Email',
    description: "Envoye pour confirmer un changement d'adresse email",
    category: 'authentication',
    icon: '📧',
    variables: ['userName', 'verificationUrl', 'newEmail'],
  },

  // Account
  {
    name: 'welcome',
    label: 'Bienvenue',
    description: "Envoye apres la verification de l'email pour souhaiter la bienvenue",
    category: 'account',
    icon: '👋',
    variables: ['userName', 'loginUrl', 'welcomeCredits'],
  },

  // Payments
  {
    name: 'purchase_credits',
    label: 'Achat Credits',
    description: "Envoye apres un achat de credits avec le lien vers la facture Stripe",
    category: 'payments',
    icon: '💳',
    variables: ['userName', 'creditsAmount', 'totalPrice', 'invoiceUrl'],
  },
];

/**
 * Get all unique categories from triggers
 * @returns {string[]} Array of category names
 */
export function getCategories() {
  return [...new Set(EMAIL_TRIGGERS.map((t) => t.category))];
}

/**
 * Get a trigger by its name
 * @param {string} name - The trigger name (e.g., 'email_verification')
 * @returns {Object|undefined} The trigger object or undefined
 */
export function getTriggerByName(name) {
  return EMAIL_TRIGGERS.find((t) => t.name === name);
}

/**
 * Get all triggers for a specific category
 * @param {string} category - The category name (e.g., 'authentication')
 * @returns {Object[]} Array of triggers in that category
 */
export function getTriggersByCategory(category) {
  return EMAIL_TRIGGERS.filter((t) => t.category === category);
}

/**
 * Get triggers grouped by category
 * @returns {Object} Object with category names as keys and arrays of triggers as values
 */
export function getTriggersGroupedByCategory() {
  return EMAIL_TRIGGERS.reduce((acc, trigger) => {
    if (!acc[trigger.category]) {
      acc[trigger.category] = [];
    }
    acc[trigger.category].push(trigger);
    return acc;
  }, {});
}

/**
 * Category display names for the UI
 */
export const CATEGORY_LABELS = {
  authentication: 'Authentification',
  account: 'Compte',
  payments: 'Paiements',
};
