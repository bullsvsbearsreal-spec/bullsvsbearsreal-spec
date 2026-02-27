# Account Features Design

## Feature 1: Avatar Upload

- User clicks avatar on `/settings` to upload a photo
- Client resizes to 256x256 via `<canvas>`, converts to webp
- `POST /api/user/avatar` uploads to DigitalOcean Spaces (`avatars/{userId}.webp`)
- Stores CDN URL in `users.image` column
- Header shows avatar in user button if available

**New dependency**: `@aws-sdk/client-s3` for DO Spaces upload

## Feature 2: Widget Dashboard

Replace static `/dashboard` with draggable widget grid.

**Widgets**: Watchlist, Portfolio, Alerts, Wallets, BTC Price, Fear & Greed, Top Movers, Liquidations, BTC Chart, Funding Heatmap, OI Chart, Dominance Chart

**Grid**: 3-col desktop, 2-col tablet, 1-col mobile (stacked, no drag). Custom CSS Grid + pointer events for drag-and-drop. No external library.

**Layout stored in**: `user_prefs.prefs.dashboardLayout` as JSON array. localStorage fallback for unauthenticated users.

**Files**:
- `src/components/dashboard/DashboardGrid.tsx` — grid + drag logic
- `src/components/dashboard/WidgetWrapper.tsx` — drag handle, remove, size
- `src/components/dashboard/widgets/*.tsx` — individual widgets
- `src/components/dashboard/WidgetPicker.tsx` — add widget modal
- `src/components/dashboard/useGridDrag.ts` — drag hook
