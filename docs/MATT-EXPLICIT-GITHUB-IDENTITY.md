# Copilot Matt: explicit per-user authentication

Security correction for the previously merged adapter.

The GitHub documentation on OAuth and SDK authentication states that OAuth user tokens must be supplied on behalf of each user and the `useLoggedInUser: false` option must be set when host fallback would be unsafe. In a multi-user server, a missing or misconfigured token must not silently fall back to a Copilot CLI login, `GH_TOKEN`, `GITHUB_TOKEN`, or other machine-level identity.

The Matt adapter now injects `gitHubToken` and `useLoggedInUser: false` into the SDK **client factory**, while retaining per-session `gitHubToken` and `availableTools: []`. Unit tests ensure the identity is set at both layers.

This is a security preparation, not live integration. The trusted server must still verify which Supabase user authorized which GitHub account, store OAuth access tokens only server-side, and enforce one-time approval and actual billing settings. No OAuth token, client secret or real user content is included in this PR.

Official docs:
- https://docs.github.com/en/copilot/how-tos/copilot-sdk/auth/authenticate
- https://docs.github.com/en/copilot/how-tos/copilot-sdk/setup/github-oauth
- https://docs.github.com/en/copilot/how-tos/copilot-sdk/setup/backend-services

No live SDK call, no hosting, no Copilot credits, no deployment, and no changes to Listening Mirror.
