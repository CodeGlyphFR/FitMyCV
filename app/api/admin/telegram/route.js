import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import prisma from '@/lib/prisma';
import { encryptJsonField, decryptJsonField } from '@/lib/security/fieldEncryption';

const TELEGRAM_SETTINGS = [
  { name: 'telegram_enabled', category: 'telegram', description: 'Activer le bot Telegram', defaultValue: '0' },
  { name: 'telegram_bot_token', category: 'telegram', description: 'Token du bot Telegram', defaultValue: '', encrypted: true },
  { name: 'telegram_chat_id', category: 'telegram', description: 'Chat ID Telegram', defaultValue: '', encrypted: true },
  { name: 'telegram_notify_session_end', category: 'telegram', description: 'Notification fin de session', defaultValue: '1' },
  { name: 'telegram_notify_payment', category: 'telegram', description: 'Notification achat crédits', defaultValue: '1' },
];

export async function GET() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ADMIN') {
    return Response.json({ error: 'Non autorisé' }, { status: 403 });
  }

  const settings = await prisma.setting.findMany({
    where: { category: 'telegram' },
  });

  const result = {};
  for (const def of TELEGRAM_SETTINGS) {
    const found = settings.find((s) => s.settingName === def.name);
    let value = found?.value ?? def.defaultValue;
    // Déchiffrer les champs sensibles pour l'affichage admin
    if (def.encrypted && value) {
      try { value = decryptJsonField(value); } catch { value = ''; }
    }
    result[def.name] = value;
  }

  return Response.json(result);
}

export async function PUT(request) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ADMIN') {
    return Response.json({ error: 'Non autorisé' }, { status: 403 });
  }

  const body = await request.json();

  for (const def of TELEGRAM_SETTINGS) {
    if (body[def.name] !== undefined) {
      // Chiffrer les champs sensibles avant stockage
      let value = String(body[def.name]);
      if (def.encrypted && value) {
        value = encryptJsonField(value);
      }

      await prisma.setting.upsert({
        where: { settingName: def.name },
        update: { value },
        create: {
          settingName: def.name,
          value,
          category: def.category,
          description: def.description,
        },
      });
    }
  }

  return Response.json({ ok: true });
}
