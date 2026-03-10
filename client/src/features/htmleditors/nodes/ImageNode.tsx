import {
  DecoratorNode,
  type DOMConversionMap,
  type DOMConversionOutput,
  type DOMExportOutput,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
  $getNodeByKey,
  $getSelection,
  $isNodeSelection,
  CLICK_COMMAND,
  COMMAND_PRIORITY_LOW,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
} from 'lexical'
import type { JSX } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useLexicalNodeSelection } from '@lexical/react/useLexicalNodeSelection'
import { mergeRegister } from '@lexical/utils'

export interface ImagePayload {
  src: string
  altText?: string
  width?: number
  height?: number
  key?: NodeKey
}

export type SerializedImageNode = Spread<
  {
    src: string
    altText: string
    width?: number
    height?: number
  },
  SerializedLexicalNode
>

function convertImageElement(domNode: Node): null | DOMConversionOutput {
  if (domNode instanceof HTMLImageElement) {
    const src = domNode.getAttribute('src') || ''
    if (!src) {
      return null
    }
    const altText = domNode.getAttribute('alt') || ''
    const widthAttr = domNode.getAttribute('width')
    const heightAttr = domNode.getAttribute('height')
    const width = widthAttr ? Number(widthAttr) : undefined
    const height = heightAttr ? Number(heightAttr) : undefined
    const node = $createImageNode({ src, altText, width, height })
    return { node }
  }
  return null
}

interface ImageComponentProps {
  src: string
  altText: string
  width?: number
  height?: number
  nodeKey: NodeKey
}

function ImageComponent({ src, altText, width, height, nodeKey }: ImageComponentProps): JSX.Element {
  const [editor] = useLexicalComposerContext()
  const [isSelected, setSelected, clearSelection] = useLexicalNodeSelection(nodeKey)
  const imageRef = useRef<HTMLImageElement>(null)
  const [isResizing, setIsResizing] = useState(false)

  useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        CLICK_COMMAND,
        (event: MouseEvent) => {
          if (isResizing) return false
          if (event.target === imageRef.current) {
            if (!event.shiftKey) {
              clearSelection()
            }
            setSelected(true)
            return true
          }
          return false
        },
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerCommand(
        KEY_DELETE_COMMAND,
        (event: KeyboardEvent): boolean => {
          if (isSelected && $isNodeSelection($getSelection())) {
            event.preventDefault()
            const node = $getNodeByKey(nodeKey)
            if (node) {
              node.remove()
              return true
            }
          }
          return false
        },
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerCommand(
        KEY_BACKSPACE_COMMAND,
        (event: KeyboardEvent): boolean => {
          if (isSelected && $isNodeSelection($getSelection())) {
            event.preventDefault()
            const node = $getNodeByKey(nodeKey)
            if (node) {
              node.remove()
              return true
            }
          }
          return false
        },
        COMMAND_PRIORITY_LOW,
      ),
    )
  }, [editor, isResizing, isSelected, nodeKey, clearSelection, setSelected])

  const onResizeStart = useCallback(
    (event: React.MouseEvent<HTMLSpanElement>, direction: string) => {
      const img = imageRef.current
      if (!img) return
      event.preventDefault()
      event.stopPropagation()

      const startX = event.clientX
      const startWidth = img.getBoundingClientRect().width
      const startHeight = img.getBoundingClientRect().height
      const aspectRatio = startHeight / startWidth

      setIsResizing(true)

      const onMouseMove = (e: MouseEvent) => {
        const dx = e.clientX - startX
        let newWidth: number
        if (direction === 'se' || direction === 'ne') {
          newWidth = Math.max(50, startWidth + dx)
        } else {
          newWidth = Math.max(50, startWidth - dx)
        }
        const newHeight = Math.round(newWidth * aspectRatio)
        img.style.width = `${newWidth}px`
        img.style.height = `${newHeight}px`
      }

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
        setIsResizing(false)
        if (!imageRef.current) return
        const finalWidth = Math.round(imageRef.current.getBoundingClientRect().width)
        const finalHeight = Math.round(imageRef.current.getBoundingClientRect().height)
        editor.update(() => {
          const node = $getNodeByKey(nodeKey)
          if (node instanceof ImageNode) {
            node.setWidthAndHeight(finalWidth, finalHeight)
          }
        })
      }

      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    },
    [editor, nodeKey],
  )

  return (
    <span className={`editor-image-container${isSelected || isResizing ? ' selected' : ''}`}>
      <img
        ref={imageRef}
        src={src}
        alt={altText}
        width={width}
        height={height}
        className="editor-image"
        draggable={false}
      />
      {(isSelected || isResizing) && (
        <>
          <span className="image-resize-handle image-resize-ne" onMouseDown={(e) => onResizeStart(e, 'ne')} />
          <span className="image-resize-handle image-resize-nw" onMouseDown={(e) => onResizeStart(e, 'nw')} />
          <span className="image-resize-handle image-resize-se" onMouseDown={(e) => onResizeStart(e, 'se')} />
          <span className="image-resize-handle image-resize-sw" onMouseDown={(e) => onResizeStart(e, 'sw')} />
        </>
      )}
    </span>
  )
}

export class ImageNode extends DecoratorNode<JSX.Element> {
  __src: string
  __altText: string
  __width: number | undefined
  __height: number | undefined

  static getType(): string {
    return 'image'
  }

  static clone(node: ImageNode): ImageNode {
    return new ImageNode(
      node.__src,
      node.__altText,
      node.__width,
      node.__height,
      node.__key
    )
  }

  static importJSON(serializedNode: SerializedImageNode): ImageNode {
    const { src, altText, width, height } = serializedNode
    return $createImageNode({ src, altText, width, height })
  }

  static importDOM(): DOMConversionMap | null {
    return {
      img: () => ({
        conversion: convertImageElement,
        priority: 0,
      }),
    }
  }

  constructor(
    src: string,
    altText: string = '',
    width?: number,
    height?: number,
    key?: NodeKey
  ) {
    super(key)
    this.__src = src
    this.__altText = altText
    this.__width = width
    this.__height = height
  }

  exportJSON(): SerializedImageNode {
    return {
      type: 'image',
      version: 1,
      src: this.__src,
      altText: this.__altText,
      width: this.__width,
      height: this.__height,
    }
  }

  exportDOM(): DOMExportOutput {
    const img = document.createElement('img')
    img.setAttribute('src', this.__src)
    img.setAttribute('alt', this.__altText)
    if (this.__width) {
      img.setAttribute('width', String(this.__width))
    }
    if (this.__height) {
      img.setAttribute('height', String(this.__height))
    }
    img.style.maxWidth = '100%'
    return { element: img }
  }

  createDOM(): HTMLElement {
    const span = document.createElement('span')
    span.className = 'editor-image-wrapper'
    return span
  }

  updateDOM(): false {
    return false
  }

  getSrc(): string {
    return this.__src
  }

  getAltText(): string {
    return this.__altText
  }

  setWidthAndHeight(width: number | undefined, height: number | undefined): void {
    const writable = this.getWritable()
    writable.__width = width
    writable.__height = height
  }

  decorate(): JSX.Element {
    return (
      <ImageComponent
        src={this.__src}
        altText={this.__altText}
        width={this.__width}
        height={this.__height}
        nodeKey={this.__key}
      />
    )
  }
}

export function $createImageNode({
  src,
  altText = '',
  width,
  height,
  key,
}: ImagePayload): ImageNode {
  return new ImageNode(src, altText, width, height, key)
}

export function $isImageNode(
  node: LexicalNode | null | undefined
): node is ImageNode {
  return node instanceof ImageNode
}
