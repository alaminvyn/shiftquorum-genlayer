# ShiftQuorum

ShiftQuorum coordinates single-day community events. Organizers enter task slots, skills, availability, workload limits, and natural-language preferences. GenLayer generates and evaluates assignments that the team can use on a shared scheduling board.

## How it works

A single Python Intelligent Contract owns the workflow. A Bradbury leader proposes assignments with a JSON LLM call. Validators check the same frozen event input and perform their own semantic review through the pinned runner's custom `gl.vm.run_nondet` callback. A proposed preference improvement used to reject a candidate must itself pass hard constraints. The contract rechecks complete task coverage, known IDs, skill compatibility, availability, half-open intervals, and workload caps before writing a schedule.

The app reads finalized state. Each schedule points to its immutable input revision. An availability edit creates a new input revision and leaves past assignments accessible. A task with zero eligible participants yields a stored conflict instead of a schedule version. Failed model execution and disagreement do not certify infeasibility.

An event supports up to eight people and eight task slots. Times are integer wall-clock minutes from midnight on the event date in a fixed UTC offset. `24:00` is allowed as an end time. Multi-day events, timezone transitions, independent participant accounts, and optimality guarantees are outside the scope.

## Run locally

Use Node.js 24 and pnpm. Install dependencies with `pnpm install --frozen-lockfile`. Run `pnpm dev`, `pnpm lint`, `pnpm test`, and `pnpm build`. The production configuration is in `src/deployment.json`. A local read-only deployment can use `VITE_SHIFTQUORUM_CONTRACT`. Any deployed address, website, and completed onchain evidence are listed in [Verification evidence](submission-assets/VERIFICATION_EVIDENCE.md).

Public event URLs include workspace and event IDs. A funded Bradbury wallet is required for workspace creation and edits. Participant records are managed by the organizer. Use synthetic aliases and keep personal data out of public inputs and calldata. See [Security](SECURITY.md) and the [Reviewer Guide](REVIEWER_GUIDE.md).
