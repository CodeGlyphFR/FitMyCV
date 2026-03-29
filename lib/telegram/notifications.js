import { getBooleanSettingValue } from '@/lib/settings/settingsUtils';
import { sendTelegramMessage } from './client';
import { formatSessionEnd, formatPayment } from './formatters';

export async function sendSessionEndNotification(data) {
  const enabled = await getBooleanSettingValue('telegram_notify_session_end', true);
  if (!enabled) return;
  const message = formatSessionEnd(data);
  return sendTelegramMessage(message);
}

export async function sendPaymentNotification(data) {
  const enabled = await getBooleanSettingValue('telegram_notify_payment', true);
  if (!enabled) return;
  const message = formatPayment(data);
  return sendTelegramMessage(message);
}
