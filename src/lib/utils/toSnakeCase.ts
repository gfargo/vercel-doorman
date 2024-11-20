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
  return str
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .toLowerCase()
    .replace(/[^a-zA-Z0-9]+/g, '_')
}
