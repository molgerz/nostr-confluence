import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'
import type { ReactNode } from 'react'
import { normalizeSlug } from '../nostr/kinds'

/**
 * Anker-ID aus dem Überschriftentext — dieselbe Ableitung wie in
 * `extractHeadings`, damit die Sprungmarken im Inhaltsverzeichnis passen.
 */
function headingId(children: ReactNode): string | undefined {
  const text = String(children ?? '').replace(/[*_`]/g, '')
  const id = normalizeSlug(text)
  return id.length > 0 ? id : undefined
}

/**
 * Markdown fremder npubs rendern. Sanitizing ist Pflicht, nicht Option:
 * Inhalte kommen von beliebigen Schlüsseln. Kein rohes HTML, keine Skripte.
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
