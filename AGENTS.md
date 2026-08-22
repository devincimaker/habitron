# Working agreements for agents

## No backwards compatibility

This software has exactly one user: its author. There are no external consumers, no old clients in the wild, and no API contracts to honour.

- When a new approach is better, commit to it fully. Do not keep the old approach alive next to it.
- Do not add fallbacks, shims, legacy branches, `isLegacy*` flags, or "if the old column is missing" code paths. Migrate the data and move on.
- Do not keep dead or duplicated code "just in case". If it is not used, delete it.
- Do not leave TODOs about backwards compatibility.

## Remove features thoroughly

When a feature or pattern is removed, remove all of it:

- the code, the helpers and utilities only it used, the types, the constants,
- the tests that exercised it,
- the database columns / migrations it needed (via a new migration),
- the docs and comments that referred to it.

The goal is the minimum expression of the code that is actually needed right now.
