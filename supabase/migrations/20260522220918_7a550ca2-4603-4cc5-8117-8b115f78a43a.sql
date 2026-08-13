INSERT INTO public.payment_settings (id, plisio_enabled, plisio_api_key, payment_instructions)
VALUES (1, true, 'SkkZKl5C_QLes32hefTT3xokoeSrgf1CWc2SUn5C8u4GioW88bgPvxoLxXZV1ORb', 'Pay with crypto (BTC, LTC, USDT) via Plisio. Click Upgrade to start checkout.')
ON CONFLICT (id) DO UPDATE
SET plisio_enabled = true,
    plisio_api_key = EXCLUDED.plisio_api_key,
    payment_instructions = EXCLUDED.payment_instructions,
    updated_at = now();