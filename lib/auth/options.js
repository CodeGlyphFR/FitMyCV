import { PrismaAdapter } from "@next-auth/prisma-adapter";
import GoogleProvider from "next-auth/providers/google";
import GithubProvider from "next-auth/providers/github";
import AppleProvider from "next-auth/providers/apple";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { writeUserCvFile, listUserCvFiles } from "@/lib/cv/storage";

function maybeProvider(condition, providerFactory){
  return condition ? providerFactory() : null;
}

export const authOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 jours
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
        maxAge: 30 * 24 * 60 * 60 // 30 jours
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
      },
      async authorize(credentials){
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
    async jwt({ token, user }){
      if (user){
        token.id = user.id;
        token.name = user.name;
        token.email = user.email;
      }
      return token;
    },
    async session({ session, token }){
      if (token?.id){
        // Vérifier que l'utilisateur existe toujours dans la DB
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id },
          select: { id: true, name: true, email: true },
        });

        // Si l'utilisateur n'existe plus, invalider la session
        if (!dbUser){
          console.warn(`[session] User ${token.id} no longer exists in DB, invalidating session`);
          // Retourner une session sans user pour invalider
          return { ...session, user: null };
        }

        session.user = session.user || {};
        session.user.id = dbUser.id;
        session.user.name = dbUser.name;
        session.user.email = dbUser.email;
      }
      return session;
    },
    async signIn({ user }){
      if (!user?.id) return false;
      await ensureUserWorkspace(user);
      return true;
    },
  },
  events: {
    async createUser({ user }){
      await ensureUserWorkspace(user);
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
    console.error("Impossible de créer le répertoire utilisateur", error);
  }

}
