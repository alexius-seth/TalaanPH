'use client';

import React, { useState, useEffect } from 'react';
import { X, Package, Plus, AlertTriangle, ArrowUpDown, Layers, Check } from 'lucide-react';
import { inventoryService } from '../inventory';
import type { Product, ProductPackageUnit } from '../types';

interface InventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInventoryChanged?: () => void;
}

export const InventoryModal: React.FC<InventoryModalProps> = ({
  isOpen,
  onClose,
  onInventoryChanged,
}) => {
  const [products, setProducts] = useState<Array<Product & { packageUnits: ProductPackageUnit[] }>>([]);
  const [activeTab, setActiveTab] = useState<'LIST' | 'RESTOCK' | 'NEW'>('LIST');

  // Restock Form State
  const [restockProductId, setRestockProductId] = useState('');
  const [restockQty, setRestockQty] = useState('1');
  const [selectedPkgUnitId, setSelectedPkgUnitId] = useState('');
  const [isRestocking, setIsRestocking] = useState(false);
  const [restockSuccessMsg, setRestockSuccessMsg] = useState('');

  // Add Product Form State
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newBaseUnit, setNewBaseUnit] = useState('sachet');
  const [newRetailPrice, setNewRetailPrice] = useState('');
  const [newInitialStock, setNewInitialStock] = useState('0');
  const [hasPkgUnit, setHasPkgUnit] = useState(false);
  const [pkgUnitName, setPkgUnitName] = useState('Box');
  const [pkgMultiplier, setPkgMultiplier] = useState('24');
  const [isSavingProduct, setIsSavingProduct] = useState(false);

  const loadInventory = async () => {
    await inventoryService.ensureDefaultProducts();
    const list = await inventoryService.getAllProducts();
    setProducts(list);
    if (list.length > 0 && !restockProductId) {
      setRestockProductId(list[0].id);
      if (list[0].packageUnits.length > 0) {
        setSelectedPkgUnitId(list[0].packageUnits[0].id);
      }
    }
  };

  useEffect(() => {
    if (isOpen) {
      void loadInventory();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentRestockProd = products.find((p) => p.id === restockProductId);
  const currentPkgUnit = currentRestockProd?.packageUnits.find((u) => u.id === selectedPkgUnitId);

  const handleRestockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentRestockProd) return;
    const qty = parseFloat(restockQty) || 0;
    if (qty <= 0) return;

    setIsRestocking(true);
    setRestockSuccessMsg('');

    try {
      const isPkg = !!selectedPkgUnitId;
      await inventoryService.restockProduct(
        currentRestockProd.id,
        qty,
        isPkg,
        selectedPkgUnitId || undefined
      );

      const added = isPkg && currentPkgUnit ? qty * currentPkgUnit.multiplier : qty;
      setRestockSuccessMsg(
        `Matagumpay na nadagdagan ng +${added} ${currentRestockProd.baseUnit} si ${currentRestockProd.name}!`
      );
      await loadInventory();
      onInventoryChanged?.();
      setRestockQty('1');
    } catch (err: any) {
      alert(err.message || 'Pumalya ang pag-restock.');
    } finally {
      setIsRestocking(false);
    }
  };

  const handleCreateProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const price = parseFloat(newRetailPrice) || 0;
    if (!newName.trim() || price <= 0) return;

    setIsSavingProduct(true);
    try {
      await inventoryService.createProduct({
        name: newName,
        category: newCategory || 'Tingi',
        baseUnit: newBaseUnit,
        initialStock: parseFloat(newInitialStock) || 0,
        retailPrice: price,
        packageUnits: hasPkgUnit
          ? [
              {
                unitName: pkgUnitName,
                multiplier: parseFloat(pkgMultiplier) || 1,
                packageCost: 0,
              },
            ]
          : undefined,
      });

      await loadInventory();
      onInventoryChanged?.();
      setActiveTab('LIST');
      // Reset form
      setNewName('');
      setNewCategory('');
      setNewRetailPrice('');
      setNewInitialStock('0');
      setHasPkgUnit(false);
    } catch (err: any) {
      alert(err.message || 'Hindi maitala ang paninda.');
    } finally {
      setIsSavingProduct(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4">
      <div className="w-full sm:max-w-xl bg-white rounded-t-2xl sm:rounded-2xl p-6 shadow-xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-emerald-600" />
            <h3 className="text-lg font-bold text-gray-900">Pamamahala ng Paninda (Tingi)</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-full text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Controls */}
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-gray-100 rounded-xl my-4 text-xs font-bold">
          <button
            onClick={() => setActiveTab('LIST')}
            className={`py-2 rounded-lg transition ${
              activeTab === 'LIST' ? 'bg-white text-emerald-800 shadow-xs' : 'text-gray-600'
            }`}
          >
            Listahan ({products.length})
          </button>
          <button
            onClick={() => setActiveTab('RESTOCK')}
            className={`py-2 rounded-lg transition ${
              activeTab === 'RESTOCK' ? 'bg-white text-emerald-800 shadow-xs' : 'text-gray-600'
            }`}
          >
            + Mag-Restock
          </button>
          <button
            onClick={() => setActiveTab('NEW')}
            className={`py-2 rounded-lg transition ${
              activeTab === 'NEW' ? 'bg-white text-emerald-800 shadow-xs' : 'text-gray-600'
            }`}
          >
            + Bagong Produkto
          </button>
        </div>

        {/* Tab 1: Product List */}
        {activeTab === 'LIST' && (
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {products.map((prod) => {
              const isLow = prod.currentStock <= prod.lowStockThreshold;
              const isOut = prod.currentStock <= 0;
              return (
                <div
                  key={prod.id}
                  className="bg-white border border-gray-200 rounded-xl p-3 shadow-xs flex items-center justify-between"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                        {prod.category}
                      </span>
                      {isOut ? (
                        <span className="text-[10px] bg-red-100 text-red-700 font-extrabold px-1.5 py-0.2 rounded">
                          UBOS NA
                        </span>
                      ) : isLow ? (
                        <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.2 rounded flex items-center gap-0.5">
                          <AlertTriangle className="w-2.5 h-2.5" />
                          Kakaunti na
                        </span>
                      ) : null}
                    </div>
                    <h4 className="font-bold text-gray-900 text-sm">{prod.name}</h4>
                    <span className="text-xs text-emerald-700 font-extrabold">
                      ₱{prod.retailPrice.toFixed(2)} / {prod.baseUnit}
                    </span>
                  </div>

                  <div className="text-right">
                    <span
                      className={`text-base font-black ${
                        isOut ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-gray-800'
                      }`}
                    >
                      {prod.currentStock}
                    </span>
                    <span className="text-xs text-gray-400 block">{prod.baseUnit}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Tab 2: Break-Bulk Restock Form */}
        {activeTab === 'RESTOCK' && (
          <form onSubmit={handleRestockSubmit} className="flex-1 overflow-y-auto space-y-4 pr-1">
            {restockSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{restockSuccessMsg}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Piliin ang Produkto</label>
              <select
                value={restockProductId}
                onChange={(e) => {
                  const pid = e.target.value;
                  setRestockProductId(pid);
                  const p = products.find((x) => x.id === pid);
                  setSelectedPkgUnitId(p?.packageUnits[0]?.id || '');
                }}
                className="w-full py-2.5 px-3 border border-gray-300 rounded-xl text-sm font-semibold bg-white focus:ring-2 focus:ring-emerald-500"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.currentStock} {p.baseUnit} sa tindahan)
                  </option>
                ))}
              </select>
            </div>

            {currentRestockProd && (
              <>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Uri ng Pag-Restock (Unit Conversion)
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedPkgUnitId('')}
                      className={`p-3 rounded-xl border text-left transition ${
                        !selectedPkgUnitId
                          ? 'border-emerald-600 bg-emerald-50/70 font-bold text-emerald-900 ring-1 ring-emerald-600'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <span className="text-xs block">Tingi / Bawat Piraso</span>
                      <span className="text-[11px] text-gray-400">1 {currentRestockProd.baseUnit}</span>
                    </button>

                    {currentRestockProd.packageUnits.map((unit) => (
                      <button
                        key={unit.id}
                        type="button"
                        onClick={() => setSelectedPkgUnitId(unit.id)}
                        className={`p-3 rounded-xl border text-left transition ${
                          selectedPkgUnitId === unit.id
                            ? 'border-emerald-600 bg-emerald-50/70 font-bold text-emerald-900 ring-1 ring-emerald-600'
                            : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <span className="text-xs block">{unit.unitName} (Whole)</span>
                        <span className="text-[11px] text-emerald-700 font-bold">
                          = {unit.multiplier} {currentRestockProd.baseUnit}s
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Dami ng I-rerestock ({selectedPkgUnitId && currentPkgUnit ? currentPkgUnit.unitName : currentRestockProd.baseUnit})
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={restockQty}
                    onChange={(e) => setRestockQty(e.target.value)}
                    className="w-full text-xl font-bold py-2.5 px-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* Conversion Preview Box */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1">
                  <span className="text-gray-500 font-semibold block">Kinalabasan ng Stock:</span>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700">Madadagdag sa inventory:</span>
                    <span className="font-extrabold text-emerald-700 text-sm">
                      +
                      {selectedPkgUnitId && currentPkgUnit
                        ? (parseFloat(restockQty) || 0) * currentPkgUnit.multiplier
                        : parseFloat(restockQty) || 0}{' '}
                      {currentRestockProd.baseUnit}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-gray-500">
                    <span>Bagong Kabuuang Stock:</span>
                    <span className="font-bold text-gray-900">
                      {currentRestockProd.currentStock +
                        (selectedPkgUnitId && currentPkgUnit
                          ? (parseFloat(restockQty) || 0) * currentPkgUnit.multiplier
                          : parseFloat(restockQty) || 0)}{' '}
                      {currentRestockProd.baseUnit}
                    </span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isRestocking}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold rounded-xl transition text-sm shadow-md"
                >
                  {isRestocking ? 'Inililista...' : 'I-save ang Restock'}
                </button>
              </>
            )}
          </form>
        )}

        {/* Tab 3: Add New Product Form */}
        {activeTab === 'NEW' && (
          <form onSubmit={handleCreateProductSubmit} className="flex-1 overflow-y-auto space-y-3 pr-1">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Pangalan ng Produkto *</label>
              <input
                type="text"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="hal. Silver Swan Suka 350ml"
                className="w-full py-2 px-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Kategorya</label>
                <input
                  type="text"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="hal. Condiments"
                  className="w-full py-2 px-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Base Unit (Tingi)</label>
                <input
                  type="text"
                  value={newBaseUnit}
                  onChange={(e) => setNewBaseUnit(e.target.value)}
                  placeholder="sachet, bote, piraso"
                  className="w-full py-2 px-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Tingi Price (₱) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={newRetailPrice}
                  onChange={(e) => setNewRetailPrice(e.target.value)}
                  placeholder="15.00"
                  className="w-full py-2 px-3 border border-gray-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Panimulang Stock</label>
                <input
                  type="number"
                  value={newInitialStock}
                  onChange={(e) => setNewInitialStock(e.target.value)}
                  placeholder="0"
                  className="w-full py-2 px-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Optional Wholesale/Break-bulk package conversion unit */}
            <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
              <label className="flex items-center gap-2 text-xs font-bold text-gray-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasPkgUnit}
                  onChange={(e) => setHasPkgUnit(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600"
                />
                <span>May Package Unit para sa Restock (hal. Box o Sako)</span>
              </label>

              {hasPkgUnit && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="block text-[11px] text-gray-500 mb-0.5">Pangalan ng Package</label>
                    <input
                      type="text"
                      value={pkgUnitName}
                      onChange={(e) => setPkgUnitName(e.target.value)}
                      placeholder="hal. Kahon (24s)"
                      className="w-full py-1.5 px-2.5 border border-gray-300 rounded-lg text-xs bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-500 mb-0.5">Ilang tingi sa loob? (Multiplier)</label>
                    <input
                      type="number"
                      value={pkgMultiplier}
                      onChange={(e) => setPkgMultiplier(e.target.value)}
                      placeholder="24"
                      className="w-full py-1.5 px-2.5 border border-gray-300 rounded-lg text-xs font-bold bg-white"
                    />
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isSavingProduct}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold rounded-xl transition text-sm shadow-md mt-2"
            >
              {isSavingProduct ? 'Inililista...' : 'Ilista ang Produkto'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

