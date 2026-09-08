// @doscientos/ui — framework-agnostic React primitives (components, hooks and
// utilities) ready to be extracted into a standalone package.
//
// Rules that make every export here "primitive":
//   · No imports from @/app/, @/lib/, or @/components/ (only relative ./ paths)
//   · No Next.js APIs (next/link, next/navigation, next/image)
//   · No server actions, Supabase clients, or any backend calls
//   · No app-level toast (sileo): failures surface via optional callbacks
//   · Internal cross-references use relative paths (./ui/X, ../hooks/X, ../lib/X)
//
// What stays in the app (not primitive — app-coupled):
//   · components/ui/attachment-section  — next/link + next/navigation + upload flow
//   · components/ui/client-avatar       — next/image
//   · components/ui/client-logo-upload  — Supabase upload + next/image
//   · components/ui/copy-button         — sileo toast (can be decoupled later)
//   · components/ui/copy-summary-button — sileo toast + window.location origin
//   · components/ui/date-field          — wires masking logic to a controlled input
//   · components/ui/error-boundary      — next/navigation useRouter
//   · components/ui/member-avatar       — team-member domain + memberAvatarUrl
//   · components/ui/nif-input           — lib/vies/nif validation
//   · components/ui/status-badge        — lib/status domain enum
//   · components/ui/zip-input           — lib/address/actions server action
//   · lib/hooks/use-undoable-delete     — next/navigation router + sileo

// Hooks — framework-agnostic React logic.
export * from './hooks/use-action-form'
export * from './hooks/use-autosave'
export * from './hooks/use-browser-notifications'
export * from './hooks/use-form-dirty'
export * from './hooks/use-github-handle'
export * from './hooks/use-optimistic-removal'
export * from './hooks/use-optimistic-update'
// Utilities & types — pure functions with no framework coupling.
export * from './lib/date-field'
export * from './lib/date-time'
export * from './lib/ranking'
export * from './lib/search-params'
export * from './lib/types'
export * from './lib/utils'
export * from './ui/ai-notice'
export * from './ui/aspect-ratio'
// Layout UI primitives (pure — depend only on other primitives + cn).
export * from './ui/autosave-indicator'
export * from './ui/breadcrumb'
export * from './ui/button'
export * from './ui/card'
export * from './ui/combobox'
export * from './ui/command'
export * from './ui/detail-grid'
export * from './ui/detail-grid-skeleton'
export * from './ui/dropdown-menu'
export * from './ui/empty-state'
export * from './ui/entity-avatar'
export * from './ui/entity-combobox'
export * from './ui/entity-multi-combobox'
export * from './ui/form-card-skeleton'
export * from './ui/form-field'
export * from './ui/hover-card'
export * from './ui/iban-input'
export * from './ui/input-group'
export * from './ui/item'
export * from './ui/markdown'
export * from './ui/menubar'
export * from './ui/page-header-skeleton'
export * from './ui/password-strength'
export * from './ui/select'
export * from './ui/table'
