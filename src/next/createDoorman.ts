import { NextRequest } from 'next/server'

export function createDoorman(paths: string[]) {
  return (request: NextRequest) => {
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
