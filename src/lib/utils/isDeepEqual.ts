/**
 * Compares two values to determine if they are deeply equal.
 *
 * This function performs a deep comparison between two values to determine if they are equivalent.
 * It handles objects, arrays, and primitive values.
 *
 * @param obj1 - The first value to compare.
 * @param obj2 - The second value to compare.
 * @returns `true` if the values are deeply equal, `false` otherwise.
 */
export function isDeepEqual(obj1: unknown, obj2: unknown): boolean {
  if (obj1 === obj2) return true
  if (typeof obj1 !== 'object' || obj1 === null || typeof obj2 !== 'object' || obj2 === null) return false

  const keys1 = Object.keys(obj1)
  const keys2 = Object.keys(obj2)

  if (keys1.length !== keys2.length) return false

  for (const key of keys1) {
    if (
      !keys2.includes(key) ||
      !isDeepEqual((obj1 as Record<string, unknown>)[key], (obj2 as Record<string, unknown>)[key])
    )
      return false
  }

  return true
}
