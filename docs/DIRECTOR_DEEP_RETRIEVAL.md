# Director Memory v4 — Deep approved-memory retrieval

## Goal
Luna, Joey, Crow, and Dave should find older, relevant project notes instead of searching only the first 100 newest entries.

## Implementation
- Authenticated trusted-server reads of up to four ordered 100-record pages from the *same* private Director memory table.
- Every page is filtered server-side by fixed project and status=approved; all results are checked again server-side for project, approval status, record shape and duplicate ID.
- The 6,000-character prompt cap remains, with relevance ranking across the entire accepted page set.
- Fail closed if 400 approved entries fill the scan; do not silently call the truncated archive complete. A future indexed retrieval endpoint is required at that size.
- Existing source references and private sensitivity labels are retained. No new authorization, write privileges, model calls, paid service or database migration.

## Caveats
- This only searches entries already approved inside the private Paperworld memory store. Existing proposed-only private history, ChatGPT chat archives and unreleased full lyrics are **not imported or automatically approved** by this change.
- Exact token matching is not equivalent to semantic understanding. Later stages require a private ingestion pipeline, richer full-text search, source-linked conversation excerpts, stale-state handling, owner correction/deletion, and cross-user security tests.
- All medical and artistic private material stays in Supabase. Never commit real private records or personal conversations in this public repository.
- Stacked after #126/#127; evaluate CI, RLS and deployment separately.

## Validation
Synthetic tests cover retrieval from a second page, status filtering, incorrect-project responses, duplicates and the 400-row limit. No live user data accessed.
