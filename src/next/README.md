# Using `doorman` in NextJS Middleware

```typescript
import { NextResponse, type NextRequest } from 'next/server'
import { createDoorman } from '../createDoorman'
import { WORDPRESS_PATHS, PHP_CONTROL_PANEL_PATHS } from '../../constants/blockedPaths'

const doorman = createDoorman([...WORDPRESS_PATHS, ...PHP_CONTROL_PANEL_PATHS])

export function handleRequest(request: NextRequest) {
  // Add a doorman to block requests
  if (doorman(request)) {
    // Log the blocked request
    // ... analyze the logs
    // ... and adjust the doorman
    return NextResponse.redirect(new URL('/not-found', request.url))
  }

  return request
}
```
