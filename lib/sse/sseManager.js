/**
 * SSE (Server-Sent Events) Manager
 *
 * Gère les connexions SSE pour la synchronisation temps réel de l'état d'onboarding
 * entre plusieurs devices (PC, tablette, mobile) pour un même utilisateur.
 *
 * Features:
 * - Connexions multiples par utilisateur (multi-device)
 * - Broadcast ciblé par userId
 * - Gestion automatique des connexions fermées
 * - Heartbeat pour maintenir les connexions actives
 *
 * Événements supportés:
 * - onboarding:updated - Mise à jour progressive de l'état
 * - onboarding:reset - Reset complet de l'onboarding
 */

class SSEManager {
  constructor() {
    // Map: userId -> Set<controller>
    // Stocke toutes les connexions SSE actives par utilisateur
    this.connections = new Map();

    // Statistiques (optionnel, pour monitoring)
    this.stats = {
      totalConnections: 0,
      totalDisconnections: 0,
      totalBroadcasts: 0
    };
  }

  /**
   * Ajoute une nouvelle connexion SSE pour un utilisateur
   * @param {string} userId - ID de l'utilisateur
   * @param {ReadableStreamDefaultController} controller - Controller du stream SSE
   */
  addConnection(userId, controller) {
    if (!this.connections.has(userId)) {
      this.connections.set(userId, new Set());
    }

    this.connections.get(userId).add(controller);
    this.stats.totalConnections++;

    // Log pour debug (dev only)
    if (process.env.NODE_ENV === 'development') {
      console.log(`[SSE] Connexion ajoutée pour user ${userId}. Total: ${this.connections.get(userId).size}`);
    }
  }

  /**
   * Retire une connexion SSE pour un utilisateur
   * @param {string} userId - ID de l'utilisateur
   * @param {ReadableStreamDefaultController} controller - Controller du stream SSE
   */
  removeConnection(userId, controller) {
    const userConnections = this.connections.get(userId);

    if (!userConnections) return;

    userConnections.delete(controller);
    this.stats.totalDisconnections++;

    // Si plus aucune connexion pour cet user, nettoyer la Map
    if (userConnections.size === 0) {
      this.connections.delete(userId);
    }

    // Log pour debug (dev only)
    if (process.env.NODE_ENV === 'development') {
      console.log(`[SSE] Connexion retirée pour user ${userId}. Total: ${userConnections.size}`);
    }
  }

  /**
   * Broadcast un événement à toutes les connexions d'un utilisateur
   * @param {string} userId - ID de l'utilisateur
   * @param {string} event - Nom de l'événement (ex: 'onboarding:updated')
   * @param {Object} data - Données à envoyer (sera stringifié en JSON)
   * @returns {number} Nombre de connexions qui ont reçu le message
   */
  broadcast(userId, event, data) {
    const userConnections = this.connections.get(userId);

    if (!userConnections || userConnections.size === 0) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[SSE] Pas de connexion active pour user ${userId}, broadcast ignoré`);
      }
      return 0;
    }

    // Format SSE standard:
    // event: nom_event
    // data: {"key": "value"}
    // (ligne vide pour terminer)
    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    const encoder = new TextEncoder();
    const encodedMessage = encoder.encode(message);

    let successCount = 0;
    const failedControllers = [];

    // Envoyer à toutes les connexions de cet utilisateur
    userConnections.forEach(controller => {
      try {
        controller.enqueue(encodedMessage);
        successCount++;
      } catch (error) {
        // Connexion fermée ou erreur d'écriture
        if (process.env.NODE_ENV === 'development') {
          console.error(`[SSE] Erreur broadcast pour user ${userId}:`, error.message);
        }
        failedControllers.push(controller);
      }
    });

    // Nettoyer les connexions en erreur
    failedControllers.forEach(controller => {
      this.removeConnection(userId, controller);
    });

    this.stats.totalBroadcasts++;

    // Log pour debug (dev only)
    if (process.env.NODE_ENV === 'development') {
      console.log(`[SSE] Broadcast '${event}' vers ${successCount} connexion(s) pour user ${userId}`);
    }

    return successCount;
  }

  /**
   * Envoie un heartbeat (keepalive) à toutes les connexions d'un utilisateur
   * @param {string} userId - ID de l'utilisateur
   * @returns {number} Nombre de connexions qui ont reçu le heartbeat
   */
  sendHeartbeat(userId) {
    const userConnections = this.connections.get(userId);

    if (!userConnections || userConnections.size === 0) {
      return 0;
    }

    const heartbeatMessage = ': heartbeat\n\n';
    const encoder = new TextEncoder();
    const encodedMessage = encoder.encode(heartbeatMessage);

    let successCount = 0;
    const failedControllers = [];

    userConnections.forEach(controller => {
      try {
        controller.enqueue(encodedMessage);
        successCount++;
      } catch (error) {
        failedControllers.push(controller);
      }
    });

    // Nettoyer les connexions en erreur
    failedControllers.forEach(controller => {
      this.removeConnection(userId, controller);
    });

    return successCount;
  }

  /**
   * Retourne le nombre de connexions actives pour un utilisateur
   * @param {string} userId - ID de l'utilisateur
   * @returns {number} Nombre de connexions actives
   */
  getConnectionCount(userId) {
    return this.connections.get(userId)?.size || 0;
  }

  /**
   * Retourne le nombre total de connexions actives (tous utilisateurs)
   * @returns {number} Nombre total de connexions
   */
  getTotalConnectionCount() {
    let total = 0;
    this.connections.forEach(userConnections => {
      total += userConnections.size;
    });
    return total;
  }

  /**
   * Retourne le nombre d'utilisateurs avec au moins une connexion active
   * @returns {number} Nombre d'utilisateurs connectés
   */
  getActiveUserCount() {
    return this.connections.size;
  }

  /**
   * Retourne les statistiques du manager
   * @returns {Object} Statistiques
   */
  getStats() {
    return {
      ...this.stats,
      activeUsers: this.getActiveUserCount(),
      totalActiveConnections: this.getTotalConnectionCount()
    };
  }

  /**
   * Ferme toutes les connexions d'un utilisateur (cleanup)
   * @param {string} userId - ID de l'utilisateur
   * @returns {number} Nombre de connexions fermées
   */
  closeAllConnections(userId) {
    const userConnections = this.connections.get(userId);

    if (!userConnections) return 0;

    const count = userConnections.size;

    userConnections.forEach(controller => {
      try {
        controller.close();
      } catch (error) {
        // Ignorer les erreurs de fermeture
      }
    });

    this.connections.delete(userId);

    if (process.env.NODE_ENV === 'development') {
      console.log(`[SSE] Fermeture de ${count} connexion(s) pour user ${userId}`);
    }

    return count;
  }

  /**
   * Ferme toutes les connexions (shutdown complet)
   * @returns {number} Nombre total de connexions fermées
   */
  shutdown() {
    let totalClosed = 0;

    this.connections.forEach((userConnections, userId) => {
      userConnections.forEach(controller => {
        try {
          controller.close();
          totalClosed++;
        } catch (error) {
          // Ignorer les erreurs de fermeture
        }
      });
    });

    this.connections.clear();

    if (process.env.NODE_ENV === 'development') {
      console.log(`[SSE] Shutdown complet : ${totalClosed} connexion(s) fermée(s)`);
    }

    return totalClosed;
  }
}

// Instance singleton exportée
export const sseManager = new SSEManager();

// Export de la classe pour tests
export { SSEManager };
