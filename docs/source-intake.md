# Source Intake Summary

This setup was aligned to the following source docs:

- `App Map - 2026.02.06.docx`
- `Software Requirements Specification [LIVEY].docx`
- `Ideas.docx`
- `Fidelis - Coding Spring 2026.pdf`

## Key Decisions Extracted

- Build starts from scratch (repo was empty).
- Primary stack: Next.js + FastAPI + Supabase.
- Initial product is a desktop web app (mobile is not in current scope).
- Core actors: guest user, registered user, venue, artist, admin.
- Core v1 capability: local discovery by ZIP with filtering and event cards.

## Open Questions to Resolve Early

- Verification workflow ownership (who approves venue accounts).
- Moderation/reporting for inaccurate or inappropriate listings.
- Ticketing strategy (link-out only vs integrated flow in future).
- Budget and provider decisions for AI/recommendation services.
