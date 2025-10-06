/**
 * Calculates dynamic column widths based on available terminal width
 *
 * @param terminalWidth - Current terminal width in characters
 * @param minWidths - Array of minimum widths for each column
 * @param maxWidths - Array of maximum widths for each column (null for unlimited)
 * @param flexColumns - Array of column indices that can be resized
 * @returns Array of calculated column widths
 * @throws Error if configuration is invalid
 */
export const calculateDynamicColWidths = (
  terminalWidth: number | undefined,
  minWidths: number[],
  maxWidths: (number | null)[],
  flexColumns: number[],
): number[] => {
  // Validate inputs
  if (!minWidths.length) {
    throw new Error('minWidths array cannot be empty')
  }

  if (flexColumns.some((col) => col >= minWidths.length)) {
    throw new Error('flexColumns contains invalid column index')
  }

  if (minWidths.length !== maxWidths.length) {
    throw new Error('minWidths and maxWidths arrays must have the same length')
  }

  // Validate min/max relationships
  minWidths.forEach((min, index) => {
    const max = maxWidths[index]
    if (max !== undefined && max !== null && min > max) {
      throw new Error(`Column ${index} has minimum width (${min}) greater than maximum width (${max})`)
    }
  })

  // Default terminal width if not available
  const maxWidth = terminalWidth || 400
  const colWidths = [...minWidths]
  const totalMinWidth = minWidths.reduce((sum, width) => sum + width, 0)
  let remainingWidth = maxWidth - totalMinWidth - 28 // Leave some padding for status and padding

  if (remainingWidth > 0 && flexColumns.length > 0) {
    // Keep track of which columns can still grow
    let availableFlexColumns = flexColumns.filter((colIndex) => {
      const maxWidth = maxWidths[colIndex]
      const colWidth = colWidths[colIndex]
      return maxWidth !== undefined && colWidth !== undefined && (maxWidth === null || colWidth < maxWidth)
    })

    while (remainingWidth > 0 && availableFlexColumns.length > 0) {
      const extraWidthPerColumn = Math.floor(remainingWidth / availableFlexColumns.length)
      if (extraWidthPerColumn === 0) break

      let usedWidth = 0

      availableFlexColumns = availableFlexColumns.filter((colIndex) => {
        const maxWidth = maxWidths[colIndex]
        const currentWidth = colWidths[colIndex]

        if (maxWidth === null) {
          if (colWidths[colIndex] !== undefined) {
            colWidths[colIndex] += extraWidthPerColumn
          }
          usedWidth += extraWidthPerColumn
          return true
        } else {
          const availableSpace = (maxWidth ?? 0) - (currentWidth ?? 0)
          if (availableSpace <= 0) return false

          const addedWidth = Math.min(extraWidthPerColumn, availableSpace)
          if (colWidths[colIndex] !== undefined) {
            colWidths[colIndex] += addedWidth
          }
          usedWidth += addedWidth
          return addedWidth === extraWidthPerColumn
        }
      })

      remainingWidth -= usedWidth
    }

    // If we still have remaining width and at least one unlimited column,
    // add the remainder to the last unlimited column
    if (remainingWidth > 0) {
      const lastUnlimitedCol = flexColumns.findLast((colIndex) => maxWidths[colIndex] === null)
      if (lastUnlimitedCol !== undefined) {
        if (lastUnlimitedCol !== undefined && colWidths[lastUnlimitedCol] !== undefined) {
          colWidths[lastUnlimitedCol] += remainingWidth
        }
      }
    }
  }

  return colWidths
}
