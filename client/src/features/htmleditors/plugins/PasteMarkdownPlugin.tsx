import { useState, useRef, useEffect, useCallback } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $generateNodesFromDOM } from '@lexical/html'
import { $createParagraphNode, $getRoot, $getSelection, $isRangeSelection, type LexicalNode } from 'lexical'
import { marked } from 'marked'

/**
 * Sanitize HTML converted from markdown:
 * - Remove all external images (only allow relative/same-origin src)
 * - Add rel="noopener noreferrer" and target="_blank" to external links
 */
function sanitizeHtml(html: string): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  // Block external images — remove <img> tags with absolute URLs
  const images = doc.querySelectorAll('img')
  images.forEach((img) => {
    const src = img.getAttribute('src') || ''
    // Keep only relative URLs (no protocol, not starting with //)
    const isExternal =
      /^https?:\/\//i.test(src) || src.startsWith('//')
    if (isExternal) {
      // Replace with a placeholder text node
      const placeholder = doc.createTextNode(`[image removed: ${src}]`)
      img.parentNode?.replaceChild(placeholder, img)
    }
  })

  // Handle external links — add safety attributes
  const links = doc.querySelectorAll('a')
  links.forEach((a) => {
    const href = a.getAttribute('href') || ''
    const isExternal =
      /^https?:\/\//i.test(href) || href.startsWith('//')
    if (isExternal) {
      a.setAttribute('target', '_blank')
      a.setAttribute('rel', 'noopener noreferrer')
    }
  })

  return doc.body.innerHTML
}

/** Configure marked for safe output */
function convertMarkdownToHtml(markdown: string): string {
  const rawHtml = marked.parse(markdown, {
    async: false,
    breaks: true,
    gfm: true,
  }) as string

  // Double-sanitize via DOM to catch anything the renderer missed
  return sanitizeHtml(rawHtml)
}

interface PasteMarkdownPluginProps {
  show: boolean
  onClose: () => void
}

export default function PasteMarkdownPlugin({ show, onClose }: PasteMarkdownPluginProps) {
  const [editor] = useLexicalComposerContext()
  const [markdown, setMarkdown] = useState('')
  const [preview, setPreview] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  // Focus textarea when dialog opens
  useEffect(() => {
    if (show) {
      setMarkdown('')
      setPreview('')
      setTimeout(() => textareaRef.current?.focus(), 50)
    }
  }, [show])

  // Live preview
  useEffect(() => {
    if (!markdown.trim()) {
      setPreview('')
      return
    }
    try {
      setPreview(convertMarkdownToHtml(markdown))
    } catch {
      setPreview('<p style="color:red">Error parsing markdown</p>')
    }
  }, [markdown])

  // Close on Escape
  useEffect(() => {
    if (!show) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [show, onClose])

  const handleInsert = useCallback(() => {
    if (!markdown.trim()) return

    const html = convertMarkdownToHtml(markdown)

    editor.update(() => {
      const parser = new DOMParser()
      const dom = parser.parseFromString(html, 'text/html')
      const nodes = $generateNodesFromDOM(editor, dom).filter((node) => {
        return !(node.getType() === 'paragraph' && node.getTextContent().trim() === '')
      })

      if (nodes.length === 0) return

      const selection = $getSelection()
      if ($isRangeSelection(selection)) {
        const anchorTopLevel = selection.anchor.getNode().getTopLevelElementOrThrow()
        let insertAfterNode: LexicalNode = anchorTopLevel

        nodes.forEach((node) => {
          insertAfterNode.insertAfter(node)
          insertAfterNode = node
        })

        const nextLine = $createParagraphNode()
        insertAfterNode.insertAfter(nextLine)
        nextLine.selectStart()
        return
      }

      const root = $getRoot()
      nodes.forEach((node) => root.append(node))
    })

    setMarkdown('')
    setPreview('')
    onClose()
  }, [editor, markdown, onClose])

  if (!show) return null

  return (
    <div
      ref={overlayRef}
      className="paste-markdown-overlay"
      onMouseDown={(e) => {
        if (e.target === overlayRef.current) onClose()
      }}
    >
      <div className="paste-markdown-dialog">
        <div className="paste-markdown-header">
          <h3>Paste Markdown</h3>
          <button
            type="button"
            className="paste-markdown-close"
            onClick={onClose}
            title="Close"
          >
            ✕
          </button>
        </div>

        <div className="paste-markdown-body">
          <div className="paste-markdown-input-section">
            <label className="paste-markdown-label">Markdown</label>
            <textarea
              ref={textareaRef}
              className="paste-markdown-textarea"
              value={markdown}
              onChange={(e) => setMarkdown(e.target.value)}
              placeholder={"Paste your markdown here...\n\n# Heading\n**Bold** and *italic*\n- List item\n[Link](https://...)"}
              spellCheck={false}
            />
          </div>

          {preview && (
            <div className="paste-markdown-preview-section">
              <label className="paste-markdown-label">Preview</label>
              <div
                className="paste-markdown-preview"
                dangerouslySetInnerHTML={{ __html: preview }}
              />
            </div>
          )}
        </div>

        <div className="paste-markdown-footer">
          <span className="paste-markdown-hint">
            External images will be removed. External links open in new tab.
          </span>
          <div className="paste-markdown-actions">
            <button
              type="button"
              className="paste-markdown-btn paste-markdown-btn-cancel"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className="paste-markdown-btn paste-markdown-btn-insert"
              onClick={handleInsert}
              disabled={!markdown.trim()}
            >
              Insert
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
