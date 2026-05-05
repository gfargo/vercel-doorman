import { CompatibilityMatrix } from '../compatibility'

describe('CompatibilityMatrix', () => {
  describe('getActionCompatibility', () => {
    it('returns full support for deny on vercel', () => {
      const compat = CompatibilityMatrix.getActionCompatibility('deny', 'vercel')
      expect(compat.level).toBe('full')
    })

    it('returns full support for deny on cloudflare with notes', () => {
      const compat = CompatibilityMatrix.getActionCompatibility('deny', 'cloudflare')
      expect(compat.level).toBe('full')
      expect(compat.notes).toContain('block')
    })

    it('returns partial support for bypass on cloudflare', () => {
      const compat = CompatibilityMatrix.getActionCompatibility('bypass', 'cloudflare')
      expect(compat.level).toBe('partial')
      expect(compat.limitations).toBeDefined()
    })

    it('returns not-supported for block on vercel', () => {
      const compat = CompatibilityMatrix.getActionCompatibility('block', 'vercel')
      expect(compat.level).toBe('not-supported')
    })

    it('returns not-supported for allow on vercel', () => {
      const compat = CompatibilityMatrix.getActionCompatibility('allow', 'vercel')
      expect(compat.level).toBe('not-supported')
    })

    it('returns not-supported for unknown action', () => {
      const compat = CompatibilityMatrix.getActionCompatibility('unknown' as any, 'vercel')
      expect(compat.level).toBe('not-supported')
    })
  })

  describe('getFieldCompatibility', () => {
    it('returns full support for path on both providers', () => {
      expect(CompatibilityMatrix.getFieldCompatibility('path', 'vercel').level).toBe('full')
      expect(CompatibilityMatrix.getFieldCompatibility('path', 'cloudflare').level).toBe('full')
    })

    it('returns not-supported for environment on cloudflare', () => {
      const compat = CompatibilityMatrix.getFieldCompatibility('environment', 'cloudflare')
      expect(compat.level).toBe('not-supported')
    })

    it('returns not-supported for ja4_digest on cloudflare', () => {
      const compat = CompatibilityMatrix.getFieldCompatibility('ja4_digest', 'cloudflare')
      expect(compat.level).toBe('not-supported')
    })

    it('returns partial support for protocol on cloudflare', () => {
      const compat = CompatibilityMatrix.getFieldCompatibility('protocol', 'cloudflare')
      expect(compat.level).toBe('partial')
    })

    it('returns not-supported for unknown field', () => {
      const compat = CompatibilityMatrix.getFieldCompatibility('unknown' as any, 'vercel')
      expect(compat.level).toBe('not-supported')
    })
  })

  describe('isActionSupported', () => {
    it('returns true for supported actions', () => {
      expect(CompatibilityMatrix.isActionSupported('deny', 'vercel')).toBe(true)
      expect(CompatibilityMatrix.isActionSupported('deny', 'cloudflare')).toBe(true)
      expect(CompatibilityMatrix.isActionSupported('challenge', 'vercel')).toBe(true)
    })

    it('returns false for unsupported actions', () => {
      expect(CompatibilityMatrix.isActionSupported('block', 'vercel')).toBe(false)
      expect(CompatibilityMatrix.isActionSupported('allow', 'vercel')).toBe(false)
    })

    it('returns true for partially supported actions', () => {
      expect(CompatibilityMatrix.isActionSupported('bypass', 'cloudflare')).toBe(true)
    })
  })

  describe('isFieldSupported', () => {
    it('returns true for supported fields', () => {
      expect(CompatibilityMatrix.isFieldSupported('path', 'cloudflare')).toBe(true)
      expect(CompatibilityMatrix.isFieldSupported('ip_address', 'cloudflare')).toBe(true)
    })

    it('returns false for unsupported fields', () => {
      expect(CompatibilityMatrix.isFieldSupported('environment', 'cloudflare')).toBe(false)
      expect(CompatibilityMatrix.isFieldSupported('ja4_digest', 'cloudflare')).toBe(false)
    })
  })

  describe('getUnsupportedActions', () => {
    it('returns unsupported actions for vercel', () => {
      const unsupported = CompatibilityMatrix.getUnsupportedActions('vercel')
      expect(unsupported).toContain('block')
      expect(unsupported).toContain('allow')
      expect(unsupported).not.toContain('deny')
    })

    it('returns empty or minimal list for cloudflare', () => {
      const unsupported = CompatibilityMatrix.getUnsupportedActions('cloudflare')
      expect(unsupported).not.toContain('block')
      expect(unsupported).not.toContain('deny')
    })
  })

  describe('getUnsupportedFields', () => {
    it('returns unsupported fields for cloudflare', () => {
      const unsupported = CompatibilityMatrix.getUnsupportedFields('cloudflare')
      expect(unsupported).toContain('environment')
      expect(unsupported).toContain('ja4_digest')
      expect(unsupported).toContain('ja3_digest')
      expect(unsupported).toContain('rate_limit_api_id')
      expect(unsupported).not.toContain('path')
    })
  })

  describe('getMigrationReport', () => {
    it('generates report for vercel to cloudflare migration', () => {
      const report = CompatibilityMatrix.getMigrationReport('vercel', 'cloudflare')

      expect(report.fullySupported.length).toBeGreaterThan(0)
      expect(report.notSupported.length).toBeGreaterThan(0)
      expect(report.warnings.length).toBeGreaterThan(0)

      // environment should be not supported
      expect(report.notSupported).toContainEqual(expect.stringContaining('environment'))
    })

    it('generates report for cloudflare to vercel migration', () => {
      const report = CompatibilityMatrix.getMigrationReport('cloudflare', 'vercel')

      expect(report.fullySupported.length).toBeGreaterThan(0)
      // block and allow are cloudflare-only actions
      expect(report.notSupported).toContainEqual(expect.stringContaining('block'))
      expect(report.notSupported).toContainEqual(expect.stringContaining('allow'))
    })

    it('includes partially supported items', () => {
      const report = CompatibilityMatrix.getMigrationReport('vercel', 'cloudflare')
      // bypass is partially supported on cloudflare
      expect(report.partiallySupported).toContainEqual(expect.stringContaining('bypass'))
    })

    it('includes warnings with notes', () => {
      const report = CompatibilityMatrix.getMigrationReport('vercel', 'cloudflare')
      expect(report.warnings.length).toBeGreaterThan(0)
    })
  })
})
