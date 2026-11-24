# ShiftQuorum

**Primary and secondary tags**
Owner selects tags and submits in the Builder Portal.

**One-liner**
ShiftQuorum uses GenLayer to allocate community tasks around volunteers’ skills, availability, workload limits, and preferences.

**Project description**
Community organizers use ShiftQuorum to plan single-day events. A GenLayer leader proposes an allocation from tasks, skills, availability, workload limits, and plain-language preferences. Validators independently evaluate the proposal. The contract enforces complete coverage, skill and availability compatibility, no overlaps, and workload limits. Organizers can adjust inputs, generate replacement schedules, and inspect immutable previous assignments. A task without an eligible participant produces a certified conflict.

**Website**
[ShiftQuorum on Vercel](https://shiftquorum-genlayer.vercel.app/)

**GitHub repository**
[ShiftQuorum source](https://github.com/alaminvyn/shiftquorum-genlayer)

**Contract and transaction evidence**
[Bradbury contract](https://scan.bradbury.genlayer.com/address/0x58B9F0B2752DbffbF8829d72806bB39D4991c0f8) · [Eight finalized transactions and state checks](VERIFICATION_EVIDENCE.md)

**Reviewer instructions**
Open the public workspace without a wallet. Select History to view V1 and V2. V2 assigns Welcome to Juniper, and V1 still assigns it to Cedar. Return to V2 to inspect the certified Repair Bench conflict. Open Schedule details for the contract and transactions. See the [Reviewer Guide](../REVIEWER_GUIDE.md) for the independent reads.

**Expected verification outcome**
Schedule V1 covers every required task. V2 references updated inputs and reassigns the affected task while V1 remains available. A certified conflict identifies the uncovered task. V2 remains the latest schedule and V3 is absent.

**Project logo**
[1024 × 1024 PNG](project-logo.png)
