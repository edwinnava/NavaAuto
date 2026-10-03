# NavaAuto

A personal, AllData-style repair reference that runs on an Android tablet: pick a
vehicle by year/make/model, browse step-by-step repair procedures, see estimated
labor hours and what a shop would charge, attach your own diagrams, and jump to
YouTube videos for the job.

Built for one user and a 2018 Infiniti Q50 3.0t, but works for any vehicle.

## Features

- **Garage**: pick year → make → model (model list from NHTSA's free vPIC API),
  optional VIN decode, engine/trim. The Q50 3.0t is preloaded.
- **Repair library** (`data/repairs.json`): 17 Q50/Q60 3.0t (VR30DDTT) procedures
  plus generic procedures that show up for any vehicle.
- **Labor + cost**: estimated labor hours × your shop rate, plus parts with a
  configurable shop markup, next to your DIY parts cost. Set the rate in ⚙ Settings.
- **Step checklist**: tick off steps as you work; progress is saved.
- **Diagrams & documents**: attach photos, screenshots or PDF pages (e.g. from a
  factory service manual) to any repair. Tap an image to view it full screen with pinch zoom.
- **Library portal**: save the link to your library's repair database in Settings; every repair gets an
  "Open in …" button that opens it and copies the car + job to paste into its search.
- **Videos**: one-tap YouTube search for your exact car + job, and save links you liked.
- **Notes, custom repairs, job log** (with total spent / saved vs. shop), **NHTSA recalls**.
- **Works offline** once loaded and installs to the home screen (PWA).
- **Backup**: export/import everything (including attachments) as one JSON file.

## Install on a Galaxy tablet

1. Host it: in GitHub go to **Settings → Pages**, set the source to this branch,
   folder `/ (root)`. Your URL will be `https://<user>.github.io/<repo>/`.
2. Open that URL in **Chrome** on the tablet.
3. Menu (⋮) → **Add to Home screen / Install app**. It opens full screen like a native app.

To try it on a computer: `npx serve .` and open the printed URL.

## About the data

- **Labor hours are estimates**, not licensed labor-guide numbers (those come from
  Mitchell/MOTOR/AllData under paid licenses). Use them to sanity-check a quote.
- **Specs tagged `verify`** (torques, capacities, fluids) are reference values;
  confirm them in the factory service manual before using them.
- Year/make/model lists, VIN decoding and recalls come from NHTSA's public API.

## Adding repairs

In the app use **+ Custom repair** (or "Copy as custom & edit" on any repair).
To add repairs to the built-in library, add an entry to `data/repairs.json`. `appliesTo` is either
`"*"` (any vehicle) or `{ make, models, years: [from, to], engine: [match strings] }`.
