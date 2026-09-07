import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import { Fragment, useEffect, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import type { ThemedToken } from 'shiki'
import { normalizeSlug } from '../nostr/kinds'
import { isOwnAttachment } from '../nostr/blossom'

/**
 * Sanitising is mandatory, not optional: content comes from arbitrary keys.
 * The default schema is the GitHub one — no raw HTML, no scripts. One addition:
 * it drops `checked` from a checkbox, so every ticked task box would render as
 * unticked and the list would quietly lie about its own state.
 */
const SCHEMA = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    input: [...(defaultSchema.attributes?.input ?? []), 'checked'],
  },
}

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
  h4: string
  h5: string
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
  h4: 'mt-6 mb-1 text-base font-semibold text-fg',
  h5: 'mt-4 mb-1 text-sm font-semibold uppercase tracking-wide text-fg-muted',
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
  h4: 'mt-2 mb-1 text-sm font-medium text-fg',
  h5: 'mt-2 mb-1 text-xs font-semibold uppercase tracking-wide text-fg-muted',
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
 * A code block, coloured once the grammar has arrived. It renders plain first
 * and swaps in the tokens afterwards — a block that appears instantly and gains
 * colour a moment later reads better than one that is not there yet. An unknown
 * language simply stays plain.
 */
function CodeBlock({
  code,
  language,
  className,
}: {
  code: string
  language: string
  className: string
}) {
  const [lines, setLines] = useState<ThemedToken[][] | null>(null)

  useEffect(() => {
    let cancelled = false
    setLines(null)
    // The highlighter is imported here rather than at the top of the file so
    // that Shiki's engine is a chunk of its own: a reader who never opens a
    // page with a code block never downloads it.
    void import('./code-highlight')
      .then(({ highlight }) => highlight(code, language))
      .then((result) => {
        if (!cancelled) setLines(result)
      })
      .catch(() => {
        /* stays plain */
      })
    return () => {
      cancelled = true
    }
  }, [code, language])

  if (!lines) return <code className={className}>{code}</code>

  return (
    <code className={className}>
      {lines.map((tokens, line) => (
        <Fragment key={line}>
          {tokens.map((token, index) => (
            <span key={index} className="shiki-token" style={token.htmlStyle as CSSProperties}>
              {token.content}
            </span>
          ))}
          {/* The newline stays real text — the surrounding `pre` preserves it,
              so no per-line block element is needed and empty lines keep their
              height. */}
          {line < lines.length - 1 ? '\n' : null}
        </Fragment>
      ))}
    </code>
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
 * Merges our classes with any the source brought along. Order matters: spreading
 * the incoming props over a `className` would silently drop our styling
 * wherever remark adds a class of its own — `contains-task-list` on a list,
 * `language-js` on a code block.
 */
function cx(...parts: (string | undefined | null | false)[]): string {
  return parts.filter(Boolean).join(' ')
}

/** Renders Markdown written by arbitrary npubs. */
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
        rehypePlugins={[[rehypeSanitize, SCHEMA]]}
        components={{
          h1: ({ children, className, ...props }) => (
            <h1 id={headingId(children)} className={cx(heading(s.h1), className)} {...props}>
              {children}
            </h1>
          ),
          h2: ({ children, className, ...props }) => (
            <h2 id={headingId(children)} className={cx(heading(s.h2), className)} {...props}>
              {children}
            </h2>
          ),
          h3: ({ children, className, ...props }) => (
            <h3 id={headingId(children)} className={cx(heading(s.h3), className)} {...props}>
              {children}
            </h3>
          ),
          h4: ({ children, className, ...props }) => (
            <h4 id={headingId(children)} className={cx(heading(s.h4), className)} {...props}>
              {children}
            </h4>
          ),
          h5: ({ children, className, ...props }) => (
            <h5 id={headingId(children)} className={cx(heading(s.h5), className)} {...props}>
              {children}
            </h5>
          ),
          h6: ({ children, className, ...props }) => (
            <h6 id={headingId(children)} className={cx(heading(s.h5), className)} {...props}>
              {children}
            </h6>
          ),
          p: ({ className, ...props }) => <p className={cx(text, className)} {...props} />,
          strong: ({ className, ...props }) => (
            <strong className={cx('font-semibold text-fg', className)} {...props} />
          ),
          del: ({ className, ...props }) => (
            <del className={cx('text-fg-subtle', className)} {...props} />
          ),
          hr: () => <hr className={`my-8 border-0 border-t border-line ${s.measure}`} />,
          ul: ({ className, ...props }) => (
            <ul className={cx('list-disc', s.list, s.measure, className)} {...props} />
          ),
          ol: ({ className, ...props }) => (
            <ol className={cx('list-decimal', s.list, s.measure, className)} {...props} />
          ),
          li: ({ children, className, ...props }) => {
            // A GFM task item carries its own checkbox, so the bullet would be
            // a second marker. Pulling it left puts the box where the bullet
            // would have been, so both kinds of item line up.
            const task = typeof className === 'string' && className.includes('task-list-item')
            return (
              <li className={cx(task && '-ml-6 list-none', className)} {...props}>
                {children}
              </li>
            )
          },
          input: (props) => (
            <input
              {...props}
              readOnly
              className="mr-2 size-3.5 translate-y-px accent-accent"
            />
          ),
          a: ({ className, ...props }) => (
            <a
              className={cx('text-accent-fg underline underline-offset-2', className)}
              rel="noreferrer noopener"
              {...props}
            />
          ),
          code: ({ className, children, ...props }) => {
            const style = cx('rounded bg-code-bg px-1 py-0.5 font-mono', s.code, className)
            // `language-…` on a fenced block is what tells us which grammar to
            // load. Without it — and for inline code — nothing is highlighted.
            const language = /(?:^|\s)language-([\w+#.-]+)/.exec(className ?? '')?.[1]
            if (!language) {
              return (
                <code className={style} {...props}>
                  {children}
                </code>
              )
            }
            return (
              <CodeBlock
                code={String(children).replace(/\n$/, '')}
                language={language}
                className={style}
              />
            )
          },
          // A code block already has the background of the `pre`; without this
          // the inner `code` would paint a second one on top of it.
          pre: ({ className, ...props }) => (
            <pre
              className={cx(
                'my-4 overflow-x-auto rounded-lg border border-code-line bg-code-bg p-3 font-mono',
                s.code,
                '[&>code]:bg-transparent [&>code]:p-0 [&>code]:text-inherit',
                className,
              )}
              {...props}
            />
          ),
          blockquote: ({ className, ...props }) => (
            <blockquote className={cx(s.quote, s.measure, className)} {...props} />
          ),
          img: ({ src, alt, title }) => (
            <SafeImage src={typeof src === 'string' ? src : undefined} alt={alt} title={title} />
          ),
          // A wide table may exceed the measure — but then it scrolls on its
          // own instead of stretching the page.
          table: ({ className, ...props }) => (
            <div className="my-4 overflow-x-auto">
              <table className={cx('w-full border-collapse text-sm', className)} {...props} />
            </div>
          ),
          th: ({ className, ...props }) => (
            <th
              className={cx(
                'border border-line bg-surface-1 px-2 py-1 text-left font-medium text-fg',
                className,
              )}
              {...props}
            />
          ),
          td: ({ className, ...props }) => (
            <td className={cx('border border-line px-2 py-1 text-fg-muted', className)} {...props} />
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
