import { abi, createClient } from 'genlayer-js'
import { testnetBradbury } from 'genlayer-js/chains'
import { readFile } from 'node:fs/promises'

const endpoint = 'https://rpc-bradbury.genlayer.com'
const sender = '0x1111111111111111111111111111111111111111'
const zero = '0x0000000000000000000000000000000000000000'
const manager = '0x3F71AE080BD6270A91dBcc7960d88797828538E0'
const genesis = '0x17d89764d4f4f963158fc4c5e8f2cb670c2837740b35f37081c12860c3df97e4'
async function rpc(method, params) {
  const response = await fetch(endpoint, { method: 'POST', headers: {'content-type':'application/json'},
    body: JSON.stringify({ jsonrpc:'2.0', id:1, method, params }), signal: AbortSignal.timeout(45000) })
  const body = await response.json()
  if (body.error) {
    const decoded = Buffer.from(body.error.data || '', 'hex').toString().match(/[ -~]{8,}/g)?.filter(part => /error|exit|panic|module|disab|llm/i.test(part) && !part.includes('cpython')).slice(-22).join(' | ')
    throw Error(method + ': ' + (decoded || body.error.message).slice(0, 500))
  }
  return body.result
}
const [id, block, managerCode] = await Promise.all([
  rpc('eth_chainId', []), rpc('eth_getBlockByNumber', ['0x0', false]), rpc('eth_getCode', [manager, 'latest']),
])
if (id !== '0x107d' || block.hash !== genesis || managerCode === '0x') throw Error('Wrong network')
const client = createClient({chain: testnetBradbury, endpoint})
const fee = await client.estimateTransactionFees({leaderTimeunitsAllocation:300n, validatorTimeunitsAllocation:300n})
console.log('Phase 2 identity verified; unsigned fee quote:', fee.feeValue.toString(), 'wei')
const contract = await readFile(new URL('../contracts/shiftquorum.py', import.meta.url), 'utf8')
const probe = contract.replace('        pass\n', `        def lead():
            try:
                return gl.nondet.exec_prompt('Return a JSON object with ok set to true.', response_format='json')
            except Exception as error:
                return {'error': repr(error)}
        def validate(result):
            return isinstance(result, gl.vm.Return) and result.calldata == {"ok": True}
        try:
            result = gl.vm.run_nondet(lead, validate)
        except Exception as error:
            raise gl.vm.UserError(repr(error))
        if result != {"ok": True}:
            raise gl.vm.UserError(repr(result))
`)
const calldata = abi.calldata.encode(abi.calldata.makeCalldataObject(undefined, [], undefined))
const constant = probe.replace(/            try:[\s\S]+?        def validate/, '            return {"ok": True}\n        def validate')
const textProbe = probe.replace("return gl.nondet.exec_prompt('Return a JSON object with ok set to true.', response_format='json')", "return {'ok': bool(gl.nondet.exec_prompt('Reply yes.'))}")
const fixture = await readFile(new URL('../fixtures/community-repair.json', import.meta.url), 'utf8')
const workflow = contract.replace('        pass\n', `        self.create_workspace("preflight")
        self.save_event("preflight", "event", 0, ${JSON.stringify(fixture)})
        self.generate("preflight", "event", 1, 0, "first")
        require(self.schedule_at("preflight", "event", 1), "Missing schedule")
`)
const settled = await Promise.allSettled([['contract', contract], ['custom VM probe', constant], ['JSON LLM probe', probe], ['text LLM probe', textProbe], ['allocation workflow', workflow]].map(async ([label, code]) => {
  const data = abi.transactions.serialize([code, calldata, false])
  const result = await rpc('gen_call', [{type:'deploy',from:sender,to:zero,data,status:'finalized'}])
  if (result.status?.code !== 0) throw Error(label + ': ' + JSON.stringify(result))
  if (code !== contract) {
    const vote = await rpc('gen_call', [{type:'deploy',from:sender,to:zero,data,status:'finalized',leader_public_data:result.leaderPublicData}])
    if (vote.status?.code !== 0 || vote.nondetDisagreementCallNo != null) throw Error(label + ': validator rejected simulation')
  }
  console.log(label + ': unsigned execution passed')
}))
for (const result of settled) if (result.status === 'rejected') { console.error(result.reason); process.exitCode = 1 }
