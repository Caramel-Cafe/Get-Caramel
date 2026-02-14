# Step 12 - Incremental Writes + Indexed Pagination

## Scope Delivered
- Switched repository persistence strategy from full table replacement to incremental upserts.
- Added paginated SQL query methods for high-volume surfaces.
- Added database indexes for common read paths in core migrations.

## Incremental Repository Writes
### Order Repository
- `upsertCart`, `deleteCart`, `upsertOrder`, `upsertReview`, `upsertSupportTicket`
- Order service now persists entities directly on mutation instead of full-state replace.

### Payment Repository
- `upsertPayment`, `upsertInvoice`, `upsertPayout`, `upsertVendorBalance`, `upsertCustomerPaymentIndex`, `setTotalPaidCents`
- Payment service now persists targeted entities for payment lifecycle, invoices, balances, payouts.

## Pagination Queries
### Order Service endpoints
- `GET /orders/customer/:customerId/paged?limit=&offset=`
- `GET /orders/customer/:customerId/reviews/paged?limit=&offset=`
- `GET /orders/customer/:customerId/tickets/paged?limit=&offset=`
- `GET /orders/vendor/:vendorId/queue/paged?limit=&offset=`
- `GET /orders/admin/orders/paged?limit=&offset=`
- `GET /orders/admin/reviews/pending/paged?limit=&offset=`
- `GET /orders/admin/support/tickets/paged?limit=&offset=`

### Payment Service endpoints
- `GET /payments/customer/:customerId/paged?limit=&offset=`
- `GET /invoices/vendor/:vendorId/paged?limit=&offset=`

## Added Indexes
- Orders: customer, vendor+status, status+created
- Reviews: vendor, customer, moderation status
- Support tickets: customer, status+priority
- Payments: customer+created
- Invoices: vendor+issued
- Payouts: vendor+created

## Notes
- Runtime in-memory maps are still retained for instant local reads and backward compatibility.
- Repository paged SQL paths are used when DB is configured, with in-memory fallback otherwise.
