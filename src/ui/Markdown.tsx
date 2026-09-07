import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { normalizeSlug } from '../nostr/kinds'
import { isOwnAttachment } from '../nostr/blossom'

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
        className="my-2 max-w-full rounded-lg border border-line"
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
      className="my-2 block rounded-lg border border-dashed border-line px-3 py-2 text-left text-xs text-fg-muted hover:border-line-strong"
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
export function Markdown({ children }: { children: string }) {
  return (
    <div className="space-y-3 text-sm leading-relaxed text-fg">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={{
          h1: ({ children, ...props }) => (
            <h1 id={headingId(children)} className="mt-6 text-xl font-medium text-fg" {...props}>
              {children}
            </h1>
          ),
          h2: ({ children, ...props }) => (
            <h2 id={headingId(children)} className="mt-5 text-lg font-medium text-fg" {...props}>
              {children}
            </h2>
          ),
          h3: ({ children, ...props }) => (
            <h3 id={headingId(children)} className="mt-4 text-base font-medium text-fg" {...props}>
              {children}
            </h3>
          ),
          p: (props) => <p className="text-sm leading-relaxed text-fg-muted" {...props} />,
          ul: (props) => <ul className="list-disc space-y-1 pl-5 text-sm text-fg-muted" {...props} />,
          ol: (props) => <ol className="list-decimal space-y-1 pl-5 text-sm text-fg-muted" {...props} />,
          a: (props) => (
            <a className="text-accent-fg underline" rel="noreferrer noopener" {...props} />
          ),
          code: (props) => (
            <code className="rounded bg-code-bg px-1 py-0.5 font-mono text-xs" {...props} />
          ),
          pre: (props) => (
            <pre
              className="overflow-x-auto rounded-lg border border-code-line bg-code-bg p-3 font-mono text-xs"
              {...props}
            />
          ),
          blockquote: (props) => (
            <blockquote className="border-l-2 border-line-strong pl-3 text-sm text-fg-subtle" {...props} />
          ),
          img: ({ src, alt, title }) => (
            <SafeImage src={typeof src === 'string' ? src : undefined} alt={alt} title={title} />
          ),
          table: (props) => <table className="w-full border-collapse text-sm" {...props} />,
          th: (props) => (
            <th className="border border-line bg-surface-1 px-2 py-1 text-left font-medium" {...props} />
          ),
          td: (props) => <td className="border border-line px-2 py-1 text-fg-muted" {...props} />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
