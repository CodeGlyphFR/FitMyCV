/**
 * Templates HTML fallback pour les emails
 * Utilisés quand aucun template n'est défini dans la base de données
 */

/**
 * Template de base avec header et footer FitMyCV
 */
function getBaseTemplate(title, content) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">FitMyCV.io</h1>
  </div>
  <div style="background: #ffffff; padding: 40px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
    ${content}
  </div>
  <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
    <p>&copy; ${new Date().getFullYear()} FitMyCV.io. Tous droits réservés.</p>
  </div>
</body>
</html>`;
}

/**
 * Bouton CTA standard
 */
function getCtaButton(url, text) {
  return `
    <div style="text-align: center; margin: 40px 0;">
      <a href="${url}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 40px; text-decoration: none; border-radius: 5px; font-weight: 600; font-size: 16px; display: inline-block;">
        ${text}
      </a>
    </div>`;
}

/**
 * Lien de secours
 */
function getFallbackLink(url) {
  return `
    <p style="font-size: 14px; color: #666; margin-top: 30px;">
      Si le bouton ne fonctionne pas, vous pouvez copier et coller ce lien dans votre navigateur :
    </p>
    <p style="font-size: 13px; color: #667eea; word-break: break-all; background: #f5f5f5; padding: 10px; border-radius: 5px;">
      ${url}
    </p>`;
}

/**
 * Template email de vérification
 */
export function getVerificationEmailTemplate(params, variables) {
  const { verificationUrl, userName } = variables;
  const content = `
    <h2 style="color: #333; margin-top: 0;">Bienvenue ${userName} !</h2>
    <p style="font-size: 16px; color: #555;">
      Merci de vous être inscrit sur FitMyCV.io. Pour commencer à utiliser votre compte, veuillez vérifier votre adresse email en cliquant sur le bouton ci-dessous.
    </p>
    ${getCtaButton(verificationUrl, 'Vérifier mon email')}
    ${getFallbackLink(verificationUrl)}
    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
    <p style="font-size: 12px; color: #999;">
      Ce lien expire dans 24 heures. Si vous n'avez pas créé de compte, vous pouvez ignorer cet email.
    </p>`;
  return getBaseTemplate('Vérifiez votre adresse email', content);
}

/**
 * Template email de réinitialisation de mot de passe
 */
export function getPasswordResetEmailTemplate(params, variables) {
  const { resetUrl, userName } = variables;
  const content = `
    <h2 style="color: #333; margin-top: 0;">Bonjour ${userName} !</h2>
    <p style="font-size: 16px; color: #555;">
      Vous avez demandé à réinitialiser votre mot de passe. Cliquez sur le bouton ci-dessous pour définir un nouveau mot de passe.
    </p>
    ${getCtaButton(resetUrl, 'Réinitialiser mon mot de passe')}
    ${getFallbackLink(resetUrl)}
    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
    <p style="font-size: 14px; color: #e63946; font-weight: 600;">
      Attention
    </p>
    <p style="font-size: 13px; color: #666;">
      Ce lien expire dans 1 heure. Si vous n'avez pas demandé de réinitialisation de mot de passe, vous pouvez ignorer cet email en toute sécurité.
    </p>`;
  return getBaseTemplate('Réinitialisation de votre mot de passe', content);
}

/**
 * Template email de changement d'adresse
 */
export function getEmailChangeTemplate(params, variables) {
  const { verificationUrl, userName, newEmail } = variables;
  const content = `
    <h2 style="color: #333; margin-top: 0;">Bonjour ${userName} !</h2>
    <p style="font-size: 16px; color: #555;">
      Vous avez demandé à modifier votre adresse email. Pour confirmer ce changement, veuillez cliquer sur le bouton ci-dessous.
    </p>
    <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
      <p style="margin: 0; font-size: 14px; color: #666;">Nouvelle adresse email :</p>
      <p style="margin: 5px 0 0; font-size: 16px; font-weight: 600; color: #333;">${newEmail}</p>
    </div>
    ${getCtaButton(verificationUrl, 'Confirmer la modification')}
    ${getFallbackLink(verificationUrl)}
    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
    <p style="font-size: 14px; color: #e63946; font-weight: 600;">
      Important
    </p>
    <p style="font-size: 13px; color: #666;">
      Ce lien expire dans 24 heures. Si vous n'avez pas demandé ce changement, veuillez ignorer cet email et votre adresse actuelle restera inchangée.
    </p>`;
  return getBaseTemplate('Confirmez votre nouvelle adresse email', content);
}

/**
 * Template email de bienvenue
 */
export function getWelcomeEmailTemplate(params, variables) {
  const { loginUrl, userName } = variables;
  const displayName = userName || 'utilisateur';
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Bienvenue sur FitMyCV.io</title>
    </head>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5;">
      <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 40px 20px;">
            <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              <tr>
                <td style="padding: 40px 40px 30px; text-align: center; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); border-radius: 12px 12px 0 0;">
                  <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">
                    Bienvenue sur FitMyCV.io
                  </h1>
                </td>
              </tr>
              <tr>
                <td style="padding: 40px;">
                  <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                    Bonjour ${displayName},
                  </p>
                  <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                    Votre compte a été créé avec succès ! Vous pouvez maintenant profiter de toutes les fonctionnalités de FitMyCV.io pour créer des CV optimisés et adaptés à vos candidatures.
                  </p>
                  <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 30px;">
                    Voici ce que vous pouvez faire :
                  </p>
                  <ul style="color: #374151; font-size: 16px; line-height: 1.8; margin: 0 0 30px; padding-left: 20px;">
                    <li>Créer et personnaliser vos CV</li>
                    <li>Adapter vos CV à chaque offre d'emploi grâce à l'IA</li>
                    <li>Exporter vos CV en PDF</li>
                    <li>Gérer plusieurs versions de vos CV</li>
                  </ul>
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${loginUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; text-decoration: none; font-weight: 600; font-size: 16px; border-radius: 8px;">
                      Accéder à mon compte
                    </a>
                  </div>
                  <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 20px 0 0; text-align: center;">
                    Si vous avez des questions, n'hésitez pas à nous contacter.
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding: 30px 40px; background-color: #f9fafb; border-radius: 0 0 12px 12px; border-top: 1px solid #e5e7eb;">
                  <p style="color: #9ca3af; font-size: 12px; line-height: 1.5; margin: 0; text-align: center;">
                    &copy; ${new Date().getFullYear()} FitMyCV.io - Tous droits réservés<br>
                    Cet email a été envoyé automatiquement, merci de ne pas y répondre.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>`;
}

/**
 * Template email de confirmation d'achat de crédits
 */
export function getPurchaseCreditsEmailTemplate(params, variables) {
  const { userName, creditsAmount, totalPrice, invoiceUrl } = variables;
  const displayName = userName || 'utilisateur';
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Confirmation d'achat - FitMyCV.io</title>
    </head>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5;">
      <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 40px 20px;">
            <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              <tr>
                <td style="padding: 40px 40px 30px; text-align: center; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 12px 12px 0 0;">
                  <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">
                    Achat confirmé !
                  </h1>
                </td>
              </tr>
              <tr>
                <td style="padding: 40px;">
                  <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                    Bonjour ${displayName},
                  </p>
                  <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 30px;">
                    Merci pour votre achat ! Votre paiement a été traité avec succès.
                  </p>
                  <table role="presentation" style="width: 100%; background-color: #f9fafb; border-radius: 8px; margin-bottom: 30px;">
                    <tr>
                      <td style="padding: 20px;">
                        <p style="color: #6b7280; font-size: 14px; margin: 0 0 10px; text-transform: uppercase; letter-spacing: 0.5px;">
                          Détails de l'achat
                        </p>
                        <table role="presentation" style="width: 100%;">
                          <tr>
                            <td style="color: #374151; font-size: 16px; padding: 8px 0;">Crédits achetés</td>
                            <td style="color: #374151; font-size: 16px; padding: 8px 0; text-align: right; font-weight: 600;">${creditsAmount} crédits</td>
                          </tr>
                          <tr>
                            <td style="color: #374151; font-size: 16px; padding: 8px 0; border-top: 1px solid #e5e7eb;">Total</td>
                            <td style="color: #10b981; font-size: 18px; padding: 8px 0; text-align: right; font-weight: 700; border-top: 1px solid #e5e7eb;">${totalPrice}</td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                  <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                    Vos crédits ont été ajoutés à votre compte et sont disponibles immédiatement.
                  </p>
                  ${invoiceUrl ? `
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${invoiceUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; text-decoration: none; font-weight: 600; font-size: 16px; border-radius: 8px;">
                      Voir ma facture
                    </a>
                  </div>
                  ` : ''}
                  <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 20px 0 0; text-align: center;">
                    Si vous avez des questions concernant votre achat, n'hésitez pas à nous contacter.
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding: 30px 40px; background-color: #f9fafb; border-radius: 0 0 12px 12px; border-top: 1px solid #e5e7eb;">
                  <p style="color: #9ca3af; font-size: 12px; line-height: 1.5; margin: 0; text-align: center;">
                    &copy; ${new Date().getFullYear()} FitMyCV.io - Tous droits réservés<br>
                    Cet email a été envoyé automatiquement, merci de ne pas y répondre.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>`;
}
