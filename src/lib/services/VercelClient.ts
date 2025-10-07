/**
 * DEPRECATED: This file is kept for backward compatibility.
 * New code should import from '../providers/vercel' instead.
 *
 * Re-exports VercelClient from the new location in the provider abstraction layer.
 */

export {
  VercelClient,
  VERCEL_API_BASE_URL,
  type ApiResponse,
  type TargetVersionConfig,
  type LatestConfigResponse,
  type VercelConfig,
} from '../providers/vercel/VercelClient'
