/**
 * Creates a doorman function that checks if a request's pathname matches any of the provided paths.
 *
 * @param paths - An array of string paths to block. If a request's pathname starts with any of these paths, the doorman will block the request.
 * @returns A function that takes a request object containing a nextUrl.pathname and returns a boolean indicating whether the request should be blocked.
 *
 * @example
 * ```typescript
 * const doorman = createDoorman(['/admin', '/private']);
 * const isBlocked = doorman({ nextUrl: { pathname: '/admin/dashboard' } });
 * // isBlocked will be true
 * ```
 */
export function createDoorman(paths: string[]) {
  return (request: {
    nextUrl: {
      pathname: string
    }
  }) => {
    let blocked = false

    for (const path of paths) {
      if (request.nextUrl.pathname.startsWith(path)) {
        blocked = true
        break
      }
    }

    return blocked
  }
}
