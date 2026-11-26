# Architecture

The application uses:

- React and React Router in `frontend/`.
- Express in `backend/`.
- MongoDB Atlas as the required runtime database, connected before Express listens.

React calls the backend through `frontend/src/services/api.js`. The backend authenticates requests with signed JWTs and applies role checks. The Mongoose models in `backend/src/models/` define collections and indexes; `MongoRepository` isolates data access from routes. `backend/data/` is retained as a migration source only, and no JSON fallback is enabled.

Employee identities and pharmacy customers use separate collections; customer credentials are stored separately from employee credentials. Customer JWTs have a distinct `Customer` role and are accepted only by the self-service profile and purchase-history routes. Employee middleware rejects customer tokens. Customer registration activates immediately, without administrator approval.

The Customers API validates and manages profiles; the POS API accepts an optional customer ID and uses `null` for walk-in purchases. POS checkout supports cash, credit card, e-wallet, M-Pesa, EcoCash, and other methods. It validates server-side prices, stock and exact nonnegative payment totals, then persists the sale, payments, stock movements and audit event. Online customer ordering and online payment processing are not included.

Financial dashboard totals use only complete recorded amounts. Incomplete historical sales are flagged and are not assigned current product prices or treated as zero-value transactions. Empty collections return empty arrays and the interface shows explicit empty states.

The JSON migration command imports only the current files in `backend/data/`, validates references, avoids overwriting conflicting records, and verifies each imported record. Original JSON and backup snapshots remain untouched.
