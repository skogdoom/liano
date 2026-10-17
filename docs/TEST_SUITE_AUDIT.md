# Test suite coverage and performance audit

Audited commit: `668dd2a`, before implementation of M9b.1. This audit changes
documentation only. Its improvements are planned in
[M9b.1](plans/testing.md#m9b1-test-suite-coverage-and-performance-m), immediately
before M9c final testing and verification on `release-verification`.

**Followed up in M9b.1:** what changed, the measurements after it and the coverage limits
that remain are in the [M9b.1 record](plans/testing.md#m9b1-test-suite-coverage-and-performance-m)
and [Coverage](plans/testing.md#coverage). This audit stays as measured at `668dd2a`.

## Coverage: what the measurements mean

The repository has no configured coverage provider, persisted line/branch report
or coverage gate. For this audit, the matching `@vitest/coverage-v8` 5.0.1 provider
was installed under `/tmp`, used through a temporary configuration, and removed
from project resolution afterward. No package manifest, lockfile, implementation
or test was edited. All **72 files / 770 tests passed** with coverage enabled.

The source-mapped measurement includes **all 128 JavaScript modules under
`src/`**, including modules not imported by unit tests. It excludes dependencies,
tests and build scripts. The [per-file coverage summary](test-suite-audit/coverage-summary.json)
preserves the measured counts with repository-relative paths.

| Node coverage scope | Lines | Branches |
|---|---:|---:|
| All `src/` | 57.79% (4,035 / 6,982) | 60.31% (2,292 / 3,800) |
| Simulation, `src/sim/` | 99.40% | 96.10% |
| Audio | 96.70% | 90.00% |
| Platform adapters | 45.55% | 53.14% |
| Pure view models, `src/views/` | 78.66% | 62.30% |
| Rendering, `src/render/` | 21.05% | 33.60% |
| Art generation/authoring, `src/art/` | 67.62% | 72.15% |

These are **Node-only coverage numbers**, not combined game coverage. Main startup,
Phaser scenes, render rigs and the worker entry have zero Node coverage; many are
exercised by browser checks. Playwright currently collects no JavaScript coverage,
so a combined line/branch percentage is unknown. Browser execution, assertion
quality and real-device acceptance must be assessed separately. Safari user-agent
emulation still runs Chromium and does not establish WebKit/device coverage.

Core rules are well covered: physics, generation, solver checks, scoring, lives,
matches, shadows and respawning have focused tests and integration/soak cases.
Pause, art selection and reload-setting preservation each have 100% Node line
and branch coverage. The driver has 100% line / 89.13% branch coverage. High
coverage alone does not prove every relevant failure case is asserted; default
callbacks and defensive branches also make a blanket 100% target misleading.

## Measured runtime

Use the existing Ubuntu/Node 22 CI jobs as the performance baseline, not the
instrumented local Node 24 run. Coverage instrumentation changes execution cost.
The two completed browser runs were inspected without rerunning that suite.

| Measurement | Observed result |
|---|---|
| [Run 137](https://github.com/skogdoom/liano/actions/runs/38971914927), unit suite | 770 tests / 72 files, 109.35 s |
| Run 137, unit job's production build | About 73 s, including window-table and both-pack generation |
| Run 137, browser suite | All 90 cases passed; 88 first attempts and two individual retries, 12.6 min |
| [Run 136](https://github.com/skogdoom/liano/actions/runs/38967429173), browser suite | All 90 cases passed; 87 first attempts and three individual retries, 12.9 min |
| Run 136, failed attempts alone | 180 s; run 137 lost another 120 s to failed attempts |
| Run 136, browser job's production build | About 75 s, separate from the unit job's build |

The recurring failures include context/page creation and startup waits. They
are not evidence that raising timeouts will fix the underlying problem. Root
cause is not yet established. Successful cases are slow too: production startup
took about 39 s in both runs, and the first development gameplay case took 51 s
in run 137. Large software-WebGL images and repeated cold startup remain costs
even when no retry is needed.

Largest unit-file times in run 137 were feasibility (55.50 s), grades (52.75 s),
window table (45.15 s), generator (41.23 s), soak (36.88 s), artwork pack checks
(11.97 s), settings (9.12 s), and the new builder integration check (5.89 s).
Files run concurrently: these durations must not be summed as wall-clock savings.

In run 136, platform cases used 112.3 s and background-motion cases 109.1 s
in aggregate. Each 1920×800, 2× image/tile comparison took about 31–32 s;
two seam cases took 24–29 s. Those are useful pixel checks, but their inner
loops and repeated rendering are worthwhile optimization targets.

## Coverage strengths and gaps to address

| Area | Existing protection | Important follow-up |
|---|---|---|
| Rules and physics | Direct unit checks, seeded generator/grade distributions, solver-versus-world comparisons, table checks and 5,000-gap resource-bounds soak | Retain independent oracles, boundary cases and statistical diversity when sharing fixtures. Do not replace the soak with only a short run. |
| Modes, input and pause | Unit driver/input/pause checks plus real keyboard/touch browser behavior, resume without release and Escape | Keep an assertion map when combining startup/mode cases; these layers are not automatically duplicates. |
| Art packs and recovery | Both packs start all desktop modes; immutable classic/cartoon references, atlas gutters, Config reloads and cartoon load recovery | Generic context recovery uses the default cartoon pack, and a second case explicitly uses cartoon. Add explicit classic recovery, retaining notice/pause/world-identity/render checks, rather than doubling every browser test. |
| Production build | `/liano/` startup, old engine URL and production trace cases | The startup smoke waits for `data-ready`/canvas; readiness is set before all main artwork and world preparation necessarily finish. Add ready-to-play production checks with actual input, selected-pack assets and worker loading. Most gameplay assertions currently use the development server. |
| Worker fallback | Deterministic fake-worker replies, stale-seed rejection and solver/main-thread constraints | `ObstaclePrefetch`'s worker-error handler is unexecuted in the unit coverage. Assert error-to-synchronous fallback and production worker delivery, without another broad random sample sweep. |
| Load failures | A browser case aborts the cartoon main atlas JSON and verifies explicit recovery to classic | Initial catalog and texture/image failures are separate loader paths; add representative failure cases and preserved-settings assertions. |
| Audio | Recipe/player/cache/manager unit checks, real sound-manager routing and cached-versus-synthesized samples | Preserve both routing and cache equivalence; they are distinct guarantees even though they use the same recipes. |
| Real devices | Deferred and explicitly pending | Safari MacBook Air M1/iPhone 13 mini and remaining device checks stay in M9c. This audit does not mark them passed. |

The recently added builder test protects custom SVG/PNG tile replacements and
unchanged generated output. Keep it: unit validation of filenames/contracts alone
previously missed the actual rasterization defect. Build-script behavior is not
included in the `src/` percentages above.

## Prioritized improvements for M9b.1

1. **Measure and stabilize browser setup first.** Persist per-test/setup/build
   durations and failure diagnostics. Distinguish context creation, navigation,
   asset loading and ready-to-play waits. Manual `browser.newPage()` calls usually
   close on success; use managed fixtures or guaranteed teardown on failure too.
   This is cleanup to investigate, not a proven cause of the context timeouts.
   Retain fresh test isolation and failed-case-only retries. Do not increase worker
   concurrency blindly: this suite deliberately serializes software-WebGL work.
2. **Reuse deterministic data without reducing samples.** `grades.test.js`
   repeatedly calls `obstacles()` over overlapping seed/gap ranges; generator,
   feasibility and settings files also traverse large related corpora. Generate
   immutable fixtures once per suitable scope and clone mutable models. Keep a
   separate uncached determinism check and independent solver/world comparisons.
   Sharing a seed corpus is not the same as using the implementation's answer as
   its own oracle.
3. **Remove equivalent exhaustive work.** `windowTable.test.js` recomputes the
   full table and also sweeps solver agreement by type/height/stage; `grades`
   samples agreement again. Both CI builds regenerate the table and check its
   freshness. Establish one owner for each exhaustive comparison, retaining
   independent boundary, stale-table and real-physics checks. Consolidate only
   after mapping the guarantees each test supplies.
4. **Optimize pixel work while checking the same pixels.** Green-snake and spider
   tests create assertions inside large pixel loops. Accumulate failures or maximum
   deltas per frame, then assert once with the failing coordinate/frame. Background
   comparisons allocate an array and callback per pixel and repeat scans for
   different metrics; use allocation-free loops and shared computations. Preserve
   all frame/viewport/tint/wrap cases, tolerances and solid-patch detection.
5. **Consolidate browser overlap by guarantee.** Layout, resolution and mobile
   menus repeat some startup/geometry checks; mode start/exit appears in both
   generic and art-pack tests. Share setup and consolidate matching assertions,
   while retaining different coordinate systems, touch/desktop behavior,
   reload/storage semantics, both-pack guarantees and production/development
   distinctions. Audio's manager-routing and cache comparisons can share harness
   code; their different oracles must remain.
6. **Benchmark build reuse against the critical path.** Both CI jobs spend roughly
   74 s generating the same outputs. A validated build-artifact producer or cache
   might help, but making browser tests wait for the unit job could add about
   109 s before they start. Measure artifact transfer, cache invalidation and
   total elapsed time. Key reuse on source/custom art, manifests, recipes,
   tunables, lockfile/toolchain and build configuration. Keep cold builds,
   generated-table checks and both deployment dependencies.
7. **Make coverage and timing durable.** Add a requirement-to-test map and
   source-mapped Node/browser coverage artifacts, including unexecuted files.
   Cover the gaps above with focused tests. Record the rationale and replacement
   for every removed case, and demonstrate that deliberate bad inputs/reference
   images still fail. Compare repeated comparable CI observations before setting
   runtime budgets; do not promise unmeasured savings or lower existing thresholds.

Known flags and manual exceptions remain visible. Approved regression images,
simulation behavior and release/device gates remain unchanged. M9c performs the
final complete verification after these improvements; no optimization is
implemented by this audit.
