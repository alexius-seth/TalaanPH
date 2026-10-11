import { db } from './db';
import { generateUUID } from './lib/uuid';
import type { Product, ProductPackageUnit, CreateProductInput, OutboxEntry } from './types';

export class InventoryService {
  /**
   * Seeds default sari-sari store products if local database is empty.
   */
  async ensureDefaultProducts(): Promise<void> {
    const count = await db.products.count();
    if (count > 0) return;

    const defaults: CreateProductInput[] = [
      {
        name: 'Nescafe Original 28g',
        category: 'Kape',
        baseUnit: 'sachet',
        initialStock: 48,
        lowStockThreshold: 10,
        costPerBaseUnit: 12.5,
        retailPrice: 15,
        packageUnits: [{ unitName: 'Box (24s)', multiplier: 24, packageCost: 300 }],
      },
      {
        name: 'Lucky Me Pancit Canton Kalamansi',
        category: 'Noodles',
        baseUnit: 'pack',
        initialStock: 36,
        lowStockThreshold: 8,
        costPerBaseUnit: 14.5,
        retailPrice: 18,
        packageUnits: [{ unitName: 'Box (24s)', multiplier: 24, packageCost: 348 }],
      },
      {
        name: 'Bigas Sinandomeng',
        category: 'Bigas',
        baseUnit: 'kilo',
        initialStock: 50,
        lowStockThreshold: 10,
        costPerBaseUnit: 48,
        retailPrice: 55,
        packageUnits: [{ unitName: 'Sako (25kg)', multiplier: 25, packageCost: 1200 }],
      },
      {
        name: 'Itlog Medium',
        category: 'Itlog',
        baseUnit: 'piraso',
        initialStock: 60,
        lowStockThreshold: 12,
        costPerBaseUnit: 7.5,
        retailPrice: 9,
        packageUnits: [{ unitName: 'Tray (30s)', multiplier: 30, packageCost: 225 }],
      },
      {
        name: 'Bear Brand Fortified 33g',
        category: 'Gatas',
        baseUnit: 'sachet',
        initialStock: 48,
        lowStockThreshold: 10,
        costPerBaseUnit: 13,
        retailPrice: 16,
        packageUnits: [{ unitName: 'Box (24s)', multiplier: 24, packageCost: 312 }],
      },
    ];

    for (const item of defaults) {
      await this.createProduct(item);
    }
  }

  /**
   * Creates a new product and optional package units atomically.
   */
  async createProduct(input: CreateProductInput): Promise<Product> {
    const productId = generateUUID();
    const now = new Date().toISOString();

    const product: Product = {
      id: productId,
      name: input.name.trim(),
      category: input.category.trim(),
      baseUnit: input.baseUnit.trim().toLowerCase(),
      currentStock: Number(input.initialStock ?? 0),
      lowStockThreshold: Number(input.lowStockThreshold ?? 5),
      costPerBaseUnit: Number(input.costPerBaseUnit ?? 0),
      retailPrice: Number(input.retailPrice),
      createdAt: now,
      updatedAt: now,
    };

    const packageUnits: ProductPackageUnit[] = (input.packageUnits ?? []).map((pkg) => ({
      id: generateUUID(),
      productId,
      unitName: pkg.unitName.trim(),
      multiplier: Number(pkg.multiplier),
      packageCost: Number(pkg.packageCost),
    }));

    const outboxEntry: OutboxEntry = {
      id: generateUUID(),
      action: 'CREATE_PRODUCT',
      payload: { product, packageUnits },
      timestamp: Date.now(),
      status: 'PENDING',
      retryCount: 0,
    };

    await db.transaction('rw', [db.products, db.packageUnits, db.syncOutbox], async () => {
      await db.products.add(product);
      if (packageUnits.length > 0) {
        await db.packageUnits.bulkAdd(packageUnits);
      }
      await db.syncOutbox.add(outboxEntry);
    });

    return product;
  }

  /**
   * Restocks a product either loose (base units) or as break-bulk packages (e.g. 1 Box -> 24 sachets).
   */
  async restockProduct(
    productId: string,
    quantity: number,
    isPackageUnit: boolean,
    packageUnitId?: string
  ): Promise<Product> {
    const product = await db.products.get(productId);
    if (!product) throw new Error(`Product not found: ${productId}`);

    let addedStock = quantity;
    let unitLabel = product.baseUnit;

    if (isPackageUnit && packageUnitId) {
      const packageUnit = await db.packageUnits.get(packageUnitId);
      if (!packageUnit) throw new Error(`Package unit not found: ${packageUnitId}`);
      addedStock = quantity * packageUnit.multiplier;
      unitLabel = `${packageUnit.unitName} (x${packageUnit.multiplier})`;
    }

    const updatedStock = Math.round((product.currentStock + addedStock) * 100) / 100;
    const now = new Date().toISOString();

    const outboxEntry: OutboxEntry = {
      id: generateUUID(),
      action: 'RESTOCK_PRODUCT',
      payload: {
        productId,
        quantity,
        addedStock,
        unitLabel,
        newStock: updatedStock,
        timestamp: now,
      },
      timestamp: Date.now(),
      status: 'PENDING',
      retryCount: 0,
    };

    await db.transaction('rw', [db.products, db.syncOutbox], async () => {
      await db.products.update(productId, {
        currentStock: updatedStock,
        updatedAt: now,
      });
      await db.syncOutbox.add(outboxEntry);
    });

    return { ...product, currentStock: updatedStock, updatedAt: now };
  }

  /**
   * Deducts base unit inventory for products sold during a transaction.
   */
  async deductStockForTransaction(
    items: Array<{ productId?: string; quantity: number }>
  ): Promise<void> {
    const validItems = items.filter((it) => it.productId && it.quantity > 0);
    if (validItems.length === 0) return;

    await db.transaction('rw', db.products, async () => {
      for (const item of validItems) {
        const prod = await db.products.get(item.productId!);
        if (prod) {
          const newStock = Math.round((prod.currentStock - item.quantity) * 100) / 100;
          await db.products.update(item.productId!, {
            currentStock: newStock,
            updatedAt: new Date().toISOString(),
          });
        }
      }
    });
  }

  /**
   * Retrieves products along with their package units.
   */
  async getAllProducts(): Promise<Array<Product & { packageUnits: ProductPackageUnit[] }>> {
    const products = await db.products.toArray();
    const result = await Promise.all(
      products.map(async (p) => {
        const packageUnits = await db.packageUnits.where('productId').equals(p.id).toArray();
        return { ...p, packageUnits };
      })
    );
    return result;
  }
}

export const inventoryService = new InventoryService();

