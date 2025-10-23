import { PrismaAdapter } from "@next-auth/prisma-adapter";
import GoogleProvider from "next-auth/providers/google";
import GithubProvider from "next-auth/providers/github";
import AppleProvider from "next-auth/providers/apple";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { writeUserCvFile, listUserCvFiles } from "@/lib/cv/storage";
import logger from "@/lib/security/secureLogger";
import { verifyAutoSignInToken, deleteAutoSignInToken } from "@/lib/auth/autoSignIn";
import { trackUserLogin, trackUserRegistration } from "@/lib/telemetry/server";
import { getDefaultTokenLimit } from "@/lib/settings/settingsUtils";

function maybeProvider(condition, providerFactory){
  return condition ? providerFactory() : null;
}

// Cache pour éviter de spammer les logs pour les sessions invalides
// Format: { userId: lastLogTime }
const invalidSessionCache = new Map();
const INVALID_SESSION_LOG_THROTTLE = 60000; // 1 minute

export const authOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60, // 7 jours (réduit de 30 jours pour la sécurité)
    updateAge: 24 * 60 * 60, // Mise à jour toutes les 24h
  },
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === 'production'
        ? `__Secure-next-auth.session-token`
        : `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 // 7 jours (réduit pour la sécurité)
      }
    },
    callbackUrl: {
      name: process.env.NODE_ENV === 'production'
        ? `__Secure-next-auth.callback-url`
        : `next-auth.callback-url`,
      options: {
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production'
      }
    },
    csrfToken: {
      name: process.env.NODE_ENV === 'production'
        ? `__Host-next-auth.csrf-token`
        : `next-auth.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production'
      }
    },
  },
  pages: {
    signIn: "/auth",
    error: "/auth",
  },
  providers: [
    maybeProvider(
      process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
      () => GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      })
    ),
    maybeProvider(
      process.env.GITHUB_ID && process.env.GITHUB_SECRET,
      () => GithubProvider({
        clientId: process.env.GITHUB_ID,
        clientSecret: process.env.GITHUB_SECRET,
      })
    ),
    maybeProvider(
      process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET && process.env.APPLE_TEAM_ID && process.env.APPLE_KEY_ID && process.env.APPLE_PRIVATE_KEY,
      () => AppleProvider({
        clientId: process.env.APPLE_CLIENT_ID,
        clientSecret: {
          privateKey: process.env.APPLE_PRIVATE_KEY,
          teamId: process.env.APPLE_TEAM_ID,
          keyId: process.env.APPLE_KEY_ID,
        },
      })
    ),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
        autoSignInToken: { label: "Auto Sign In Token", type: "text" },
      },
      async authorize(credentials){
        // Mode 1: Connexion automatique avec token (après validation email)
        if (credentials?.autoSignInToken) {
          const verification = await verifyAutoSignInToken(credentials.autoSignInToken);
          if (!verification.valid) {
            logger.context('auth', 'warn', 'Token auto-signin invalide');
            return null;
          }

          const user = await prisma.user.findUnique({
            where: { id: verification.userId },
            select: { id: true, email: true, name: true, emailVerified: true },
          });

          if (!user || !user.emailVerified) {
            logger.context('auth', 'warn', 'Utilisateur invalide ou email non vérifié pour auto-signin');
            return null;
          }

          // Supprimer le token (usage unique)
          await deleteAutoSignInToken(credentials.autoSignInToken);

          logger.context('auth', 'info', `Connexion automatique réussie pour user ${user.id}`);
          return {
            id: user.id,
            email: user.email,
            name: user.name,
          };
        }

        // Mode 2: Connexion normale avec email/password
        const email = credentials?.email?.toLowerCase().trim();
        const password = credentials?.password ?? "";
        if (!email || !password) return null;
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.passwordHash) return null;
        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;
        return {
          id: user.id,
          email: user.email,
          name: user.name,
        };
      },
    }),
  ].filter(Boolean),
  callbacks: {
    async jwt({ token, user, trigger, account }){
      if (user){
        token.id = user.id;
        token.name = user.name;
        token.email = user.email;
        // Retirer du cache d'invalidation si l'utilisateur se reconnecte
        invalidSessionCache.delete(user.id);
      }

      // À chaque mise à jour du token, rafraîchir emailVerified et role depuis la DB
      if (token?.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id },
          select: { emailVerified: true, passwordHash: true, role: true },
        });

        // Si l'utilisateur n'existe plus, marquer le token comme invalide
        if (!dbUser) {
          token.invalid = true;
          return token;
        }

        // Si c'est un utilisateur OAuth (pas de passwordHash) et pas encore vérifié, le vérifier maintenant
        if (dbUser && !dbUser.passwordHash && !dbUser.emailVerified) {
          await prisma.user.update({
            where: { id: token.id },
            data: { emailVerified: new Date() },
          });
          token.emailVerified = new Date();
          logger.context('auth', 'info', `Email auto-vérifié pour OAuth user ${token.id}`);
        } else {
          token.emailVerified = dbUser?.emailVerified || null;
        }

        // Ajouter le role au token
        token.role = dbUser?.role || 'USER';
        token.invalid = false;
      }

      return token;
    },
    async session({ session, token }){
      // Si le token est marqué comme invalide (utilisateur supprimé), invalider immédiatement
      if (token?.invalid) {
        // Throttle les logs pour éviter le spam (max 1 log par minute par userId)
        const now = Date.now();
        const lastLogTime = invalidSessionCache.get(token.id);

        if (!lastLogTime || (now - lastLogTime) > INVALID_SESSION_LOG_THROTTLE) {
          logger.context('session', 'warn', `User ${token.id} no longer exists in DB, invalidating session`);
          invalidSessionCache.set(token.id, now);

          // Nettoyer le cache (garder seulement les 10 dernières entrées)
          if (invalidSessionCache.size > 10) {
            const entries = Array.from(invalidSessionCache.entries());
            entries.sort((a, b) => b[1] - a[1]);
            invalidSessionCache.clear();
            entries.slice(0, 10).forEach(([id, time]) => invalidSessionCache.set(id, time));
          }
        }

        // Retourner une session sans user pour invalider
        return { ...session, user: null };
      }

      if (token?.id){
        // Vérifier que l'utilisateur existe toujours dans la DB
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id },
          select: { id: true, name: true, email: true, emailVerified: true, role: true },
        });

        // Si l'utilisateur n'existe plus, invalider la session
        if (!dbUser){
          // Throttle les logs pour éviter le spam (max 1 log par minute par userId)
          const now = Date.now();
          const lastLogTime = invalidSessionCache.get(token.id);

          if (!lastLogTime || (now - lastLogTime) > INVALID_SESSION_LOG_THROTTLE) {
            logger.context('session', 'warn', `User ${token.id} no longer exists in DB, invalidating session`);
            invalidSessionCache.set(token.id, now);

            // Nettoyer le cache (garder seulement les 10 dernières entrées)
            if (invalidSessionCache.size > 10) {
              const entries = Array.from(invalidSessionCache.entries());
              entries.sort((a, b) => b[1] - a[1]);
              invalidSessionCache.clear();
              entries.slice(0, 10).forEach(([id, time]) => invalidSessionCache.set(id, time));
            }
          }

          // Retourner une session sans user pour invalider
          return { ...session, user: null };
        }

        session.user = session.user || {};
        session.user.id = dbUser.id;
        session.user.name = dbUser.name;
        session.user.email = dbUser.email;
        session.user.emailVerified = dbUser.emailVerified;
        session.user.role = dbUser.role || 'USER';
      }
      return session;
    },
    async signIn({ user, account }){
      if (!user?.id) return false;

      // Vérifier si les inscriptions sont activées (uniquement pour les nouvelles inscriptions)
      // Pour OAuth, on détecte une nouvelle inscription en vérifiant si l'utilisateur vient d'être créé
      if (account) {
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { createdAt: true, passwordHash: true },
        });

        if (dbUser) {
          // Vérifier si l'utilisateur a été créé récemment (moins de 30 secondes = nouvelle inscription)
          const isNewUser = (Date.now() - new Date(dbUser.createdAt).getTime()) < 30000;

          // Si c'est un nouvel utilisateur, vérifier le setting registration_enabled
          if (isNewUser) {
            const regSetting = await prisma.setting.findUnique({
              where: { settingName: 'registration_enabled' },
            });

            if (regSetting && regSetting.value === '0') {
              logger.context('auth', 'warn', `Nouvelle inscription bloquée (registration_enabled=0) pour ${user.email}`);

              // Supprimer l'utilisateur et ses accounts associés car l'inscription est bloquée
              try {
                await prisma.account.deleteMany({
                  where: { userId: user.id },
                });
                await prisma.user.delete({
                  where: { id: user.id },
                });
                logger.context('auth', 'info', `Utilisateur ${user.id} supprimé (inscription bloquée)`);
              } catch (error) {
                logger.error('Erreur lors de la suppression de l\'utilisateur bloqué', error);
              }

              return false; // Bloquer l'inscription
            }
          }
        }
      }

      // Tracking télémétrie - Login
      try {
        const provider = account?.provider || 'credentials';
        await trackUserLogin({
          userId: user.id,
          deviceId: null,
          provider,
          status: 'success',
        });
      } catch (trackError) {
        console.error('[auth] Erreur tracking login:', trackError);
      }

      await ensureUserWorkspace(user);
      return true;
    },
  },
  events: {
    async createUser({ user }){
      // Pour les connexions OAuth, l'email est déjà vérifié par le provider
      // On vérifie si l'utilisateur n'a pas de passwordHash (donc OAuth)
      if (user?.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { passwordHash: true, emailVerified: true, matchScoreRefreshCount: true },
        });

        // Récupérer le nombre de tokens par défaut depuis les settings
        const defaultTokenLimit = await getDefaultTokenLimit();

        // Préparer les données à mettre à jour
        const updateData = {};

        // Si pas de passwordHash, c'est une connexion OAuth
        if (dbUser && !dbUser.passwordHash && !dbUser.emailVerified) {
          updateData.emailVerified = new Date();
          logger.context('auth', 'info', `Email auto-vérifié pour OAuth user ${user.id}`);
        }

        // Initialiser matchScoreRefreshCount avec la valeur du setting si l'utilisateur a 0 tokens
        if (dbUser && dbUser.matchScoreRefreshCount === 0) {
          updateData.matchScoreRefreshCount = defaultTokenLimit;
          logger.context('auth', 'info', `Tokens initialisés à ${defaultTokenLimit} pour user ${user.id}`);
        }

        // Mettre à jour l'utilisateur si nécessaire
        if (Object.keys(updateData).length > 0) {
          await prisma.user.update({
            where: { id: user.id },
            data: updateData,
          });
        }

        // Tracking télémétrie - Registration
        try {
          const provider = dbUser && !dbUser.passwordHash ? 'oauth' : 'credentials';
          await trackUserRegistration({
            userId: user.id,
            deviceId: null,
            provider,
            status: 'success',
          });
        } catch (trackError) {
          console.error('[auth] Erreur tracking registration:', trackError);
        }
      }

      // Note: Ne pas créer le workspace ici car il sera créé dans le callback signIn
      // après vérification de registration_enabled
    },
  },
};

async function ensureUserWorkspace(user){
  if (!user?.id) return;
  const fs = await import("fs/promises");
  const path = await import("path");
  const baseDir = process.env.CV_BASE_DIR || "data/users";
  const userDir = path.join(process.cwd(), baseDir, user.id, "cvs");
  try {
    await fs.mkdir(userDir, { recursive: true });
  } catch (error) {
    logger.error("Impossible de créer le répertoire utilisateur", error);
  }

}
