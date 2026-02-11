// api/paypal/capture-order.ts — Capture payment after customer approves
// POST { orderId }
// → returns { captureId, status, payer }

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkRateLimit } from '../_lib/rateLimit.js';

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

  if (!res.ok) throw new Error('PayPal auth failed');
  const data = await res.json();
  return data.access_token;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!(await checkRateLimit(req, res, 'sensitive'))) return;
  
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { orderId } = req.body;
    if (!orderId) return res.status(400).json({ error: 'orderId is required' });

    const accessToken = await getAccessToken();

    const captureRes = await fetch(`${PAYPAL_API}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!captureRes.ok) {
      const err = await captureRes.text();
      console.error('PayPal capture error:', err);
      throw new Error('Failed to capture payment');
    }

    const capture = await captureRes.json();
    const captureId = capture.purchase_units?.[0]?.payments?.captures?.[0]?.id;
    const payer = capture.payer;
    const shipping = capture.purchase_units?.[0]?.shipping;

    return res.status(200).json({
      captureId,
      status: capture.status,
      payer: {
        email: payer?.email_address,
        name: payer?.name ? `${payer.name.given_name} ${payer.name.surname}` : undefined,
        payerId: payer?.payer_id,
      },
      shipping: shipping ? {
        name: shipping.name?.full_name,
        address: shipping.address ? {
          address1: shipping.address.address_line_1 || '',
          address2: shipping.address.address_line_2 || '',
          city: shipping.address.admin_area_2 || '',
          state: shipping.address.admin_area_1 || '',
          zip: shipping.address.postal_code || '',
          country: shipping.address.country_code || 'US',
        } : undefined,
      } : undefined,
    });
  } catch (err: any) {
    console.error('capture-order error:', err);
    return res.status(500).json({ error: err.message || 'Failed to capture payment' });
  }
}
