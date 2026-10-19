---
name: react-best-practices
description: Applies Vercel's reviewed React performance guidance to Zelaté's React client applications only. Excludes Next.js, server components, React Native and framework-specific rules.
---

# React best practices for Zelaté client applications

Use the review record in `SOURCE.md` to locate the pinned Vercel guidance. Apply only rules that fit this repository's React 19, Vite and browser-only architecture.

- Prevent avoidable re-renders; keep state close to its consumers and use stable list keys.
- Keep components focused and use lazy loading for genuinely large, non-critical routes or features.
- Avoid blocking waterfalls; parallelize independent requests and use TanStack Query for server state.
- Keep browser bundles lean: import icons individually and load maps or other heavy features on demand.
- Preserve accessible semantics, keyboard behavior and reduced-motion support from `docs/DESIGN_SYSTEM.md`.
- Never introduce Next.js, React Server Components, server actions or React Native patterns into this Vite application.

This short local guidance is a selective summary, not a copy of the upstream skill. Follow the project TRD and design system when they impose stricter requirements.
