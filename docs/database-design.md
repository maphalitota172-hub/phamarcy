# MongoDB Data Design

MongoDB Atlas is the active data store. Mongoose models cover users, customers, separate customer credentials, products, sales, payments, expenses, income, suppliers, supplier invoices/payments, stock movements, budgets, audit logs, and settings. The original JSON files in `backend/data/` remain unchanged as the migration source; backups are not imported.

Money is represented in integer minor units. A value of `6800000` means M68,000.00. POS and customer-portal sale, payment, inventory, stock-movement, and audit writes execute in a MongoDB transaction.

Employee accounts and pharmacy customer profiles are separate collections. Customer credentials are in `customerCredentials`, linked by customer ID, and contain a bcrypt password hash and normalized phone lookup. Customer registration activates the customer immediately. No customer credentials or role are placed in the employee collection; customer JWTs are restricted to the customer portal.

A customer has a generated numeric record ID and `CUST-` identifier, contact details, registration date, status and optional notes. Sales reference `customerId` for registered customers and use `null` with `walkIn: true` for walk-in sales. Customer-portal sales are recorded with source `Customer Portal`; their payment method is stored with the sale and payment record. Customer purchase history is derived from completed sales and payment records rather than stored totals.

The settings document retains `customerIdNext`, a monotonically increasing customer ID, so clearing customer profiles does not allow an unexpired customer token to identify a newly registered account with a reused ID.

Legacy sales that lack recorded totals or item prices are retained with `financialCompleteness: "Incomplete"` and a list of missing financial fields. They are never valued using current product prices. Historical customer/cashier labels remain as recorded; missing foreign-key IDs are not inferred.

The migrated settings document disables the demo flag and excludes the illustrative monthly-summary field. Source JSON remains unchanged.

## JSON migration

Configure `MONGODB_URI` and `MONGODB_DATABASE` in `backend/.env`, then run `npm run migrate:json --prefix backend`. Migration reads only current active files, detects duplicate/conflicting IDs, preserves relationships, avoids overwrites, and verifies source records against MongoDB. It is safe to rerun. Snapshot-only records in `backend/backups/` are intentionally excluded per the selected migration scope. The Express server never falls back to JSON when Atlas is unavailable.

The React application should not require changes beyond configuration because it communicates only through the existing API.
