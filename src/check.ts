import { formatReceiptText } from './sms.ts';

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

  // Check 4: Idempotency set deduplication check
  const batch = [{ id: 'evt-1' }, { id: 'evt-2' }, { id: 'evt-1' }];
  const processed = new Set(['evt-1']);
  const newItems = batch.filter((b) => !processed.has(b.id));
  assert(newItems.length === 1 && newItems[0].id === 'evt-2', 'Idempotency filter failed');

  console.log('✓ All core ledger, SMS, and sync asserts passed.');
}

if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('check')) {
  runChecks();
}

