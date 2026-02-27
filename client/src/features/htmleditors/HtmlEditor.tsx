import { useEffect, useCallback, useState, forwardRef, useImperativeHandle, useRef } from 'react'
import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin'
import { ListPlugin } from '@lexical/react/LexicalListPlugin'
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin'
import { TablePlugin } from '@lexical/react/LexicalTablePlugin'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { HeadingNode, QuoteNode } from '@lexical/rich-text'
import { ListNode, ListItemNode } from '@lexical/list'
import { LinkNode, AutoLinkNode } from '@lexical/link'
import { TableNode, TableCellNode, TableRowNode } from '@lexical/table'
import { CodeNode, CodeHighlightNode, registerCodeHighlighting } from '@lexical/code'
import { $generateHtmlFromNodes, $generateNodesFromDOM } from '@lexical/html'
import { $getRoot, $insertNodes, TextNode, type EditorState, type LexicalEditor } from 'lexical'
import ToolbarPlugin from './plugins/ToolbarPlugin'
import TableActionMenuPlugin from './plugins/TableActionMenuPlugin'
import ImagePlugin from './plugins/ImagePlugin'
import PasteMarkdownPlugin from './plugins/PasteMarkdownPlugin'
import { ImageNode, $createImageNode } from './nodes/ImageNode'
import { ExtendedTextNode } from './nodes/ExtendedTextNode'
import './HtmlEditor.css'
import Prism from 'prismjs'
import loadLanguages from 'prismjs/components/index'

if (!(globalThis as { Prism?: typeof Prism }).Prism) {
  (globalThis as { Prism?: typeof Prism }).Prism = Prism
  loadLanguages(['markup', 'json', 'javascript', 'typescript', 'python', 'csharp', 'cpp'])
}

export interface HtmlEditorRef {
  resetContent: (html: string) => void
  insertImage: (src: string, altText?: string) => void
}

interface HtmlEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  minHeight?: string
  onOpenImageBrowser?: () => void
  onOpenDiagram?: (imageUrl?: string) => void
  onOpenDataModel?: (imageUrl?: string) => void
}

// Plugin to expose imperative handle for resetting content
function ResetContentPlugin({ onResetRef }: { onResetRef: (resetFn: (html: string) => void) => void }) {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    const resetContent = (html: string) => {
      editor.update(() => {
        const root = $getRoot()
        root.clear()
        
        if (html) {
          const parser = new DOMParser()
          const dom = parser.parseFromString(html, 'text/html')
          const nodes = $generateNodesFromDOM(editor, dom)
          $insertNodes(nodes)
        }
      })
    }

    onResetRef(resetContent)
  }, [editor, onResetRef])

  return null
}

// Plugin to capture editor instance for imperative API
function EditorRefPlugin({ editorRefCallback }: { editorRefCallback: (editor: LexicalEditor) => void }) {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    editorRefCallback(editor)
  }, [editor, editorRefCallback])

  return null
}

// Plugin to load initial HTML content
function LoadInitialContentPlugin({ value }: { value: string }) {
  const [editor] = useLexicalComposerContext()
  const hasLoadedInitialContent = useRef(false)

  useEffect(() => {
    if (hasLoadedInitialContent.current) return
    if (!value) return

    editor.update(() => {
      const root = $getRoot()
      const parser = new DOMParser()
      const dom = parser.parseFromString(value, 'text/html')
      const nodes = $generateNodesFromDOM(editor, dom)
      root.clear()
      $insertNodes(nodes)
      hasLoadedInitialContent.current = true
    })
  }, [editor, value])

  return null
}

// Plugin to sync HTML changes
function HtmlChangePlugin({ onChange }: { onChange: (html: string) => void }) {
  const [editor] = useLexicalComposerContext()

  const handleChange = useCallback(
    (editorState: EditorState) => {
      editorState.read(() => {
        const html = $generateHtmlFromNodes(editor, null)
        onChange(html)
      })
    },
    [editor, onChange]
  )

  return <OnChangePlugin onChange={handleChange} />
}

function CodeHighlightingPlugin() {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    return registerCodeHighlighting(editor)
  }, [editor])

  return null
}

const theme = {
  paragraph: 'editor-paragraph',
  heading: {
    h1: 'editor-heading-h1',
    h2: 'editor-heading-h2',
    h3: 'editor-heading-h3',
    h4: 'editor-heading-h4',
  },
  list: {
    ul: 'editor-list-ul',
    ol: 'editor-list-ol',
    listitem: 'editor-list-item',
    nested: {
      listitem: 'editor-nested-list',
    },
  },
  link: 'editor-link',
  text: {
    bold: 'editor-text-bold',
    italic: 'editor-text-italic',
    underline: 'editor-text-underline',
    strikethrough: 'editor-text-strikethrough',
    code: 'editor-text-code',
  },
  quote: 'editor-quote',
  code: 'editor-code-block',
  codeHighlight: {
    atrule: 'editor-tokenAttr',
    attr: 'editor-tokenAttr',
    boolean: 'editor-tokenProperty',
    builtin: 'editor-tokenSelector',
    cdata: 'editor-tokenComment',
    char: 'editor-tokenSelector',
    class: 'editor-tokenFunction',
    'class-name': 'editor-tokenFunction',
    comment: 'editor-tokenComment',
    constant: 'editor-tokenProperty',
    deleted: 'editor-tokenProperty',
    doctype: 'editor-tokenComment',
    entity: 'editor-tokenOperator',
    function: 'editor-tokenFunction',
    important: 'editor-tokenVariable',
    inserted: 'editor-tokenSelector',
    keyword: 'editor-tokenAttr',
    namespace: 'editor-tokenVariable',
    number: 'editor-tokenProperty',
    operator: 'editor-tokenOperator',
    prolog: 'editor-tokenComment',
    property: 'editor-tokenProperty',
    punctuation: 'editor-tokenPunctuation',
    regex: 'editor-tokenVariable',
    selector: 'editor-tokenSelector',
    string: 'editor-tokenSelector',
    symbol: 'editor-tokenProperty',
    tag: 'editor-tokenProperty',
    url: 'editor-tokenOperator',
    variable: 'editor-tokenVariable',
  },
  table: 'editor-table',
  tableCell: 'editor-table-cell',
  tableCellHeader: 'editor-table-cell-header',
  tableRow: 'editor-table-row',
  image: 'editor-image',
}

function onError(error: Error) {
  console.error('Lexical error:', error)
}

const HtmlEditor = forwardRef<HtmlEditorRef, HtmlEditorProps>(
  ({ value, onChange, placeholder = 'Enter description...', minHeight = '200px', onOpenImageBrowser, onOpenDiagram, onOpenDataModel }, ref) => {
    const [isFullscreen, setIsFullscreen] = useState(false)
    const [showPasteMarkdown, setShowPasteMarkdown] = useState(false)

    const initialConfig = {
      namespace: 'HtmlEditor',
      theme,
      onError,
      nodes: [
        HeadingNode,
        QuoteNode,
        ListNode,
        ListItemNode,
        LinkNode,
        AutoLinkNode,
        TableNode,
        TableCellNode,
        TableRowNode,
        CodeNode,
        CodeHighlightNode,
        ExtendedTextNode,
        {
          replace: TextNode,
          with: (node: TextNode) => new ExtendedTextNode(node.__text),
          withKlass: ExtendedTextNode,
        },
        ImageNode,
      ],
    }

    // Ref to store reset function
    const resetContentRef = useRef<((html: string) => void) | null>(null)
    // Ref to store editor instance
    const editorInstanceRef = useRef<LexicalEditor | null>(null)

    // Callback to set the reset function
    const handleResetRef = useCallback((fn: (html: string) => void) => {
      resetContentRef.current = fn
    }, [])

    // Callback to capture editor instance
    const handleEditorRef = useCallback((editor: LexicalEditor) => {
      editorInstanceRef.current = editor
    }, [])

    // Expose imperative handle
    useImperativeHandle(ref, () => ({
      resetContent: (html: string) => {
        if (resetContentRef.current) {
          resetContentRef.current(html)
        }
      },
      insertImage: (src: string, altText?: string) => {
        const editor = editorInstanceRef.current
        if (editor) {
          editor.update(() => {
            const imageNode = $createImageNode({ src, altText: altText || '' })
            $insertNodes([imageNode])
          })
        }
      },
    }))

    // Handle Escape to exit fullscreen
    useEffect(() => {
      if (!isFullscreen) return
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setIsFullscreen(false)
      }
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }, [isFullscreen])

    return (
      <div className={`html-editor-wrapper ${isFullscreen ? 'html-editor-fullscreen' : ''}`} style={isFullscreen ? undefined : { minHeight }}>
        <LexicalComposer initialConfig={initialConfig}>
          <div className="html-editor-container">
            <ToolbarPlugin
              isFullscreen={isFullscreen}
              onToggleFullscreen={() => setIsFullscreen((f) => !f)}
              onOpenImageBrowser={onOpenImageBrowser}
              onOpenDiagram={onOpenDiagram}
              onOpenDataModel={onOpenDataModel}
              onPasteMarkdown={() => setShowPasteMarkdown(true)}
            />
            <div className="editor-inner">
              <RichTextPlugin
                contentEditable={<ContentEditable className="editor-input" />}
                placeholder={<div className="editor-placeholder">{placeholder}</div>}
                ErrorBoundary={LexicalErrorBoundary}
              />
              <HistoryPlugin />
              <ListPlugin />
              <LinkPlugin />
              <TablePlugin />
              <CodeHighlightingPlugin />
              <TableActionMenuPlugin />
              <ImagePlugin />
              <PasteMarkdownPlugin
                show={showPasteMarkdown}
                onClose={() => setShowPasteMarkdown(false)}
              />
              <LoadInitialContentPlugin value={value} />
              <HtmlChangePlugin onChange={onChange} />
              <ResetContentPlugin onResetRef={handleResetRef} />
              <EditorRefPlugin editorRefCallback={handleEditorRef} />
            </div>
          </div>
        </LexicalComposer>
      </div>
    )
  }
)

HtmlEditor.displayName = 'HtmlEditor'

export default HtmlEditor
