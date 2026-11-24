import { abi, createClient, isSuccessful } from 'genlayer-js'
import { testnetBradbury } from 'genlayer-js/chains'

export type Hex = `0x${string}`
type Provider = NonNullable<NonNullable<Parameters<typeof createClient>[0]>['provider']>
export const endpoint = 'https://rpc-bradbury.genlayer.com'
export const explorer = 'https://scan.bradbury.genlayer.com'
const manager = '0x3F71AE080BD6270A91dBcc7960d88797828538E0'
const genesis = '0x17d89764d4f4f963158fc4c5e8f2cb670c2837740b35f37081c12860c3df97e4'
const chainId = '0x107d'
export const validAddress = (value: string): value is Hex => /^0x[0-9a-f]{40}$/i.test(value) && !/^0x0{40}$/.test(value)
export const client = createClient({ chain: testnetBradbury, endpoint })
export const wallet = () => (window as Window & { ethereum?: Provider }).ethereum
export type Receipt = Awaited<ReturnType<typeof client.getTransaction>>
export const succeeded = (receipt: Receipt) => receipt.statusName === 'FINALIZED' && isSuccessful(receipt)

export async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const response = await fetch(endpoint, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({jsonrpc: '2.0', id: 1, method, params}), signal: AbortSignal.timeout(18000),
  })
  if (!response.ok) throw Error(`Bradbury RPC returned HTTP ${response.status}`)
  const data = await response.json()
  if (data.error) throw Error(data.error.message.slice(0, 240))
  return data.result
}

export async function networkCheck() {
  const [id, block, code] = await Promise.all([
    rpc<string>('eth_chainId', []), rpc<{hash: string}>('eth_getBlockByNumber', ['0x0', false]),
    rpc<string>('eth_getCode', [manager, 'latest']),
  ])
  if (id !== chainId || block?.hash !== genesis || code.length < 4) throw Error('Bradbury Phase 2 identity mismatch.')
}

export async function connect() {
  const provider = wallet()
  if (!provider) throw Error('Open ShiftQuorum in a browser with an Ethereum wallet.')
  const accounts = await provider.request({method: 'eth_requestAccounts'}) as Hex[]
  if (!accounts[0] || !validAddress(accounts[0])) throw Error('No wallet account connected.')
  return accounts[0]
}

export async function switchNetwork() {
  const provider = wallet()
  if (!provider) throw Error('Ethereum wallet unavailable.')
  try {
    await provider.request({method: 'wallet_switchEthereumChain', params: [{chainId}]})
  } catch (error) {
    if ((error as {code?: number}).code !== 4902) throw error
    await provider.request({method: 'wallet_addEthereumChain', params: [{chainId, chainName: 'GenLayer Bradbury Phase 2',
      nativeCurrency: {name: 'GEN', symbol: 'GEN', decimals: 18}, rpcUrls: [endpoint],
      blockExplorerUrls: ['https://scan.testnet-chain.genlayer.com']}]})
  }
}

export async function signer(account: Hex, awaiting: () => void) {
  const provider = wallet()
  if (!provider) throw Error('Connect your wallet first.')
  const [id, block, accounts] = await Promise.all([
    provider.request({method: 'eth_chainId'}),
    provider.request({method:'eth_getBlockByNumber',params:['0x0',false]}) as Promise<{hash: string} | null>,
    provider.request({method:'eth_accounts'}) as Promise<string[]>,
    networkCheck(),
  ])
  if (id !== chainId || block?.hash !== genesis) throw Error('Select Bradbury Phase 2 using its current RPC URL.')
  if (accounts[0]?.toLowerCase() !== account.toLowerCase()) throw Error('The active wallet account changed.')
  const guarded: Provider = {
    async request(input: Parameters<Provider['request']>[0]) {
      if (input.method === 'eth_sendTransaction') {
        const envelope = (input.params as unknown[])?.[0] as Record<string, string> | undefined
        if (!envelope?.from || envelope.from.toLowerCase() !== account.toLowerCase() || !envelope.to || !envelope.data) {
          throw Error('The transaction envelope is incomplete or the account changed.')
        }
        const {from, to, data, value = '0x0', gas} = envelope
        const [estimate, balance, gasPrice] = await Promise.all([
          rpc<Hex>('eth_estimateGas', [{from, to, data, value}]),
          rpc<Hex>('eth_getBalance', [from, 'latest']),
          rpc<Hex>('eth_gasPrice', []),
        ])
        if (gas && BigInt(gas) < BigInt(estimate)) throw Error('Transaction gas cap is below the live estimate.')
        if (BigInt(balance) < BigInt(value) + BigInt(gas ?? estimate) * BigInt(gasPrice)) throw Error('Insufficient testnet GEN for consensus fees and gas.')
        awaiting()
      }
      return provider.request(input)
    },
  }
  return createClient({chain: testnetBradbury, endpoint, provider: guarded, account})
}

export async function fees() {
  const {distribution, feeValue, messageAllocations} = await client.estimateTransactionFees({
    leaderTimeunitsAllocation: 300n, validatorTimeunitsAllocation: 300n,
  })
  return {distribution, feeValue, messageAllocations}
}

export async function read<T>(address: Hex, method: string, args: (string | number)[], json = true): Promise<T | null> {
  const encoded = abi.calldata.encode(abi.calldata.makeCalldataObject(method, args, undefined))
  const response = await rpc<{data: string; status: {code: number; message: string}}>('gen_call', [{
    type: 'read', from: '0x0000000000000000000000000000000000000000', to: address,
    status: 'finalized', data: abi.transactions.serialize([encoded, false]),
  }])
  if (response.status.code !== 0) throw Error(response.status.message)
  const bytes = response.data.replace(/^0x/, '').match(/../g) ?? []
  const value = abi.calldata.decode(Uint8Array.from(bytes, byte => parseInt(byte, 16)))
  return typeof value === 'string' && value ? (json ? JSON.parse(value) : value) as T : null
}
