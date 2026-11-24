# Verification evidence

## Bradbury preflight

The Phase 2 genesis and AddressManager matched the official network configuration. The live consensus fee quote for 300/300 phase allocations was 100000000000016941 wei during preflight. The unsigned constructor, custom VM callback, text prompt, JSON prompt, and fixture-backed allocation workflow passed. The callback probes exercised both simulated execution modes with the leader's public data. The pinned runner exposes the custom callback as `gl.vm.run_nondet`.

## Finalized deployment and demonstrations

| Evidence | Verified result |
| --- | --- |
| Public GitHub repository | [ShiftQuorum](https://github.com/alaminvyn/shiftquorum-genlayer) |
| Production Vercel URL | Pending |
| Contract address and deployment receipt | [Signed deployment](https://scan.bradbury.genlayer.com/tx/0xf6f18a551ee5c4efc0c36c916547dd9f8b8df8e01f7f96ff14bb1ae6662953c3) finalized with successful execution. [Contract](https://scan.bradbury.genlayer.com/address/0x58B9F0B2752DbffbF8829d72806bB39D4991c0f8). |
| Event URL and Schedule V1 receipt | Pending |
| Input revision and Schedule V2 receipt | Pending |
| Certified conflict receipt and absent V3 | Pending |

Unsigned execution and local tests are preflight evidence. The deployed workflow requires successful finalized GenLayer receipts and finalized state reads to complete this table.
