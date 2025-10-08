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
}

// Utiliser globalThis pour garantir une vraie instance unique en environnement serverless
if (!globalThis.__dbEmitter) {
  globalThis.__dbEmitter = new DBEmitter();
}

const dbEmitter = globalThis.__dbEmitter;

export default dbEmitter;
