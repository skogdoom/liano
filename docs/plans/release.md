# Release workflow

Part of the [Liano plan](../../PLAN.md). Branches, versions, deployment, and the two milestones left before `v3.0.0`: final verification (M9c) and the release (M10).

## Decisions

| Question | Decision |
|---|---|
| Branching? | **Long-lived `phaser` branch** through M9 cleanup and the owner-approved merge into `master`. Then create `release-verification` from the updated `master`. Implement M9a on the separate `canopy` branch from `master`, then integrate it into `master` and `release-verification`. M9b consolidates the plans by area, M9b.1 improves the test suite, and M9c performs all final testing, verification and resulting fixes there. Implement M9b.2 separately on a new `loading-indicator` branch from `master`; integrate it into `master` and sync `release-verification` before M9c. Integrate the tested result into `master` before M10 publishes the release. |
| Master meanwhile? | Bug fixes only; new visual features wait until 3.0.0 (a fix that changes `src/render/*` gets a matching change in `src/phaser/`). Ended with M9: `master` is the Phaser version. |
| Version numbers? | `3.0.0-dev.N` through M9 integration, M9a, M9b, M9b.1 and M9b.2; prepare `3.0.0` and its release metadata on `release-verification` in M9c before final verification. M10 publishes that tested version from `master`. |

M9b, planned on `release-verification`, was done on `consolidate-plans`, a branch from `master`, at the owner's request.

## Release and deploy

- Vite `base: '/liano/'` for build and preview; the game is served at `https://skogdoom.github.io/liano/`.
- CI runs `npm ci`, `npm test`, `npm run build` and the window-table check on every PR and on `master`. Every push to `master` deploys to Pages.
- The README covers how to play, the controls, local development and the disclaimer. The page has an SVG favicon and a description. The version from `package.json` is shown on the title screen.
- Releases are tagged `vX.Y.Z`, each with a GitHub release. The owner creates the tag and release, because this environment can't push tags.
- CI also runs the browser checks and the art checks; Pages deploys only after both CI jobs pass.
- Merges into `master` happen only on the owner's explicit word.

## M9c. Test and verification (M)

Execute after M9a, M9b, M9b.1 and M9b.2 and before M10. All final testing and
verification takes place on `release-verification`, the new branch created from
`master` after M9. Make
resulting fixes and document the results on that branch.

- Complete all remaining manual and real-device verification from the migration plan, including the deferred M3 sound, M7 performance and M8a artwork/device checks. Cover desktop browsers, Safari on the MacBook Air M1 and iPhone 13 mini, the remaining iPad/Android checks, supported modes, gameplay, audio, startup/texture/frame budgets, rotation, menus and graphics switching.
- Verify M9a's canopy fix in 1P fullscreen with both art packs, including fullscreen entry/exit, resize and rotation. Include 2P shared and the other supported layouts in regression coverage; sky above the canopy is allowed in 2P shared.
- Verify M9b's plan restructuring: references resolve, the main plan links to each area plan, and requirements, reports, acceptance gates and pending work from both original plans remain accounted for.
- Review M9b.1's coverage map and before/after timing report; confirm critical negative controls, retained regression scenarios and the complete suite still pass, and record any accepted remaining limits.
- Verify M9b.2's loading indicator on cold and cached startup, slow downloads and resource failures, including real-device setup delays, reduced motion, rotation and both graphics modes. Confirm it covers the whole wait, disappears at actual readiness and leaves no stuck overlay or unintended input.
- Run the full automated suite, artwork/source validation, classic and cartoon regression comparisons, production build, generated-table checks and CI on this branch. For Chromium context-creation timeouts, rerun only the failed cases rather than the full suite. Resolve failures and repeat checks affected by fixes.
- Prepare the `3.0.0` version, release-specific documentation and metadata on this branch before the final verification pass. Verify the built game at `/liano/` and record the tested commit and corresponding release artifacts.
- After real-device testing finishes, add the dated follow-up to the finalized M8a report on this branch: tested commit, devices/browser versions, results, findings that change the implementation or conclusions, resulting changes and validation. Historical M8a reports remain records of the completed work; their earlier instruction to test on `phaser` is superseded by this milestone.
- Resolve or obtain explicit acceptance of concrete exceptions. Integrate the tested branch into `master` with the owner's explicit approval before M10. If `master` changes during verification, bring those changes into `release-verification` and complete the affected checks there before integration; preserve the tested release contents.
- **Done when:** all required testing and verification is recorded and accepted, checks pass, and the tested `3.0.0` contents and reports are integrated into `master`. M10 may then begin.

**Progress (2026-10-17).** `release-verification` was merged into `master` (fast-forward to `d50e5d6`) with M9b.1. The version is `3.0.0`, and the draft release notes are in [docs/release-notes/v3.0.0.md](../release-notes/v3.0.0.md). Locally, on the `3.0.0` commit: 785 unit tests, the art check and the production build pass, and the window table is unchanged. Still to do: the full CI run on this commit, the real-device checks ([testing.md](testing.md#device-verification-pending)), the verification of the restructured plan, and the tested commit and artifacts recorded here.

## M10. Release (S)

Work takes place on `master` at the end, after M9, M9a, M9b, M9b.1, M9b.2 and M9c are complete and
the tested release candidate is integrated. All final testing and verification was
performed on `release-verification`, created from `master` after M9.

- Publish the `3.0.0` contents, metadata and artifacts verified in M9c. Any further change requiring testing returns to `release-verification` and M9c before release.
- The owner tags the tested release on `master` as `v3.0.0` and publishes the prepared release notes and release.
- **Done when:** `v3.0.0` identifies the tested `3.0.0` release on `master`, and its artifacts, release notes and release are published.
