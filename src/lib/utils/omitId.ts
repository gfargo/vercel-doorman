export type WithId = { id?: string | number | null }

export function omitId<T extends WithId>(obj: T): Omit<T, 'id'> {
  const { id, ...rest } = obj
  return rest
}
