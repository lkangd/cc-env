# Changelog

## 1.1.0 (2026-04-27)

### Features
* add CLI descriptions and improve error formatting
* add env source and merge services
* add env validation and masking helpers
* add gradient ASCII art banner to CLI startup
* add initial project structure with .gitignore, package.json, and documentation
* add interactive preset creation flow
* add interactive preset delete with confirmation flow
* add interactive preset list UI with project/global source display
* add non-interactive preset creation
* add output and preset inspection commands
* add preset and history storage services
* add restore flow and command
* add runtime execution and dry-run
* add settings migration flow
* add shebang to CLI entry point
* auto-add .cc-env to .gitignore on project preset create and remove config service
* complete cc-env v1 command wiring
* migrate Claude env into managed shell blocks
* redesign run command as Claude launcher with interactive preset selection
* scope package as @lkangd/cc-env for public npm publish
* support project-level Claude settings in init and restore

### Bug Fixes
* align preset create step progression
* complete interactive init and restore flows
* harden interactive preset create flow
* harden project env first-write handling
* harden restore flow selection
* harden run command validation and preview
* harden storage writes and preset deletion
* normalize preset create input errors
* resolve TypeScript exactOptionalPropertyTypes errors in preset create
* simplify interactive preset create flow
* support top-level run flags
* wire preset management commands and outputs

### Code Refactoring
* align persisted history records with schema
* extract shared EnvSummary component and replace stdout writes with ink rendering
* merge preset list and show into single interactive show command
* remove debug command and runtime env service
* remove preset edit command and add .cc-env/ to gitignore
* remove proper-lockfile in favor of atomic writes
* reorder merge params to match priority and use ink in debug
* rewrite preset-create-app with full interactive wizard UI
* rewrite preset-create-flow state machine for full interactive wizard
* simplify preset create command to thin renderFlow wrapper
* use sources array in history schema and improve interactive UI

### Documentation
* add preset create interactive refactor design spec
* add preset create interactive refactor implementation plan

### Other Changes
* merge: integrate Claude shell env migration
* fix restore typing against persisted history schema
* fix signal exits and history record validation
* fix restore flow state invariants and CLI wiring
* fix interactive preset create flow wiring
* fix schema timestamp validation and secret masking
* fix package dependency versions for task 1 compliance
