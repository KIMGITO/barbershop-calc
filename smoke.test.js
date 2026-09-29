// TEMPORARY smoke test — deleted after verifying the CRUD paths.
import { describe, it, expect, beforeEach, vi } from 'vitest'

const calls = []
let failNext = null

vi.mock('../src/lib/supabaseClient', () => ({
  supabase: {
    auth: { getSession: async () => ({ data: {} }), signInAnonymously: async () => ({ data: {} }), signOut: async () => ({}) },
    from: (table) => {
      const q = {
        _table: table,
        select: () => q,
        eq: () => q,
        order: () => q,
        range: () => q,
        gte: () => q,
        upsert: async (body) => { calls.push({ t: 'upsert', table, body }); return failNext ? { error: failNext } : {} },
        update: (body) => { q._update = body; return q },
        delete: () => { q._delete = true; return q },
        then: (res) => { calls.push({ t: 'query', table, q: { ...q } }); return Promise.resolve(failNext ? { error: failNext, data: null } : { data: [], error: null }) },
      }
      return q
    },
    rpc: async () => ({ data: null, error: null }),
  },
}))

const { useShopStore } = await import('../src/store/useShopStore')
const db = await import('../src/lib/db')
const { getDB } = db

const SHOP = 'shop-1'

beforeEach(async () => {
  const d = await getDB()
  for (const s of ['providers', 'services', 'earnings', 'payouts', 'sync_queue']) {
    await d.clear(s)
  }
  calls.length = 0
  failNext = null
  useShopStore.setState({ providers: [], services: [], earningsByProvider: {}, payoutsByProvider: {}, requests: [] })
})

describe('catalog CRUD is offline-first', () => {
  it('queues a service rename instead of failing with no signal', async () => {
    const d = await getDB()
    await d.put('services', { id: 's1', shop_id: SHOP, name: 'Haircut', default_price: 300, active: true })
    failNext = new Error('offline')

    await useShopStore.getState().updateService({ id: 's1', name: 'Cut', defaultPrice: 350 })

    const cached = await db.getCachedServices(SHOP)
    expect(cached[0].name).toBe('Cut')
    expect(cached[0].pending).toBe(true)

    const queued = await d.get('sync_queue', 's1')
    expect(queued).toMatchObject({ op: 'patch', table: 'services', payload: { name: 'Cut', default_price: 350 } })
  })

  it('keeps a locally pending edit when the server list is re-read', async () => {
    const d = await getDB()
    await d.put('services', { id: 's1', shop_id: SHOP, name: 'Haircut', active: true })
    await useShopStore.getState().updateService({ id: 's1', name: 'Cut', defaultPrice: null })

    // A refresh from the server still carrying the OLD name must not win.
    await db.replaceCachedServices(SHOP, [{ id: 's1', shop_id: SHOP, name: 'Haircut', active: true }])
    const cached = await db.getCachedServices(SHOP)
    expect(cached[0].name).toBe('Cut')
  })

  it('drops a service the server no longer returns', async () => {
    const d = await getDB()
    await d.put('services', { id: 's1', shop_id: SHOP, name: 'Haircut', active: true })
    await d.put('services', { id: 's2', shop_id: SHOP, name: 'Beard trim', active: true })
    await db.replaceCachedServices(SHOP, [{ id: 's1', shop_id: SHOP, name: 'Haircut', active: true }])
    const cached = await db.getCachedServices(SHOP)
    expect(cached.map((s) => s.id)).toEqual(['s1'])
  })

  it('soft-deletes a provider and keeps them out of the cached list', async () => {
    const d = await getDB()
    await d.put('providers', { id: 'p1', shop_id: SHOP, name: 'Brian', phone: '0700', active: true })
    await useShopStore.getState().deleteProvider('p1')

    expect(await db.getCachedProviders(SHOP)).toEqual([])
    expect(await d.get('sync_queue', 'p1')).toMatchObject({ op: 'patch', payload: { active: false } })
  })

  it('never sends a null phone (NOT NULL column)', async () => {
    const d = await getDB()
    await d.put('providers', { id: 'p1', shop_id: SHOP, name: 'Brian', phone: '0700', active: true })
    await useShopStore.getState().updateProvider({ id: 'p1', name: 'Brian O', phone: '', roleTitle: 'Barber', canSelfRecord: true })
    const queued = await d.get('sync_queue', 'p1')
    expect(queued.payload).toEqual({ name: 'Brian O', role_title: 'Barber', can_self_record: true })
    expect(queued.payload).not.toHaveProperty('phone')
  })

  it('reports a clear error instead of throwing when the row is gone', async () => {
    await expect(
      useShopStore.getState().updateService({ id: 'nope', name: 'X', defaultPrice: null }),
    ).rejects.toThrow(/no longer on the list/)
  })
})

describe('earning and payout CRUD', () => {
  it('queues an earning edit with a services snapshot', async () => {
    const d = await getDB()
    await d.put('earnings', { local_id: 'e1', shop_id: SHOP, provider_id: 'p1', amount: 300, created_at: new Date().toISOString(), pending: false })
    await d.put('services', { id: 's1', shop_id: SHOP, name: 'Haircut', default_price: 300, active: true })

    await useShopStore.getState().updateEarning({
      localId: 'e1', providerId: 'p1', serviceId: 's1',
      services: [{ id: 's1', name: 'Haircut', price: 300 }],
      amount: 500, note: 'tip',
    })

    const row = await d.get('earnings', 'e1')
    expect(row).toMatchObject({ amount: 500, note: 'tip', service_id: 's1', pending: true })
    expect((await d.get('sync_queue', 'e1')).op).toBe('update')
  })

  it('soft-deletes an earning and hides it from the provider feed', async () => {
    const d = await getDB()
    await d.put('earnings', { local_id: 'e1', shop_id: SHOP, provider_id: 'p1', amount: 300, created_at: new Date().toISOString(), pending: false })
    await useShopStore.getState().deleteEarning({ localId: 'e1', providerId: 'p1' })

    expect(await db.getEarningsForProvider('p1')).toEqual([])
    expect(await d.get('earnings', 'e1')).toMatchObject({ deleted: true, pending: true })
  })
})
