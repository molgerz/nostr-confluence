/**
 * Bounds a promise so a caller never waits forever. Remote signing (NIP-46) is
 * a network round trip plus a human on the other end; without a bound the
 * caller waits silently and no error surface ever learns why. The relay
 * connection uses the same helper for the same reason.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), ms)
    }),
  ])
}
