# Worship Lab

A glass-styled worship setlist planner for Mount Greylock Baptist Church — a single-file
companion to [Sacred Strings](https://github.com/malachuk-josh/Sacred-Strings), redesigned
around the setlist builder.

The entire app is one self-contained `index.html`: no build step, no server, no dependencies.
Open it in any browser (or host it anywhere static) and it runs. All data is saved privately
in the browser via `localStorage`.

## Features

- **Setlist builder** — the heart of the app. Name a setlist, pick the service date, add songs
  from a 193-song modern + traditional worship catalog or the church library, set keys, reorder,
  and keep flow notes. Copy any setlist as plain text to share.
- **Worship teams** — assign roles and people per setlist, reorder the lineup, save multiple
  named teams and load one into any service in a click.
- **Roster** — team members with role chips, always sorted alphabetically. This public copy
  ships with placeholder names; add your real team on the Team tab.
- **Church library** — the congregation's go-to songs, seeded with a starter set.
- **SongSelect by CCLI** — a standalone search that deep-links into songselect.ccli.com, plus
  per-song links throughout (your church's own SongSelect subscription handles access).
- **Calendar** — month view with service markers; tap a day to plan it.
- **Design** — liquid-glass panels over a spectrum of blues and grays, light and dark themes,
  desktop dock + mobile tab bar, KJV verse of the day.

## Notes

This copy seeds generic placeholder roster names so no personal information lives in a public
repository. Data entered in the app never leaves the device it's entered on.
