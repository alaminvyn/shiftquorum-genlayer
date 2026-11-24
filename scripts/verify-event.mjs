import { abi, createClient, isSuccessful } from 'genlayer-js'
import { testnetBradbury } from 'genlayer-js/chains'
import { readFile } from 'node:fs/promises'

const endpoint = 'https://rpc-bradbury.genlayer.com'
const deployment = JSON.parse(await readFile(new URL('../src/deployment.json', import.meta.url), 'utf8'))
const [workspace = deployment.demoWorkspace, event = deployment.demoEvent, ...hashes] = process.argv.slice(2)
if (!/^[a-z0-9_-]{1,40}$/.test(workspace) || !/^[a-z0-9_-]{1,40}$/.test(event)) {
  throw Error('Usage: node scripts/verify-event.mjs WORKSPACE EVENT [GENLAYER_TX_HASH...]')
}
const client = createClient({chain:testnetBradbury, endpoint})
async function read(name, args) {
  const call = abi.calldata.encode(abi.calldata.makeCalldataObject(name, args, undefined))
  const response = await fetch(endpoint, {
    method: 'POST', headers: {'content-type':'application/json'}, signal: AbortSignal.timeout(18000),
    body: JSON.stringify({jsonrpc:'2.0', id:1, method:'gen_call', params:[{
      type:'read', from:'0x0000000000000000000000000000000000000000', to:deployment.contract,
      data:abi.transactions.serialize([call,false]), status:'finalized',
    }]}),
  })
  const body = await response.json()
  if (!response.ok || body.error || body.result?.status?.code !== 0) throw Error(name + ': ' + (body.error?.message ?? body.result?.status?.message ?? response.status))
  const decoded = abi.calldata.decode(Buffer.from(body.result.data.replace(/^0x/, ''), 'hex'))
  return decoded ? JSON.parse(decoded) : null
}
const key = [workspace,event]
const meta = await read('event', key)
if (!meta) throw Error('No finalized event was found')
const versions = await Promise.all(Array.from({length:meta.version}, async (_,index) => {
  const schedule = await read('schedule_at',[...key,index+1])
  const inputs = await read('inputs_at',[...key,schedule.revision])
  return {version:index+1,schedule,inputs}
}))
const [latestAttempt, nextSchedule, receipts] = await Promise.all([
  meta.last ? read('attempt',[...key,meta.last]) : null,
  read('schedule_at',[...key,meta.version+1]),
  Promise.all(hashes.map(async hash => {
    const receipt = await client.getTransaction({hash})
    return {hash,status:receipt.statusName,success:isSuccessful(receipt),recipient:receipt.recipient}
  })),
])
console.log(JSON.stringify({contract:deployment.contract,workspace,event,meta,versions,latestAttempt,nextSchedule,receipts},null,2))
if (receipts.some(receipt => receipt.status !== 'FINALIZED' || !receipt.success)) process.exitCode = 1
