// The page side of the time of day. `src/index.css` holds the morning and evening colours and mixes them with
// `color-mix` according to two CSS variables; this module writes those two percentages, plus the `data-tod` attribute
// that the CSS fallback for browsers without `color-mix` reads.

import { TIME_OF_DAY } from '../config/look.ts'

const STEPS = TIME_OF_DAY.cssSteps
/** Every percentage string that can be written, built once so a transition allocates nothing per frame. */
const PERCENT: readonly string[] = Array.from({ length: STEPS + 1 }, (_, i) => `${(i * 100) / STEPS}%`)

/** The last steps written (-1 = nothing yet), so the style is only touched when it changes. */
export interface PageTheme {
  page: number
  text: number
}

export function createPageTheme(): PageTheme {
  return { page: -1, text: -1 }
}

/** `pageBlend` drives the background and the pills, `textBlend` the text; both run from 0 (morning) to 1 (evening). */
export function writePageTheme(theme: PageTheme, pageBlend: number, textBlend: number): void {
  const page = Math.round(pageBlend * STEPS)
  const text = Math.round(textBlend * STEPS)
  if (page !== theme.page) {
    theme.page = page
    document.documentElement.style.setProperty('--tod-page', PERCENT[page] as string)
  }
  if (text !== theme.text) {
    theme.text = text
    document.documentElement.style.setProperty('--tod-text', PERCENT[text] as string)
    document.documentElement.dataset.tod = text * 2 >= STEPS ? 'evening' : 'morning'
  }
}
