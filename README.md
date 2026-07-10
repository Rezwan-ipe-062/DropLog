# DropLog — Route Delivery Tracking

Route delivery tracking system for supply officers, administrators, and distributors.

## Structure

```
admin/       Admin dashboard
so-app/      Supply Officer mobile app (PWA)
portal/      Distributor tracking portal
supabase/    SQL schema and migrations
```

## Quick Start

1. Run SQL scripts in order: `01_tables` → `02_alter_indexes_rls` → `03_seed_data` → `05_hash_pins`
2. Set Supabase URL and anon key in each app's config file
3. Deploy each directory as a static site

## Features

- **Multi-warehouse** warehousing with data scoping
- **Route Builder** with auto-detection of multi-stop and single-stop deliveries
- **Delivery Tracking** with delivery status, GPS, photos, and issue recording
- **Fleet Management** for vehicles and drivers
- **Security**: PIN hashing (SHA-256), session validation, warehouse-scoped data access
- **Distributor Portal** for live dispatch tracking, ETA, exceptions, and POD
