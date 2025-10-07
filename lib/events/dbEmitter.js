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
    const listenerCount = this.listenerCount('task:updated');
    console.log(`[DBEmitter] 📢 Émission task:updated - ${taskId} pour user ${userId} (${listenerCount} listener(s))`);

    if (listenerCount === 0) {
      console.warn(`[DBEmitter] ⚠️ AUCUN LISTENER pour task:updated ! L'événement sera perdu !`);
    }

    this.emit('task:updated', { taskId, userId, data });
  }

  // Émettre un événement de mise à jour de CV
  emitCvUpdate(filename, userId, data) {
    const listenerCount = this.listenerCount('cv:updated');
    console.log(`[DBEmitter] 📢 Émission cv:updated - ${filename} pour user ${userId} (${listenerCount} listener(s))`);

    if (listenerCount === 0) {
      console.warn(`[DBEmitter] ⚠️ AUCUN LISTENER pour cv:updated ! L'événement sera perdu !`);
    }

    this.emit('cv:updated', { filename, userId, data });
  }

  // Émettre un événement générique
  emitDbChange(entity, id, userId, data) {
    const listenerCount = this.listenerCount('db:change');
    console.log(`[DBEmitter] 📢 Émission db:change - ${entity}:${id} pour user ${userId} (${listenerCount} listener(s))`);
    this.emit('db:change', { entity, id, userId, data });
  }
}

// Utiliser globalThis pour garantir une vraie instance unique en environnement serverless
if (!globalThis.__dbEmitter) {
  console.log('[DBEmitter] 🆕 Création de la première instance DBEmitter');
  globalThis.__dbEmitter = new DBEmitter();
} else {
  console.log('[DBEmitter] ♻️ Réutilisation de l\'instance DBEmitter existante');
}

const dbEmitter = globalThis.__dbEmitter;

export default dbEmitter;
