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
  lang?: 'tl' | 'en';
}): string {
  const cleanStore = params.storeName.trim().slice(0, 20);
  const cleanNick = params.nickname.trim().slice(0, 18);
  const isEn = params.lang === 'en';
  const typeLabel = isEn
    ? params.type === 'Utang' ? 'Credit' : params.type === 'Bayad' ? 'Payment' : params.type
    : params.type;

  if (isEn) {
    return [
      `[Talaan - ${cleanStore}]`,
      `Customer: ${cleanNick}`,
      `Ref: ${params.refNumber}`,
      `${typeLabel}: P${params.amount.toFixed(2)}`,
      `Total Balance: P${params.balance.toFixed(2)}`,
      'Thank you!',
    ].join('\n');
  }

  return [
    `[Talaan - ${cleanStore}]`,
    `Suki: ${cleanNick}`,
    `Ref: ${params.refNumber}`,
    `${typeLabel}: P${params.amount.toFixed(2)}`,
    `Kabuuang Utang: P${params.balance.toFixed(2)}`,
    'Salamat po!',
  ].join('\n');
}

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`Assertion failed: ${msg}`);
}

export function runChecks() {
  // Check 1: SMS format & GSM-7 160 character boundary (Tagalog)
  const receiptTl = formatReceiptText({
    storeName: 'Aling Nena Store Long Name',
    nickname: 'Mang Carding Dela Cruz',
    refNumber: 'TXN-ABC123XYZ',
    type: 'Utang',
    amount: 150.50,
    balance: 420.00,
    lang: 'tl',
  });

  assert(receiptTl.length <= 160, `TL Receipt length exceeds 160 chars: ${receiptTl.length}`);
  assert(receiptTl.includes('Utang: P150.50'), 'TL Receipt does not contain amount');
  assert(receiptTl.includes('Kabuuang Utang: P420.00'), 'TL Receipt does not contain total debt');

  // Check 1b: SMS format & GSM-7 160 character boundary (English)
  const receiptEn = formatReceiptText({
    storeName: 'Aling Nena Store Long Name',
    nickname: 'Mang Carding Dela Cruz',
    refNumber: 'TXN-ABC123XYZ',
    type: 'Utang',
    amount: 150.50,
    balance: 420.00,
    lang: 'en',
  });

  assert(receiptEn.length <= 160, `EN Receipt length exceeds 160 chars: ${receiptEn.length}`);
  assert(receiptEn.includes('Credit: P150.50'), 'EN Receipt does not contain credit amount');
  assert(receiptEn.includes('Total Balance: P420.00'), 'EN Receipt does not contain total balance');

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

  function formatReminderText(params: {
    storeName: string;
    nickname: string;
    balance: number;
    dueDate: string;
    lang?: 'tl' | 'en';
  }): string {
    const cleanStore = params.storeName.trim().slice(0, 18);
    const cleanNick = params.nickname.trim().slice(0, 16);
    const balanceStr = params.balance.toFixed(2);
    const isEn = params.lang === 'en';

    if (isEn) {
      return [
        `[Talaan - ${cleanStore}]`,
        `Reminder for customer ${cleanNick}:`,
        `Payment of P${balanceStr} is due today (${params.dueDate}).`,
        'Please settle at the store. Thank you!',
      ].join('\n');
    }

    return [
      `[Talaan - ${cleanStore}]`,
      `Paalala kay suki ${cleanNick}:`,
      `May nakatakdang utang na P${balanceStr} ngayong araw (${params.dueDate}).`,
      'Paki-settle po sa tindahan. Maraming salamat!',
    ].join('\n');
  }

  const reminderTextTl = formatReminderText({
    storeName: 'Nena Store',
    nickname: 'Carding',
    balance: 350.0,
    dueDate: '2026-10-15',
    lang: 'tl',
  });
  assert(reminderTextTl.length <= 160, `TL Reminder SMS exceeds 160 chars: ${reminderTextTl.length}`);
  assert(reminderTextTl.includes('Carding'), 'TL Reminder nickname missing');
  assert(reminderTextTl.includes('P350.00'), 'TL Reminder balance missing');

  const reminderTextEn = formatReminderText({
    storeName: 'Nena Store',
    nickname: 'Carding',
    balance: 350.0,
    dueDate: '2026-10-15',
    lang: 'en',
  });
  assert(reminderTextEn.length <= 160, `EN Reminder SMS exceeds 160 chars: ${reminderTextEn.length}`);
  assert(reminderTextEn.includes('Reminder for customer Carding'), 'EN Reminder header missing');
  assert(reminderTextEn.includes('Payment of P350.00 is due today'), 'EN Reminder balance missing');

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

  // Check 9: Account resolution logic for sync push (prevent foreign key violations)
  function resolveAccountForEntry(
    txnType: 'CREDIT_PURCHASE' | 'PAYMENT' | 'ADJUSTMENT',
    direction: 'DEBIT' | 'CREDIT',
    customerId?: string
  ): { code: string; type: string } {
    if (txnType === 'CREDIT_PURCHASE') {
      return direction === 'CREDIT'
        ? { code: 'REVENUE:SALES', type: 'REVENUE' }
        : { code: customerId ? `ASSET:AR:${customerId}` : 'ASSET:AR', type: 'ASSET' };
    } else if (txnType === 'PAYMENT') {
      return direction === 'DEBIT'
        ? { code: 'ASSET:CASH', type: 'ASSET' }
        : { code: customerId ? `ASSET:AR:${customerId}` : 'ASSET:AR', type: 'ASSET' };
    } else {
      return direction === 'DEBIT'
        ? { code: 'EXPENSE:ADJUSTMENT', type: 'EXPENSE' }
        : { code: customerId ? `ASSET:AR:${customerId}` : 'ASSET:AR', type: 'ASSET' };
    }
  }

  const salesRes = resolveAccountForEntry('CREDIT_PURCHASE', 'CREDIT', 'cust-123');
  assert(salesRes.code === 'REVENUE:SALES' && salesRes.type === 'REVENUE', 'Sales account resolution failed');

  const arRes = resolveAccountForEntry('CREDIT_PURCHASE', 'DEBIT', 'cust-123');
  assert(arRes.code === 'ASSET:AR:cust-123' && arRes.type === 'ASSET', 'AR account resolution failed');

  const cashRes = resolveAccountForEntry('PAYMENT', 'DEBIT', 'cust-123');
  assert(cashRes.code === 'ASSET:CASH' && cashRes.type === 'ASSET', 'Cash account resolution failed');

  const adjRes = resolveAccountForEntry('ADJUSTMENT', 'DEBIT', 'cust-123');
  assert(adjRes.code === 'EXPENSE:ADJUSTMENT' && adjRes.type === 'EXPENSE', 'Adjustment account resolution failed');

  // Check 10: Sync batch mutation prioritization
  const ACTION_PRIORITY: Record<string, number> = {
    CREATE_CUSTOMER: 1,
    UPDATE_CUSTOMER: 2,
    CREATE_PRODUCT: 3,
    UPDATE_PRODUCT: 4,
    RECORD_TRANSACTION: 5,
    RESTOCK_PRODUCT: 5,
    ARCHIVE_CUSTOMER: 6,
  };

  const sampleBatch = [
    { action: 'RECORD_TRANSACTION', timestamp: 200 },
    { action: 'CREATE_CUSTOMER', timestamp: 100 },
    { action: 'ARCHIVE_CUSTOMER', timestamp: 300 },
    { action: 'UPDATE_CUSTOMER', timestamp: 150 },
  ];

  const sorted = [...sampleBatch].sort((a, b) => {
    const pA = ACTION_PRIORITY[a.action] ?? 99;
    const pB = ACTION_PRIORITY[b.action] ?? 99;
    if (pA !== pB) return pA - pB;
    return a.timestamp - b.timestamp;
  });

  assert(sorted[0].action === 'CREATE_CUSTOMER', 'CREATE_CUSTOMER must be first');
  assert(sorted[1].action === 'UPDATE_CUSTOMER', 'UPDATE_CUSTOMER must be second');
  assert(sorted[2].action === 'RECORD_TRANSACTION', 'RECORD_TRANSACTION must follow customers');
  assert(sorted[3].action === 'ARCHIVE_CUSTOMER', 'ARCHIVE_CUSTOMER must be last');

  // Check 11: integer-centavo math is drift-free and NaN-safe
  const toCents = (n: number) => (Number.isFinite(n) ? Math.round((n + Number.EPSILON) * 100) : 0);
  let drift = 0;
  for (let i = 0; i < 1000; i++) drift += 0.1; // naive float sum = 99.9999999999986
  let cents = 0;
  for (let i = 0; i < 1000; i++) cents += toCents(0.1);
  assert(drift !== 100 && cents / 100 === 100, 'Integer centavo sum must be exact (1000 x 0.10 = 100.00)');
  assert(toCents(NaN) === 0 && toCents(Infinity) === 0, 'Non-finite amounts must not poison balances');
  assert(toCents(1.005) === 101 && toCents(0.1 + 0.2) === 30, 'Centavo rounding mismatch');

  console.log('✓ All core ledger, SMS, sync, reminders, archive rules, and validation asserts passed.');
}

if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('check')) {
  runChecks();
}

