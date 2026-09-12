// @vitest-environment jsdom
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
import { describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'

/**
 * The one thing no client.ts-level test can show on its own: two real React
 * components holding the same relay via useRelay() at once, the way
 * AppShell's Shell (mounted for the whole session) and ProfileSettings
 * (mounted only while /settings/profile is open) do in the real app. The
 * Sign out button lives on ProfileSettings and navigates away — unmounting
 * it — while Shell stays mounted and still needs the connection. The parent
 * here has to stay the same component across the transition (as the router
 * does — AppShell never remounts, only its <Outlet> child does), or React
 * would remount ShellLike too and the bug wouldn't be there to catch.
 * See client.reconnect.test.ts, "a second consumer releasing the relay does
 * not take the first one down", for the client.ts-only version of this bug.
 */
class FakeSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3
  readyState = FakeSocket.CONNECTING
  onopen: (() => void) | null = null
  onerror: (() => void) | null = null
  onclose: ((ev: unknown) => void) | null = null
  onmessage: ((ev: { data: string }) => void) | null = null
  url: string
  constructor(url: string) {
    this.url = url
    sockets.push(this)
  }
  send() {}
  close() {
    if (this.readyState === FakeSocket.CLOSED) return
    this.readyState = FakeSocket.CLOSED
    this.onclose?.({ code: 1000, reason: 'closed', wasClean: true })
  }
  open() {
    this.readyState = FakeSocket.OPEN
    this.onopen?.()
  }
}

let sockets: FakeSocket[] = []

async function flush(rounds = 10) {
  for (let i = 0; i < rounds; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
}

function latestSocket(): FakeSocket {
  const socket = sockets.at(-1)
  if (!socket) throw new Error('no socket created')
  return socket
}

describe('useRelay: two mounted consumers of the same relay (CON-35)', () => {
  it(
    'a child consumer unmounting (navigating away) does not break the always-mounted parent',
    async () => {
      sockets = []
      vi.resetModules()
      ;(globalThis as unknown as { WebSocket: unknown }).WebSocket = FakeSocket
      const { useRelay } = await import('./relay-status')
      const { createElement, useState, useImperativeHandle, forwardRef } = await import('react')

      const RELAY = 'ws://fake/'
      let shellConnection = ''
      let profileConnection = ''

      function ShellLike({ showProfile }: { showProfile: boolean }) {
        const { snapshot } = useRelay(RELAY)
        shellConnection = snapshot.connection
        return createElement('div', null, showProfile ? createElement(ProfileLike) : null)
      }
      function ProfileLike() {
        const { snapshot } = useRelay(RELAY)
        profileConnection = snapshot.connection
        return null
      }
      // AppShell itself never remounts across a logout navigation — only its
      // <Outlet> child does. Model that with a stable App whose "route" is
      // driven from outside via an imperative handle, exactly like a router
      // swapping children without touching the layout above it.
      type Handle = { setShowProfile: (v: boolean) => void }
      const App = forwardRef<Handle>((_props, ref) => {
        const [showProfile, setShowProfile] = useState(true)
        useImperativeHandle(ref, () => ({ setShowProfile }))
        return createElement(ShellLike, { showProfile })
      })

      const host = document.createElement('div')
      document.body.appendChild(host)
      let root: Root
      const handleRef = { current: null as Handle | null }

      await act(async () => {
        root = createRoot(host)
        root.render(createElement(App, { ref: handleRef }))
      })
      await flush()
      latestSocket().open()
      await act(async () => {
        await flush()
      })

      expect(shellConnection).toBe('online')
      expect(profileConnection).toBe('online')

      // the Sign out click: logout(), then navigate() unmounts ProfileLike —
      // the always-mounted Shell/App stays mounted throughout
      await act(async () => {
        handleRef.current?.setShowProfile(false)
      })
      await act(async () => {
        await flush(20)
      })

      expect(shellConnection, 'Shell must stay online after Profile unmounts').toBe('online')

      // The bug only shows once something tries to reconnect afterwards:
      // deleting the wanted entry doesn't flip an already-online snapshot by
      // itself, it just stops open()/scheduleRetry from ever running again.
      // Drop the connection and confirm Shell's own hold is still enough to
      // bring it back.
      const socketsBefore = sockets.length
      await act(async () => {
        latestSocket().close()
      })
      expect(shellConnection).toBe('offline')

      const deadline = Date.now() + 3000
      while (sockets.length === socketsBefore && Date.now() < deadline) {
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 50))
        })
      }
      expect(sockets.length, 'expected a reconnect attempt to open a new socket').toBeGreaterThan(
        socketsBefore,
      )
      await act(async () => {
        const socket = latestSocket()
        if (socket.readyState === FakeSocket.CONNECTING) socket.open()
      })
      await act(async () => {
        await flush(20)
      })
      expect(shellConnection).toBe('online')

      await act(async () => {
        root.unmount()
      })
    },
    10000,
  )
})
