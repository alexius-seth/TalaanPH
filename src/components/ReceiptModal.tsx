'use client';

import React, { useState } from 'react';
import { MessageSquare, Check, X, AlertCircle } from 'lucide-react';
import { dispatchReceiptSms, type ReceiptParams } from '../sms';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  receiptParams: ReceiptParams;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  isOpen,
  onClose,
  receiptParams,
}) => {
  const [isSending, setIsSending] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSendSms = async () => {
    setIsSending(true);
    try {
      const dispatched = await dispatchReceiptSms(receiptParams);
      if (dispatched) setSentSuccess(true);
    } catch (err) {
      console.error('Failed to trigger SMS', err);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-gray-900">Resibo ng Transaksyon</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-gray-400 hover:text-gray-600 active:scale-95"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Paper receipt box */}
        <div className="bg-amber-50/70 border border-amber-200 font-mono text-xs rounded-lg p-4 mb-5 text-gray-800 space-y-1.5 shadow-inner">
          <p className="font-bold text-center text-sm mb-2 text-amber-900 border-b border-amber-200 pb-1">
            [Talaan - {receiptParams.storeName}]
          </p>
          <div className="flex justify-between">
            <span className="text-gray-500">Suki:</span>
            <span className="font-semibold">{receiptParams.nickname}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Ref:</span>
            <span>{receiptParams.refNumber}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Uri:</span>
            <span className="font-semibold">{receiptParams.type}</span>
          </div>
          <div className="flex justify-between text-sm pt-1 border-t border-dashed border-amber-300">
            <span>Halaga:</span>
            <span className="font-bold">₱{receiptParams.amount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm font-bold text-amber-950 pt-1">
            <span>Kabuuang Utang:</span>
            <span>₱{receiptParams.balance.toFixed(2)}</span>
          </div>
          <p className="text-center text-gray-500 pt-2 italic">Salamat po!</p>
        </div>

        <div className="space-y-3">
          <button
            onClick={handleSendSms}
            disabled={isSending}
            className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md active:scale-98 transition disabled:opacity-50 text-base"
          >
            {sentSuccess ? (
              <>
                <Check className="w-5 h-5" />
                <span>Napadala / Nabuksan ang SMS</span>
              </>
            ) : (
              <>
                <MessageSquare className="w-5 h-5" />
                <span>I-text ang Resibo (Libre via SIM)</span>
              </>
            )}
          </button>

          <button
            onClick={onClose}
            className="w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl active:scale-98 transition text-sm"
          >
            Tapos Na / Isara
          </button>
        </div>
      </div>
    </div>
  );
};

