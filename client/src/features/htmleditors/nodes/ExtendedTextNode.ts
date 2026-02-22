import {
  $applyNodeReplacement,
  $isTextNode,
  TextNode,
  type DOMConversion,
  type DOMConversionMap,
  type DOMConversionOutput,
  type LexicalNode,
  type NodeKey,
} from 'lexical'

function collectInlineStyles(element: HTMLElement): string {
  const styles = [
    element.style.color ? `color: ${element.style.color}` : '',
    element.style.backgroundColor ? `background-color: ${element.style.backgroundColor}` : '',
    element.style.fontSize ? `font-size: ${element.style.fontSize}` : '',
  ].filter(Boolean)

  return styles.join('; ')
}

function patchStyleConversion(
  originalDOMConverter?: (node: HTMLElement) => DOMConversion | null
): (node: HTMLElement) => DOMConversionOutput | null {
  return (node) => {
    const original = originalDOMConverter?.(node)

    if (!original) {
      return null
    }

    const originalOutput = original.conversion(node)

    if (!originalOutput) {
      return originalOutput
    }

    const extraStyles = collectInlineStyles(node)

    if (!extraStyles) {
      return originalOutput
    }

    return {
      ...originalOutput,
      forChild: (lexicalNode, parent) => {
        const originalForChild = originalOutput.forChild ?? ((childNode: LexicalNode) => childNode)
        const result = originalForChild(lexicalNode, parent)

        if ($isTextNode(result)) {
          const mergedStyle = [result.getStyle(), extraStyles].filter(Boolean).join('; ')
          return result.setStyle(mergedStyle)
        }

        return result
      },
    }
  }
}

export class ExtendedTextNode extends TextNode {
  static getType(): string {
    return 'extended-text'
  }

  static clone(node: ExtendedTextNode): ExtendedTextNode {
    return new ExtendedTextNode(node.__text, node.__key)
  }

  static importDOM(): DOMConversionMap | null {
    const importers = TextNode.importDOM()

    return {
      ...importers,
      code: () => ({
        conversion: patchStyleConversion(importers?.code),
        priority: 1,
      }),
      em: () => ({
        conversion: patchStyleConversion(importers?.em),
        priority: 1,
      }),
      span: () => ({
        conversion: patchStyleConversion(importers?.span),
        priority: 1,
      }),
      strong: () => ({
        conversion: patchStyleConversion(importers?.strong),
        priority: 1,
      }),
      sub: () => ({
        conversion: patchStyleConversion(importers?.sub),
        priority: 1,
      }),
      sup: () => ({
        conversion: patchStyleConversion(importers?.sup),
        priority: 1,
      }),
    }
  }

  static importJSON(serializedNode: ReturnType<TextNode['exportJSON']>): ExtendedTextNode {
    return $createExtendedTextNode().updateFromJSON(serializedNode)
  }

  isSimpleText(): boolean {
    return this.__type === 'extended-text' && this.__mode === 0
  }

  exportJSON() {
    return {
      ...super.exportJSON(),
      type: 'extended-text',
      version: 1,
    }
  }
}

export function $createExtendedTextNode(text = ''): ExtendedTextNode {
  return $applyNodeReplacement(new ExtendedTextNode(text))
}

export function $isExtendedTextNode(
  node: LexicalNode | null | undefined
): node is ExtendedTextNode {
  return node instanceof ExtendedTextNode
}

export function $createExtendedTextNodeWithKey(text = '', key?: NodeKey): ExtendedTextNode {
  return $applyNodeReplacement(new ExtendedTextNode(text, key))
}