import { describe, expect, it } from '@jest/globals'
import { PHP_CONTROL_PANEL_PATHS, WORDPRESS_PATHS, createDoorman } from './index'

describe('Library Exports', () => {
  describe('Blocked Paths Constants', () => {
    it('should export WORDPRESS_PATHS as an array of strings', () => {
      expect(Array.isArray(WORDPRESS_PATHS)).toBe(true)
      expect(WORDPRESS_PATHS.length).toBeGreaterThan(0)
      WORDPRESS_PATHS.forEach((path) => {
        expect(typeof path).toBe('string')
        expect(path.startsWith('/')).toBe(true)
      })
    })

    it('should export PHP_CONTROL_PANEL_PATHS as an array of strings', () => {
      expect(Array.isArray(PHP_CONTROL_PANEL_PATHS)).toBe(true)
      expect(PHP_CONTROL_PANEL_PATHS.length).toBeGreaterThan(0)
      PHP_CONTROL_PANEL_PATHS.forEach((path) => {
        expect(typeof path).toBe('string')
        expect(path.startsWith('/')).toBe(true)
      })
    })

    it('should not have duplicate paths across constants', () => {
      const allPaths = new Set([...WORDPRESS_PATHS, ...PHP_CONTROL_PANEL_PATHS])
      expect(allPaths.size).toBe(WORDPRESS_PATHS.length + PHP_CONTROL_PANEL_PATHS.length)
    })
  })

  describe('createDoorman Function', () => {
    it('should export createDoorman as a function', () => {
      expect(typeof createDoorman).toBe('function')
    })

    it('should create a middleware that blocks specified paths', () => {
      const paths = ['/test', '/admin']
      const doorman = createDoorman(paths)

      expect(doorman({ nextUrl: { pathname: '/test/page' } })).toBe(true)
      expect(doorman({ nextUrl: { pathname: '/admin/dashboard' } })).toBe(true)
      expect(doorman({ nextUrl: { pathname: '/public/page' } })).toBe(false)
    })

    it('should handle empty paths array', () => {
      const doorman = createDoorman([])
      expect(doorman({ nextUrl: { pathname: '/any/path' } })).toBe(false)
    })

    it('should work with the exported path constants', () => {
      const doorman = createDoorman([...WORDPRESS_PATHS, ...PHP_CONTROL_PANEL_PATHS])

      // Should block WordPress paths
      expect(doorman({ nextUrl: { pathname: '/wp-admin/index.php' } })).toBe(true)
      expect(doorman({ nextUrl: { pathname: '/wp-login.php' } })).toBe(true)

      // Should block PHP control panel paths
      expect(doorman({ nextUrl: { pathname: '/ws.php' } })).toBe(true)
      expect(doorman({ nextUrl: { pathname: '/img/xmrlpc.php' } })).toBe(true)

      // Should not block legitimate paths
      expect(doorman({ nextUrl: { pathname: '/api/data' } })).toBe(false)
      expect(doorman({ nextUrl: { pathname: '/blog/post-1' } })).toBe(false)
    })
  })
})
