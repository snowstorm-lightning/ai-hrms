# Visual Copilot Constraints

## Interaction

Users can point, select, draw, and annotate multiple screen regions before giving an instruction.

Visual selections can be temporary for explanation or saved when they become tasks, feedback, approvals, or actions.

## Metadata

Business UI should expose stable `data-vc-*` metadata for elements, fields, actions, and object references.

Coordinates are hints; semantic business references are authoritative.

## Privacy

DOM snapshots and screenshots must be redacted by default before leaving the browser.

Go re-checks every submitted business reference against the caller's scope.
