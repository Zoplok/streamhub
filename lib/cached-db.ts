import { unstable_cache } from 'next/cache'
import { db } from './db'

export function cachedDbQuery<T>(
  key: string,
  text: string,
  params: unknown[] = [],
  revalidate = 60
) {
  return unstable_cache(
    () => db.query<T>(text, params),
    ['db-query', key],
    { revalidate }
  )()
}
