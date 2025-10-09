import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { CloudflareClient } from '../CloudflareClient'
import type {
  CloudflareRuleset,
  CloudflareAPIResponse,
  CloudflareList,
  CloudflareListItem,
} from '../../../types/cloudflare'

// Helper to build Response-like objects
const makeResponse = (init: {
  ok: boolean
  status: number
  statusText?: string
  jsonBody?: unknown
  headers?: Record<string, string>
}): Response => {
  const headers = new Headers(init.headers || {})
  const body = init.jsonBody
  const res = {
    ok: init.ok,
    status: init.status,
    statusText: init.statusText || '',
    headers,
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  } as unknown as Response
  return res
}

describe('CloudflareClient', () => {
  const API_TOKEN = 'test-token'
  const ZONE_ID = 'test-zone-id'
  const ACCOUNT_ID = 'test-account-id'

  let client: CloudflareClient
  let fetchMock: jest.SpiedFunction<typeof fetch>

  beforeEach(() => {
    client = new CloudflareClient(API_TOKEN, ZONE_ID, ACCOUNT_ID)
    fetchMock = jest.spyOn(globalThis, 'fetch')
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('Authentication', () => {
    it('should include Bearer token in Authorization header', async () => {
      const mockResponse: CloudflareAPIResponse<CloudflareRuleset[]> = {
        success: true,
        errors: [],
        messages: [],
        result: [],
      }

      fetchMock.mockResolvedValueOnce(makeResponse({ ok: true, status: 200, jsonBody: mockResponse }))

      await client.listRulesets()

      expect(fetchMock).toHaveBeenCalledTimes(1)
      const callArgs = fetchMock.mock.calls[0]
      const requestInit = callArgs?.[1] as RequestInit
      const headers = requestInit.headers as Record<string, string>
      expect(headers['Authorization']).toBe(`Bearer ${API_TOKEN}`)
    })
  })

  describe('Ruleset Operations', () => {
    it('should list all rulesets', async () => {
      const mockRulesets: CloudflareRuleset[] = [
        {
          id: 'ruleset-1',
          name: 'Test Ruleset',
          description: 'Test Description',
          kind: 'custom',
          phase: 'http_request_firewall_custom',
          version: '1',
          rules: [],
        },
      ]

      const mockResponse: CloudflareAPIResponse<CloudflareRuleset[]> = {
        success: true,
        errors: [],
        messages: [],
        result: mockRulesets,
      }

      fetchMock.mockResolvedValueOnce(makeResponse({ ok: true, status: 200, jsonBody: mockResponse }))

      const result = await client.listRulesets()

      expect(result).toEqual(mockRulesets)
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(fetchMock.mock.calls[0]?.[0]).toContain(`/zones/${ZONE_ID}/rulesets`)
    })

    it('should get a specific ruleset by ID', async () => {
      const mockRuleset: CloudflareRuleset = {
        id: 'ruleset-1',
        name: 'Test Ruleset',
        description: 'Test Description',
        kind: 'custom',
        phase: 'http_request_firewall_custom',
        version: '1',
        rules: [],
      }

      const mockResponse: CloudflareAPIResponse<CloudflareRuleset> = {
        success: true,
        errors: [],
        messages: [],
        result: mockRuleset,
      }

      fetchMock.mockResolvedValueOnce(makeResponse({ ok: true, status: 200, jsonBody: mockResponse }))

      const result = await client.getRuleset('ruleset-1')

      expect(result).toEqual(mockRuleset)
      expect(fetchMock.mock.calls[0]?.[0]).toContain(`/zones/${ZONE_ID}/rulesets/ruleset-1`)
    })

    it('should create a new ruleset', async () => {
      const newRuleset = {
        name: 'New Ruleset',
        kind: 'custom' as const,
        phase: 'http_request_firewall_custom' as const,
        description: 'New Description',
        rules: [],
      }

      const mockRuleset: CloudflareRuleset = {
        id: 'new-ruleset-id',
        ...newRuleset,
        version: '1',
      }

      const mockResponse: CloudflareAPIResponse<CloudflareRuleset> = {
        success: true,
        errors: [],
        messages: [],
        result: mockRuleset,
      }

      fetchMock.mockResolvedValueOnce(makeResponse({ ok: true, status: 200, jsonBody: mockResponse }))

      const result = await client.createRuleset(newRuleset)

      expect(result).toEqual(mockRuleset)
      expect(fetchMock.mock.calls[0]?.[0]).toContain(`/zones/${ZONE_ID}/rulesets`)
    })

    it('should update an existing ruleset', async () => {
      const updateData = {
        rules: [
          {
            id: 'rule-1',
            action: 'block' as const,
            expression: 'http.request.uri.path eq "/blocked"',
            description: 'Block specific path',
            enabled: true,
          },
        ],
      }

      const mockRuleset: CloudflareRuleset = {
        id: 'ruleset-1',
        name: 'Test Ruleset',
        description: 'Test Description',
        kind: 'custom',
        phase: 'http_request_firewall_custom',
        version: '2',
        rules: updateData.rules,
      }

      const mockResponse: CloudflareAPIResponse<CloudflareRuleset> = {
        success: true,
        errors: [],
        messages: [],
        result: mockRuleset,
      }

      fetchMock.mockResolvedValueOnce(makeResponse({ ok: true, status: 200, jsonBody: mockResponse }))

      const result = await client.updateRuleset('ruleset-1', updateData)

      expect(result.version).toBe('2')
      expect(fetchMock.mock.calls[0]?.[0]).toContain(`/zones/${ZONE_ID}/rulesets/ruleset-1`)
    })

    it('should delete a ruleset', async () => {
      const mockResponse: CloudflareAPIResponse<void> = {
        success: true,
        errors: [],
        messages: [],
        result: undefined,
      }

      fetchMock.mockResolvedValueOnce(makeResponse({ ok: true, status: 200, jsonBody: mockResponse }))

      await client.deleteRuleset('ruleset-1')

      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(fetchMock.mock.calls[0]?.[0]).toContain(`/zones/${ZONE_ID}/rulesets/ruleset-1`)
    })

    it('should handle API errors when listing rulesets', async () => {
      const mockResponse: CloudflareAPIResponse<CloudflareRuleset[]> = {
        success: false,
        errors: [{ code: 7003, message: 'Authentication failed' }],
        messages: [],
        result: [],
      }

      fetchMock.mockResolvedValueOnce(makeResponse({ ok: true, status: 403, jsonBody: mockResponse }))

      await expect(client.listRulesets()).rejects.toThrow('Authentication failed')
    })
  })

  describe('Rule Operations', () => {
    it('should create a rule in a ruleset', async () => {
      const newRule = {
        action: 'block' as const,
        expression: 'http.request.uri.path eq "/api/test"',
        description: 'Block test API',
      }

      const mockRuleset: CloudflareRuleset = {
        id: 'ruleset-1',
        name: 'Test Ruleset',
        description: 'Test Description',
        kind: 'custom',
        phase: 'http_request_firewall_custom',
        version: '2',
        rules: [{ ...newRule, id: 'rule-1' }],
      }

      const mockResponse: CloudflareAPIResponse<CloudflareRuleset> = {
        success: true,
        errors: [],
        messages: [],
        result: mockRuleset,
      }

      fetchMock.mockResolvedValueOnce(makeResponse({ ok: true, status: 200, jsonBody: mockResponse }))

      const result = await client.createRule('ruleset-1', newRule)

      expect(result.rules).toHaveLength(1)
      expect(fetchMock.mock.calls[0]?.[0]).toContain(`/zones/${ZONE_ID}/rulesets/ruleset-1/rules`)
    })

    it('should update a rule in a ruleset', async () => {
      const updateData = {
        action: 'challenge' as const,
        expression: 'http.request.uri.path eq "/api/test"',
        description: 'Challenge test API',
      }

      const mockRuleset: CloudflareRuleset = {
        id: 'ruleset-1',
        name: 'Test Ruleset',
        description: 'Test Description',
        kind: 'custom',
        phase: 'http_request_firewall_custom',
        version: '3',
        rules: [{ ...updateData, id: 'rule-1' }],
      }

      const mockResponse: CloudflareAPIResponse<CloudflareRuleset> = {
        success: true,
        errors: [],
        messages: [],
        result: mockRuleset,
      }

      fetchMock.mockResolvedValueOnce(makeResponse({ ok: true, status: 200, jsonBody: mockResponse }))

      const result = await client.updateRule('ruleset-1', 'rule-1', updateData)

      expect(result.rules[0]?.action).toBe('challenge')
      expect(fetchMock.mock.calls[0]?.[0]).toContain(`/zones/${ZONE_ID}/rulesets/ruleset-1/rules/rule-1`)
    })

    it('should delete a rule from a ruleset', async () => {
      const mockRuleset: CloudflareRuleset = {
        id: 'ruleset-1',
        name: 'Test Ruleset',
        description: 'Test Description',
        kind: 'custom',
        phase: 'http_request_firewall_custom',
        version: '4',
        rules: [],
      }

      const mockResponse: CloudflareAPIResponse<CloudflareRuleset> = {
        success: true,
        errors: [],
        messages: [],
        result: mockRuleset,
      }

      fetchMock.mockResolvedValueOnce(makeResponse({ ok: true, status: 200, jsonBody: mockResponse }))

      const result = await client.deleteRule('ruleset-1', 'rule-1')

      expect(result.rules).toHaveLength(0)
      expect(fetchMock.mock.calls[0]?.[0]).toContain(`/zones/${ZONE_ID}/rulesets/ruleset-1/rules/rule-1`)
    })
  })

  describe('getOrCreateFirewallRuleset', () => {
    it('should return existing custom firewall ruleset', async () => {
      const existingRuleset: CloudflareRuleset = {
        id: 'existing-ruleset',
        name: 'Existing Ruleset',
        description: 'Existing Description',
        kind: 'custom',
        phase: 'http_request_firewall_custom',
        version: '1',
        rules: [],
      }

      const mockResponse: CloudflareAPIResponse<CloudflareRuleset[]> = {
        success: true,
        errors: [],
        messages: [],
        result: [existingRuleset],
      }

      fetchMock.mockResolvedValueOnce(makeResponse({ ok: true, status: 200, jsonBody: mockResponse }))

      const result = await client.getOrCreateFirewallRuleset()

      expect(result).toEqual(existingRuleset)
      expect(fetchMock).toHaveBeenCalledTimes(1) // Only list, no create
    })

    it('should create new custom firewall ruleset if none exists', async () => {
      const listResponse: CloudflareAPIResponse<CloudflareRuleset[]> = {
        success: true,
        errors: [],
        messages: [],
        result: [], // No existing rulesets
      }

      const newRuleset: CloudflareRuleset = {
        id: 'new-ruleset',
        name: 'Doorman Custom Firewall Rules',
        description: 'Custom firewall rules managed by Vercel Doorman',
        kind: 'custom',
        phase: 'http_request_firewall_custom',
        version: '1',
        rules: [],
      }

      const createResponse: CloudflareAPIResponse<CloudflareRuleset> = {
        success: true,
        errors: [],
        messages: [],
        result: newRuleset,
      }

      fetchMock
        .mockResolvedValueOnce(makeResponse({ ok: true, status: 200, jsonBody: listResponse }))
        .mockResolvedValueOnce(makeResponse({ ok: true, status: 200, jsonBody: createResponse }))

      const result = await client.getOrCreateFirewallRuleset()

      expect(result.name).toBe('Doorman Custom Firewall Rules')
      expect(fetchMock).toHaveBeenCalledTimes(2) // List + create
    })
  })

  describe('verifyCredentials', () => {
    it('should return true for valid credentials', async () => {
      const mockResponse: CloudflareAPIResponse<CloudflareRuleset[]> = {
        success: true,
        errors: [],
        messages: [],
        result: [],
      }

      fetchMock.mockResolvedValueOnce(makeResponse({ ok: true, status: 200, jsonBody: mockResponse }))

      const result = await client.verifyCredentials()

      expect(result).toBe(true)
    })

    it('should return false for invalid credentials', async () => {
      fetchMock.mockRejectedValueOnce(new Error('Authentication failed'))

      const result = await client.verifyCredentials()

      expect(result).toBe(false)
    })
  })

  describe('getZoneInfo', () => {
    it('should fetch zone information', async () => {
      const mockZoneInfo = {
        id: ZONE_ID,
        name: 'example.com',
      }

      const mockResponse: CloudflareAPIResponse<{ id: string; name: string }> = {
        success: true,
        errors: [],
        messages: [],
        result: mockZoneInfo,
      }

      fetchMock.mockResolvedValueOnce(makeResponse({ ok: true, status: 200, jsonBody: mockResponse }))

      const result = await client.getZoneInfo()

      expect(result).toEqual(mockZoneInfo)
      expect(fetchMock.mock.calls[0]?.[0]).toContain(`/zones/${ZONE_ID}`)
    })
  })

  describe('Lists API Operations', () => {
    it('should list all Lists', async () => {
      const mockLists: CloudflareList[] = [
        {
          id: 'list-1',
          name: 'Test List',
          description: 'Test Description',
          kind: 'ip',
          num_items: 5,
          num_referencing_filters: 1,
          created_on: '2024-01-01T00:00:00Z',
          modified_on: '2024-01-01T00:00:00Z',
        },
      ]

      const mockResponse: CloudflareAPIResponse<CloudflareList[]> = {
        success: true,
        errors: [],
        messages: [],
        result: mockLists,
      }

      fetchMock.mockResolvedValueOnce(makeResponse({ ok: true, status: 200, jsonBody: mockResponse }))

      const result = await client.listLists()

      expect(result).toEqual(mockLists)
      expect(fetchMock.mock.calls[0]?.[0]).toContain(`/accounts/${ACCOUNT_ID}/rules/lists`)
    })

    it('should return empty array if no account ID provided', async () => {
      const clientWithoutAccount = new CloudflareClient(API_TOKEN, ZONE_ID)

      const result = await clientWithoutAccount.listLists()

      expect(result).toEqual([])
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('should get a specific List by ID', async () => {
      const mockList: CloudflareList = {
        id: 'list-1',
        name: 'Test List',
        description: 'Test Description',
        kind: 'ip',
        num_items: 5,
        num_referencing_filters: 1,
        created_on: '2024-01-01T00:00:00Z',
        modified_on: '2024-01-01T00:00:00Z',
      }

      const mockResponse: CloudflareAPIResponse<CloudflareList> = {
        success: true,
        errors: [],
        messages: [],
        result: mockList,
      }

      fetchMock.mockResolvedValueOnce(makeResponse({ ok: true, status: 200, jsonBody: mockResponse }))

      const result = await client.getList('list-1')

      expect(result).toEqual(mockList)
    })

    it('should throw error when getting List without account ID', async () => {
      const clientWithoutAccount = new CloudflareClient(API_TOKEN, ZONE_ID)

      await expect(clientWithoutAccount.getList('list-1')).rejects.toThrow('Account ID required')
    })

    it('should create a new List', async () => {
      const newList = {
        name: 'New List',
        description: 'New Description',
        kind: 'ip' as const,
      }

      const mockList: CloudflareList = {
        id: 'new-list-id',
        ...newList,
        num_items: 0,
        num_referencing_filters: 0,
        created_on: '2024-01-01T00:00:00Z',
        modified_on: '2024-01-01T00:00:00Z',
      }

      const mockResponse: CloudflareAPIResponse<CloudflareList> = {
        success: true,
        errors: [],
        messages: [],
        result: mockList,
      }

      fetchMock.mockResolvedValueOnce(makeResponse({ ok: true, status: 200, jsonBody: mockResponse }))

      const result = await client.createList(newList)

      expect(result).toEqual(mockList)
    })

    it('should update a List', async () => {
      const updateData = {
        description: 'Updated Description',
      }

      const mockList: CloudflareList = {
        id: 'list-1',
        name: 'Test List',
        description: 'Updated Description',
        kind: 'ip',
        num_items: 5,
        num_referencing_filters: 1,
        created_on: '2024-01-01T00:00:00Z',
        modified_on: '2024-01-02T00:00:00Z',
      }

      const mockResponse: CloudflareAPIResponse<CloudflareList> = {
        success: true,
        errors: [],
        messages: [],
        result: mockList,
      }

      fetchMock.mockResolvedValueOnce(makeResponse({ ok: true, status: 200, jsonBody: mockResponse }))

      const result = await client.updateList('list-1', updateData)

      expect(result.description).toBe('Updated Description')
    })

    it('should delete a List', async () => {
      const mockResponse: CloudflareAPIResponse<void> = {
        success: true,
        errors: [],
        messages: [],
        result: undefined,
      }

      fetchMock.mockResolvedValueOnce(makeResponse({ ok: true, status: 200, jsonBody: mockResponse }))

      await client.deleteList('list-1')

      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('should get List items', async () => {
      const mockItems: CloudflareListItem[] = [
        {
          id: 'item-1',
          ip: '192.168.1.1',
          comment: 'Test IP',
          created_on: '2024-01-01T00:00:00Z',
          modified_on: '2024-01-01T00:00:00Z',
        },
      ]

      const mockResponse = {
        success: true,
        errors: [],
        messages: [],
        result: mockItems,
      }

      fetchMock.mockResolvedValueOnce(makeResponse({ ok: true, status: 200, jsonBody: mockResponse }))

      const result = await client.getListItems('list-1')

      expect(result).toEqual(mockItems)
    })

    it('should add items to a List', async () => {
      const newItems = [
        {
          ip: '192.168.1.2',
          comment: 'New IP',
        },
      ]

      const mockItems: CloudflareListItem[] = [
        {
          id: 'item-2',
          ...newItems[0]!,
          created_on: '2024-01-01T00:00:00Z',
          modified_on: '2024-01-01T00:00:00Z',
        },
      ]

      const mockResponse = {
        success: true,
        errors: [],
        messages: [],
        result: mockItems,
      }

      fetchMock.mockResolvedValueOnce(makeResponse({ ok: true, status: 200, jsonBody: mockResponse }))

      const result = await client.addListItems('list-1', { items: newItems })

      expect(result).toEqual(mockItems)
    })

    it('should remove items from a List', async () => {
      const itemsToRemove = {
        items: [{ id: 'item-1' }],
      }

      const mockResponse: CloudflareAPIResponse<void> = {
        success: true,
        errors: [],
        messages: [],
        result: undefined,
      }

      fetchMock.mockResolvedValueOnce(makeResponse({ ok: true, status: 200, jsonBody: mockResponse }))

      await client.removeListItems('list-1', itemsToRemove)

      expect(fetchMock).toHaveBeenCalledTimes(1)
    })
  })

  describe('getOrCreateIPBlocklist', () => {
    it('should return existing IP blocklist', async () => {
      const existingList: CloudflareList = {
        id: 'existing-list',
        name: 'Doorman IP Blocklist',
        description: 'Existing blocklist',
        kind: 'ip',
        num_items: 10,
        num_referencing_filters: 1,
        created_on: '2024-01-01T00:00:00Z',
        modified_on: '2024-01-01T00:00:00Z',
      }

      const mockResponse: CloudflareAPIResponse<CloudflareList[]> = {
        success: true,
        errors: [],
        messages: [],
        result: [existingList],
      }

      fetchMock.mockResolvedValueOnce(makeResponse({ ok: true, status: 200, jsonBody: mockResponse }))

      const result = await client.getOrCreateIPBlocklist()

      expect(result).toEqual(existingList)
      expect(fetchMock).toHaveBeenCalledTimes(1) // Only list, no create
    })

    it('should create new IP blocklist if none exists', async () => {
      const listResponse: CloudflareAPIResponse<CloudflareList[]> = {
        success: true,
        errors: [],
        messages: [],
        result: [], // No existing lists
      }

      const newList: CloudflareList = {
        id: 'new-list',
        name: 'Doorman IP Blocklist',
        description: 'IP addresses blocked by Vercel Doorman',
        kind: 'ip',
        num_items: 0,
        num_referencing_filters: 0,
        created_on: '2024-01-01T00:00:00Z',
        modified_on: '2024-01-01T00:00:00Z',
      }

      const createResponse: CloudflareAPIResponse<CloudflareList> = {
        success: true,
        errors: [],
        messages: [],
        result: newList,
      }

      fetchMock
        .mockResolvedValueOnce(makeResponse({ ok: true, status: 200, jsonBody: listResponse }))
        .mockResolvedValueOnce(makeResponse({ ok: true, status: 200, jsonBody: createResponse }))

      const result = await client.getOrCreateIPBlocklist()

      expect(result.name).toBe('Doorman IP Blocklist')
      expect(fetchMock).toHaveBeenCalledTimes(2) // List + create
    })

    it('should throw error if no account ID provided', async () => {
      const clientWithoutAccount = new CloudflareClient(API_TOKEN, ZONE_ID)

      await expect(clientWithoutAccount.getOrCreateIPBlocklist()).rejects.toThrow('Account ID required')
    })
  })
})
