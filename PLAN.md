# Git Working Set Roadmap & Architecture

## 🎯 Vision
A professional, read-only audit workspace for local Git changes. Focus on safety and explicit actions.

## 🏗 Modular File Structure (Refactoring)
### `src/commands/`
- `src/commands/index.ts`: Central registry for all commands.
- `src/commands/fileActions.ts`: `openFile` and context menu helpers.
- `src/commands/diffActions.ts`: `openDiff` (solo) and `openReview` (multi).
- `src/commands/revertActions.ts`: `revert` (discard/clean) logic.

### `src/providers/`
- `src/providers/treeProvider.ts`: `WorkingSetProvider` implementation.
- `src/providers/scmProvider.ts`: `WorkingSetSCM` implementation.
- `src/providers/contentProvider.ts`: `ReadOnlyProvider` and `EmptyContentProvider`.

### `src/`
- `src/extension.ts`: Activation and orchestration.
- `src/types.ts`: Shared interfaces and Git status enums.
- `src/treeItem.ts`: Tree UI components.

## ✅ Phase 1: Core Foundation (Done)
- [x] Strict Read-Only Diffs.
- [x] SCM sidebar integration.
- [x] Modular architecture (in progress).

## 🚀 Phase 2: Bug Fixes & UI Polish (Current)
- [ ] **Fix Multi-Diff:** Use highly compatible command signatures for `openReview`.
- [ ] **Fix Revert:** Use robust `git.checkout` and `git.clean` logic to avoid `slice` errors.
- [ ] **Split Code:** Move logic into the new modular structure.
- [ ] **Status Badges:** Add custom decorations (A, M, D, U) in the Tree View.

## 🛠 Phase 3: Workflow Features
- [ ] **Partial Reviews:** Focus review on selected folders.
- [ ] **Comparison Base:** Allow comparing against specific branches.
