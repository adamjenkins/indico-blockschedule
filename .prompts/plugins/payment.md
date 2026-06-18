# Payment Plugin Development Guide

Reference implementation: `../indico-plugins/payment_paypal/`
(`indico_payment_paypal/plugin.py`). Also check `payment_stripe` and
`payment_sixpay` for variations.

## When to use this guide

The plugin adds a way for registrants to pay for an event registration —
i.e. it implements an actual payment method, not just "the plugin deals
with money" in some general sense.

## Base class

```python
from indico.modules.events.payment import PaymentPluginMixin
from indico.core.plugins import IndicoPlugin

class MyPaymentPlugin(PaymentPluginMixin, IndicoPlugin):
    configurable = True
    settings_form = SettingsForm           # subclass PaymentPluginSettingsFormBase
    event_settings_form = EventSettingsForm  # subclass PaymentEventSettingsFormBase
    default_settings = {...}
    default_event_settings = {...}

    def adjust_payment_form_data(self, data):
        data['register_link'] = ...
```

`PaymentPluginMixin` sets `category = PluginCategory.payment`
automatically and wires the plugin into the event registration payment
flow's plugin list.

## Settings forms

Use the payment-specific bases, not plain `IndicoForm`:
```python
from indico.modules.events.payment.forms import (
    PaymentPluginSettingsFormBase, PaymentEventSettingsFormBase,
)

class SettingsForm(PaymentPluginSettingsFormBase):
    ...  # global credentials, e.g. API key

class EventSettingsForm(PaymentEventSettingsFormBase):
    ...  # per-event configuration, e.g. which account to charge into
```

## The payment flow shape

1. Registrant reaches the payment step of registration.
2. `adjust_payment_form_data(data)` lets the plugin inject context the
   template needs (redirect URLs, computed amounts, provider-specific
   tokens).
3. The plugin's blueprint exposes endpoints for the provider's redirect/
   webhook callback (e.g. PayPal's IPN-style callback, Stripe's webhook).
4. On confirmed payment, mark the registration as paid through the core
   payment API (don't hand-roll registration-state changes) — follow
   `payment_paypal`'s controller for the exact call sequence.

## Security specifics for payment plugins

- Validate webhook/callback signatures using the provider's SDK/shared
  secret — never trust an unsigned "payment succeeded" callback.
- Never log full card numbers, secrets, or full webhook payloads
  containing PII at info level.
- Treat all amounts as the provider's canonical currency unit handling
  (cents vs. whole units) — off-by-orders-of-magnitude bugs here are a
  real-money problem, not just a display bug.

## Testing

`payment_paypal` and `payment_stripe` are both in the CI test matrix
(`indico-plugins/.github/workflows/ci.yml`) — model `pytest.ini` and test
layout on whichever is structurally closer to the new plugin's provider
integration style (REST callback vs. SDK-driven).
