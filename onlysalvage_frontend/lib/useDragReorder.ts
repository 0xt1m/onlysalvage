import { useState } from 'react'

// Native HTML5 drag-and-drop reordering for a list of items in local state.
// Spread `dragHandlers(index)` onto each draggable tile.
export function useDragReorder<T>(items: T[], setItems: (items: T[]) => void) {
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  const dragHandlers = (index: number) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      setDragIndex(index)
      e.dataTransfer.effectAllowed = 'move'
    },
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault()
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault()
      if (dragIndex === null || dragIndex === index) return

      const next = [...items]
      const [moved] = next.splice(dragIndex, 1)
      next.splice(index, 0, moved)
      setItems(next)
      setDragIndex(null)
    },
    onDragEnd: () => setDragIndex(null),
  })

  return { dragIndex, dragHandlers }
}
