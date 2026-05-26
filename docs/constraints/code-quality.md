# Code Quality Constraints

## Standard

Code should be simple, reviewable, and appropriate to the domain model. Passing tests or running locally is not enough.

## Expectations

- Prefer small modules with clear ownership.
- Keep logic explicit where hidden abstraction would make behavior harder to inspect.
- Design for extension only where the near-term model already requires it.
- Avoid copying source project flaws when reproducing behavior.
- Review data authorization, error paths, and transaction boundaries before considering work complete.

## Verification

For each non-trivial change, pair implementation with the narrowest useful harness, test, or smoke check.
