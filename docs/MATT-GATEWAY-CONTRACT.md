# PAPERWORLD — Server-side Matt AI gateway contract

This draft PR implements a **server-only HTTP handler contract**. It does not start an HTTP listener, deploy hosting, configure OAuth or make an AI request. It is deliberately *not* imported in the public web app. Do not treat mock tests as live AI tests.

## Request flow (future)
`POST /chat/matt` with a Supabase JWT, private thread UUID, one-time approval UUID, unique request UUID and message. The server, **not the browser**, must:
1. Verify the Supabase access token via a trusted identity service. This code injects `authenticate`; it does not implement verification.
2. Verify that the thread belongs to that owner and is for `matt` via `ownsThread`.
3. Atomically claim a single-use approval tied to the owner/thread/request and enforce billing/credit limits via `claimApproval`. An app-defined boolean is insufficient without real billing constraints.
4. Retrieve the linked OAuth token from a private server-side secret store via `linkedToken`.
5. Forward only validated identity and server-owned token to the previously proposed `matt-copilot-adapter`.

There is no anonymous access, worker execution, prompt logging, browser token, or public Actions workflow prompt. Auth or ownership or approval failure blocks the AI call.

## Open security work — blockers before deployment
- Implement validated Supabase JWT with token/session expiry checks and request throttling.
- Implement verified GitHub OAuth account linking with encrypted token persistence and revocation.
- Add a one-time atomic approval/spending reservation that cannot be replayed, and tie that mechanism to verified Copilot entitlement/overage policy.
- Bind and **transactionally persist** authentic agent replies in the private Supabase tables; avoid duplicating response on retries.
- Enforce TLS, same-origin policy, request body limits, strict CORS and error handling in the real HTTP host.
- Choose and approve compatible long-running Node hosting (or trusted on-device runtime). No free-hosting claim.
- Pin the Copilot SDK version and verify actual `availableTools: []`, client startup and session lifecycle against it.
- Add independent real RLS/two-user tests; current tests are mocked and do not assert PostgreSQL RLS.

## Test
`node --test tests/matt-gateway.test.cjs` (zero AI, zero API tokens).

## Official references
- https://docs.github.com/en/copilot/how-tos/copilot-sdk/setup/backend-services
- https://docs.github.com/en/copilot/how-tos/copilot-sdk/setup/github-oauth
- https://docs.github.com/en/copilot/how-tos/copilot-sdk/auth/authenticate
