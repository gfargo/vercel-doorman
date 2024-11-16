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
