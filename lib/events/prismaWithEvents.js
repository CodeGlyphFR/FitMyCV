import prisma from "@/lib/prisma";
import dbEmitter from "./dbEmitter";

/**
 * Met à jour une BackgroundTask et émet un événement
 */
export async function updateBackgroundTask(taskId, userId, data) {
  if (!taskId) return null;

  try {
    console.log(`[prismaWithEvents] 📝 Mise à jour de la tâche: ${taskId} pour user ${userId}`, data);

    const updated = await prisma.backgroundTask.updateMany({
      where: { id: taskId, userId },
      data,
    });

    if (updated.count > 0) {
      // Émettre un événement pour notifier les clients connectés
      console.log(`[prismaWithEvents] 📢 Émission de l'événement task:updated...`);
      dbEmitter.emitTaskUpdate(taskId, userId, data);
    } else {
      console.log(`[prismaWithEvents] ⚠️ Aucune tâche mise à jour (count: 0)`);
    }

    return updated;
  } catch (error) {
    console.warn(`[prismaWithEvents] ❌ Impossible de mettre à jour la tâche ${taskId}`, error);
    return null;
  }
}

/**
 * Met à jour un CV File et émet un événement
 */
export async function updateCvFile(userId, filename, data) {
  if (!userId || !filename) {
    console.warn('[prismaWithEvents] updateCvFile appelé sans userId ou filename');
    return null;
  }

  try {
    console.log(`[prismaWithEvents] 📝 Mise à jour du CV: ${filename} pour user ${userId}`, data);

    const updated = await prisma.cvFile.update({
      where: {
        userId_filename: {
          userId,
          filename,
        },
      },
      data,
    });

    // Émettre un événement
    console.log(`[prismaWithEvents] 📢 Émission de l'événement cv:updated...`);
    dbEmitter.emitCvUpdate(filename, userId, data);

    return updated;
  } catch (error) {
    console.warn(`[prismaWithEvents] ❌ Impossible de mettre à jour le CV ${filename}`, error);
    return null;
  }
}

/**
 * Créer une BackgroundTask et émet un événement
 */
export async function createBackgroundTask(data) {
  try {
    const task = await prisma.backgroundTask.create({ data });

    // Émettre un événement
    if (task) {
      dbEmitter.emitTaskUpdate(task.id, task.userId, { status: task.status });
    }

    return task;
  } catch (error) {
    console.error(`[prismaWithEvents] Impossible de créer la tâche`, error);
    throw error;
  }
}

/**
 * Créer un CV File et émet un événement
 */
export async function createCvFile(data) {
  if (!data.userId || !data.filename) {
    console.warn('[prismaWithEvents] createCvFile appelé sans userId ou filename');
    return null;
  }

  try {
    console.log(`[prismaWithEvents] 📝 Création du CV: ${data.filename} pour user ${data.userId}`);

    const created = await prisma.cvFile.create({ data });

    // Émettre un événement
    console.log(`[prismaWithEvents] 📢 Émission de l'événement cv:created...`);
    dbEmitter.emitCvUpdate(data.filename, data.userId, { created: true });

    return created;
  } catch (error) {
    console.warn(`[prismaWithEvents] ❌ Impossible de créer le CV ${data.filename}`, error);
    return null;
  }
}

/**
 * Wrapper générique pour toute opération Prisma avec émission d'événement
 */
export async function withEvents(operation, entity, id, userId) {
  try {
    const result = await operation();

    if (result) {
      dbEmitter.emitDbChange(entity, id, userId, result);
    }

    return result;
  } catch (error) {
    console.error(`[prismaWithEvents] Erreur operation ${entity}:`, error);
    throw error;
  }
}
