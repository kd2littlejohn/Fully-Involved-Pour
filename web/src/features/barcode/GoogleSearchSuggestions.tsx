import { useState } from 'react'
import styles from './Barcode.module.css'

// Google's Search Suggestions for a grounded answer, shown exactly as Google
// renders them (groundingMetadata.searchEntryPoint.renderedContent) — its
// terms require them wherever that answer is displayed. Isolated in a
// sandboxed frame: no scripts run, and a tapped suggestion opens Google
// Search in a new tab.

const MIN_HEIGHT = 56

export function GoogleSearchSuggestions({ html }: { html: string }) {
  const [height, setHeight] = useState(MIN_HEIGHT)
  return (
    <iframe
      className={styles.searchSuggestions}
      title="Google Search suggestions"
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      srcDoc={`<!doctype html><html><head><meta charset="utf-8"><base target="_blank"></head><body style="margin:0">${html}</body></html>`}
      style={{ height }}
      onLoad={(e) => {
        const doc = e.currentTarget.contentDocument
        if (doc?.body) setHeight(Math.max(MIN_HEIGHT, doc.body.scrollHeight))
      }}
    />
  )
}
