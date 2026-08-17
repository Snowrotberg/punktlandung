# Punktlandung responsive product rules

## Scrolling

- Mobile portrait and mobile landscape may scroll vertically when necessary.
- Home, setup, waiting-room, game, round-result, replay, and final-result views must fit into laptop, monitor, and TV viewports without document-level vertical scrolling.
- Informational, catalogue, help, license, imprint, privacy, and comparable long-form pages may scroll on every viewport.
- Horizontal document scrolling is never allowed.

## Visibility priorities

- Home mobile: keep the header, main promise, primary play action, and a recognizable start of the mode selection visible before scrolling.
- Setup and waiting room: keep the current heading and primary next action reachable.
- Active game: keep all controls required for the current action visible and usable.
- Results: keep the essential result and primary continuation action reachable.

## Quality rules

- Prefer readable type and scrolling on mobile over shrinking the entire interface.
- Treat clipped meaningful text, overlapping controls, missing images/fonts, and unreachable actions as defects.
- Review small mobile touch targets; aim for at least 40x40 CSS pixels for button-like controls unless the visual control has a larger clickable wrapper.
- Keep QA deterministic: block ads/analytics and seed game state locally.
