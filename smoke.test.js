// Smoke tests for the three bugs that were fixed together:
//
//   1. a provider edit or delete threw `IDBDatabase.transaction: 'service_providers'
//      is not a known object store name` — the roster lives in the local
//      `providers` store but is `service_providers` on the server, and one name
//      was being used for both;
//   2. a service added a moment ago could not be edited or deleted: it existed
//      only in the store's memory, never in the cached catalog, so the write
//      found nothing to patch and the list looked like it had swallowed the
//      change;
//   3. removing an activity has to *void* it. It stays in the history, struck
//      through, and out of every total — history is never cleared; and
//   4. that same removal has to leave the *activity* surfaces (Home's "Today's
//      activity", a provider's Activity Log) while History keeps it, so both
//      surfaces are asserted separately rather than trusted to agree.
//
// Supabase is faked rather than reached, and every request it is asked for is
// recorded, because two of the bugs were really about which table and which
// operation got sent to the server.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const SHOP = 'shop-1'

// --- the fake Supabase --------------------------------------------------------
const requests = [] // every query the app made, in order
let selectRows = {} // rows a `select` returns, keyed by table
let singleRow = null // row an `insert().select().single()` returns
let failNext = null // make the next request fail, as if the signal dropped

vi.mock('./src/lib/supabaseClient', () => ({
  supabase: {
    from(table) {
      const q = {
        table,
        filters: [],
        select: () => q,
        eq: (column, value) => {
          q.filters.push([column, value])
          return q
        },
        order: () => q,
        limit: () => q,
        range: () => q,
        gte: () => q,
        single: () => q,
        insert: (row) => {
          q.inserted = row
          return q
        },
        update: (row) => {
          q.updated = row
          return q
        },
        upsert: (row) => {
          q.upserted = row
          return q
        },
        delete: () => {
          q.deleted = true
          return q
        },
        // Awaiting the builder is what sends the request.
        then: (resolve) => {
          requests.push(q)
          const failure = failNext
          failNext = null
          if (failure) return Promise.resolve({ data: null, error: failure }).then(resolve)
          if (q.inserted !== undefined) return Promise.resolve({ data: singleRow, error: null }).then(resolve)
          return Promise.resolve({ data: selectRows[table] ?? [], error: null }).then(resolve)
        },
      }
      return q
    },
    rpc: () => Promise.resolve({ data: null, error: null }),
  },
}))

const {
  getDB,
  getCachedServices,
  getCachedProviders,
  getEarningsForProvider,
  replaceCachedServices,
  voidEarningLocal,
} = await import('./src/lib/db')
const { runSync } = await import('./src/lib/sync')
const { useShopStore } = await import('./src/store/useShopStore')
const { periodTotals } = await import('./src/utils/dates')
const { isToday, liveActivities, mergeActivities, totals } = await import(
  './src/utils/activity'
)
// The history surface itself, rendered for real: the two-surface rule lives in
// the screens (activity) and in HistoryView (history), so asserting the pure
// helper alone would not prove History keeps the row.
const HistoryView = (await import('./src/components/HistoryView')).default

const provider = (over = {}) => ({
  id: 'prov-1',
  shop_id: SHOP,
  name: 'Brian',
  phone: '+254700000001',
  role_title: 'Barber',
  active: true,
  ...over,
})

const activity = (localId, amount, over = {}) => ({
  local_id: localId,
  shop_id: SHOP,
  provider_id: 'prov-1',
  amount,
  created_at: new Date().toISOString(),
  pending: false,
  ...over,
})

beforeEach(async () => {
  requests.length = 0
  selectRows = {}
  singleRow = null
  failNext = null
  // A fresh device: no rows cached, nothing in the store.
  useShopStore.setState({
    shopId: SHOP,
    providers: [],
    allProviders: [],
    services: [],
    requests: [],
    earningsByProvider: {},

    payoutsByProvider: {},
  })
  const db = await getDB()
  for (const name of [...db.objectStoreNames]) {
    const tx = db.transaction(name, 'readwrite')
    for (const key of await tx.store.getAllKeys()) await tx.store.delete(key)
    await tx.done
  }
})

// ---------------------------------------------------------------------------
// 1. Editing and removing a provider
// ---------------------------------------------------------------------------
describe('provider edits and removals', () => {
  it('writes the local `providers` store while queuing the `service_providers` table', async () => {
    const db = await getDB()
    await db.put('providers', provider())

    // Before the fix this threw: the lookup used the server's table name.
    await useShopStore.getState().updateProvider({
      id: 'prov-1',
      name: 'Brian O.',
      phone: '',
      roleTitle: 'Barber',
    })

    const row = await db.get('providers', 'prov-1')
    expect(row.name).toBe('Brian O.') // the local write happened
    expect(row.pending).toBe(true)
    // An emptied phone field keeps the old number: the column is NOT NULL and
    // unique per shop (the provider claims their device with it).
    expect(row.phone).toBe('+254700000001')

    const queued = await db.get('sync_queue', 'prov-1')
    expect(queued.store).toBe('providers') // where the row lives on this device
    expect(queued.table).toBe('service_providers') // what PostgREST is asked for
    expect(queued.op).toBe('patch')
    expect(queued.payload).toEqual({ name: 'Brian O.', role_title: 'Barber' })
  })

  it('takes a removed provider off the team list but keeps them for history', async () => {
    const db = await getDB()
    await db.put('providers', provider())
    await useShopStore.getState().loadProviders(SHOP)
    expect(useShopStore.getState().providers.map((p) => p.id)).toEqual(['prov-1'])

    await useShopStore.getState().deleteProvider('prov-1')

    // Gone from the team list and from the cached active roster…
    expect(useShopStore.getState().providers).toEqual([])
    expect(await getCachedProviders(SHOP)).toEqual([])
    // …but still on the full roster, so their name keeps resolving in history.
    expect(useShopStore.getState().allProviders.map((p) => p.id)).toEqual(['prov-1'])
    expect((await getCachedProviders(SHOP, { includeInactive: true })).map((p) => p.id)).toEqual(['prov-1'])

    const queued = await db.get('sync_queue', 'prov-1')
    expect(queued.table).toBe('service_providers')
    expect(queued.payload).toEqual({ active: false }) // soft-delete, not a DELETE
  })
})

// ---------------------------------------------------------------------------
// 2. The service price list
// ---------------------------------------------------------------------------
describe('the service catalog', () => {
  it('can edit and then delete a service that was added a moment ago', async () => {
    const conn = await getDB()
    singleRow = { id: 'svc-new', shop_id: SHOP, name: 'Shave', default_price: 200, active: true }
    await useShopStore.getState().addService({ name: 'Shave', defaultPrice: 200 })
    // The new row is in the cached catalog, not just in memory. Without this it
    // could not be patched later and the app claimed it was "no longer on the list".
    expect((await getCachedServices(SHOP)).map((s) => s.id)).toEqual(['svc-new'])

    await useShopStore.getState().updateService({
      id: 'svc-new',
      name: 'Shave + hot towel',
      defaultPrice: 250,
    })
    expect(useShopStore.getState().services[0].name).toBe('Shave + hot towel')
    expect((await getCachedServices(SHOP))[0].default_price).toBe(250)

    await useShopStore.getState().deleteService('svc-new')
    // The screen renders the store's list, so this is the UI refresh.
    expect(useShopStore.getState().services).toEqual([])
    expect(await getCachedServices(SHOP)).toEqual([])
    expect(await conn.get('sync_queue', 'svc-new')).toMatchObject({
      store: 'services',
      table: 'services',
      payload: { active: false },
    })
  })

  it('does not prune a service whose edit is still queued', async () => {
    const db = await getDB()
    await db.put('services', {
      id: 'svc-pending',
      shop_id: SHOP,
      name: 'Haircut (renamed offline)',
      active: true,
      pending: true, // queued edit that has not uploaded yet
    })
    await db.put('services', { id: 'svc-gone', shop_id: SHOP, name: 'Faded', active: true, pending: false })

    // The server list no longer mentions either of them.
    await replaceCachedServices(SHOP, [])

    // The synced row is pruned (that is how a deactivation on another device
    // reaches this one), while the queued edit outranks the server copy.
    expect((await getCachedServices(SHOP)).map((s) => s.id)).toEqual(['svc-pending'])
    expect(await db.get('services', 'svc-gone')).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// 3. Removing an activity voids it — history is never cleared
// ---------------------------------------------------------------------------
describe('removing an activity', () => {
  it('voids an earning: the row stays in the history but stops counting', async () => {
    const db = await getDB()
    await db.put('earnings', activity('e-live', 300))
    await db.put('earnings', activity('e-gone', 500))

    await useShopStore.getState().deleteEarning({ localId: 'e-gone', providerId: 'prov-1' })

    // Nothing was deleted: the row is on disk, in the provider's log, and in
    // the feed.
    const rows = await getEarningsForProvider('prov-1')
    expect(rows.map((r) => r.local_id).sort()).toEqual(['e-gone', 'e-live'])
    const gone = rows.find((r) => r.local_id === 'e-gone')
    expect(gone.voided_at).toBeTruthy()
    expect(gone.pending).toBe(true) // the stamp still has to upload

    const queued = await db.get('sync_queue', 'e-gone')
    expect(queued.op).toBe('void')
    expect(queued.payload).toEqual({ voided_at: gone.voided_at })

    // It is shown as removed, and counts towards nothing.
    const feed = mergeActivities(rows, [], () => 'Brian')
    expect(feed).toHaveLength(2)
    expect(feed.find((a) => a.refId === 'e-gone').voided).toBe(true)
    expect(totals(feed)).toEqual({ earned: 300, paid: 0 })
    expect(periodTotals(rows)).toMatchObject({ today: 300, all: 300 })
  })

  it('voids a payout the same way', async () => {
    const db = await getDB()
    await db.put('payouts', activity('p-gone', 200))

    await useShopStore.getState().deletePayout({ localId: 'p-gone', providerId: 'prov-1' })

    const { payouts } = await useShopStore.getState().loadProviderLogs('prov-1')
    expect(payouts.map((r) => r.local_id)).toEqual(['p-gone'])
    expect(payouts[0].voided_at).toBeTruthy()
    expect((await db.get('sync_queue', 'p-gone')).op).toBe('void')
    expect(await db.get('payouts', 'p-gone')).toBeTruthy()
  })

  it('still leaves out a row an older build removed with the `deleted` flag', async () => {
    const legacy = [{ local_id: 'e-legacy', amount: 400, created_at: new Date().toISOString(), deleted: true }]
    expect(periodTotals(legacy).all).toBe(0)
    expect(totals(mergeActivities(legacy, [], () => 'Brian'))).toEqual({ earned: 0, paid: 0 })
  })

  it('uploads a removal as an update on the row, never a delete', async () => {
    const db = await getDB()
    await db.put('earnings', activity('e-1', 300, { pending: true }))
    await voidEarningLocal('e-1')

    const wasOnline = navigator.onLine
    navigator.onLine = true
    try {
      await runSync()
    } finally {
      navigator.onLine = wasOnline
    }

    const writes = requests.filter((r) => r.table === 'earnings')
    expect(writes).toHaveLength(1)
    expect(writes[0].deleted).toBeUndefined() // never a DELETE
    expect(writes[0].updated).toEqual({ voided_at: expect.any(String) })
    expect(writes[0].filters).toEqual([['local_id', 'e-1']])

    // Accepted, so the queue drains and the row stops showing as syncing — but
    // the row itself is still there.
    expect(await db.get('sync_queue', 'e-1')).toBeUndefined()
    const row = await db.get('earnings', 'e-1')
    expect(row.pending).toBe(false)
    expect(row.voided_at).toBeTruthy()
  })

  it('leaves the activity feed the moment it is removed, but not the history', async () => {
    const db = await getDB()
    await db.put('earnings', activity('e-keep', 300))
    await db.put('earnings', activity('e-drop', 500))

    await useShopStore.getState().deleteEarning({
      localId: 'e-drop',
      providerId: 'prov-1',
    })
    const rows = await getEarningsForProvider('prov-1')
    const history = mergeActivities(rows, [], () => 'Brian')

    // History is the audit trail: both rows are there, and the removed one says
    // so — this is the struck-through, "Deleted" row the user still sees.
    expect(history.map((a) => a.refId).sort()).toEqual(['e-drop', 'e-keep'])
    expect(history.find((a) => a.refId === 'e-drop')).toMatchObject({ voided: true })
    expect(history.find((a) => a.refId === 'e-keep')).toMatchObject({ voided: false })

    // An activity surface (Home / a provider's Activity Log) shows what is live
    // now, so the removed row is not in it at all…
    const feed = liveActivities(history).filter(isToday)
    expect(feed.map((a) => a.refId)).toEqual(['e-keep'])

    // …while the history list it was derived from is left whole: the two
    // surfaces really do differ, and nothing mutates the audit trail.
    expect(history).toHaveLength(2)
  })

  it('stays removed on this device even when the server rejects the stamp', async () => {
    // A deployed database that lags the app answers the void with a 400
    // ("column earnings.voided_at does not exist"). The removal must still be
    // true here and the stamp retried — never quietly reverted, and never turned
    // into a DELETE of the record.
    const db = await getDB()
    await db.put('earnings', activity('e-1', 300, { pending: true }))
    await voidEarningLocal('e-1')

    failNext = {
      code: '42703',
      message: 'column earnings.voided_at does not exist',
    }
    const wasOnline = navigator.onLine
    navigator.onLine = true
    try {
      await runSync()
    } finally {
      navigator.onLine = wasOnline
    }

    const writes = requests.filter((r) => r.table === 'earnings')
    expect(writes).toHaveLength(1)
    expect(writes[0].deleted).toBeUndefined()
    expect(writes[0].updated).toEqual({ voided_at: expect.any(String) })

    // The local truth is unchanged: removed, and still waiting to upload.
    const row = await db.get('earnings', 'e-1')
    expect(row.voided_at).toBeTruthy()
    expect(row.pending).toBe(true)
    expect((await db.get('sync_queue', 'e-1')).op).toBe('void')

    // And it is already out of the live feed while it waits.
    const feed = mergeActivities(
      await getEarningsForProvider('prov-1'),
      [],
      () => 'Brian',
    )
    expect(liveActivities(feed)).toEqual([])
    expect(totals(feed)).toEqual({ earned: 0, paid: 0 })
  })

  it('renders the removed record in History: struck through and marked Deleted', async () => {
    const history = mergeActivities(
      [
        activity('e-live', 300, {
          services: [{ id: 's-live', name: 'Shave', price: 300 }],
        }),
        activity('e-drop', 500, {
          voided_at: '2026-09-29T09:00:00.000Z',
          services: [{ id: 's-drop', name: 'Fade', price: 500 }],
        }),
      ],
      [],
      () => 'Brian',
    )

    // Rendered for real, because "HistoryView must not filter" is a property of
    // that component, not of the helper the activity screens use.
    const markup = renderToStaticMarkup(
      React.createElement(HistoryView, { activities: history, providers: [] }),
    )
    // React separates the adjacent text nodes of a line ("2 activities") with an
    // empty comment, so the comments come out before asserting on the text.
    const text = markup.replace(/<!--.*?-->/g, '')

    expect(text).toContain('Shave') // the live record
    expect(text).toContain('Fade') // the removed one is still listed…
    expect(text).toContain('+ KES 500') // …with its original amount…
    expect(text).toContain('line-through') // …struck through…
    expect(text.toLowerCase()).toContain('deleted') // …and tagged as deleted

    // The count and the money are the two halves of the rule: the removed row is
    // still an *entry* in history, but it is not money any more.
    const summary = text.match(/role="status"[^>]*>(.*?)<\/div>/)[1]
    expect(summary).toContain('2 activities')
    expect(summary).toContain('KES 300')
    expect(summary).not.toContain('800') // 300 + 500 would read as 800
  })

  it("takes it off a provider's Today tab too, not only out of the helper", async () => {
    // The screens are where the rule has to actually reach the user, so this
    // renders one: if a screen ever stops passing its feed through
    // liveActivities, a removed record would reappear there and this fails.
    const { MemoryRouter } = await import('react-router-dom')

    // A static render cannot read a live zustand store. zustand renders from
    // `api.getServerState || api.getInitialState`, and `getInitialState` is
    // frozen at store creation, so `setState` is invisible to it — and
    // `create()` copies the api's methods onto the returned hook, so assigning
    // `useProviderStore.getServerState` never reaches the api useStore reads.
    // Handing the screen a store that answers with the state this test sets is
    // the whole of "this device has finished loading".
    let storeState = {}
    vi.doMock('./src/store/useProviderStore', () => ({
      useProviderStore: () => storeState,
    }))
    const ProviderHome = (await import('./src/screens/ProviderHome')).default

    const removed = activity('e-drop', 500, {
      voided_at: new Date().toISOString(),
    })
    const live = activity('e-live', 300)

    const show = async (earnings) => {
      storeState = {
        provider: {
          id: 'prov-1',
          name: 'Brian Otieno',
          role_title: 'Barber',
          can_self_record: false,
        },
        earnings,
        payouts: [],
        requests: [],
        services: [],
        loading: false,
        error: '',
      }
      return renderToStaticMarkup(
        React.createElement(
          MemoryRouter,
          null,
          React.createElement(ProviderHome),
        ),
      )
        // React separates the adjacent text nodes of a line with an empty
        // comment, and static markup escapes apostrophes.
        .replace(/<!--.*?-->/g, '')
        .replace(/&#x27;/g, "'")
    }

    const onlyRemoved = await show([removed])
    expect(onlyRemoved).toContain("Today's activity (0)")
    expect(onlyRemoved).toContain('No activity yet today.')
    // The amount, not the digits: "500" alone is inside `font-weight:500`.
    expect(onlyRemoved).not.toContain('KES 500')

    // …and the tab is not simply blank: a live record still shows up.
    const mixed = await show([removed, live])
    expect(mixed).toContain("Today's activity (1)")
    expect(mixed).toContain('+ KES 300')
    expect(mixed).not.toContain('KES 500')
  })
})
// ---------------------------------------------------------------------------
// 4. Phone numbers: one shape however they were typed, unique after normalizing
// ---------------------------------------------------------------------------
// The number is the provider's identity — it is how they claim their device —
// so the same number written two ways must not become two providers. See
// src/utils/phone.js for the conversion itself and its own unit tests.
describe('provider phone numbers', () => {
  it('stores whichever format was typed in one canonical shape', async () => {
    singleRow = provider({ id: 'prov-2', phone: '+254712345678' })

    await useShopStore.getState().addProvider({
      name: 'Brian',
      phone: '0712 345 678',
      roleTitle: 'Barber',
    })

    const insert = requests.find((r) => r.inserted !== undefined)
    expect(insert.table).toBe('service_providers')
    // "0712 345 678", "254712345678" and "+254712345678" are one number, and
    // the column only ever holds one of them.
    expect(insert.inserted.phone).toBe('+254712345678')
  })

  it('refuses a second provider whose number differs only in format', async () => {
    useShopStore.setState({ providers: [provider({ phone: '+254712345678' })] })

    await expect(
      useShopStore.getState().addProvider({ name: 'Someone else', phone: '0712 345 678' }),
    ).rejects.toThrow(/already registered/)

    // Refused on this device: the server was never asked, so nothing is queued
    // to fail on the next sync either.
    expect(requests.some((r) => r.inserted !== undefined)).toBe(false)
  })

  it('refuses a number that could not be dialled', async () => {
    await expect(
      useShopStore.getState().addProvider({ name: 'Brian', phone: '123' }),
    ).rejects.toThrow(/valid phone number/)

    expect(requests.some((r) => r.inserted !== undefined)).toBe(false)
  })

  it('normalizes an edit before it is cached and queued', async () => {
    const db = await getDB()
    await db.put('providers', provider())

    await useShopStore.getState().updateProvider({ id: 'prov-1', phone: '0712 000 002' })

    expect((await db.get('providers', 'prov-1')).phone).toBe('+254712000002')
    expect((await db.get('sync_queue', 'prov-1')).payload).toEqual({ phone: '+254712000002' })
  })

  it('refuses an edit that would take a number another provider already has', async () => {
    const db = await getDB()
    await db.put('providers', provider())
    useShopStore.setState({
      providers: [provider(), provider({ id: 'prov-2', phone: '+254712000002' })],
    })

    await expect(
      useShopStore.getState().updateProvider({ id: 'prov-1', phone: '0712 000 002' }),
    ).rejects.toThrow(/already registered/)

    // Nothing was written locally and nothing was queued.
    expect((await db.get('providers', 'prov-1')).phone).toBe('+254700000001')
    expect(await db.get('sync_queue', 'prov-1')).toBeUndefined()
  })
})


