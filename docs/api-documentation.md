# API Documentation

Local API base: `http://localhost:4000/api`

## Authentication

- `POST /auth/login` — authenticate a demo account.
- `POST /auth/register` — create an inactive account pending System Administrator approval.
- `GET /auth/me` — return the authenticated user.
- `POST /customer-auth/register` — create an active customer account immediately; no employee approval.
- `POST /customer-auth/login` — authenticate with the registered phone number and password.
- `GET /customer-portal/me` — return the signed-in customer's own profile.
- `GET /customer-portal/products` — return active in-stock products and current prices.
- `GET /customer-portal/purchases` — return only that customer's purchase and refund history.
- `POST /customer-portal/checkout` — create a completed sale for the signed-in customer. The request contains `items: [{ productId, quantity }]` and `paymentMethod`, one of `M-Pesa`, `EcoCash`, `E-wallet`, or `Credit Card`. Prices and totals are calculated by the server.

Protected routes require `Authorization: Bearer <JWT>`.

## Phase 2 resources

- `GET /dashboard` — persisted-record dashboard values.
- `GET /customers`
- `GET /customers/:id`
- `GET /customers/:id/purchases`
- `POST /customers`
- `PUT /customers/:id`
- `PATCH /customers/:id/status`
- `GET /suppliers`
- `GET /products`
- `GET /sales`
- `GET /income`
- `GET /expenses`
- `GET /payments`
- `GET /budgets`
- `GET /supplierInvoices`
- `GET /supplierPayments`
- `GET /stock-movements`
- `GET /audit-logs`
- `PATCH /users/:id/activate` — System Administrator approves a pending registration.
- `POST /sales` — cashier, finance manager, or system administrator completes a registered-customer or walk-in sale. The backend validates prices, inventory and exact payment totals.

Customer records and credentials are separate from employee accounts. Employee JWTs access staff customer-management routes; customer JWTs access only their own profile and history. Cashiers, accountants, finance managers and administrators can register and edit customer profiles; only finance managers and administrators can change customer status. Auditors may read customer records. Completed sales are immutable.

The POS accepts payment methods `Cash`, `Credit Card`, `E-wallet`, `M-Pesa`, `EcoCash`, and `Other` (legacy `Card` and `Mobile Money` are accepted for compatibility). Payment amounts are positive integer minor units and their sum must equal the server-calculated sale total. Customer checkout writes the sale, payment, stock change, stock movement, and audit record atomically; the cashier transaction list includes the products and payment method.

Customer checkout currently records the selected payment method as paid for prototype testing only. No external gateway is configured, so it does not charge a card or mobile-money account. Real-money checkout requires integrating and verifying an appropriate payment provider before enabling customer orders.

Historical sales may include `financialCompleteness: "Incomplete"` and `missingFinancialFields`. A missing `totalMinor` is returned as unavailable; reports do not estimate historical totals using current prices.

The general resource routes support creation and updates where permitted by role. Customers use their dedicated validation routes. Completed sales are created only through the POS endpoint, and audit records are append-only.
