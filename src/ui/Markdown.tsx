import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { normalizeSlug } from '../nostr/kinds'
import { isOwnAttachment } from '../nostr/blossom'

/**
 * Two densities, one renderer. A page is a reading surface and gets the size
 * and line length of a document; a comment sits inside somebody else's page and
 * has to stay subordinate to it, so it keeps the 14px of the surrounding UI.
 */
export type Density = 'page' | 'compact'

type Scale = {
  /** limits the line length — the content column is much wider than is readable */
  measure: string
  block: string
  h1: string
  h2: string
  h3: string
  list: string
  code: string
  quote: string
}

const PAGE: Scale = {
  measure: 'max-w-[70ch]',
  block: 'my-4 text-base leading-7 text-fg',
  h1: 'mt-8 mb-3 text-2xl font-semibold tracking-tight text-fg',
  h2: 'mt-8 mb-2 text-xl font-semibold tracking-tight text-fg',
  h3: 'mt-6 mb-2 text-lg font-medium text-fg',
  list: 'my-4 space-y-1.5 pl-6 text-base leading-7 text-fg',
  code: 'text-sm',
  quote: 'my-4 border-l-2 border-line-strong pl-4 text-base leading-7 text-fg-muted',
}

const COMPACT: Scale = {
  measure: '',
  block: 'my-2 text-sm leading-relaxed text-fg',
  h1: 'mt-3 mb-1 text-base font-semibold text-fg',
  h2: 'mt-3 mb-1 text-sm font-semibold text-fg',
  h3: 'mt-2 mb-1 text-sm font-medium text-fg',
  list: 'my-2 space-y-1 pl-5 text-sm leading-relaxed text-fg',
  code: 'text-xs',
  quote: 'my-2 border-l-2 border-line-strong pl-3 text-sm text-fg-subtle',
}

/**
 * Images from foreign sources are only loaded on click: otherwise an embedded
 * image tells a foreign server who reads which page and when. Attachments from
 * our own Blossom server load directly.
 * docs/09-security-privacy.md
 */
function SafeImage({ src, alt, title }: { src?: string; alt?: string; title?: string }) {
  const [allowed, setAllowed] = useState(false)
  if (!src) return null

  const trusted = isOwnAttachment(src) || src.startsWith('/') || src.startsWith('data:image/')
  if (trusted || allowed) {
    return (
      <img
        src={src}
        alt={alt ?? ''}
        title={title}
        loading="lazy"
        className="my-4 max-w-full rounded-lg border border-line"
      />
    )
  }

  let host = 'a foreign source'
  try {
    host = new URL(src).host
  } catch {
    /* relative or broken URL */
  }

  return (
    <button
      type="button"
      onClick={() => setAllowed(true)}
      className="my-4 block rounded-lg border border-dashed border-line px-3 py-2 text-left text-xs text-fg-muted hover:border-line-strong"
    >
      Load image from {host}
      {alt ? <span className="block text-fg-subtle">{alt}</span> : null}
    </button>
  )
}

/**
 * Anchor id from the heading text — the same derivation as in
 * `extractHeadings`, so the table of contents links line up.
 */
function headingId(children: ReactNode): string | undefined {
  const text = String(children ?? '').replace(/[*_`]/g, '')
  const id = normalizeSlug(text)
  return id.length > 0 ? id : undefined
}

/**
 * Renders Markdown written by arbitrary npubs. Sanitising is mandatory, not
 * optional: content comes from arbitrary keys. No raw HTML, no scripts.
 * docs/09-security-privacy.md
 */
export function Markdown({
  children,
  density = 'page',
}: {
  children: string
  density?: Density
}) {
  const s = density === 'page' ? PAGE : COMPACT
  const text = `${s.block} ${s.measure}`.trim()
  const heading = (level: string) => `${level} ${s.measure}`.trim()

  return (
    // The first block must not push the whole text down by its own top margin.
    <div className="[&>*:first-child]:mt-0">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={{
          h1: ({ children, ...props }) => (
            <h1 id={headingId(children)} className={heading(s.h1)} {...props}>
              {children}
            </h1>
          ),
          h2: ({ children, ...props }) => (
            <h2 id={headingId(children)} className={heading(s.h2)} {...props}>
              {children}
            </h2>
          ),
          h3: ({ children, ...props }) => (
            <h3 id={headingId(children)} className={heading(s.h3)} {...props}>
              {children}
            </h3>
          ),
          p: (props) => <p className={text} {...props} />,
          ul: (props) => <ul className={`list-disc ${s.list} ${s.measure}`} {...props} />,
          ol: (props) => <ol className={`list-decimal ${s.list} ${s.measure}`} {...props} />,
          a: (props) => (
            <a
              className="text-accent-fg underline underline-offset-2"
              rel="noreferrer noopener"
              {...props}
            />
          ),
          code: (props) => (
            <code className={`rounded bg-code-bg px-1 py-0.5 font-mono ${s.code}`} {...props} />
          ),
          pre: (props) => (
            <pre
              className={`my-4 overflow-x-auto rounded-lg border border-code-line bg-code-bg p-3 font-mono ${s.code}`}
              {...props}
            />
          ),
          blockquote: (props) => <blockquote className={`${s.quote} ${s.measure}`} {...props} />,
          img: ({ src, alt, title }) => (
            <SafeImage src={typeof src === 'string' ? src : undefined} alt={alt} title={title} />
          ),
          table: (props) => <table className="w-full border-collapse text-sm" {...props} />,
          th: (props) => (
            <th
              className="border border-line bg-surface-1 px-2 py-1 text-left font-medium text-fg"
              {...props}
            />
          ),
          td: (props) => <td className="border border-line px-2 py-1 text-fg-muted" {...props} />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
