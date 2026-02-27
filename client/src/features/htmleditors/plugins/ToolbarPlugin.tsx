import { useCallback, useEffect, useState, useRef } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import {
  $getSelection,
  $isRangeSelection,
  FORMAT_TEXT_COMMAND,
  FORMAT_ELEMENT_COMMAND,
  SELECTION_CHANGE_COMMAND,
  COMMAND_PRIORITY_CRITICAL,
  $createParagraphNode,
  type ElementFormatType,
} from 'lexical'
import {
  $setBlocksType,
  $patchStyleText,
  $getSelectionStyleValueForProperty,
} from '@lexical/selection'
import {
  $createHeadingNode,
  $isHeadingNode,
  $createQuoteNode,
  $isQuoteNode,
  type HeadingTagType,
} from '@lexical/rich-text'
import {
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  $isListNode,
  ListNode,
} from '@lexical/list'
import { $isLinkNode, TOGGLE_LINK_COMMAND } from '@lexical/link'
import { $findMatchingParent, mergeRegister } from '@lexical/utils'
import { INSERT_TABLE_COMMAND } from '@lexical/table'
import { $createCodeNode, $isCodeNode } from '@lexical/code'
import { $createImageNode } from '../nodes/ImageNode'
import { $insertNodes } from 'lexical'
import { uploadImage, validateImageFile, ImageUploadError } from '../imageUpload'

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/svg+xml', 'image/webp']

const FONT_SIZES = ['12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px', '36px', '48px']

const FONT_COLORS = [
  '#000000', '#434343', '#666666', '#999999', '#cccccc',
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
]

const CODE_LANGUAGES = [
  { label: 'Plain', value: '' },
  { label: 'JSON', value: 'json' },
  { label: 'XML/HTML', value: 'markup' },
  { label: 'JavaScript', value: 'javascript' },
  { label: 'TypeScript', value: 'typescript' },
  { label: 'Python', value: 'python' },
  { label: 'C#', value: 'csharp' },
  { label: 'C++', value: 'cpp' },
]

interface ToolbarPluginProps {
  isFullscreen?: boolean
  onToggleFullscreen?: () => void
  onOpenImageBrowser?: () => void
  onOpenDiagram?: (imageUrl?: string) => void
  onOpenDataModel?: (imageUrl?: string) => void
  onPasteMarkdown?: () => void
}

export default function ToolbarPlugin({ isFullscreen, onToggleFullscreen, onOpenImageBrowser, onOpenDiagram, onOpenDataModel, onPasteMarkdown }: ToolbarPluginProps) {
  const [editor] = useLexicalComposerContext()
  const [isBold, setIsBold] = useState(false)
  const [isItalic, setIsItalic] = useState(false)
  const [isUnderline, setIsUnderline] = useState(false)
  const [isStrikethrough, setIsStrikethrough] = useState(false)
  const [isLink, setIsLink] = useState(false)
  const [blockType, setBlockType] = useState<string>('paragraph')
  const [fontSize, setFontSize] = useState<string>('')
  const [fontColor, setFontColor] = useState<string>('#000000')
  const [codeLanguage, setCodeLanguage] = useState<string>('')
  const [elementFormat, setElementFormat] = useState<ElementFormatType>('')
  const [showTablePicker, setShowTablePicker] = useState(false)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [hoveredRows, setHoveredRows] = useState(0)
  const [hoveredCols, setHoveredCols] = useState(0)
  const [pickerPosition, setPickerPosition] = useState({ top: 0, left: 0 })
  const [colorPickerPosition, setColorPickerPosition] = useState({ top: 0, left: 0 })
  const tableButtonRef = useRef<HTMLButtonElement>(null)
  const colorButtonRef = useRef<HTMLButtonElement>(null)

  const updateToolbar = useCallback(() => {
    const selection = $getSelection()
    if ($isRangeSelection(selection)) {
      setIsBold(selection.hasFormat('bold'))
      setIsItalic(selection.hasFormat('italic'))
      setIsUnderline(selection.hasFormat('underline'))
      setIsStrikethrough(selection.hasFormat('strikethrough'))

      // Font size and color
      setFontSize($getSelectionStyleValueForProperty(selection, 'font-size', ''))
      setFontColor($getSelectionStyleValueForProperty(selection, 'color', '#000000'))

      const anchorNode = selection.anchor.getNode()
      const element =
        anchorNode.getKey() === 'root'
          ? anchorNode
          : $findMatchingParent(anchorNode, (e) => {
              const parent = e.getParent()
              return parent !== null && parent.getKey() === 'root'
            })

      if (element !== null) {
        if ($isListNode(element)) {
          const parentList = $findMatchingParent(anchorNode, $isListNode)
          setBlockType(parentList ? (parentList as ListNode).getListType() : element.getType())
        } else if ($isHeadingNode(element)) {
          setBlockType(element.getTag())
        } else if ($isQuoteNode(element)) {
          setBlockType('quote')
        } else if ($isCodeNode(element)) {
          setBlockType('code')
          setCodeLanguage(element.getLanguage() ?? '')
        } else {
          setBlockType(element.getType())
          setCodeLanguage('')
        }

        // Get element alignment
        const elementDOM = editor.getElementByKey(element.getKey())
        if (elementDOM) {
          const style = window.getComputedStyle(elementDOM)
          const align = style.textAlign
          if (align === 'center' || align === 'right' || align === 'justify') {
            setElementFormat(align as ElementFormatType)
          } else {
            setElementFormat('left' as ElementFormatType)
          }
        }
      }

      // Check for link
      const node = anchorNode.getParent()
      setIsLink($isLinkNode(node))
    }
  }, [editor])

  useEffect(() => {
    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => {
          updateToolbar()
        })
      }),
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          updateToolbar()
          return false
        },
        COMMAND_PRIORITY_CRITICAL
      )
    )
  }, [editor, updateToolbar])

  // Close table picker on outside click
  useEffect(() => {
    if (!showTablePicker && !showColorPicker) return

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (
        showTablePicker &&
        tableButtonRef.current &&
        !tableButtonRef.current.contains(target) &&
        !(target as HTMLElement).closest('.table-picker-popup')
      ) {
        setShowTablePicker(false)
      }
      if (
        showColorPicker &&
        colorButtonRef.current &&
        !colorButtonRef.current.contains(target) &&
        !(target as HTMLElement).closest('.color-picker-popup')
      ) {
        setShowColorPicker(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showTablePicker, showColorPicker])

  const formatHeading = (headingSize: HeadingTagType | 'paragraph') => {
    editor.update(() => {
      const selection = $getSelection()
      if ($isRangeSelection(selection)) {
        if (headingSize === 'paragraph') {
          $setBlocksType(selection, () => $createParagraphNode())
        } else {
          $setBlocksType(selection, () => $createHeadingNode(headingSize))
        }
      }
    })
  }

  const formatBlockquote = () => {
    editor.update(() => {
      const selection = $getSelection()
      if ($isRangeSelection(selection)) {
        if (blockType === 'quote') {
          $setBlocksType(selection, () => $createParagraphNode())
        } else {
          $setBlocksType(selection, () => $createQuoteNode())
        }
      }
    })
  }

  const formatCodeBlock = () => {
    editor.update(() => {
      const selection = $getSelection()
      if ($isRangeSelection(selection)) {
        if (blockType === 'code') {
          $setBlocksType(selection, () => $createParagraphNode())
          setCodeLanguage('')
        } else {
          $setBlocksType(selection, () => $createCodeNode())
          setCodeLanguage('')
        }
      }
    })
  }

  const applyCodeLanguage = (language: string) => {
    editor.update(() => {
      const selection = $getSelection()
      if (!$isRangeSelection(selection)) return

      const anchorNode = selection.anchor.getNode()
      const codeNode = $isCodeNode(anchorNode)
        ? anchorNode
        : $findMatchingParent(anchorNode, $isCodeNode)

      if ($isCodeNode(codeNode)) {
        codeNode.setLanguage(language)
      }
    })
    setCodeLanguage(language)
  }

  const applyFontSize = (size: string) => {
    editor.update(() => {
      const selection = $getSelection()
      if ($isRangeSelection(selection)) {
        $patchStyleText(selection, { 'font-size': size || null })
      }
    })
  }

  const applyFontColor = (color: string) => {
    editor.update(() => {
      const selection = $getSelection()
      if ($isRangeSelection(selection)) {
        $patchStyleText(selection, { color })
      }
    })
    setFontColor(color)
    setShowColorPicker(false)
  }

  const formatAlignment = (alignment: ElementFormatType) => {
    editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, alignment)
  }

  const insertLink = () => {
    if (isLink) {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, null)
    } else {
      const url = prompt('Enter URL:', 'https://')
      if (url) {
        editor.dispatchCommand(TOGGLE_LINK_COMMAND, {
          url,
          target: '_blank',
          rel: 'noopener noreferrer',
        })
      }
    }
  }

  const insertImage = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = ALLOWED_IMAGE_TYPES.join(',')
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      try {
        validateImageFile(file)
        const { url } = await uploadImage(file)
        editor.update(() => {
          const imageNode = $createImageNode({ src: url, altText: file.name })
          $insertNodes([imageNode])
        })
      } catch (error) {
        const message = error instanceof ImageUploadError
          ? error.message
          : 'Failed to upload image'
        alert(message)
      }
    }
    input.click()
  }

  const insertTable = (rows: number, cols: number) => {
    editor.dispatchCommand(INSERT_TABLE_COMMAND, {
      columns: String(cols),
      rows: String(rows),
    })
    setShowTablePicker(false)
  }

  return (
    <div className="toolbar">
      {/* Heading dropdown */}
      <select
        className="toolbar-select"
        value={blockType}
        onChange={(e) => formatHeading(e.target.value as HeadingTagType | 'paragraph')}
      >
        <option value="paragraph">Normal</option>
        <option value="h2">Heading 1</option>
        <option value="h3">Heading 2</option>
        <option value="h4">Heading 3</option>
      </select>

      {/* Font Size */}
      <select
        className="toolbar-select"
        value={fontSize}
        onChange={(e) => applyFontSize(e.target.value)}
        title="Font Size"
      >
        <option value="">Size</option>
        {FONT_SIZES.map((size) => (
          <option key={size} value={size}>{size}</option>
        ))}
      </select>

      <span className="toolbar-divider" />

      {/* Text formatting */}
      <button
        type="button"
        className={`toolbar-button ${isBold ? 'active' : ''}`}
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold')}
        title="Bold"
      >
        <strong>B</strong>
      </button>
      <button
        type="button"
        className={`toolbar-button ${isItalic ? 'active' : ''}`}
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic')}
        title="Italic"
      >
        <em>I</em>
      </button>
      <button
        type="button"
        className={`toolbar-button ${isUnderline ? 'active' : ''}`}
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline')}
        title="Underline"
      >
        <u>U</u>
      </button>
      <button
        type="button"
        className={`toolbar-button ${isStrikethrough ? 'active' : ''}`}
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'strikethrough')}
        title="Strikethrough"
      >
        <s>S</s>
      </button>

      {/* Font Color */}
      <button
        ref={colorButtonRef}
        type="button"
        className="toolbar-button"
        onClick={() => {
          if (!showColorPicker && colorButtonRef.current) {
            const rect = colorButtonRef.current.getBoundingClientRect()
            const toolbar = colorButtonRef.current.closest('.toolbar')
            const toolbarRect = toolbar?.getBoundingClientRect()
            setColorPickerPosition({
              top: colorButtonRef.current.offsetTop + colorButtonRef.current.offsetHeight + 4,
              left: toolbarRect ? rect.left - toolbarRect.left : colorButtonRef.current.offsetLeft,
            })
          }
          setShowColorPicker(!showColorPicker)
        }}
        title="Font Color"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <text x="3" y="11" fontSize="11" fontWeight="bold" fontFamily="serif">A</text>
          <rect x="2" y="13" width="12" height="2.5" rx="0.5" fill={fontColor} />
        </svg>
      </button>

      {/* Color Picker Popup */}
      {showColorPicker && (
        <div
          className="color-picker-popup"
          style={{
            position: 'absolute',
            top: `${colorPickerPosition.top}px`,
            left: `${colorPickerPosition.left - 40}px`,
            backgroundColor: 'white',
            border: '1px solid #ccc',
            borderRadius: '4px',
            padding: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            zIndex: 1000,
          }}
        >
          <div style={{ marginBottom: '6px', fontSize: '12px', color: '#666' }}>Font Color</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 24px)', gap: '3px' }}>
            {FONT_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => applyFontColor(color)}
                style={{
                  width: '24px',
                  height: '24px',
                  backgroundColor: color,
                  border: fontColor === color ? '2px solid #6366f1' : '1px solid #ddd',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  padding: 0,
                }}
                title={color}
              />
            ))}
          </div>
          <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label style={{ fontSize: '12px', color: '#666' }}>Custom:</label>
            <input
              type="color"
              value={fontColor}
              onChange={(e) => applyFontColor(e.target.value)}
              style={{ width: '28px', height: '24px', padding: 0, border: 'none', cursor: 'pointer' }}
            />
          </div>
        </div>
      )}

      <span className="toolbar-divider" />

      {/* Text Alignment */}
      <button
        type="button"
        className={`toolbar-button ${elementFormat === 'left' || elementFormat === '' ? 'active' : ''}`}
        onClick={() => formatAlignment('left')}
        title="Align Left"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <rect x="2" y="2" width="12" height="1.5" />
          <rect x="2" y="5.5" width="8" height="1.5" />
          <rect x="2" y="9" width="12" height="1.5" />
          <rect x="2" y="12.5" width="8" height="1.5" />
        </svg>
      </button>
      <button
        type="button"
        className={`toolbar-button ${elementFormat === 'center' ? 'active' : ''}`}
        onClick={() => formatAlignment('center')}
        title="Align Center"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <rect x="2" y="2" width="12" height="1.5" />
          <rect x="4" y="5.5" width="8" height="1.5" />
          <rect x="2" y="9" width="12" height="1.5" />
          <rect x="4" y="12.5" width="8" height="1.5" />
        </svg>
      </button>
      <button
        type="button"
        className={`toolbar-button ${elementFormat === 'right' ? 'active' : ''}`}
        onClick={() => formatAlignment('right')}
        title="Align Right"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <rect x="2" y="2" width="12" height="1.5" />
          <rect x="6" y="5.5" width="8" height="1.5" />
          <rect x="2" y="9" width="12" height="1.5" />
          <rect x="6" y="12.5" width="8" height="1.5" />
        </svg>
      </button>
      <button
        type="button"
        className={`toolbar-button ${elementFormat === 'justify' ? 'active' : ''}`}
        onClick={() => formatAlignment('justify')}
        title="Justify"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <rect x="2" y="2" width="12" height="1.5" />
          <rect x="2" y="5.5" width="12" height="1.5" />
          <rect x="2" y="9" width="12" height="1.5" />
          <rect x="2" y="12.5" width="12" height="1.5" />
        </svg>
      </button>

      <span className="toolbar-divider" />

      {/* Lists */}
      <button
        type="button"
        className={`toolbar-button ${blockType === 'bullet' ? 'active' : ''}`}
        onClick={() => editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)}
        title="Bullet List"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="3" cy="4" r="1.5" />
          <circle cx="3" cy="8" r="1.5" />
          <circle cx="3" cy="12" r="1.5" />
          <rect x="6" y="3" width="9" height="2" />
          <rect x="6" y="7" width="9" height="2" />
          <rect x="6" y="11" width="9" height="2" />
        </svg>
      </button>
      <button
        type="button"
        className={`toolbar-button ${blockType === 'number' ? 'active' : ''}`}
        onClick={() => editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)}
        title="Numbered List"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <text x="1" y="5" fontSize="5" fontWeight="bold">1</text>
          <text x="1" y="9" fontSize="5" fontWeight="bold">2</text>
          <text x="1" y="13" fontSize="5" fontWeight="bold">3</text>
          <rect x="6" y="3" width="9" height="2" />
          <rect x="6" y="7" width="9" height="2" />
          <rect x="6" y="11" width="9" height="2" />
        </svg>
      </button>

      {/* Blockquote */}
      <button
        type="button"
        className={`toolbar-button ${blockType === 'quote' ? 'active' : ''}`}
        onClick={formatBlockquote}
        title="Blockquote"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <rect x="2" y="2" width="2" height="12" rx="1" />
          <rect x="6" y="3" width="8" height="1.5" />
          <rect x="6" y="7" width="8" height="1.5" />
          <rect x="6" y="11" width="6" height="1.5" />
        </svg>
      </button>

      {/* Code Block */}
      <button
        type="button"
        className={`toolbar-button ${blockType === 'code' ? 'active' : ''}`}
        onClick={formatCodeBlock}
        title="Code Block"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M5.854 4.854a.5.5 0 1 0-.708-.708l-3.5 3.5a.5.5 0 0 0 0 .708l3.5 3.5a.5.5 0 0 0 .708-.708L2.707 8l3.147-3.146z" />
          <path d="M10.146 4.854a.5.5 0 0 1 .708-.708l3.5 3.5a.5.5 0 0 1 0 .708l-3.5 3.5a.5.5 0 0 1-.708-.708L13.293 8l-3.147-3.146z" />
        </svg>
      </button>

      {blockType === 'code' && (
        <select
          className="toolbar-select toolbar-select-code-language"
          value={codeLanguage}
          onChange={(e) => applyCodeLanguage(e.target.value)}
          title="Code language"
        >
          {CODE_LANGUAGES.map((language) => (
            <option key={language.value || 'plain'} value={language.value}>
              {language.label}
            </option>
          ))}
        </select>
      )}

      <span className="toolbar-divider" />

      {/* Link */}
      <button
        type="button"
        className={`toolbar-button ${isLink ? 'active' : ''}`}
        onClick={insertLink}
        title="Insert Link (opens in new tab)"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M6.354 5.5H7a.5.5 0 0 1 0 1h-.354a4 4 0 0 0 0 8h.354a.5.5 0 0 1 0 1H6.5a5 5 0 0 1 0-10zm3.292 0H9a.5.5 0 0 1 0 1h.646a4 4 0 0 0 0 8H9a.5.5 0 0 1 0 1h.5a5 5 0 0 0 0-10z" transform="scale(0.8) translate(2, 2)" />
          <path d="M4 8a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7A.5.5 0 0 1 4 8z" transform="scale(0.8) translate(2, 2)" />
        </svg>
      </button>

      {/* Image */}
      <button
        type="button"
        className="toolbar-button"
        onClick={insertImage}
        title="Insert Image"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M6.002 5.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z" />
          <path d="M2.002 1a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2h-12zm12 1a1 1 0 0 1 1 1v6.5l-3.777-1.947a.5.5 0 0 0-.577.093l-3.71 3.71-2.66-1.772a.5.5 0 0 0-.63.062L1.002 12V3a1 1 0 0 1 1-1h12z" />
        </svg>
      </button>

      {/* Image Browser */}
      {onOpenImageBrowser && (
        <button
          type="button"
          className="toolbar-button"
          onClick={onOpenImageBrowser}
          title="Browse Images"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4.502 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z" />
            <path d="M14.002 13.5a1.5 1.5 0 0 1-1.5 1.5h-9a1.5 1.5 0 0 1-1.5-1.5v-9a1.5 1.5 0 0 1 1.5-1.5h9a1.5 1.5 0 0 1 1.5 1.5v9zm-1.5.5a.5.5 0 0 0 .5-.5V9.457l-1.572-1.572a.5.5 0 0 0-.708 0L7.443 11.664l5.059-.001zm-7-4.457l-2.5 2.5v1.457a.5.5 0 0 0 .5.5h4.457L5.002 9.543zM1.002 4v1h14V4a2 2 0 0 0-2-2h-10a2 2 0 0 0-2 2z" />
          </svg>
        </button>
      )}

      {/* Diagram (Excalidraw) */}
      {onOpenDiagram && (
        <button
          type="button"
          className="toolbar-button"
          onClick={() => onOpenDiagram()}
          title="Insert/Update Diagram"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M1 1h4v4H1V1zm1 1v2h2V2H2zm6-1h4v4H8V1zm1 1v2h2V2H9zM1 8h4v4H1V8zm1 1v2h2V9H2zm10.5-1.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zm0 1a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z" />
            <path d="M5 3h3v1H5V3zm0 5h3v1H5V8zM3 5v3H2V5h1zm7 0v3h-1V5h1z" opacity="0.4" />
          </svg>
        </button>
      )}

      {/* Data Model */}
      {onOpenDataModel && (
        <button
          type="button"
          className="toolbar-button"
          onClick={() => onOpenDataModel()}
          title="Insert/Update Data Model"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 1c-3.866 0-7 1.343-7 3v8c0 1.657 3.134 3 7 3s7-1.343 7-3V4c0-1.657-3.134-3-7-3zM2 4c0-.94 2.686-2 6-2s6 1.06 6 2-2.686 2-6 2-6-1.06-6-2zm12 8c0 .94-2.686 2-6 2s-6-1.06-6-2v-2.07c1.326.836 3.52 1.37 6 1.37s4.674-.534 6-1.37V12zm0-4c0 .94-2.686 2-6 2s-6-1.06-6-2V5.93c1.326.836 3.52 1.37 6 1.37s4.674-.534 6-1.37V8z" />
          </svg>
        </button>
      )}

      {/* Paste Markdown */}
      <button
        type="button"
        className="toolbar-button"
        onClick={onPasteMarkdown}
        title="Paste Markdown"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M2 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2zm2-1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H4z" />
          <path d="M5.15 6.77V5.08h1.18v1.69l.73-.73.49.49L6.32 7.76l1.24 1.22-.49.49-.73-.73v1.69H5.15V8.74l-.74.73-.49-.49 1.23-1.22-1.23-1.23.49-.49.74.73zm4.46 2.42H8.38V7.81h1.23V6.58h.76v1.23h1.24v1.38h-1.24v1.23h-.76V9.19z" />
        </svg>
      </button>

      <span className="toolbar-divider" />

      {/* Table */}
      <button
        ref={tableButtonRef}
        type="button"
        className="toolbar-button"
        onClick={() => {
          if (!showTablePicker && tableButtonRef.current) {
            const rect = tableButtonRef.current.getBoundingClientRect()
            const toolbar = tableButtonRef.current.closest('.toolbar')
            const toolbarRect = toolbar?.getBoundingClientRect()
            setPickerPosition({
              top: tableButtonRef.current.offsetTop + tableButtonRef.current.offsetHeight + 4,
              left: toolbarRect ? rect.left - toolbarRect.left : tableButtonRef.current.offsetLeft,
            })
          }
          setShowTablePicker(!showTablePicker)
        }}
        title="Insert Table"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <rect x="2" y="2" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <line x1="2" y1="6" x2="14" y2="6" stroke="currentColor" strokeWidth="1.5" />
          <line x1="2" y1="10" x2="14" y2="10" stroke="currentColor" strokeWidth="1.5" />
          <line x1="6" y1="2" x2="6" y2="14" stroke="currentColor" strokeWidth="1.5" />
          <line x1="10" y1="2" x2="10" y2="14" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>

      <span className="toolbar-divider" />

      {/* Fullscreen */}
      {onToggleFullscreen && (
        <button
          type="button"
          className={`toolbar-button ${isFullscreen ? 'active' : ''}`}
          onClick={onToggleFullscreen}
          title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
        >
          {isFullscreen ? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M5.5 1a.5.5 0 0 1 .5.5v4a.5.5 0 0 1-.5.5h-4a.5.5 0 0 1 0-1H5V1.5a.5.5 0 0 1 .5-.5zm5 0a.5.5 0 0 1 .5.5V5h3.5a.5.5 0 0 1 0 1h-4a.5.5 0 0 1-.5-.5v-4a.5.5 0 0 1 .5-.5zM1 10.5a.5.5 0 0 1 .5-.5h4a.5.5 0 0 1 .5.5v4a.5.5 0 0 1-1 0V11H1.5a.5.5 0 0 1-.5-.5zm9 0a.5.5 0 0 1 .5-.5h4a.5.5 0 0 1 0 1H11v3.5a.5.5 0 0 1-1 0v-4z" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M1.5 1a.5.5 0 0 0-.5.5v4a.5.5 0 0 0 1 0V2h3.5a.5.5 0 0 0 0-1h-4zm0 14a.5.5 0 0 1-.5-.5v-4a.5.5 0 0 1 1 0V14h3.5a.5.5 0 0 1 0 1h-4zm13-14a.5.5 0 0 1 .5.5v4a.5.5 0 0 1-1 0V2h-3.5a.5.5 0 0 1 0-1h4zm0 14a.5.5 0 0 0 .5-.5v-4a.5.5 0 0 0-1 0V14h-3.5a.5.5 0 0 0 0 1h4z" />
            </svg>
          )}
        </button>
      )}

      {/* Table Picker Popup */}
      {showTablePicker && (
        <div
          className="table-picker-popup"
          style={{
            position: 'absolute',
            top: `${pickerPosition.top}px`,
            left: `${pickerPosition.left - 40}px`,
            backgroundColor: 'white',
            border: '1px solid #ccc',
            borderRadius: '4px',
            padding: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            zIndex: 1000,
          }}
        >
          <div style={{ marginBottom: '8px', fontSize: '12px', color: '#666' }}>
            {hoveredRows > 0 && hoveredCols > 0
              ? `${hoveredRows} x ${hoveredCols}`
              : 'Select table size'}
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(10, 20px)',
              gap: '2px',
            }}
          >
            {Array.from({ length: 100 }, (_, i) => {
              const row = Math.floor(i / 10) + 1
              const col = (i % 10) + 1
              const isHighlighted = row <= hoveredRows && col <= hoveredCols
              return (
                <div
                  key={i}
                  onMouseEnter={() => {
                    setHoveredRows(row)
                    setHoveredCols(col)
                  }}
                  onClick={() => insertTable(row, col)}
                  style={{
                    width: '20px',
                    height: '20px',
                    border: '1px solid #ddd',
                    backgroundColor: isHighlighted ? '#4a9eff' : 'white',
                    cursor: 'pointer',
                    transition: 'background-color 0.1s',
                  }}
                />
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
