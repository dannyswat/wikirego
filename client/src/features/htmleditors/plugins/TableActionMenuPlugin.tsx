import { useCallback, useEffect, useRef, useState } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import {
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_LOW,
  SELECTION_CHANGE_COMMAND,
} from 'lexical'
import {
  $isTableCellNode,
  $isTableRowNode,
  $isTableNode,
  TableCellNode,
  TableNode,
  TableRowNode,
  $getTableRowIndexFromTableCellNode,
  $insertTableColumn__EXPERIMENTAL,
  $insertTableRow__EXPERIMENTAL,
  $deleteTableColumn__EXPERIMENTAL,
  $deleteTableRow__EXPERIMENTAL,
  TableCellHeaderStates,
} from '@lexical/table'
import { $findMatchingParent, mergeRegister } from '@lexical/utils'
import { createPortal } from 'react-dom'

interface MenuPosition {
  x: number
  y: number
  cellElement: HTMLElement
}

function TableActionMenu({
  cellNode,
  onClose,
  position,
}: {
  cellNode: TableCellNode
  onClose: () => void
  position: MenuPosition
}) {
  const [editor] = useLexicalComposerContext()
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  const insertRowAbove = () => {
    editor.update(() => {
      $insertTableRow__EXPERIMENTAL(false)
    })
    onClose()
  }

  const insertRowBelow = () => {
    editor.update(() => {
      $insertTableRow__EXPERIMENTAL(true)
    })
    onClose()
  }

  const insertColumnBefore = () => {
    editor.update(() => {
      $insertTableColumn__EXPERIMENTAL(false)
    })
    onClose()
  }

  const insertColumnAfter = () => {
    editor.update(() => {
      $insertTableColumn__EXPERIMENTAL(true)
    })
    onClose()
  }

  const deleteRow = () => {
    editor.update(() => {
      $deleteTableRow__EXPERIMENTAL()
    })
    onClose()
  }

  const deleteColumn = () => {
    editor.update(() => {
      $deleteTableColumn__EXPERIMENTAL()
    })
    onClose()
  }

  const deleteTable = () => {
    editor.update(() => {
      const tableNode = $findMatchingParent(cellNode, $isTableNode)
      if (tableNode) {
        tableNode.remove()
      }
    })
    onClose()
  }

  const toggleHeaderRow = () => {
    editor.update(() => {
      const tableNode = $findMatchingParent(cellNode, $isTableNode) as TableNode | null
      if (tableNode) {
        const rowIndex = $getTableRowIndexFromTableCellNode(cellNode)
        const rows = tableNode.getChildren()
        const row = rows[rowIndex] as TableRowNode | undefined
        if (row && $isTableRowNode(row)) {
          const cells = row.getChildren()
          cells.forEach((cell) => {
            if ($isTableCellNode(cell)) {
              const currentType = cell.getHeaderStyles()
              if (currentType === TableCellHeaderStates.ROW) {
                cell.setHeaderStyles(TableCellHeaderStates.NO_STATUS)
              } else {
                cell.setHeaderStyles(TableCellHeaderStates.ROW)
              }
            }
          })
        }
      }
    })
    onClose()
  }

  const toggleHeaderColumn = () => {
    editor.update(() => {
      const tableNode = $findMatchingParent(cellNode, $isTableNode) as TableNode | null
      if (tableNode) {
        const rows = tableNode.getChildren()
        const anchorCellKey = cellNode.getKey()
        let columnIndex = -1

        // Find the column index of the selected cell
        rows.some((row) => {
          if ($isTableRowNode(row)) {
            const cells = row.getChildren()
            const index = cells.findIndex((cell) => cell.getKey() === anchorCellKey)
            if (index !== -1) {
              columnIndex = index
              return true
            }
          }
          return false
        })

        if (columnIndex !== -1) {
          // Toggle header for all cells in this column
          rows.forEach((row) => {
            if ($isTableRowNode(row)) {
              const cells = row.getChildren()
              const cell = cells[columnIndex]
              if (cell && $isTableCellNode(cell)) {
                const currentType = cell.getHeaderStyles()
                if (currentType === TableCellHeaderStates.COLUMN) {
                  cell.setHeaderStyles(TableCellHeaderStates.NO_STATUS)
                } else {
                  cell.setHeaderStyles(TableCellHeaderStates.COLUMN)
                }
              }
            }
          })
        }
      }
    })
    onClose()
  }

  return createPortal(
    <div
      ref={menuRef}
      className="table-action-menu"
      style={{
        position: 'absolute',
        left: position.x,
        top: position.y - 40,
        transform: 'translateX(-50%)',
        zIndex: 1000,
      }}
    >
      <button type="button" onClick={insertRowAbove} title="Insert row above">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          <rect x="2" y="2" width="12" height="5" fill="none" stroke="currentColor" strokeWidth="1.5"/>
        </svg>
      </button>
      <button type="button" onClick={insertRowBelow} title="Insert row below">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          <rect x="2" y="9" width="12" height="5" fill="none" stroke="currentColor" strokeWidth="1.5"/>
        </svg>
      </button>
      <button type="button" onClick={insertColumnBefore} title="Insert column before">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          <rect x="2" y="2" width="5" height="12" fill="none" stroke="currentColor" strokeWidth="1.5"/>
        </svg>
      </button>
      <button type="button" onClick={insertColumnAfter} title="Insert column after">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          <rect x="9" y="2" width="5" height="12" fill="none" stroke="currentColor" strokeWidth="1.5"/>
        </svg>
      </button>
      <span className="table-action-divider" />
      <button type="button" onClick={toggleHeaderRow} title="Toggle header row">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <rect x="2" y="2" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5"/>
          <rect x="2" y="2" width="12" height="4" fill="currentColor" opacity="0.3"/>
          <line x1="2" y1="6" x2="14" y2="6" stroke="currentColor" strokeWidth="1.5"/>
        </svg>
      </button>
      <button type="button" onClick={toggleHeaderColumn} title="Toggle header column">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <rect x="2" y="2" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5"/>
          <rect x="2" y="2" width="4" height="12" fill="currentColor" opacity="0.3"/>
          <line x1="6" y1="2" x2="6" y2="14" stroke="currentColor" strokeWidth="1.5"/>
        </svg>
      </button>
      <span className="table-action-divider" />
      <button type="button" onClick={deleteRow} title="Delete row" className="danger">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          <rect x="2" y="6" width="12" height="4" fill="none" stroke="currentColor" strokeWidth="1.5"/>
        </svg>
      </button>
      <button type="button" onClick={deleteColumn} title="Delete column" className="danger">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 3v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          <rect x="6" y="2" width="4" height="12" fill="none" stroke="currentColor" strokeWidth="1.5"/>
        </svg>
      </button>
      <button type="button" onClick={deleteTable} title="Delete table" className="danger">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <line x1="4" y1="4" x2="12" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          <line x1="12" y1="4" x2="4" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </button>
    </div>,
    document.body
  )
}

export default function TableActionMenuPlugin() {
  const [editor] = useLexicalComposerContext()
  const [tableCellNode, setTableCellNode] = useState<TableCellNode | null>(null)
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null)

  const closeMenu = useCallback(() => {
    setTableCellNode(null)
    setMenuPosition(null)
  }, [])

  const updateMenu = useCallback(() => {
    const selection = $getSelection()
    if (!$isRangeSelection(selection)) {
      closeMenu()
      return
    }

    const anchorNode = selection.anchor.getNode()
    const cellNode = $findMatchingParent(anchorNode, $isTableCellNode)

    if (cellNode && $isTableCellNode(cellNode)) {
      const cellElement = editor.getElementByKey(cellNode.getKey())
      if (cellElement) {
        const rect = cellElement.getBoundingClientRect()
        setTableCellNode(cellNode)
        setMenuPosition({
          x: rect.left + rect.width / 2,
          y: rect.top,
          cellElement: cellElement as HTMLElement,
        })
      }
    } else {
      closeMenu()
    }
  }, [editor, closeMenu])

  useEffect(() => {
    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => {
          updateMenu()
        })
      }),
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          updateMenu()
          return false
        },
        COMMAND_PRIORITY_LOW
      )
    )
  }, [editor, updateMenu])

  if (!tableCellNode || !menuPosition) {
    return null
  }

  return (
    <TableActionMenu
      cellNode={tableCellNode}
      onClose={closeMenu}
      position={menuPosition}
    />
  )
}
