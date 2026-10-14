# Cartoon pack · M8a authoring

The art direction uses `docs/cover_day.png` and `docs/cover_night.png`: a cohesive
painted cartoon style for characters and scenery. Implementation is underway on
`phaser-sprites`. The first style sample needs review before full sprite production.

## Review

Run the dev server and open `/cartoon.html`. It shows the current sample sheet,
anatomy close-ups, day/night mockups and desktop/small-phone sizes. Actual CSS size
avoids shrinking a desktop mockup to fit the review page. The monkey envelopes
come from the classic rig at the shown sample poses; the new poses are uniformly
fitted inside those envelopes. Backgrounds are concept strips, not finished tiles.

The sheet is an art-direction sample. It is **not a production atlas**, a complete
monkey rig, or approved coverage of its component keys. No sample frame is marked
painted/reviewed in the production inventory. Production work will separate body,
head, limbs and tail with the existing pivots, replace the mockup vine with bendable
strips, and prepare seamless scenery and repeated temple pieces.

The owner flagged a missing arm and an unnatural gripping hand in the first draft.
The current sample restores the flying pose's far arm, redraws the grip and
repairs the truncated ring finger on the restored hand;
the review page includes close-ups of both. Check those details before approval.

## Inventory

`inventory.json` covers 175 pieces and 594 stable frame keys from
`art/manifest.json`. It records each classic rendering contract, logical box,
pivot, attachments, hitbox guides, tint/alpha, repeat/strip/slice rules, softening
and output pixel sizes at 1×/2×/4×. These are the constraints for new artwork.

Each frame tracks:

- `status`: pending, painted or reviewed.
- `source`: the eventual PNG/SVG source path, relative to this pack; null until assigned.
- `sourceCell`: optional rectangle in a master source sheet; null for a whole-file source.
- `sheet`: proposed asset family, editable as sheets are organized.
- `cell`: the eventual packed cell, null until assigned.
- `notes`: review or production notes.

Run `npm run art:cartoon:inventory` to refresh authoritative contracts. Existing
frame progress survives regeneration; duplicate or removed frame keys are errors
instead of silently losing progress. Run `npm run art:cartoon:check` to check that
the inventory matches the current manifest. The script does not claim that source
files are valid production assets; full pack validation is a later M8a step.

The `review/` directory holds sample artwork and its review layout metadata.
Keep approved component sources separate from review illustrations. Keep classic
generated art and overrides unchanged.
