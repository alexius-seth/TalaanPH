export interface ReceiptParams {
  storeName: string;
  nickname: string;
  refNumber: string;
  type: 'Utang' | 'Bayad' | 'Adjustment';
  amount: number;
  balance: number;
  phoneNumber?: string;
}

export interface ReminderParams {
  storeName: string;
  nickname: string;
  balance: number;
  dueDate: string;
  phoneNumber?: string;
}

/**
 * Formats a single-segment GSM-7 compliant SMS receipt (<= 160 chars).
 */
export function formatReceiptText(params: ReceiptParams): string {
  const cleanStore = params.storeName.trim().slice(0, 20);
  const cleanNick = params.nickname.trim().slice(0, 18);
  const amountStr = params.amount.toFixed(2);
  const balanceStr = params.balance.toFixed(2);

  const receipt = [
    `[Talaan - ${cleanStore}]`,
    `Suki: ${cleanNick}`,
    `Ref: ${params.refNumber}`,
    `${params.type}: P${amountStr}`,
    `Kabuuang Utang: P${balanceStr}`,
    'Salamat po!',
  ].join('\n');

  return receipt;
}

/**
 * Formats a single-segment GSM-7 compliant SMS payment reminder.
 */
export function formatReminderText(params: ReminderParams): string {
  const cleanStore = params.storeName.trim().slice(0, 18);
  const cleanNick = params.nickname.trim().slice(0, 16);
  const balanceStr = params.balance.toFixed(2);

  return [
    `[Talaan - ${cleanStore}]`,
    `Paalala kay suki ${cleanNick}:`,
    `May nakatakdang utang na P${balanceStr} ngayong araw (${params.dueDate}).`,
    'Paki-settle po sa tindahan. Maraming salamat!',
  ].join('\n');
}

/**
 * Checks if the user device is iOS/iPadOS for SMS URI parameter delimiter differences.
 */
function isIOSDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

/**
 * Dispatches an SMS receipt via native SMS URI handler with navigator.share() fallback.
 */
export async function dispatchReceiptSms(params: ReceiptParams): Promise<boolean> {
  const receipt = formatReceiptText(params);
  return dispatchNativeSms(receipt, params.phoneNumber, `Resibo - ${params.nickname}`);
}

/**
 * Dispatches an SMS due date reminder via native SMS URI handler with navigator.share() fallback.
 */
export async function dispatchReminderSms(params: ReminderParams): Promise<boolean> {
  const message = formatReminderText(params);
  return dispatchNativeSms(message, params.phoneNumber, `Paalala - ${params.nickname}`);
}

async function dispatchNativeSms(text: string, phone?: string, shareTitle?: string): Promise<boolean> {
  const encodedBody = encodeURIComponent(text);
  const rawPhone = (phone || '').replace(/[^0-9+]/g, '');

  const isIOS = isIOSDevice();
  const separator = isIOS ? '&' : '?';
  const smsUri = rawPhone
    ? `sms:${rawPhone}${separator}body=${encodedBody}`
    : `sms:${separator}body=${encodedBody}`;

  try {
    if (typeof window !== 'undefined') {
      window.location.href = smsUri;
      return true;
    }
  } catch {}

  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({
        title: shareTitle ?? 'Talaan',
        text,
      });
      return true;
    } catch {}
  }

  return false;
}
