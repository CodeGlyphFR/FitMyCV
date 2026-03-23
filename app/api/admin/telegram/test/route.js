import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { getSettingValue } from '@/lib/settings/settingsUtils';
import { decryptJsonField } from '@/lib/security/fieldEncryption';

export async function POST() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ADMIN') {
    return Response.json({ error: 'Non autorisé' }, { status: 403 });
  }

  const encryptedToken = await getSettingValue('telegram_bot_token', '');
  const encryptedChatId = await getSettingValue('telegram_chat_id', '');

  if (!encryptedToken || !encryptedChatId) {
    return Response.json({ error: 'Token ou Chat ID manquant.' }, { status: 400 });
  }

  let token, chatId;
  try {
    token = decryptJsonField(encryptedToken);
    chatId = decryptJsonField(encryptedChatId);
  } catch {
    return Response.json({ error: 'Erreur de déchiffrement des credentials.' }, { status: 400 });
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: '✅ *FitMyCV Bot connecté !*\n\nLe bot Telegram est correctement configuré et opérationnel.',
      parse_mode: 'Markdown',
    }),
  });

  if (response.ok) {
    return Response.json({ ok: true });
  }

  const error = await response.text();
  return Response.json({ error: `Échec envoi: ${error}` }, { status: 400 });
}
