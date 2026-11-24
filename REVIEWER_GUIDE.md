# Verify ShiftQuorum

Open the [public workspace](https://shiftquorum-genlayer.vercel.app/) and follow the [transaction evidence](submission-assets/VERIFICATION_EVIDENCE.md).

1. Open the event without connecting a wallet. Select **History** and open **Schedule V1**.
2. Open **Schedule V2** and inspect its changed assignment and input revision. Return to V1 and confirm the original assignments remain visible.
3. Inspect the certified conflict and the stale input label on V2. Confirm there is no V3.
4. Open **Schedule details** for the contract and relevant transaction links. Verify each GenLayer receipt reached finality and executed successfully. Compare finalized `schedule_at`, `inputs_at`, and `attempt` reads against the evidence table.
5. A funded Bradbury wallet can create a workspace, save an event, and generate its own schedule.

The [synthetic event fixture](fixtures/community-repair.json) gives two hard-valid allocations. For revision, move the incumbent welcome participant's start to 10:00 and move the setup task to 10:00–11:00, leaving a feasible schedule. For conflict, change the repair task's required skill to `unavailable`. The [contract source](contracts/shiftquorum.py) contains the hard checks and semantic validator. Local tests use a VM double, while the unsigned Bradbury preflight exercises the pinned runner.

For an independent snapshot, run `node scripts/verify-event.mjs WORKSPACE EVENT [GENLAYER_TX_HASH...]`. It reads every finalized schedule and its input snapshot, the latest attempt, the next version lookup, and the specified transaction receipts.
