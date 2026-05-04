import { describe, it, expect } from '@jest/globals'
import { executeBatch, executeParallel, optimizedDiff } from '../batch'

describe('executeBatch', () => {
  it('should execute all operations successfully', async () => {
    const operations = [
      () => Promise.resolve('a'),
      () => Promise.resolve('b'),
      () => Promise.resolve('c'),
    ]

    const result = await executeBatch(operations)

    expect(result.succeeded).toBe(3)
    expect(result.failed).toBe(0)
    expect(result.results).toHaveLength(3)
    expect(result.results.map((r) => r.result)).toEqual(['a', 'b', 'c'])
  })

  it('should return empty results for empty operations', async () => {
    const result = await executeBatch([])

    expect(result.succeeded).toBe(0)
    expect(result.failed).toBe(0)
    expect(result.results).toHaveLength(0)
    expect(result.totalDuration).toBe(0)
  })

  it('should handle individual failures with continueOnError=true', async () => {
    const operations = [
      () => Promise.resolve('ok'),
      () => Promise.reject(new Error('fail')),
      () => Promise.resolve('ok2'),
    ]

    const result = await executeBatch(operations, { continueOnError: true })

    expect(result.succeeded).toBe(2)
    expect(result.failed).toBe(1)
    expect(result.results[0]!.success).toBe(true)
    expect(result.results[1]!.success).toBe(false)
    expect(result.results[1]!.error?.message).toBe('fail')
    expect(result.results[2]!.success).toBe(true)
  })

  it('should stop on first failure with continueOnError=false', async () => {
    const operations = [
      () => Promise.reject(new Error('fail')),
      () => Promise.resolve('should not run'),
    ]

    const result = await executeBatch(operations, {
      continueOnError: false,
      concurrency: 1,
    })

    expect(result.failed).toBeGreaterThanOrEqual(1)
  })

  it('should respect concurrency limit', async () => {
    let maxConcurrent = 0
    let currentConcurrent = 0

    const createOp = () => async () => {
      currentConcurrent++
      maxConcurrent = Math.max(maxConcurrent, currentConcurrent)
      await new Promise((resolve) => setTimeout(resolve, 50))
      currentConcurrent--
      return 'done'
    }

    const operations = Array.from({ length: 10 }, createOp)

    await executeBatch(operations, { concurrency: 3 })

    expect(maxConcurrent).toBeLessThanOrEqual(3)
  })

  it('should handle operation timeouts', async () => {
    const operations = [
      () => new Promise<string>((resolve) => setTimeout(() => resolve('ok'), 10)),
      () => new Promise<string>(() => {}), // never resolves
    ]

    const result = await executeBatch(operations, {
      operationTimeout: 100,
      concurrency: 2,
    })

    expect(result.results[0]!.success).toBe(true)
    expect(result.results[1]!.success).toBe(false)
    expect(result.results[1]!.error?.message).toContain('timed out')
  })

  it('should track duration per operation', async () => {
    const operations = [
      () => new Promise<string>((resolve) => setTimeout(() => resolve('ok'), 50)),
    ]

    const result = await executeBatch(operations)

    expect(result.results[0]!.duration).toBeGreaterThanOrEqual(40)
    expect(result.totalDuration).toBeGreaterThanOrEqual(40)
  })

  it('should insert delay between batches', async () => {
    const start = Date.now()

    const operations = [
      () => Promise.resolve('a'),
      () => Promise.resolve('b'),
      () => Promise.resolve('c'),
      () => Promise.resolve('d'),
    ]

    await executeBatch(operations, { concurrency: 2, batchDelay: 50 })

    const elapsed = Date.now() - start
    // Should have at least one 50ms delay between the two batches
    expect(elapsed).toBeGreaterThanOrEqual(40)
  })

  it('should preserve operation indices in results', async () => {
    const operations = [
      () => Promise.resolve('zero'),
      () => Promise.resolve('one'),
      () => Promise.resolve('two'),
    ]

    const result = await executeBatch(operations)

    expect(result.results[0]!.index).toBe(0)
    expect(result.results[1]!.index).toBe(1)
    expect(result.results[2]!.index).toBe(2)
  })
})

describe('executeParallel', () => {
  it('should execute named operations and return keyed results', async () => {
    const result = await executeParallel({
      zone: () => Promise.resolve({ id: 'z1', name: 'example.com' }),
      rulesets: () => Promise.resolve([{ id: 'rs1' }]),
    })

    expect(result.zone).toEqual({ id: 'z1', name: 'example.com' })
    expect(result.rulesets).toEqual([{ id: 'rs1' }])
  })

  it('should return Error objects for failed operations', async () => {
    const result = await executeParallel({
      success: () => Promise.resolve('ok'),
      failure: () => Promise.reject(new Error('boom')),
    })

    expect(result.success).toBe('ok')
    expect(result.failure).toBeInstanceOf(Error)
    expect((result.failure as Error).message).toBe('boom')
  })

  it('should respect concurrency limit', async () => {
    let maxConcurrent = 0
    let currentConcurrent = 0

    const createOp = (name: string) => async () => {
      currentConcurrent++
      maxConcurrent = Math.max(maxConcurrent, currentConcurrent)
      await new Promise((resolve) => setTimeout(resolve, 30))
      currentConcurrent--
      return name
    }

    await executeParallel(
      {
        a: createOp('a'),
        b: createOp('b'),
        c: createOp('c'),
        d: createOp('d'),
        e: createOp('e'),
      } as Record<string, () => Promise<unknown>>,
      2,
    )

    expect(maxConcurrent).toBeLessThanOrEqual(2)
  })
})

describe('optimizedDiff', () => {
  interface TestItem {
    id: string
    name: string
    value: number
  }

  const equalFn = (a: TestItem, b: TestItem) =>
    a.id === b.id && a.name === b.name && a.value === b.value

  it('should detect items to add', () => {
    const local: TestItem[] = [
      { id: '1', name: 'a', value: 1 },
      { id: '2', name: 'b', value: 2 },
    ]
    const remote: TestItem[] = [{ id: '1', name: 'a', value: 1 }]

    const diff = optimizedDiff(local, remote, 'id', equalFn)

    expect(diff.toAdd).toEqual([{ id: '2', name: 'b', value: 2 }])
    expect(diff.toUpdate).toEqual([])
    expect(diff.toDelete).toEqual([])
  })

  it('should detect items to update', () => {
    const local: TestItem[] = [{ id: '1', name: 'a', value: 99 }]
    const remote: TestItem[] = [{ id: '1', name: 'a', value: 1 }]

    const diff = optimizedDiff(local, remote, 'id', equalFn)

    expect(diff.toAdd).toEqual([])
    expect(diff.toUpdate).toEqual([{ id: '1', name: 'a', value: 99 }])
    expect(diff.toDelete).toEqual([])
  })

  it('should detect items to delete', () => {
    const local: TestItem[] = []
    const remote: TestItem[] = [{ id: '1', name: 'a', value: 1 }]

    const diff = optimizedDiff(local, remote, 'id', equalFn)

    expect(diff.toAdd).toEqual([])
    expect(diff.toUpdate).toEqual([])
    expect(diff.toDelete).toEqual([{ id: '1', name: 'a', value: 1 }])
  })

  it('should handle mixed add/update/delete', () => {
    const local: TestItem[] = [
      { id: '1', name: 'updated', value: 99 },
      { id: '3', name: 'new', value: 3 },
    ]
    const remote: TestItem[] = [
      { id: '1', name: 'original', value: 1 },
      { id: '2', name: 'deleted', value: 2 },
    ]

    const diff = optimizedDiff(local, remote, 'id', equalFn)

    expect(diff.toAdd).toEqual([{ id: '3', name: 'new', value: 3 }])
    expect(diff.toUpdate).toEqual([{ id: '1', name: 'updated', value: 99 }])
    expect(diff.toDelete).toEqual([{ id: '2', name: 'deleted', value: 2 }])
  })

  it('should handle empty arrays', () => {
    const diff = optimizedDiff<TestItem>([], [], 'id', equalFn)

    expect(diff.toAdd).toEqual([])
    expect(diff.toUpdate).toEqual([])
    expect(diff.toDelete).toEqual([])
  })

  it('should handle identical arrays', () => {
    const items: TestItem[] = [
      { id: '1', name: 'a', value: 1 },
      { id: '2', name: 'b', value: 2 },
    ]

    const diff = optimizedDiff(items, [...items], 'id', equalFn)

    expect(diff.toAdd).toEqual([])
    expect(diff.toUpdate).toEqual([])
    expect(diff.toDelete).toEqual([])
  })

  it('should perform well with large arrays', () => {
    const size = 10000
    const local: TestItem[] = Array.from({ length: size }, (_, i) => ({
      id: `item-${i}`,
      name: `name-${i}`,
      value: i,
    }))
    const remote: TestItem[] = Array.from({ length: size }, (_, i) => ({
      id: `item-${i}`,
      name: `name-${i}`,
      value: i % 2 === 0 ? i : i + 1, // Half are different
    }))

    const start = Date.now()
    const diff = optimizedDiff(local, remote, 'id', equalFn)
    const elapsed = Date.now() - start

    // Should complete in well under 1 second for 10k items
    expect(elapsed).toBeLessThan(1000)
    expect(diff.toUpdate.length).toBeGreaterThan(0)
  })
})
