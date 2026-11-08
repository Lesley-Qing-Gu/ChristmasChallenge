# 🎄 Shipmas

**A 24-day Christmas countdown design challenge.** One tiny product shipped every 2 days, from Nov 8 to Dec 24, all built end to end and shipped in public.

👉 **Live:** https://lesley-qing-gu.github.io/ChristmasChallenge/
🔗 **By:** [Lesley Qing Gu](https://www.linkedin.com/in/qing-gu-072167322)

![Shipmas calendar](docs/screenshots/home.png)

## The idea

I've always loved advent calendars, with a tiny surprise behind every door. Shipmas is one where every door is a real, working product. Each box unlocks on its date, and each one goes from idea to design, build and launch.

- **24** tiny products
- **1** every **2** days
- **Nov 8 → Dec 24** (47 days)

## What's behind the doors

| Day | Date | Project | Status |
| --- | --- | --- | --- |
| 01 | Nov 8 | [The Shipmas Plan](#day-01--the-shipmas-plan) | ✅ Shipped |
| 02 | Nov 10 | — | 🔒 |
| 03 | Nov 12 | — | 🔒 |
| 04 | Nov 14 | — | 🔒 |
| 05 | Nov 16 | — | 🔒 |
| 06 | Nov 18 | — | 🔒 |
| 07 | Nov 20 | — | 🔒 |
| 08 | Nov 22 | — | 🔒 |
| 09 | Nov 24 | — | 🔒 |
| 10 | Nov 26 | — | 🔒 |
| 11 | Nov 28 | — | 🔒 |
| 12 | Nov 30 | — | 🔒 |
| 13 | Dec 2 | — | 🔒 |
| 14 | Dec 4 | — | 🔒 |
| 15 | Dec 6 | — | 🔒 |
| 16 | Dec 8 | — | 🔒 |
| 17 | Dec 10 | — | 🔒 |
| 18 | Dec 12 | — | 🔒 |
| 19 | Dec 14 | — | 🔒 |
| 20 | Dec 16 | — | 🔒 |
| 21 | Dec 18 | — | 🔒 |
| 22 | Dec 20 | — | 🔒 |
| 23 | Dec 22 | — | 🔒 |
| 24 | Dec 24 | — | 🔒 |

---

## Day 01 · The Shipmas Plan

**Shipped Nov 8** · [Live page](https://lesley-qing-gu.github.io/ChristmasChallenge/days/01/) · Source: [`days/01/`](days/01)

The calendar itself, and the plan behind it.

- **Design:** a red advent calendar with 24 boxes, each with its own flat Christmas illustration (inline SVG, no image files).
- **Interaction:** hover a box and it turns like a book page. Locked days only lift a corner. On touch screens the first tap turns the page and the second opens it.
- **Motion:** floating pearls that follow the mouse, slow falling snow, and pearls that pop when clicked. Respects `prefers-reduced-motion`.
- **System:** boxes unlock on their date automatically, so each release is one line of config and a push.

![Day 01](docs/screenshots/day-01.png)

<!-- NEXT DAY GOES HERE: copy the template below -->

---

## Tech

Plain HTML, CSS and JavaScript. No framework, no build step. Hosted on GitHub Pages.

```
index.html          the calendar page
style.css           styles, including the page-turn effect
app.js              builds the 24 boxes and handles unlocking
days.js             the schedule: date, title and path for each day
icons.js            24 inline SVG illustrations
days/NN/            one folder per project
docs/screenshots/   screenshots used in this README
scripts/            helper scripts
```

## Adding a new day

1. Build the project in `days/NN/index.html` (for example `days/02/`). Link back to `../../`.
2. In [`days.js`](days.js), set that day's `title` and `path`:
   ```js
   { "day": 2, "date": "2026-11-10", "title": "Your Project", "path": "days/02/" }
   ```
3. Take a screenshot:
   ```bash
   scripts/screenshot.sh days/02/index.html day-02 1000 1400
   ```
4. Add a section to this README (copy the template below) and tick the row in the table above.
5. Bump the `?v=` number on the script and style tags in `index.html` so browsers don't use cached files, then `git push`.

### README template

```md
## Day NN · Project Name

**Shipped Nov X** · [Live page](https://lesley-qing-gu.github.io/ChristmasChallenge/days/NN/) · Source: [`days/NN/`](days/NN)

One sentence on what it is and why.

- **What it does:** …
- **How it's built:** …
- **What I learned:** …

![Day NN](docs/screenshots/day-NN.png)
```

Add `?preview` to the calendar URL to see every box unlocked while testing locally.
