import consola from 'consola'

/**
 * Prompts the user with a message and options, and returns the user's response.
 * If the user cancels the prompt, the process exits with code 0.
 *
 * @note This is a wrapper to exit the process if the user presses CTRL+C.
 *
 * @param message - The message to display to the user.
 * @param options - The options to provide to the prompt.
 * @returns The user's response.
 */
export const prompt: typeof consola.prompt = async (message, options) => {
  const response = await consola.prompt(message, options)

  if (response.toString() === 'Symbol(clack:cancel)') {
    process.exit(0)
  }
  return response
}
