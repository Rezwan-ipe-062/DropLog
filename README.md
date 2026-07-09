# DropLog — Route Delivery Tracking

**Syngenta Bangladesh** — Admin panel + SO mobile app for managing group delivery routes across 4 warehouses (CTG, GAZ, JSR, BGR).

## Structure

```
admin/       Admin panel (dashboard, route builder, fleet, users, contacts, notifications)
so-app/      Supply Officer mobile app (route execution, delivery, issues, GPS)
supabase/    SQL scripts for database schema, seed data, migrations
```

## Quick Start

1. Run SQL scripts in order: `01_tables` → `02_alter_indexes_rls` → `03_seed_data` → `05_hash_pins`
2. Deploy `admin/` as a static site (admin.syngenta-drop.com)
3. Deploy `so-app/` as a separate static site (app.syngenta-drop.com)
4. Enter Supabase credentials in both `config.js` files

## Features

- **Multi-warehouse**: 4 warehouses with separate admin accounts and data scoping
- **Route Builder**: Auto-detect multi-stop GDs, bundle single-stop GDs, assign vehicles & SOs
- **Delivery Tracking**: SO app records delivery status, GPS, photos, and issues per stop
- **Fleet Management**: Register vehicles & drivers per warehouse
- **Security**: PIN hashing (SHA-256), session validation, warehouse scoping

## Default Admin Accounts

| ID | Warehouse | PIN |
|---|---|---|
| ADMIN-01 | All (legacy) | 0000 |
| ADMIN-CTG | Chittagong | 0001 |
| ADMIN-GAZ | Gazipur | 0002 |
| ADMIN-JSR | Jashore | 0003 |
| ADMIN-BGR | Bogura | 0004 |

See SOP document (`DropLog_SOP.docx`) for full user guide.
