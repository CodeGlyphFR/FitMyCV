/**
 * Migration de données : Normaliser les filenames CV
 *
 * Renomme les CvFile.filename contenant "_adapted_" (chaînage de noms source)
 * en format timestamp uniforme yyyyMMddHHmmssSSS.json basé sur le createdAt.
 *
 * Tables impactées :
 * - CvFile.filename
 * - BackgroundTask.cvFile
 * - CvGenerationOffer.generatedCvFileName
 * - Feedback.currentCvFile
 * - BackgroundTask.result (JSON contenant filename/generatedCvs[].filename)
 */

module.exports = async (prisma) => {
  // 1. Récupérer tous les CvFile dont le filename contient "_adapted_"
  const cvFiles = await prisma.cvFile.findMany({
    where: { filename: { contains: '_adapted_' } },
    select: { id: true, userId: true, filename: true, createdAt: true },
  });

  if (cvFiles.length === 0) {
    console.log('[normalize-filenames] Aucun filename à migrer.');
    return;
  }

  console.log(`[normalize-filenames] ${cvFiles.length} fichier(s) à renommer.`);

  // 2. Construire le mapping oldFilename → newFilename par userId
  // Pour garantir l'unicité par user, on garde un Set des filenames déjà utilisés
  const usedFilenamesByUser = new Map();

  // Précharger les filenames existants pour chaque user concerné
  const userIds = [...new Set(cvFiles.map(f => f.userId))];
  for (const userId of userIds) {
    const existing = await prisma.cvFile.findMany({
      where: { userId },
      select: { filename: true },
    });
    usedFilenamesByUser.set(userId, new Set(existing.map(f => f.filename)));
  }

  // Générer un filename basé sur createdAt au format yyyyMMddHHmmssSSS
  function generateTimestampFilename(createdAt) {
    const d = new Date(createdAt);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    const millis = String(d.getMilliseconds()).padStart(3, '0');
    return `${year}${month}${day}${hours}${minutes}${seconds}${millis}.json`;
  }

  const mapping = []; // { cvFileId, userId, oldFilename, newFilename }

  for (const cv of cvFiles) {
    const usedSet = usedFilenamesByUser.get(cv.userId);
    let newFilename = generateTimestampFilename(cv.createdAt);

    // Collision check: ajouter un suffixe aléatoire si le filename existe déjà
    while (usedSet.has(newFilename)) {
      const rand = Math.random().toString(36).substring(2, 6);
      const base = newFilename.replace('.json', '');
      newFilename = `${base}${rand}.json`;
    }

    usedSet.add(newFilename);
    mapping.push({
      cvFileId: cv.id,
      userId: cv.userId,
      oldFilename: cv.filename,
      newFilename,
    });
  }

  console.log(`[normalize-filenames] Mapping construit pour ${mapping.length} fichier(s).`);

  // 3. Appliquer les renommages dans une transaction
  await prisma.$transaction(async (tx) => {
    for (const { cvFileId, userId, oldFilename, newFilename } of mapping) {
      // a. CvFile.filename
      await tx.cvFile.update({
        where: { id: cvFileId },
        data: { filename: newFilename },
      });

      // b. BackgroundTask.cvFile
      await tx.backgroundTask.updateMany({
        where: { userId, cvFile: oldFilename },
        data: { cvFile: newFilename },
      });

      // c. CvGenerationOffer.generatedCvFileName
      await tx.cvGenerationOffer.updateMany({
        where: { generatedCvFileName: oldFilename },
        data: { generatedCvFileName: newFilename },
      });

      // d. Feedback.currentCvFile
      await tx.feedback.updateMany({
        where: { userId, currentCvFile: oldFilename },
        data: { currentCvFile: newFilename },
      });
    }

    // e. BackgroundTask.result (String contenant du JSON) — traiter en batch
    // Récupérer toutes les BackgroundTask qui contiennent un ancien filename dans result
    const oldFilenames = mapping.map(m => m.oldFilename);
    const tasksWithResult = await tx.backgroundTask.findMany({
      where: {
        result: { not: null },
        OR: oldFilenames.map(f => ({
          result: { contains: f },
        })),
      },
      select: { id: true, result: true },
    });

    if (tasksWithResult.length > 0) {
      console.log(`[normalize-filenames] ${tasksWithResult.length} BackgroundTask.result à mettre à jour.`);

      // Construire un lookup rapide old → new
      const filenameMap = new Map(mapping.map(m => [m.oldFilename, m.newFilename]));

      for (const task of tasksWithResult) {
        let resultStr = task.result;
        let changed = false;

        for (const [oldFn, newFn] of filenameMap) {
          if (resultStr.includes(oldFn)) {
            resultStr = resultStr.split(oldFn).join(newFn);
            changed = true;
          }
        }

        if (changed) {
          await tx.backgroundTask.update({
            where: { id: task.id },
            data: { result: resultStr },
          });
        }
      }
    }
  });

  console.log(`[normalize-filenames] Migration terminée. ${mapping.length} fichier(s) renommé(s).`);
};
