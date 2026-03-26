import { useRef, useEffect, useState, useCallback } from 'react'
import DOMPurify from 'dompurify'

interface EmailViewerProps {
  html: string
  className?: string
}

function sanitizeEmailHtml(rawHtml: string): string {
  return DOMPurify.sanitize(rawHtml, {
    WHOLE_DOCUMENT: false,
    ALLOW_UNKNOWN_PROTOCOLS: false,
    ADD_TAGS: ['style', 'link', 'head', 'meta', 'title'],
    ADD_ATTR: ['target', 'bgcolor', 'cellpadding', 'cellspacing', 'align', 'valign', 'width', 'height', 'border', 'background'],
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'textarea', 'select', 'button'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onmouseout', 'onfocus', 'onblur'],
  })
}

function isHtml(content: string): boolean {
  return /<[a-z][\s\S]*>/i.test(content)
}

function extractBodyContent(html: string): string {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  if (bodyMatch) return bodyMatch[1]
  const htmlMatch = html.match(/<html[^>]*>([\s\S]*?)<\/html>/i)
  if (htmlMatch) return htmlMatch[1]
  return html
}

function extractHeadContent(html: string): string {
  const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i)
  if (headMatch) return headMatch[1]
  const styles: string[] = []
  const styleRegex = /<style[^>]*>[\s\S]*?<\/style>/gi
  let match
  while ((match = styleRegex.exec(html)) !== null) {
    styles.push(match[0])
  }
  return styles.join('\n')
}

export function EmailViewer({ html, className }: EmailViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState(150)

  const hasHtml = isHtml(html)

  const srcdoc = (() => {
    if (!hasHtml) return ''

    const headContent = extractHeadContent(html)
    const bodyContent = extractBodyContent(html)
    const sanitizedBody = sanitizeEmailHtml(bodyContent)
    const sanitizedHead = sanitizeEmailHtml(headContent)

    return `<!DOCTYPE html>
<html>
<head>
  <base target="_blank">
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  ${sanitizedHead}
  <style>
    body {
      margin: 0;
      padding: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      font-size: 14px;
      line-height: 1.5;
      color: #1a1a1a;
      overflow-y: hidden;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    img { max-width: 100%; height: auto; }
    a { color: #1a73e8; }
    table { max-width: 100% !important; }
  </style>
</head>
<body>${sanitizedBody}</body>
</html>`
  })()

  const resizeIframe = useCallback(() => {
    const iframe = iframeRef.current
    if (!iframe?.contentDocument?.body) return
    const newHeight = iframe.contentDocument.body.scrollHeight
    if (newHeight > 0) {
      setHeight(newHeight + 16)
    }
  }, [])

  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe || !hasHtml) return

    const handleLoad = () => {
      resizeIframe()
      const doc = iframe.contentDocument
      if (doc) {
        doc.querySelectorAll('a').forEach((a) => {
          a.setAttribute('target', '_blank')
          a.setAttribute('rel', 'noopener noreferrer')
        })
      }
    }

    iframe.addEventListener('load', handleLoad)
    return () => iframe.removeEventListener('load', handleLoad)
  }, [srcdoc, hasHtml, resizeIframe])

  if (!hasHtml) {
    return (
      <div
        className={className}
        style={{
          fontSize: 14,
          lineHeight: 1.7,
          color: 'var(--text)',
          whiteSpace: 'pre-wrap',
        }}
      >
        {html}
      </div>
    )
  }

  return (
    <iframe
      ref={iframeRef}
      srcDoc={srcdoc}
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      title="Email content"
      className={className}
      style={{
        width: '100%',
        height: `${height}px`,
        border: 'none',
        overflow: 'hidden',
      }}
    />
  )
}
