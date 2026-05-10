/** Server-side payment configuration flags (no secrets exposed). */

export type PaymentReadiness = {
  appUrl: boolean;
  stripe: { checkout: boolean; webhook: boolean };
  razorpay: { api: boolean; webhook: boolean };
  payu: { hostedCheckout: boolean };
  /** At least one path can accept customer payments from Settings. */
  anyChargePath: boolean;
  /** Recommended for automatic plan sync (webhooks / verified return). */
  planSyncReady: boolean;
};

export function getPaymentReadiness(): PaymentReadiness {
  const appUrl = Boolean(process.env.NEXT_PUBLIC_APP_URL?.trim());
  const stripeKey = Boolean(process.env.STRIPE_SECRET_KEY?.trim());
  const stripePrice = Boolean(process.env.STRIPE_PRO_PRICE_ID?.trim());
  const stripeWh = Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim());

  const rzpKey = Boolean(process.env.RAZORPAY_KEY_ID?.trim() && process.env.RAZORPAY_KEY_SECRET?.trim());
  const rzpWh = Boolean(process.env.RAZORPAY_WEBHOOK_SECRET?.trim());

  const payuKey = Boolean(process.env.PAYU_MERCHANT_KEY?.trim() && process.env.PAYU_MERCHANT_SALT?.trim());
  const payuHosted = payuKey && appUrl;

  const stripeCheckout = stripeKey && stripePrice;
  const anyChargePath = stripeCheckout || rzpKey || payuHosted;
  const planSyncReady =
    (stripeCheckout && stripeWh) || (rzpKey && rzpWh) || payuHosted;

  return {
    appUrl,
    stripe: { checkout: stripeCheckout, webhook: stripeKey && stripeWh },
    razorpay: { api: rzpKey, webhook: rzpWh },
    payu: { hostedCheckout: payuHosted },
    anyChargePath,
    planSyncReady,
  };
}
