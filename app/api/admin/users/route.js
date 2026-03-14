import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { createManualUser } from '@/lib/admin/userManagement';
import { isSubscriptionModeEnabled } from '@/lib/settings/settingsUtils';

/**
 * GET /api/admin/users
 * Récupère la liste des utilisateurs avec pagination, filtres, et KPIs
 * Query params:
 * - page: numéro de page (défaut: 1)
 * - limit: nombre d'items par page (défaut: 10, max: 50)
 * - role: filtre par rôle (USER, ADMIN, ou vide pour tous)
 * - emailStatus: filtre par statut email (verified, unverified, ou vide pour tous)
 * - search: recherche par nom/prénom
 * - sortBy: tri par date (newest, oldest)
 */
export async function GET(request) {
  try {
    const session = await auth();

    // Vérifier que l'utilisateur est admin
    if (session?.user?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10), 50);
    const role = searchParams.get('role') || '';
    const emailStatus = searchParams.get('emailStatus') || '';
    const search = searchParams.get('search') || '';
    const sortBy = searchParams.get('sortBy') || 'newest';

    // Construire les filtres
    const where = {};

    if (role && ['USER', 'ADMIN'].includes(role)) {
      where.role = role;
    }

    if (emailStatus === 'verified') {
      where.emailVerified = { not: null };
    } else if (emailStatus === 'unverified') {
      where.emailVerified = null;
    }

    // Note: La recherche sera appliquée après récupération car SQLite ne supporte pas 'mode: insensitive'
    // On filtre côté serveur après la requête
    const searchTerm = search.trim().toLowerCase();

    // Ordre de tri
    const orderBy = sortBy === 'oldest'
      ? { createdAt: 'asc' }
      : { createdAt: 'desc' };

    // Exécuter les requêtes en parallèle
    const [allUsers, totalUsersCount, avgCvPerUser, unverifiedCount, allCreditBalances] = await Promise.all([
      // Récupérer tous les utilisateurs correspondant aux filtres (sans pagination pour la recherche)
      prisma.user.findMany({
        where,
        orderBy,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          emailVerified: true,
          createdAt: true,
          _count: {
            select: {
              cvs: true,
            },
          },
          accounts: {
            select: {
              provider: true,
            },
          },
          subscription: {
            select: {
              id: true,
              status: true,
              billingPeriod: true,
              plan: {
                select: {
                  id: true,
                  name: true,
                  tier: true,
                  priceMonthly: true,
                  priceYearly: true,
                },
              },
            },
          },
          creditBalance: {
            select: {
              balance: true,
            },
          },
        },
      }),

      // KPI: Total utilisateurs (sans filtre)
      prisma.user.count(),

      // KPI: Moyenne de CV par utilisateur
      prisma.cvFile.count().then(async (totalCvs) => {
        const userCount = await prisma.user.count();
        return userCount > 0 ? (totalCvs / userCount).toFixed(1) : 0;
      }),

      // KPI: Utilisateurs en attente de validation
      prisma.user.count({
        where: { emailVerified: null },
      }),

      // Distribution des crédits (tous les soldes)
      prisma.creditBalance.findMany({
        select: { balance: true },
      }),
    ]);

    // Calculer la distribution par tranches de crédits
    const creditBuckets = [
      { label: '> 15', min: 16, max: Infinity },
      { label: '15', min: 15, max: 15 },
      { label: '13-14', min: 13, max: 14 },
      { label: '10-12', min: 10, max: 12 },
      { label: '8-9', min: 8, max: 9 },
      { label: '5-7', min: 5, max: 7 },
      { label: '3-4', min: 3, max: 4 },
      { label: '1-2', min: 1, max: 2 },
      { label: '0', min: 0, max: 0 },
    ];

    const creditDistribution = creditBuckets.map(bucket => ({
      label: bucket.label,
      count: allCreditBalances.filter(cb =>
        cb.balance >= bucket.min && cb.balance <= bucket.max
      ).length,
    }));

    // Filtrer côté serveur par recherche (case-insensitive)
    let filteredUsers = allUsers;
    if (searchTerm) {
      filteredUsers = allUsers.filter(user => {
        const nameMatch = user.name?.toLowerCase().includes(searchTerm);
        const emailMatch = user.email?.toLowerCase().includes(searchTerm);
        return nameMatch || emailMatch;
      });
    }

    // Calculer le nombre total après filtrage
    const totalCount = filteredUsers.length;

    // Appliquer la pagination sur les résultats filtrés
    const users = filteredUsers.slice((page - 1) * limit, page * limit);

    // Récupérer la dernière activité pour tous les utilisateurs en une seule requête
    const userIds = users.map(u => u.id);
    const lastActivities = await prisma.telemetryEvent.groupBy({
      by: ['userId'],
      where: {
        userId: { in: userIds }
      },
      _max: {
        timestamp: true
      }
    });

    // Créer un map pour un accès rapide
    const activityMap = new Map(
      lastActivities.map(a => [a.userId, a._max.timestamp])
    );

    // Enrichir les utilisateurs avec la dernière activité et les infos OAuth
    const usersWithActivity = users.map(user => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      cvCount: user._count.cvs,
      lastActivity: activityMap.get(user.id) || user.createdAt,
      oauthProviders: user.accounts.map(a => a.provider),
      hasOAuth: user.accounts.length > 0,
      subscription: user.subscription,
      credits: user.creditBalance?.balance || 0,
    }));

    const subscriptionMode = await isSubscriptionModeEnabled();

    return NextResponse.json({
      users: usersWithActivity,
      subscriptionMode,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: page * limit < totalCount,
      },
      kpis: {
        totalUsers: totalUsersCount,
        avgCvPerUser: parseFloat(avgCvPerUser),
        unverifiedCount,
        creditDistribution,
      },
    });

  } catch (error) {
    console.error('[Admin API] Error fetching users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/users
 * Crée un utilisateur manuellement
 * Body: { email, name, password, role }
 */
export async function POST(request) {
  try {
    const session = await auth();

    // Vérifier que l'utilisateur est admin
    if (session?.user?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { email, name, password, role } = body;

    // Validation email
    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email requis' },
        { status: 400 }
      );
    }

    // Validation format email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return NextResponse.json(
        { error: 'Format email invalide' },
        { status: 400 }
      );
    }

    // Validation nom
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { error: 'Nom requis' },
        { status: 400 }
      );
    }

    // Validation password
    if (!password || typeof password !== 'string' || !password.trim()) {
      return NextResponse.json(
        { error: 'Mot de passe requis' },
        { status: 400 }
      );
    }

    if (password.trim().length < 8) {
      return NextResponse.json(
        { error: 'Le mot de passe doit contenir au moins 8 caractères' },
        { status: 400 }
      );
    }

    // Validation rôle
    if (!role || !['USER', 'ADMIN'].includes(role)) {
      return NextResponse.json(
        { error: 'Rôle invalide (USER ou ADMIN attendu)' },
        { status: 400 }
      );
    }

    // Créer l'utilisateur
    const result = await createManualUser({ email, name, password, role });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      user: result.user,
    });

  } catch (error) {
    console.error('[Admin API] Error creating user:', error);
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    );
  }
}
