import { getSettingValue, getBooleanSettingValue } from '@/lib/settings/settingsUtils';
import { decryptJsonField } from '@/lib/security/fieldEncryption';

export async function sendTelegramMessage(text) {
  const enabled = await getBooleanSettingValue('telegram_enabled', false);
  if (!enabled) return null;

  const encryptedToken = await getSettingValue('telegram_bot_token', '');
  const encryptedChatId = await getSettingValue('telegram_chat_id', '');

  if (!encryptedToken || !encryptedChatId) return null;

  // Déchiffrer le token et le chat ID
  const token = decryptJsonField(encryptedToken);
  const chatId = decryptJsonField(encryptedChatId);

  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[telegram] Erreur envoi message:', error);
    return null;
  }

  return response.json();
}
