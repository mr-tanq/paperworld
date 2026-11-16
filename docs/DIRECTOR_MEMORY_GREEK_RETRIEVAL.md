# Director Memory — Greek-language retrieval improvement

## Goal
The owner interacts in Greek and wants Luna, Joey, Crow, Dave to remember detailed project history. A search that mostly matches English is insufficient even when the underlying owner-authenticated memory store is healthy.

## Implemented
- Normalize Unicode accents and Greek final sigma for matching; originals are preserved exactly for display.
- Remove routine Greek and English conversational filler tokens while ranking. Support title/description full-word, substring and conservative first-five-character matches for common inflection differences.
- Keep the existing ranked, bounded 6000-character approved-memory handoff. Every project's allowlist, RLS owner authorization and sensitive-data isolation remain unchanged.
- Add focused synthetic tests. No inference, API billing, SQL schema, source code from other projects or deployment.

## Current state
The owner has multiple approved notes plus pending owner-private history entries for all four Directors; a previous ingestion step added 20 detailed proposals and another added 22 proposed records. Pending memories must not enter an AI prompt without the existing owner-review status transition. This PR does not bulk-approve any row and does not retrieve uninspected verbatim ChatGPT conversations or unreleased lyrics.

## Limits
Accent folding is deterministic lexical search, not semantic comprehension or a full archive index. Knowledge quality still depends on source fidelity, freshness and authenticated project-scoped retrieval. Future larger projects need indexed recall and richer private source excerpts.
