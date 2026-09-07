import { createHighlighterCore } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'
import type { HighlighterCore, ThemedToken } from 'shiki'

/**
 * Syntax highlighting for code blocks in a page.
 *
 * Two decisions worth knowing about:
 *
 * - **Tokens, not HTML.** Shiki can hand back a finished HTML string, but the
 *   content of a code block comes from an arbitrary npub, and this app renders
 *   no foreign HTML anywhere (docs/09-security-privacy.md). We ask for tokens
 *   and build React elements from them, so there is no `dangerouslySetInnerHTML`
 *   in the reading path at all.
 * - **Both themes in one pass.** Every token carries `--shiki-light` and
 *   `--shiki-dark`; which one applies is decided by CSS from `data-theme`.
 *   Switching the mode therefore repaints without re-highlighting anything.
 */

/** Everything is a dynamic import, so no grammar sits in the main bundle. */
const GRAMMARS: Record<string, () => Promise<unknown>> = {
  bash: () => import('@shikijs/langs/bash'),
  c: () => import('@shikijs/langs/c'),
  cpp: () => import('@shikijs/langs/cpp'),
  css: () => import('@shikijs/langs/css'),
  diff: () => import('@shikijs/langs/diff'),
  dockerfile: () => import('@shikijs/langs/dockerfile'),
  go: () => import('@shikijs/langs/go'),
  html: () => import('@shikijs/langs/html'),
  ini: () => import('@shikijs/langs/ini'),
  java: () => import('@shikijs/langs/java'),
  javascript: () => import('@shikijs/langs/javascript'),
  json: () => import('@shikijs/langs/json'),
  kotlin: () => import('@shikijs/langs/kotlin'),
  markdown: () => import('@shikijs/langs/markdown'),
  php: () => import('@shikijs/langs/php'),
  python: () => import('@shikijs/langs/python'),
  ruby: () => import('@shikijs/langs/ruby'),
  rust: () => import('@shikijs/langs/rust'),
  sql: () => import('@shikijs/langs/sql'),
  swift: () => import('@shikijs/langs/swift'),
  toml: () => import('@shikijs/langs/toml'),
  tsx: () => import('@shikijs/langs/tsx'),
  typescript: () => import('@shikijs/langs/typescript'),
  xml: () => import('@shikijs/langs/xml'),
  yaml: () => import('@shikijs/langs/yaml'),
}

/** What people actually write after the three backticks. */
const ALIASES: Record<string, string> = {
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  console: 'bash',
  js: 'javascript',
  jsx: 'tsx',
  mjs: 'javascript',
  cjs: 'javascript',
  ts: 'typescript',
  py: 'python',
  rs: 'rust',
  yml: 'yaml',
  md: 'markdown',
  'c++': 'cpp',
  docker: 'dockerfile',
  cfg: 'ini',
  conf: 'ini',
  patch: 'diff',
}

export function resolveLanguage(raw: string | undefined): string | null {
  if (!raw) return null
  const name = raw.trim().toLowerCase()
  const resolved = ALIASES[name] ?? name
  return resolved in GRAMMARS ? resolved : null
}

const THEMES = { light: 'github-light', dark: 'github-dark' } as const

let corePromise: Promise<HighlighterCore> | null = null
const loaded = new Set<string>()

function core(): Promise<HighlighterCore> {
  corePromise ??= createHighlighterCore({
    themes: [import('@shikijs/themes/github-light'), import('@shikijs/themes/github-dark')],
    langs: [],
    // The JavaScript engine rather than the Oniguruma WASM one: 16 kB gzipped
    // against 230 kB, and all grammars listed above were checked against it.
    // It translates Oniguruma patterns to JavaScript regexes, so a grammar it
    // cannot express would fail — `highlight` falls back to plain text then.
    engine: createJavaScriptRegexEngine(),
  })
  return corePromise
}

/**
 * Returns one array of tokens per line, or null when the language is unknown or
 * the grammar fails to load. Null means "render it plain" — a code block
 * without colour is a small loss, a crashed page is not.
 */
export async function highlight(code: string, language: string): Promise<ThemedToken[][] | null> {
  const lang = resolveLanguage(language)
  if (!lang) return null

  try {
    const highlighter = await core()
    if (!loaded.has(lang)) {
      const grammar = await GRAMMARS[lang]()
      await highlighter.loadLanguage(grammar as Parameters<HighlighterCore['loadLanguage']>[0])
      loaded.add(lang)
    }
    return highlighter.codeToTokens(code, { lang, themes: THEMES, defaultColor: false }).tokens
  } catch {
    return null
  }
}
