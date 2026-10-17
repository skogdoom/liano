# Liano — Plan

A one-button browser game. A monkey swings on lianas through a jungle. It grabs a liana anywhere along its length, slowly slips toward the tip, and the player presses a key (or taps) to let go. The monkey flies ballistically and auto-grabs the next liana it touches. Obstacles sit in the gaps between lianas: static ones first, moving ones from the sixth. Bananas are an extra challenge: each player's are counted against the bananas they passed. Difficulty ramps in stages. Modes: single player, two-player shared screen, two-player split screen.

This is the authoritative plan: the current status, the roadmap and where each part of the design is kept. The latest tagged release is v2.2.0, built on PixiJS. `master` carries the Phaser version, `3.0.0-dev.9`, to be released as v3.0.0; GitHub Pages (https://skogdoom.github.io/liano/) follows `master`, so the site shows each successful `master` build.

## Status (2026-10-17)

- **The Phaser migration is merged into `master`** ([PR #42](https://github.com/skogdoom/liano/pull/42), merge `73a36d0`). Pixi is gone (M8). The painted cartoon pack is the default; Config's **Classic graphics** brings back the original look (M8a, accepted by the owner through `7abe519`).
- **M9a** (fullscreen canopy) and **M9b.2** (startup loading indicator) are integrated into `master`.
- **M9b** (this consolidation) is done on `consolidate-plans` and waits for the owner's merge; M9c verifies it.
- **Next:** M9b.1 (test-suite coverage and speed), then M9c (final testing, real devices, preparing `3.0.0`), then M10 (release).
- **Pending gates:** the real-device checks collected in [testing.md](docs/plans/testing.md#device-verification-pending). None is recorded as passed; all are due in M9c.

## Area plans

Each requirement and decision has one home, in one of these files.

| Plan | What it holds |
|---|---|
| [Gameplay](docs/plans/gameplay.md) | Rules, modes and controls, Config, stages and grades, two-player rules, the fairness guarantee, sound, touch, screen layouts, full screen, design decisions, out of scope |
| [Architecture and performance](docs/plans/architecture.md) | Tech stack, engine decisions, runtime structure, Phaser 4.2.1 notes, simulation model, project structure, tunables, device budgets, performance and hardening, risks |
| [Artwork and asset pipeline](docs/plans/art-pipeline.md) | Pieces and rigs, the generated classic pack, the cartoon pack, pack selection and budgets, build-time softening, the classic visual style |
| [Testing and device verification](docs/plans/testing.md) | Test layers, the parity checklist, M9b.1, the pending device checks and how to measure on a device |
| [Release workflow](docs/plans/release.md) | Branches, versions, deploy, M9c and M10 |
| [Background motion](docs/plans/background-motion.md) | The background and whole-scene motion investigation: findings, tools, Safari results |
| [History: v1 and v2](docs/plans/history/v1-v2.md) | Milestones 1–30 with their checklists; the v2 performance record |
| [History: the Phaser migration](docs/plans/history/phaser-migration.md) | M0–M9b.2: each milestone's plan and report, the migration's design record |

Also: the [test-suite audit](docs/TEST_SUITE_AUDIT.md) (input to M9b.1), and the artists' guides, [art/README.md](art/README.md) and [art/packs/cartoon/README.md](art/packs/cartoon/README.md).

## Roadmap

| Milestone | Status | After | Plan and report |
|---|---|---|---|
| 1–14 (v1), 15–22 (v2), 23–30 | Released up to v2.2.0; some device checks open | | [v1-v2](docs/plans/history/v1-v2.md) |
| M0 Parity tool, M1 Spike | Done (M1's go measured on the iPhone 13 mini) | | [M0](docs/plans/history/phaser-migration.md#m0-groundwork-and-the-parity-tool-m), [M1](docs/plans/history/phaser-migration.md#m1-spike-prove-the-approach-and-set-the-budgets-m-a-decision-gate) |
| M2 Platform, M3 Input and audio | Done; M3's manual sound pass partly open | M1 | [M2](docs/plans/history/phaser-migration.md#m2-platform-game-scenes-scale-lifecycle-m), [M3](docs/plans/history/phaser-migration.md#m3-input-and-audio-on-phaser-m) |
| M4 Asset pipeline | Done | M1 | [M4](docs/plans/history/phaser-migration.md#m4-the-asset-pipeline-generated-replaceable-art-l) |
| M5 World rendering | Done; two parity exceptions accepted | M4 | [M5](docs/plans/history/phaser-migration.md#m5-world-rendering-l-in-four-parts) |
| M6 Panes, HUD, overlays, modes | Done | M5 | [M6](docs/plans/history/phaser-migration.md#m6-panes-hud-overlays-and-the-three-modes-l) |
| M7 Parity, performance, polish | Done; the real-device pass open | M6 | [M7](docs/plans/history/phaser-migration.md#m7-parity-performance-and-polish-ml) |
| M8 Remove Pixi | Done ([PR #40](https://github.com/skogdoom/liano/pull/40)) | M7 | [M8](docs/plans/history/phaser-migration.md#m8-remove-pixi-sm) |
| M8a Cartoon pack, Classic graphics toggle | Done ([PR #41](https://github.com/skogdoom/liano/pull/41), `a49b1f2`); device checks open | M8 | [M8a](docs/plans/history/phaser-migration.md#m8a-cartoon-sprite-sheets-and-the-classic-graphics-toggle-l) |
| M9 Cleanup and merge | Done ([PR #42](https://github.com/skogdoom/liano/pull/42), `73a36d0`) | M8a | [M9](docs/plans/history/phaser-migration.md#m9-cleanup-and-merge-s) |
| M9a Fullscreen canopy | Done (`master`, `d91cfe2`); device checks open | M9 | [M9a](docs/plans/history/phaser-migration.md#m9a-fullscreen-canopy-coverage-s) |
| M9b Plan consolidation | Done on `consolidate-plans`; awaiting merge | M9 | [M9b](docs/plans/history/phaser-migration.md#m9b-plan-consolidation-and-area-plans-m) |
| M9b.2 Loading indicator | Done (`master`, `1c97afc`); device checks open | M9 | [M9b.2](docs/plans/history/phaser-migration.md#m9b2-startup-loading-indicator-s) |
| **M9b.1 Test suite coverage and performance** | Next | M9b | [testing.md](docs/plans/testing.md#m9b1-test-suite-coverage-and-performance-m) |
| **M9c Test and verification** | Planned | M9a, M9b, M9b.1, M9b.2 | [release.md](docs/plans/release.md#m9c-test-and-verification-m) |
| **M10 Release v3.0.0** | Planned | M9c | [release.md](docs/plans/release.md#m10-release-s) |

## Branches and versions

- `master` is the base. M9b.1 and M9c work on `release-verification` (created from `master` after M9); bring `master` into it before M9c. Separate fixes take a branch from `master`, as `canopy` (M9a), `loading-indicator` (M9b.2) and `consolidate-plans` (M9b) did.
- Versions stay `3.0.0-dev.N` until M9c prepares `3.0.0`. Merges into `master` happen on the owner's word; the owner tags releases. Details: [release.md](docs/plans/release.md).

## Keeping the plan

- A new requirement or decision goes into the area plan it belongs to, once. This file keeps the status, the roadmap and the links.
- An open milestone's plan sits in its area plan; when it closes, its plan and report move to the history files, and its outcome into the area plan.
- No questions are open. A new one is added here and answered before its milestone's PR is merged.
- `tests/docLinks.test.js` checks that every relative link and anchor in the repository's Markdown resolves.
