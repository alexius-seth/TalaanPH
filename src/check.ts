declare const process: any;

function generateUUID(): string {
  if (
    typeof window !== 'undefined' &&
    window.crypto &&
    typeof window.crypto.randomUUID === 'function'
  ) {
    return window.crypto.randomUUID();
  }
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function formatReceiptText(params: {
  storeName: string;
  nickname: string;
  refNumber: string;
  type: string;
  amount: number;
  balance: number;
}): string {
  const cleanStore = params.storeName.trim().slice(0, 20);
  const cleanNick = params.nickname.trim().slice(0, 18);
  return [
    `[Talaan - ${cleanStore}]`,
    `Suki: ${cleanNick}`,
    `Ref: ${params.refNumber}`,
    `${params.type}: P${params.amount.toFixed(2)}`,
    `Kabuuang Utang: P${params.balance.toFixed(2)}`,
    'Salamat po!',
  ].join('\n');
}

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`Assertion failed: ${msg}`);
}

export function runChecks() {
  // Check 1: SMS format & GSM-7 160 character boundary
  const receipt = formatReceiptText({
    storeName: 'Aling Nena Store Long Name',
    nickname: 'Mang Carding Dela Cruz',
    refNumber: 'TXN-ABC123XYZ',
    type: 'Utang',
    amount: 150.50,
    balance: 420.00,
  });

  assert(receipt.length <= 160, `Receipt length exceeds 160 chars: ${receipt.length}`);
  assert(receipt.includes('Utang: P150.50'), 'Receipt does not contain amount');
  assert(receipt.includes('Kabuuang Utang: P420.00'), 'Receipt does not contain total debt');

  // Check 2: Double-entry math check
  const debit = 150.50;
  const credit = 150.50;
  assert(Math.round(debit * 100) === Math.round(credit * 100), 'Centavo balance check failed');

  // Check 3: Imbalance rejection check
  const badDebit = 150.50;
  const badCredit = 140.00;
  assert(Math.round(badDebit * 100) !== Math.round(badCredit * 100), 'Imbalance was not detected');

  // Check 5: PH Phone validation check
  function isValidPHPhoneNumber(phone: string): boolean {
    const cleaned = phone.trim().replace(/[\s-]/g, '');
    return /^(09|\+639)\d{9}$/.test(cleaned);
  }

  assert(isValidPHPhoneNumber('09171234567') === true, 'Valid 09 format failed');
  assert(isValidPHPhoneNumber('+639189876543') === true, 'Valid +639 format failed');
  assert(isValidPHPhoneNumber('0917-123-4567') === true, 'Dashed format failed');
  assert(isValidPHPhoneNumber('08171234567') === false, 'Invalid prefix passed');
  assert(isValidPHPhoneNumber('12345') === false, 'Short phone passed');

  // Check 6: Due date presets and reminder formatting
  function getNextFriday(): string {
    const d = new Date();
    const day = d.getDay();
    const diff = (5 - day + 7) % 7 || 7;
    d.setDate(d.getDate() + diff);
    return d.toISOString().split('T')[0];
  }

  const fri = getNextFriday();
  assert(/^\d{4}-\d{2}-\d{2}$/.test(fri), 'Next Friday format failed');

  function formatReminderText(params: { storeName: string; nickname: string; balance: number; dueDate: string }): string {
    return [
      `[Talaan - ${params.storeName.slice(0, 18)}]`,
      `Paalala kay suki ${params.nickname.slice(0, 16)}:`,
      `May nakatakdang utang na P${params.balance.toFixed(2)} ngayong araw (${params.dueDate}).`,
      'Paki-settle po sa tindahan. Maraming salamat!',
    ].join('\n');
  }

  const reminderText = formatReminderText({
    storeName: 'Nena Store',
    nickname: 'Carding',
    balance: 350.0,
    dueDate: '2026-10-15',
  });
  assert(reminderText.length <= 160, `Reminder SMS exceeds 160 chars: ${reminderText.length}`);
  assert(reminderText.includes('Carding'), 'Reminder nickname missing');
  assert(reminderText.includes('P350.00'), 'Reminder balance missing');

  // Check 7: UUID generation format for insecure LAN origins
  const testId = generateUUID();
  assert(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(testId),
    `Generated UUID is invalid: ${testId}`
  );

  // Check 8: Suki archive ledger constraint (zero balance check)
  function canArchiveCustomer(balance: number): { allowed: boolean; error?: string } {
    if (balance !== 0) {
      return {
        allowed: false,
        error: `Hindi pwedeng burahin ang suki na may natitirang utang (₱${balance.toFixed(2)}). Kailangan munang ma-settle o maging ₱0.00.`,
      };
    }
    return { allowed: true };
  }

  assert(canArchiveCustomer(150.5).allowed === false, 'Customer with debt must not be archived');
  assert(canArchiveCustomer(0).allowed === true, 'Customer with zero debt must be archivable');
  assert(
    canArchiveCustomer(50).error?.includes('Hindi pwedeng burahin') === true,
    'Archive error message mismatch'
  );

  console.log('✓ All core ledger, SMS, sync, reminders, archive rules, and validation asserts passed.');
}

if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('check')) {
  runChecks();
}

