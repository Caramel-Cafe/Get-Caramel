# Performance Baseline (Instant UX)

## Client Targets
- First meaningful paint under 1.8s on mid-tier devices
- Navigation transition below 120ms
- List scroll at sustained 60fps
- Tap-to-feedback below 50ms

## API Targets
- Auth endpoints p95 under 180ms (without external OTP providers)
- Gateway cold-start avoided in production via warm instances
- Payload budgets:
  - Auth bootstrap response under 4KB
  - Vendor card response under 2KB each

## Implementation Rules
- Prefer server-driven pagination for all feed endpoints
- Send only required fields per screen (no over-fetching)
- Keep onboarding and home assets optimized (webp, compressed SVG)
- Use Redis for hot keys: session checks, nearby vendor IDs, menu summary cache
- Emit async events for non-critical side effects (analytics, notifications)

## Mobile Rendering Rules
- Use `FlashList` or optimized `FlatList` with stable keys and item layout hints
- Memoize cards and row components
- Avoid heavy shadows/blur on large scrolling surfaces
- Preload next screen data during current interaction idle time
