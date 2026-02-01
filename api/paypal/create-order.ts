// api/paypal/create-order.ts — Create a PayPal order for checkout
// POST { items: [{ name, quantity, price }], currency? }
// → returns { orderId }

import type { VercelRequest, VercelResponse } from '@vercel/node';

const PAYPAL_API = process.env.PAYPAL_MODE === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

async function getAccessToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !secret) throw new Error('PayPal credentials not configured');

  const auth = Buffer.from(`${clientId}:${secret}`).toString('base64');
  const res = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`PayPal auth failed: ${err}`);
  }

  const data = await res.json();
  return data.access_token;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { items, currency = 'USD' } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items array is required' });
    }

    const accessToken = await getAccessToken();

    // Calculate totals
    const itemTotal = items.reduce((sum: number, item: any) => {
      return sum + (parseFloat(item.price) * (parseInt(item.quantity) || 1));
    }, 0);

    const paypalItems = items.map((item: any) => ({
      name: item.name,
      description: item.description || '',
      quantity: String(item.quantity || 1),
      unit_amount: {
        currency_code: currency,
        value: parseFloat(item.price).toFixed(2),
      },
      category: 'PHYSICAL_GOODS',
    }));

    const orderPayload = {
      intent: 'CAPTURE',
      purchase_units: [{
        description: 'MyRestoMod Custom Merch',
        amount: {
          currency_code: currency,
          value: itemTotal.toFixed(2),
          breakdown: {
            item_total: {
              currency_code: currency,
              value: itemTotal.toFixed(2),
            },
            shipping: {
              currency_code: currency,
              value: '0.00',
            },
          },
        },
        items: paypalItems,
      }],
      application_context: {
        brand_name: 'MyRestoMod',
        shipping_preference: 'GET_FROM_FILE', // Let PayPal collect shipping address
        user_action: 'PAY_NOW',
      },
    };

    const orderRes = await fetch(`${PAYPAL_API}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderPayload),
    });

    if (!orderRes.ok) {
      const err = await orderRes.text();
      console.error('PayPal create order error:', err);
      throw new Error('Failed to create PayPal order');
    }

    const order = await orderRes.json();
    return res.status(200).json({ orderId: order.id });
  } catch (err: any) {
    console.error('create-order error:', err);
    return res.status(500).json({ error: err.message || 'Failed to create order' });
  }
}
