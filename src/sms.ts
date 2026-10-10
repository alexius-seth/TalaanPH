export interface ReceiptParams {
  storeName: string;
  nickname: string;
  refNumber: string;
  type: 'Utang' | 'Bayad' | 'Adjustment';
  amount: number;
  balance: number;
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
 * Checks if the user device is iOS/iPadOS for SMS URI parameter delimiter differences.
 * iOS uses ';' or '&' while Android/standard RFC uses '?'.
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
  const encodedBody = encodeURIComponent(receipt);
  const rawPhone = (params.phoneNumber || '').replace(/[^0-9+]/g, '');

  const isIOS = isIOSDevice();
  const separator = isIOS ? '&' : '?';
  const smsUri = rawPhone
    ? `sms:${rawPhone}${separator}body=${encodedBody}`
    : `sms:${separator}body=${encodedBody}`;

  // Try opening native SMS app
  try {
    if (typeof window !== 'undefined') {
      window.location.href = smsUri;
      return true;
    }
  } catch (err) {
    console.warn('[SMS] Direct URI dispatch failed, attempting share fallback:', err);
  }

  // Fallback to Web Share API
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({
        title: `Resibo - ${params.nickname}`,
        text: receipt,
      });
      return true;
    } catch (shareErr) {
      // User cancelled share or share failed
      if ((shareErr as DOMException).name !== 'AbortError') {
        console.error('[SMS] Navigator share failed:', shareErr);
      }
    }
  }

  return false;
}

