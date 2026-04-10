/**
 * Vector 150: Knowledge Hub — Unified Index
 * Single import point for all help system data.
 */

export { glossaryEntries } from "./glossary"
export type { HelpEntry } from "./glossary"
export { howtoEntries } from "./howto"
export { changelogEntries, getRecentChangelog } from "./changelog"
export type { ChangelogEntry } from "./changelog"

import { glossaryEntries } from "./glossary"
import { howtoEntries } from "./howto"

/** All help entries merged and indexed by ID */
export const allHelpEntries = [...glossaryEntries, ...howtoEntries]

export function getHelpEntry(id: string) {
    return allHelpEntries.find(e => e.id === id) ?? null
}

export function getRelatedEntries(ids: string[]) {
    return ids.map(id => getHelpEntry(id)).filter(Boolean)
}
