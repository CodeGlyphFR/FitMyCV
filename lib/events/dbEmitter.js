import { EventEmitter } from 'events';

// Event Emitter global pour les changements de base de données
// Utilise globalThis pour garantir une vraie instance unique en serverless
class DBEmitter extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(100); // Augmenter la limite pour gérer plusieurs connexions SSE
  }

  // Émettre un événement de mise à jour de tâche
  emitTaskUpdate(taskId, userId, data) {
    this.emit('task:updated', { taskId, userId, data });
  }

  // Émettre un événement de mise à jour de CV
  emitCvUpdate(filename, userId, data) {
    this.emit('cv:updated', { filename, userId, data });
  }

  // Émettre un événement générique
  emitDbChange(entity, id, userId, data) {
    this.emit('db:change', { entity, id, userId, data });
  }

  // Émettre un événement de génération CV - progression d'une offre
  emitCvGenerationProgress(userId, data) {
    this.emit('cv_generation:offer_progress', { userId, data });
  }

  // Émettre un événement de génération CV - offre terminée
  emitCvGenerationOfferCompleted(userId, data) {
    this.emit('cv_generation:offer_completed', { userId, data });
  }

  // Émettre un événement de génération CV - offre échouée
  emitCvGenerationOfferFailed(userId, data) {
    this.emit('cv_generation:offer_failed', { userId, data });
  }

  // Émettre un événement de génération CV - tâche terminée
  emitCvGenerationCompleted(userId, data) {
    this.emit('cv_generation:completed', { userId, data });
  }

  // Émettre un événement d'amélioration CV - progression
  emitCvImprovementProgress(userId, data) {
    this.emit('cv_improvement:progress', { userId, data });
  }

  // Émettre un événement d'amélioration CV - terminée
  emitCvImprovementCompleted(userId, data) {
    this.emit('cv_improvement:completed', { userId, data });
  }

  // Émettre un événement d'amélioration CV - échouée
  emitCvImprovementFailed(userId, data) {
    this.emit('cv_improvement:failed', { userId, data });
  }

  // Émettre un événement de mise à jour des crédits (dépense, remboursement, achat)
  emitCreditsUpdate(userId, data) {
    this.emit('credits:updated', { userId, data });
  }

  // Émettre un événement de mise à jour des settings (broadcast à tous les utilisateurs)
  emitSettingsUpdate(data) {
    this.emit('settings:updated', { userId: '*', data }); // '*' = broadcast
  }

  // Émettre un événement de mise à jour de l'onboarding
  emitOnboardingUpdate(userId, data) {
    this.emit('onboarding:updated', { userId, data });
  }

  // Émettre un événement de reset de l'onboarding
  emitOnboardingReset(userId, data) {
    this.emit('onboarding:reset', { userId, data });
  }

  // Émettre un événement de validation d'email
  emitEmailVerified(userId, data) {
    this.emit('email:verified', { userId, data });
  }
}

// Utiliser globalThis pour garantir une vraie instance unique en environnement serverless
if (!globalThis.__dbEmitter) {
  globalThis.__dbEmitter = new DBEmitter();
}

const dbEmitter = globalThis.__dbEmitter;

export default dbEmitter;
