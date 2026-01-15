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

  // Émettre un événement de génération CV v2 - progression d'une offre
  emitCvGenerationProgress(userId, data) {
    this.emit('cv_generation_v2:offer_progress', { userId, data });
  }

  // Émettre un événement de génération CV v2 - offre terminée
  emitCvGenerationOfferCompleted(userId, data) {
    this.emit('cv_generation_v2:offer_completed', { userId, data });
  }

  // Émettre un événement de génération CV v2 - offre échouée
  emitCvGenerationOfferFailed(userId, data) {
    this.emit('cv_generation_v2:offer_failed', { userId, data });
  }

  // Émettre un événement de génération CV v2 - tâche terminée
  emitCvGenerationCompleted(userId, data) {
    this.emit('cv_generation_v2:completed', { userId, data });
  }
}

// Utiliser globalThis pour garantir une vraie instance unique en environnement serverless
if (!globalThis.__dbEmitter) {
  globalThis.__dbEmitter = new DBEmitter();
}

const dbEmitter = globalThis.__dbEmitter;

export default dbEmitter;
