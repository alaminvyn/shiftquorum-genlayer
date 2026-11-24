# Verification evidence

## Bradbury preflight

The Phase 2 genesis and AddressManager matched the official network configuration. The live consensus fee quote for 300/300 phase allocations was 100000000000016941 wei during preflight. The unsigned constructor, custom VM callback, text prompt, JSON prompt, and fixture-backed allocation workflow passed. The callback probes exercised both simulated execution modes with the leader's public data. The pinned runner exposes the custom callback as `gl.vm.run_nondet`.

## Finalized deployment and demonstrations

| Evidence | Verified result |
| --- | --- |
| Public GitHub repository | [ShiftQuorum](https://github.com/alaminvyn/shiftquorum-genlayer) |
| Production Vercel URL | [ShiftQuorum](https://shiftquorum-genlayer.vercel.app/) |
| Contract address and deployment receipt | [Signed deployment](https://scan.bradbury.genlayer.com/tx/0xf6f18a551ee5c4efc0c36c916547dd9f8b8df8e01f7f96ff14bb1ae6662953c3) finalized with successful execution. [Contract](https://scan.bradbury.genlayer.com/address/0x58B9F0B2752DbffbF8829d72806bB39D4991c0f8). |
| Workspace creation | [Finalized successfully](https://scan.bradbury.genlayer.com/tx/0xb2b8de19670ab37af1acbe78dc9f8b23eb101fa21db37327684545b64c7b5764) |
| Initial event inputs | [Finalized successfully](https://scan.bradbury.genlayer.com/tx/0xc8ea4495fb2fd62ce999f7fc6f59a069bf02169d576f05377f70b9c6b5d64fef) |
| Schedule V1 | [Finalized successfully](https://scan.bradbury.genlayer.com/tx/0x056d448bc5fde309feb4026027e57ef53ec9b79dbade9d9e049abcac8193c1ce). Cedar at Welcome, Juniper at Setup, and Reed at Repair. Each has 60 minutes. |
| Input revision | [Finalized successfully](https://scan.bradbury.genlayer.com/tx/0x260bba0a3467dd678d0afbd9177358afca4f941290d176e43b35d1e0eec6be35). Cedar’s availability begins at 10:00. Setup moves to 10:00. |
| Schedule V2 | [Finalized successfully](https://scan.bradbury.genlayer.com/tx/0x966ae8efff4c25dffd011e7698c34e3af5bdab0745e0cb5df5fdfc9617fddaa6). Juniper took Welcome, Cedar took Setup, and Reed kept Repair. |
| Conflict inputs | [Finalized successfully](https://scan.bradbury.genlayer.com/tx/0x4c771af30a039b336a69a8167515f29d45f7f44cec642b7bee6948456a7c1adf). Repair Bench requires a skill no participant has. |
| Certified conflict and absent V3 | [Finalized successfully](https://scan.bradbury.genlayer.com/tx/0xa226a24ec24cfcf2d68880f3e6e1984358bea1894d63819a27818c7b5f1278cf). The latest attempt certifies `repair` as uncovered. The event is on input revision 3 with V2 as its latest schedule. A finalized V3 lookup returned no record. |

All eight signed receipts were independently read from the Bradbury GenLayer RPC and returned successful finalized execution. Both allocations passed independent eligibility, coverage, overlap, and workload checks. V1 matched its original inputs and assignments after V2 and the conflict.

Run `node scripts/verify-event.mjs` for finalized state or pass workspace ID, event ID, and the transaction hashes to check their receipts. The [public workspace](https://shiftquorum-genlayer.vercel.app/) opens the verified event without a wallet.
