// api/_lib/pricing.ts — Server-side canonical pricing
// CRITICAL: Never trust client-provided prices

export interface Product {
  id: string;
  name: string;
  price: number; // USD
  category: 'apparel' | 'home' | 'accessories';
}

/**
 * Canonical product pricing (source of truth)
 * All prices in USD
 */
export const PRODUCT_CATALOG: Record<string, Product> = {
  'classic-tee': {
    id: 'classic-tee',
    name: 'Classic T-Shirt',
    price: 29.99,
    category: 'apparel',
  },
  'premium-hoodie': {
    id: 'premium-hoodie',
    name: 'Premium Hoodie',
    price: 49.99,
    category: 'apparel',
  },
  'poster-12x18': {
    id: 'poster-12x18',
    name: '12x18" Poster',
    price: 19.99,
    category: 'home',
  },
  'poster-18x24': {
    id: 'poster-18x24',
    name: '18x24" Poster',
    price: 29.99,
    category: 'home',
  },
  'mug-ceramic': {
    id: 'mug-ceramic',
    name: 'Ceramic Mug',
    price: 14.99,
    category: 'home',
  },
  'phone-case': {
    id: 'phone-case',
    name: 'Phone Case',
    price: 24.99,
    category: 'accessories',
  },
  'sticker-pack': {
    id: 'sticker-pack',
    name: 'Sticker Pack (5)',
    price: 9.99,
    category: 'accessories',
  },
};

/**
 * Get canonical price for a product
 * @returns Price in USD or null if product not found
 */
export function getProductPrice(productId: string): number | null {
  const product = PRODUCT_CATALOG[productId];
  return product ? product.price : null;
}

/**
 * Validate order total against canonical pricing
 * @returns { valid: boolean, expectedTotal: number, receivedTotal: number }
 */
export function validateOrderTotal(
  items: Array<{ productId: string; quantity: number }>,
  receivedTotal: number
): { valid: boolean; expectedTotal: number; receivedTotal: number; errors?: string[] } {
  const errors: string[] = [];
  let expectedTotal = 0;

  for (const item of items) {
    const price = getProductPrice(item.productId);
    if (price === null) {
      errors.push(`Invalid product ID: ${item.productId}`);
      continue;
    }
    expectedTotal += price * item.quantity;
  }

  // Allow 1 cent tolerance for floating point rounding
  const valid = Math.abs(expectedTotal - receivedTotal) < 0.01;

  return {
    valid,
    expectedTotal: parseFloat(expectedTotal.toFixed(2)),
    receivedTotal: parseFloat(receivedTotal.toFixed(2)),
    errors: errors.length > 0 ? errors : undefined,
  };
}
