# Delivery process

## Principles
Local-first, transparent state, minimal privileges, progressive enhancement, testable releases and accessible UI. Mark assumptions and experiments; avoid fabricated benchmarks or placeholder artifacts.

## Phases
1. **Foundation:** maintained guest, real boot lifecycle, persistent browser workspace, safe explicit guest exchange, reset, verified dependency pipeline and tests. In progress; current guest is an obsolete demo, not production-ready.
2. **Desktop MVP:** shell, window manager, file manager, text editor, terminal and settings using foundation APIs.
3. **Learning lab:** versioned lesson format, starter lessons, checker, hints, lesson reset and local progress.
4. **Developer workspace:** language templates, Git integration, project management and reproducibility.
5. **Accounts and teams:** optional sync, identity, classroom features, enterprise management and security reviews.

## Definition of done per feature
Agreed acceptance criteria; implemented behavior with explicit failures; automated unit and appropriate browser tests; accessibility and security review; offline/storage behavior defined; documentation and migration/recovery instructions updated; no unverified performance claims.

## Phase 1 release gate
A supported maintained guest and licensing review; reproducible verified artifacts; startup and reset verified; local persistence and explicit transfer round-trip; corruption, unavailable storage, quota, reload and multi-tab tests; offline tests; browser compatibility matrix; threat model and documented backup/recovery. These are not all complete.

## Decision and change management
Record architecture decisions with context, alternatives and consequences. For any change to filesystem semantics define data migration and rollback. Prioritize security and data-loss defects ahead of visual polish. Any backend/account feature requires a privacy impact assessment and explicit user consent.
