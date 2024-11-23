/**
 * Converts a given string to snake_case.
 *
 * This function takes a string as input and performs the following transformations:
 * 1. Inserts a space before each uppercase letter.
 * 2. Trims any leading or trailing whitespace.
 * 3. Converts the entire string to lowercase.
 * 4. Replaces any sequence of non-alphanumeric characters with an underscore.
 *
 * @param str - The input string to be converted to snake_case.
 * @returns The converted snake_case string.
 */
export function convertToSnakeCase(str: string): string {
  // Handle special cases first
  if (!str || str.trim().length === 0) return ''

  // First, handle special word boundaries
  let result = str
    // Add underscore between lowercase and uppercase letters
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    // Add underscore between uppercase letter and lowercase letter
    .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')

  // Handle known acronyms
  const knownAcronyms = ['IP', 'HTTP', 'XML', 'API']
  knownAcronyms.forEach((acronym) => {
    // Look for the acronym at word boundaries
    const regex = new RegExp(`\\b${acronym}\\b`, 'g')
    result = result.replace(regex, acronym.toLowerCase())
  })

  // Handle remaining uppercase sequences
  result = result
    // Split remaining uppercase sequences
    .replace(/[A-Z]{2,}/g, (match) => {
      // If it's a known acronym, keep it together
      if (knownAcronyms.includes(match)) {
        return match.toLowerCase()
      }
      // Otherwise split each letter
      return match.split('').join('_')
    })
    // Convert to lowercase
    .toLowerCase()
    // Replace any non-alphanumeric with underscore
    .replace(/[^a-z0-9]+/g, '_')
    // Remove leading/trailing underscores
    .replace(/^_+|_+$/g, '')
    // Remove duplicate underscores
    .replace(/_+/g, '_')

  // Special case: handle word boundaries before acronyms
  knownAcronyms.forEach((acronym) => {
    const lowerAcronym = acronym.toLowerCase()
    result = result.replace(new RegExp(`([a-z])${lowerAcronym}`, 'g'), `$1_${lowerAcronym}`)
  })

  return result
}
