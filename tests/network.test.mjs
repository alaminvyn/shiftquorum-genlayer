import assert from 'node:assert/strict'
import test from 'node:test'
import { abi } from 'genlayer-js'
import { connect, networkCheck, read, signer } from '../src/network.ts'

const genesis = '0x17d89764d4f4f963158fc4c5e8f2cb670c2837740b35f37081c12860c3df97e4'
const address = '0x58B9F0B2752DbffbF8829d72806bB39D4991c0f8'
const state = { revision: 2, version: 2, count: 2, last: 'second' }

function mockRpc(t, resolve) {
  t.mock.method(globalThis, 'fetch', async (_endpoint, options) => {
    const request = JSON.parse(options.body)
    return Response.json({jsonrpc:'2.0',id:1,result:resolve(request)})
  })
}

test('accepts phase 2 identity and stops on the reused chain ID with a wrong genesis', async t => {
  let blockHash = genesis
  mockRpc(t, ({method}) => ({eth_chainId:'0x107d',eth_getBlockByNumber:{hash:blockHash},eth_getCode:'0x6000'})[method])
  await networkCheck()
  blockHash = '0x1234'
  await assert.rejects(networkCheck(), /identity mismatch/)
})

test('public state requests use finalized reads and decode the contract response', async t => {
  mockRpc(t, ({method,params}) => {
    assert.equal(method,'gen_call')
    assert.equal(params[0].type,'read')
    assert.equal(params[0].status,'finalized')
    assert.equal(params[0].to,address)
    return {status:{code:0},data:Buffer.from(abi.calldata.encode(JSON.stringify(state))).toString('hex')}
  })
  assert.deepEqual(await read(address,'event',['workspace','event']),state)
})

test('wallet rejection is preserved for the application and signing blocks a wrong wallet network', async t => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window')
  t.after(() => descriptor ? Object.defineProperty(globalThis, 'window', descriptor) : delete globalThis.window)
  globalThis.window = {ethereum:{request:async ({method}) => {
    if (method === 'eth_requestAccounts') throw Object.assign(Error('User rejected request'),{code:4001})
    return ({eth_chainId:'0x1',eth_getBlockByNumber:{hash:genesis},eth_accounts:[address]})[method]
  }}}
  mockRpc(t, ({method}) => ({eth_chainId:'0x107d',eth_getBlockByNumber:{hash:genesis},eth_getCode:'0x6000'})[method])
  await assert.rejects(connect(),{code:4001})
  await assert.rejects(signer(address,()=>assert.fail('Must not request signing')), /Select Bradbury Phase 2/)
})
