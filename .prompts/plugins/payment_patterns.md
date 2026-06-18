# Payment Plugin Patterns and Antipatterns

## ✅ Proven Patterns

### 1. Delegate state changes to core's payment API
```python
# ✅ Let core record the transaction and flip registration state
register_transaction(registration, amount=amount, currency=currency,
                      action=TransactionAction.complete, provider=self.name, data=raw_payload)
```
Don't directly flip `registration.state` — the core payment transaction
API keeps audit history and triggers the right notification signals.

### 2. Verify webhook signatures before doing anything else
```python
# ✅
if not provider_sdk.verify_signature(request.data, request.headers['X-Signature'], secret):
    abort(400)
```

### 3. Idempotent callback handling
```python
# ✅ Provider webhooks can be retried/duplicated — guard against double-processing
existing = PaymentTransaction.query.filter_by(provider_transaction_id=txn_id).first()
if existing:
    return jsonify(status='already processed')
```

## ❌ Common Antipatterns

### 1. Trusting client-side amount
```python
# ❌ Wrong: amount comes from the form POST, attacker-controllable
amount = request.form['amount']

# ✅ Recompute from the registration/event data server-side
amount = registration.price
```

### 2. Logging secrets or full payloads
```python
# ❌
current_app.logger.info('Webhook payload: %s', request.data)

# ✅ Log identifiers only
current_app.logger.info('Processed payment for registration %s', registration.id)
```

### 3. Synchronous external calls without timeout/error handling
```python
# ❌
response = requests.post(provider_url, json=payload)

# ✅
response = requests.post(provider_url, json=payload, timeout=10)
response.raise_for_status()
```
