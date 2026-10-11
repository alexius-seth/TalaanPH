'use client';

import React, { useState, useEffect } from 'react';
import { X, PlusCircle, MinusCircle, AlertTriangle, Calendar, Package, ShoppingBag, Plus, Minus } from 'lucide-react';
import { ledgerService } from '../ledger';
import { inventoryService } from '../inventory';
import type { Customer, TransactionType, Product, LineItemInput } from '../types';
import type { ReceiptParams } from '../sms';

interface TransactionModalProps {
  isOpen: boolean;
  customer: Customer;
  currentBalance: number;
  initialType?: TransactionType;
  storeName?: string;
  onClose: () => void;
  onSuccess: (receipt: ReceiptParams) => void;
}

export function getNextFriday(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = (5 - day + 7) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

export function getKatapusan(): string {
  const d = new Date();
  if (d.getDate() < 15) {
    d.setDate(15);
  } else {
    d.setMonth(d.getMonth() + 1, 0);
  }
  return d.toISOString().split('T')[0];
}

export function getOneWeekLater(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().split('T')[0];
}

interface CartItem {
  product: Product;
  quantity: number;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  customer,
  currentBalance,
  initialType = 'CREDIT_PURCHASE',
  storeName = 'Sari-Sari Store',
  onClose,
  onSuccess,
}) => {
  const [txnType, setTxnType] = useState<TransactionType>(initialType);
  const [amountStr, setAmountStr] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Inventory Products & Cart
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);

  useEffect(() => {
    if (isOpen) {
      if (initialType) setTxnType(initialType);
      (async () => {
        await inventoryService.ensureDefaultProducts();
        const prods = await inventoryService.getAllProducts();
        setProducts(prods);
      })();
    }
  }, [isOpen, initialType]);

  if (!isOpen) return null;

  const handleAddProductToCart = (prod: Product) => {
    if (prod.currentStock <= 0) return;

    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === prod.id);
      let updated: CartItem[];
      if (existing) {
        updated = prev.map((item) =>
          item.product.id === prod.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      } else {
        updated = [...prev, { product: prod, quantity: 1 }];
      }

      // Compute total amount and description
      const total = updated.reduce((sum, it) => sum + it.quantity * it.product.retailPrice, 0);
      setAmountStr(total.toFixed(2));
      setDescription(updated.map((it) => `${it.quantity} ${it.product.name}`).join(', '));
      return updated;
    });
  };

  const handleRemoveFromCart = (prodId: string) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === prodId);
      if (!existing) return prev;

      let updated: CartItem[];
      if (existing.quantity > 1) {
        updated = prev.map((item) =>
          item.product.id === prodId ? { ...item, quantity: item.quantity - 1 } : item
        );
      } else {
        updated = prev.filter((item) => item.product.id !== prodId);
      }

      const total = updated.reduce((sum, it) => sum + it.quantity * it.product.retailPrice, 0);
      setAmountStr(total > 0 ? total.toFixed(2) : '');
      setDescription(updated.map((it) => `${it.quantity} ${it.product.name}`).join(', '));
      return updated;
    });
  };

  const numericAmount = parseFloat(amountStr) || 0;
  const projectedBalance =
    txnType === 'CREDIT_PURCHASE'
      ? currentBalance + numericAmount
      : Math.max(0, currentBalance - numericAmount);

  const isOverLimit =
    customer.creditLimit > 0 &&
    txnType === 'CREDIT_PURCHASE' &&
    projectedBalance > customer.creditLimit;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (numericAmount <= 0) return setErrorMsg('Maglagay ng tamang halaga.');

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const itemsPayload: LineItemInput[] | undefined =
        txnType === 'CREDIT_PURCHASE' && cart.length > 0
          ? cart.map((c) => ({
              productId: c.product.id,
              itemName: c.product.name,
              quantity: c.quantity,
              unitPrice: c.product.retailPrice,
            }))
          : undefined;

      const result = await ledgerService.recordTransaction({
        type: txnType,
        customerId: customer.id,
        amount: numericAmount,
        description: description.trim() || undefined,
        dueDate: txnType === 'CREDIT_PURCHASE' && dueDate ? dueDate : undefined,
        items: itemsPayload,
      });

      onSuccess({
        storeName,
        nickname: customer.nickname,
        refNumber: result.transaction.referenceNumber,
        type: txnType === 'CREDIT_PURCHASE' ? 'Utang' : 'Bayad',
        amount: numericAmount,
        balance: result.newBalance,
        phoneNumber: customer.phoneNumber,
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Pumalya ang transaksyon.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4">
      <div className="w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl p-6 shadow-xl max-h-[95vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900">{customer.nickname}</h3>
            <p className="text-xs text-gray-500">
              {customer.firstName} {customer.lastName} • {customer.phoneNumber}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-full text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-xl mb-4">
          <button
            type="button"
            onClick={() => {
              setTxnType('CREDIT_PURCHASE');
              setErrorMsg('');
            }}
            className={`py-2.5 text-sm font-bold rounded-lg flex items-center justify-center gap-1.5 transition ${
              txnType === 'CREDIT_PURCHASE' ? 'bg-rose-600 text-white shadow-xs' : 'text-gray-600'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            <span>Bagong Utang</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setTxnType('PAYMENT');
              setErrorMsg('');
            }}
            className={`py-2.5 text-sm font-bold rounded-lg flex items-center justify-center gap-1.5 transition ${
              txnType === 'PAYMENT' ? 'bg-emerald-600 text-white shadow-xs' : 'text-gray-600'
            }`}
          >
            <MinusCircle className="w-4 h-4" />
            <span>Bayad</span>
          </button>
        </div>

        {/* Live balance indicator */}
        <div className="bg-gray-50 rounded-xl p-3 mb-4 border border-gray-200 flex justify-between items-center text-sm">
          <div>
            <span className="text-gray-500 text-xs block">Kasalukuyan:</span>
            <span className="font-semibold text-gray-800">₱{currentBalance.toFixed(2)}</span>
          </div>
          <div className="text-right">
            <span className="text-gray-500 text-xs block">Bagong Balanse:</span>
            <span
              className={`font-bold ${
                txnType === 'CREDIT_PURCHASE' ? 'text-rose-600' : 'text-emerald-700'
              }`}
            >
              ₱{projectedBalance.toFixed(2)}
            </span>
          </div>
        </div>

        {isOverLimit && (
          <div className="flex items-center gap-2 p-2.5 mb-4 bg-amber-50 border border-amber-300 text-amber-800 rounded-lg text-xs font-medium">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Lalagpas sa credit limit na ₱{customer.creditLimit.toFixed(2)}</span>
          </div>
        )}

        {/* Interactive Inventory Product Tiles for Utang */}
        {txnType === 'CREDIT_PURCHASE' && (
          <div className="space-y-2 mb-4">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1 text-xs font-bold text-gray-700">
                <ShoppingBag className="w-3.5 h-3.5 text-rose-600" />
                <span>Pumili ng Paninda (Tingi Inventory)</span>
              </label>
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setCart([]);
                    setAmountStr('');
                    setDescription('');
                  }}
                  className="text-[11px] text-rose-600 font-semibold hover:underline"
                >
                  I-clear
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
              {products.map((prod) => {
                const isOutOfStock = prod.currentStock <= 0;
                const isLowStock = prod.currentStock > 0 && prod.currentStock <= prod.lowStockThreshold;
                const cartQty = cart.find((it) => it.product.id === prod.id)?.quantity ?? 0;

                return (
                  <button
                    key={prod.id}
                    type="button"
                    disabled={isOutOfStock}
                    onClick={() => handleAddProductToCart(prod)}
                    className={`text-left p-2.5 rounded-xl border transition relative flex flex-col justify-between ${
                      isOutOfStock
                        ? 'opacity-50 bg-gray-100 border-gray-200 cursor-not-allowed'
                        : cartQty > 0
                        ? 'bg-rose-50/70 border-rose-400 ring-1 ring-rose-400'
                        : 'bg-white border-gray-200 hover:border-rose-300 hover:bg-rose-50/30'
                    }`}
                  >
                    {cartQty > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 bg-rose-600 text-white font-extrabold text-[10px] w-5 h-5 rounded-full flex items-center justify-center shadow-xs">
                        {cartQty}
                      </span>
                    )}
                    <div>
                      <span className="text-[10px] text-gray-400 font-medium block uppercase tracking-wider">
                        {prod.category}
                      </span>
                      <h4 className="font-bold text-gray-900 text-xs leading-tight line-clamp-1">
                        {prod.name}
                      </h4>
                    </div>

                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs font-black text-rose-600">₱{prod.retailPrice}</span>
                      <span
                        className={`text-[10px] font-semibold ${
                          isOutOfStock ? 'text-red-500' : isLowStock ? 'text-amber-600' : 'text-gray-400'
                        }`}
                      >
                        {isOutOfStock ? 'Out' : `${prod.currentStock} ${prod.baseUnit}`}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Selected Cart Items Breakdown */}
            {cart.length > 0 && (
              <div className="bg-rose-50/40 border border-rose-200 rounded-xl p-2.5 space-y-1.5">
                <span className="text-[11px] font-bold text-gray-700 block">Kinuha:</span>
                {cart.map((item) => (
                  <div key={item.product.id} className="flex items-center justify-between text-xs">
                    <span className="text-gray-700 font-medium">{item.product.name}</span>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 bg-white border border-gray-300 rounded-lg px-1">
                        <button
                          type="button"
                          onClick={() => handleRemoveFromCart(item.product.id)}
                          className="text-gray-500 hover:text-rose-600 p-0.5"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="font-bold px-1">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => handleAddProductToCart(item.product)}
                          className="text-gray-500 hover:text-emerald-600 p-0.5"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <span className="font-bold text-gray-900 w-12 text-right">
                        ₱{(item.quantity * item.product.retailPrice).toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Amount Input */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Kabuuang Halaga (₱)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              required
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              placeholder="0.00"
              className="w-full text-2xl font-bold py-3 px-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          {/* Bayad Quick Presets */}
          {txnType === 'PAYMENT' && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Mabilisang bayad:</label>
              <div className="flex flex-wrap gap-1.5">
                {[50, 100, 200, 500].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setAmountStr(amt.toFixed(2))}
                    className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 active:scale-95 text-xs font-semibold rounded-lg transition"
                  >
                    ₱{amt}
                  </button>
                ))}
                {currentBalance > 0 && (
                  <button
                    type="button"
                    onClick={() => setAmountStr(currentBalance.toFixed(2))}
                    className="px-3 py-1.5 bg-emerald-700 text-white active:scale-95 text-xs font-bold rounded-lg transition"
                  >
                    Buo (₱{currentBalance.toFixed(2)})
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Due date picker for CREDIT_PURCHASE */}
          {txnType === 'CREDIT_PURCHASE' && (
            <div className="bg-rose-50/50 border border-rose-100 rounded-xl p-3 space-y-2">
              <label className="flex items-center gap-1.5 text-xs font-bold text-gray-700">
                <Calendar className="w-3.5 h-3.5 text-rose-600" />
                <span>Kailan Magbabayad? (Due Date)</span>
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full py-2 px-3 border border-gray-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-rose-500 focus:outline-none bg-white"
              />
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                <button
                  type="button"
                  onClick={() => setDueDate(getNextFriday())}
                  className="px-2 py-1 bg-white hover:bg-rose-100 border border-rose-200 text-rose-800 rounded-md text-[11px] font-medium transition"
                >
                  📅 Sa Biyernes
                </button>
                <button
                  type="button"
                  onClick={() => setDueDate(getKatapusan())}
                  className="px-2 py-1 bg-white hover:bg-rose-100 border border-rose-200 text-rose-800 rounded-md text-[11px] font-medium transition"
                >
                  📅 Katapusan
                </button>
                <button
                  type="button"
                  onClick={() => setDueDate(getOneWeekLater())}
                  className="px-2 py-1 bg-white hover:bg-rose-100 border border-rose-200 text-rose-800 rounded-md text-[11px] font-medium transition"
                >
                  📅 1 Linggo
                </button>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Deskripsyon / Tala (Opsyonal)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="hal. 2 kape, 1 bigas"
              className="w-full py-2.5 px-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          {errorMsg && <p className="text-xs text-rose-600 font-semibold">{errorMsg}</p>}

          <button
            type="submit"
            disabled={isSubmitting || numericAmount <= 0}
            className={`w-full py-3.5 px-4 rounded-xl font-bold text-white shadow-md transition active:scale-98 disabled:opacity-50 text-base ${
              txnType === 'CREDIT_PURCHASE'
                ? 'bg-rose-600 hover:bg-rose-700'
                : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            {isSubmitting ? 'Itinatala...' : 'Itala ang Transaksyon'}
          </button>
        </form>
      </div>
    </div>
  );
};
