/**
 * Data migration: Domain migration fitmycv.io → fitmycv.fr
 *
 * The .io domain is being retired. Email templates edited in the admin are stored
 * in the database (seeds in prisma/email-templates/ only cover fresh installs), so
 * their URLs (logos: https://app.fitmycv.io/icons/...) and brand name must be updated.
 *
 * Tables impactées :
 * - EmailTemplate.subject / htmlContent / designJson
 *   1. "fitmycv.io" → "fitmycv.fr"   (URLs + email addresses)
 *   2. "FitMyCV.io" → "FitMyCV"      (brand name)
 *
 * Setting.value is only reported (not modified) if it still references fitmycv.io.
 * Idempotent: re-running finds nothing left to replace.
 */

module.exports = async (prisma) => {
  const updated = await prisma.$executeRaw`
    UPDATE "EmailTemplate"
    SET
      "subject"     = REPLACE(REPLACE("subject",     'fitmycv.io', 'fitmycv.fr'), 'FitMyCV.io', 'FitMyCV'),
      "htmlContent" = REPLACE(REPLACE("htmlContent", 'fitmycv.io', 'fitmycv.fr'), 'FitMyCV.io', 'FitMyCV'),
      "designJson"  = REPLACE(REPLACE("designJson",  'fitmycv.io', 'fitmycv.fr'), 'FitMyCV.io', 'FitMyCV'),
      "updatedAt"   = NOW()
    WHERE "subject" LIKE '%fitmycv.io%' OR "subject" LIKE '%FitMyCV.io%'
       OR "htmlContent" LIKE '%fitmycv.io%' OR "htmlContent" LIKE '%FitMyCV.io%'
       OR "designJson" LIKE '%fitmycv.io%' OR "designJson" LIKE '%FitMyCV.io%'
  `;
  console.log(`[domain-fitmycv-fr] EmailTemplate : ${updated} template(s) mis à jour.`);

  const settings = await prisma.$queryRaw`
    SELECT "settingName" FROM "Setting" WHERE "value" ILIKE '%fitmycv.io%'
  `;
  if (settings.length > 0) {
    console.warn(
      `[domain-fitmycv-fr] ⚠️ Setting(s) référençant encore fitmycv.io (non modifiés) : ${settings
        .map((s) => s.settingName)
        .join(', ')}`
    );
  } else {
    console.log('[domain-fitmycv-fr] Setting : aucune référence à fitmycv.io.');
  }
};
