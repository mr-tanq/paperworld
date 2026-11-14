# Matt: concrete Supabase identity guard (server-only)

This module is a deployable *dependency* for the future gateway, not a deployed gateway.

`createSupabaseGuard` supplies two server-side helpers:
- `authenticate(jwt)`: contacts the Supabase Auth `/auth/v1/user` endpoint using the presented user JWT and checks a valid authenticated user ID.
- `ownsThread({threadId,ownerId,agentId,token})`: rechecks the JWT identity, then uses that same JWT to query `paperworld_agent_threads` through Supabase PostgREST. Owner ID AND agent ID must match; RLS remains enabled server-side.

This does not grant additional DB privileges. It uses the project **publishable** key and bearer token; never use a service role key.

## Security limitations
- Existing `server/matt-gateway.cjs` requires a trusted authorization callback with `authenticate(token)` and `ownsThread(...)` contracts. The guard is a building block: the future host MUST bind the bearer token to both calls (the gateway currently does not pass token to ownsThread, so they cannot be safely wired together without another reviewed change).
- No GitHub OAuth link, approval reservation, budget gate, reply persistence, real HTTP server, credit use, or production RLS isolation test has been implemented.
- The Auth endpoint verifies the current token/user; for exceptionally sensitive operations, consider extra session-revocation checks and rate limiting.
- This is tested offline with mocked HTTP responses. It is NOT a live cross-account Supabase test.

## Why hosting is still needed
GitHub Pages is static. The Copilot SDK supports a Node backend (bundled CLI or headless runtime), but we need an always-on trusted Node host for tablet access. No free tier or zero-cost hosting is assumed.

## Next implementation gates
1. Review PR and run tests in CI; do not deploy without authorization.
2. Wire bearer token consistently through the gateway, verified callback and RLS checks.
3. Design and implement single-use approvals, GitHub OAuth user linking and non-overage budget settings.
4. Choose a host with an explicitly stated recurring cost, or an approved local machine, and run a single opt-in AI request.

Sources:
- https://supabase.com/docs/guides/auth/users
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://docs.github.com/en/copilot/how-tos/copilot-sdk/setup/backend-services
