# PRD: Bond — Refundable Anti-Spam Deposits on Bitcoin Cash

Nov 20, 2026 · @Chris

Bond lets open-source maintainers require a small refundable BCH deposit on new issues and PRs, so spam costs money and honest contributions stay free. Target: a mainnet-ready submission to BCH BLAZE 2026 by Nov 22, 2026 19:30 IST.

## Summary and problem

AI-generated spam is drowning open-source maintainers, and the usual fixes either punish honest contributors or pay the spammers. Bond prices spam without pricing honesty: contributors lock about $5 of BCH, get it back when a maintainer marks their issue genuine, and lose it to charity if it's slop.

**Evidence:**

- curl ended its bug bounty on 31 Jan 2026 after a flood of AI-slop reports; by mid-2025 about 20% of its submissions were slop ([The Register](https://www.theregister.com/2026/01/21/curl_ends_bug_bounty/), [Bugcrowd](https://www.bugcrowd.com/blog/hacker-opinion-piece-how-lazy-hacking-killed-curls-bug-bounty/)).
- Python, React and Apache Airflow report the same problem.
- Removing cash rewards cut the incentive but did not cut the reviewing cost. Bond attacks that cost directly.

**Why BCH:** fees under a cent make a $5 refundable deposit practical. Covenants can enforce "refund to contributor or pay charity, never the maintainer" without a company in the middle. WizardConnect gives one-tap signing from existing wallets.

**One-line pitch:** "$5 to reach a maintainer. Refunded if you're human."

## Goals, non-goals and success metrics

The hackathon goal is one flawless bond-to-refund loop on mainnet that a judge completes alone in under 2 minutes.

**Goals (v1, BLAZE submission):**

- A contributor can bond a GitHub issue from a browser wallet via WizardConnect.
- A maintainer can refund or forfeit by adding a label, with no wallet needed.
- A contributor can reclaim after the timeout if nobody acts.
- Funds can only ever go to the contributor or the repo's chosen charity.

**Non-goals (v1):**

- Identity or reputation systems: no on-chain reputation counter, no NFT badges.
- Paying maintainers. Forfeits never go to the maintainer, by design.
- A full GitHub App, multi-platform inboxes, or fiat pricing of the bond.
- Requiring bonds on every repo. It is opt-in per repo.

**Success metrics:**

| Metric | Hackathon target | 3-month target |
| --- | --- | --- |
| Mainnet txs shown (bond, refund, forfeit, reclaim) | 4 distinct txids | — |
| Judge time from link to first refund | under 2 min | under 1 min |
| Wallets tested with WizardConnect | 2 (Paytaca, Selene) | 3+ |
| Repos with `bond.json` installed | 1 demo repo | 10 real repos |
| Share of bonded issues refunded (honest rate) | — | above 80% |

## Users and use cases

The maintainer is the buyer and the contributor is the user. Bond succeeds only if it is effortless for both, so the maintainer flow is just labels, and the contributor flow is one page and one tap.

| User | Job to be done | What Bond gives them |
| --- | --- | --- |
| Maintainer of a busy repo | Stop triaging AI slop without scaring off real contributors | A "bonded ✓" filter, and slop that pays charity instead of wasting review time |
| Honest contributor | Get a real bug looked at fast | A refundable signal of seriousness: money back when the issue is valid |
| Security researcher | Report a vulnerability and be taken seriously | A bonded report jumps the queue |
| Charity or ecosystem fund | Receive donations | Forfeited bonds go there automatically |

**Primary use case (v1):** GitHub issues and PRs on repos that opt in.

**Next use cases (post-hackathon), same contract:** security-disclosure inboxes, creator and journalist contact forms, job applications ("apply with a bond"), DAO proposal submissions, cold-email gates.

## Bond lifecycle

&#91;embedded content: bond lifecycle · 3 steps, 3 outcomes\]

A bond has exactly three exits. The maintainer's `valid` label refunds it, `slop` sends it to charity, and silence lets the contributor reclaim it after the timeout.

## Functional requirements

Four components ship in v1. P0 items are needed to pass the hackathon gate and the demo; P1 items come only if time remains after Sunday 08:30 IST.

| ID | Component | Requirement | Priority |
| --- | --- | --- | --- |
| C1 | Contract | Three spend paths, `refund`, `forfeit` and `reclaim`, as specified in the next section | P0 |
| C2 | Contract | One contract address per issue: `subjectHash = sha256("owner/repo#number")` is a constructor parameter | P0 |
| R1 | Repo config | `.github/bond.json` holds `maintainerPkh`, `charityLock`, `minValueSats`, `reclaimDays`, `maxFeeSats` | P0 |
| W1 | Web app | Bond page: paste an issue URL, see amount and terms, connect via WizardConnect, fund the bond | P0 |
| W2 | Web app | The bond page derives the contract address from `bond.json` plus the issue, so contributors can't pick the maintainer key | P0 |
| W3 | Web app | Status view: bonded, refunded, forfeited or reclaimable, with explorer links | P0 |
| W4 | Web app | Maintainer pane for the demo, using a clearly labelled public demo key | P0 |
| W5 | Web app | Reclaim button, enabled once `tx.age` passes | P0 |
| W6 | Web app | Network toggle: mainnet by default, chipnet for practice | P1 |
| A1 | GitHub Action | On issue/PR open and on a 5-minute schedule: find the bond by expected address and `minValue`, then label it "bonded ✓" or comment with the bond link | P0 |
| A2 | GitHub Action | On label `valid`: build and broadcast `refund`. On label `slop`: build and broadcast `forfeit`. Signs with `BOND_MAINTAINER_KEY` from repo secrets | P0 |
| A3 | GitHub Action | Spent-bond awareness: check tx history, not just unspent outputs, so a refunded bond shows as "refunded" and not "unbonded" | P1 |
| D1 | Docs | README with "Try it in 3 steps", a limitations list, and install steps for maintainers | P0 |

**Out of scope:** NFT receipts, reputation counters, a GitHub App, Discord or email integrations, and fiat-pegged amounts.

## Smart contract specification

The contract has one rule that makes the whole product safe: money leaves only to the contributor or the charity, and every output is paired to its own input. The sketch below hasn't been compiled yet; it must pass cashc and the tests in the table before mainnet.

**Constructor parameters:** `contributorPkh` (bytes20), `maintainerPkh` (bytes20), `charityLock` (bytes, locking bytecode), `reclaimBlocks` (int), `maxFee` (int, 2,000 sats or less), `subjectHash` (bytes32).

| Function | Who signs | Output rule (at index `i = this.activeInputIndex`) | Timing |
| --- | --- | --- | --- |
| `refund` | Maintainer | `outputs[i]` pays P2PKH(contributorPkh), value at least input minus `maxFee` | Any time |
| `forfeit` | Maintainer | `outputs[i].lockingBytecode == charityLock`, value at least input minus `maxFee` | Any time |
| `reclaim` | Contributor | Any output (the contributor's own choice) | `tx.age >= reclaimBlocks` |

```
pragma cashscript ^0.11.0;
contract Bond(bytes20 contributorPkh, bytes20 maintainerPkh, bytes charityLock,
              int reclaimBlocks, int maxFee, bytes32 subjectHash) {
  function refund(pubkey pk, sig s) {
    require(hash160(pk) == maintainerPkh && checkSig(s, pk));
    int i = this.activeInputIndex;
    require(tx.outputs[i].lockingBytecode == new LockingBytecodeP2PKH(contributorPkh));
    require(tx.outputs[i].value >= tx.inputs[i].value - maxFee);
  }
  function forfeit(pubkey pk, sig s) {
    require(hash160(pk) == maintainerPkh && checkSig(s, pk));
    int i = this.activeInputIndex;
    require(tx.outputs[i].lockingBytecode == charityLock);
    require(tx.outputs[i].value >= tx.inputs[i].value - maxFee);
  }
  function reclaim(pubkey pk, sig s) {
    require(hash160(pk) == contributorPkh && checkSig(s, pk));
    require(tx.age >= reclaimBlocks);
    require(subjectHash.length == 32);
  }
}
```

**Security rules and required tests:**

| Threat | Defence | Test |
| --- | --- | --- |
| Two bonds paid through one output | Output index equals input index | Spend 2 bonds in one tx with a single output: must fail |
| Bond value burned as miner fee | `value >= input - maxFee` | Fee above `maxFee`: must fail |
| Contributor names themselves maintainer | Action and web app rebuild the address from `bond.json` | Bond with a wrong `maintainerPkh` is never labelled |
| One bond reused for several issues | `subjectHash` sits in the bytecode, so one address per issue | Bond for #1 does not label #2 |
| Stolen CI key | Key can only refund or pay charity; rotate via `bond.json` | Forfeit to any other address: must fail |
| Early reclaim | `tx.age` check | Reclaim before `reclaimBlocks`: must fail |

**Defaults:** bond 0.0005 BCH for the demo (about $5 in production), `reclaimDays` 14 (2,016 blocks), and `reclaimBlocks` 1 for the pre-aged demo bond.

## Architecture and tech stack

Bond needs no backend or database. The blockchain is the database, the web app is static, and the GitHub Action is the only automation.

| Layer | Choice | Notes |
| --- | --- | --- |
| Contract | CashScript (latest, Layla-compatible) | Compile with cashc; test with the CashScript MockNetworkProvider, then chipnet |
| Chain access | Electrum/Fulcrum servers via the CashScript ElectrumNetworkProvider | Keep a fallback server list |
| Wallet connect | WizardConnect (`@wizardconnect/core`) | CashScript's WalletConnect guide shows the HD-path input format WizardConnect needs |
| Web app | Vite + React + TypeScript, deployed on Vercel | Static; reads `bond.json` from the public repo via raw.githubusercontent |
| GitHub Action | Node 20 Action in `bond-action/` | Uses `GITHUB_TOKEN` for labels and comments, `BOND_MAINTAINER_KEY` secret for refund and forfeit |
| Explorer links | A public BCH explorer (e.g. Blockchair) | Shown after every tx |
| Demo repo | `bond-demo` public repo with `bond.json` | Its maintainer key is public and labelled "demo only" |

**Data flow:** the web app reads `bond.json`, derives the address and funds it through the wallet. The Action watches the repo, checks the address on-chain, labels the issue, and builds the refund or forfeit transaction when a maintainer adds a label. The contributor's reclaim goes through the web app.

## Hackathon compliance and judge demo

Every BLAZE Mainnet Track gate rule maps to a concrete deliverable. A missing one means the project is never scored.

| Gate rule | How Bond meets it |
| --- | --- |
| Sends BCH mainnet transactions | Bond, refund, forfeit and reclaim txs on mainnet, with txids in the README |
| Live click-to-try demo | Vercel URL, mainnet by default, no install |
| WizardConnect | Contributor funding and reclaim go through WizardConnect |
| Widget Factory deck | Built on the official template: problem, CashScript, proof slides |
| Original work in the hackathon window | Public repo, all commits 14 to 22 Nov |
| Telegram "real" confirmation + roll call | Done by Saturday |

**Judge demo script (under 2 minutes):**

1. Open the link. The hero line says "$5 to reach a maintainer. Refunded if you're human."
2. Click "Bond demo issue #1" and connect Paytaca or Selene via WizardConnect.
3. Approve 0.0005 BCH. The issue on GitHub shows "bonded ✓" within the next Action run, and the app shows the explorer link.
4. Switch to the Maintainer pane and click Refund (or Forfeit to charity). The tx appears; funds return to the judge's wallet.
5. Optional: click Reclaim on the pre-aged bond to see the timeout path.

**Deck (Widget Factory), 3 key slides:**

- **Problem:** curl killed its bug bounty over AI slop, with the evidence line.
- **Contract:** the `forfeit` function with the `charityLock` line highlighted: "the maintainer can't take your money".
- **Proof:** four mainnet txids plus a QR code to the live demo.

## Risks and mitigations

The top risk is wallet signing, not the contract: if WizardConnect wallets won't sign a covenant spend, the demo breaks. That is why it gets tested in the first three hours.

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Wallets refuse to sign custom covenant inputs over WizardConnect | Medium | Demo dead | Spike in hours 0 to 3. Contributor funding is a plain P2SH payment; reclaim can fall back to an app-derived key |
| WizardConnect's Nostr relay is down during judging | Low | Demo stalls | Configure a fallback relay; show the recorded video |
| Judges see "pay to contribute" as gatekeeping | Medium | Lower score | Frame as opt-in per repo and refunded to humans; show the refund first in the demo |
| GitHub Action latency (scheduled runs are slow) | High | Label appears late | Trigger on issue events too; the app shows on-chain status instantly |
| Contract bug drains bonds | Low | Severe | Index-pairing tests, small demo amounts, `maxFee` cap |
| Bond proves money, not identity | Certain | Limits the claim | State it in the limitations list; out of v1 scope |
| Time overrun | Medium | Missed deadline | Freeze features Sunday 08:30 IST; P1 items only after that |

## Milestones (IST)

Feature freeze is Sunday 08:30 and submission is Sunday 18:30, an hour of buffer before the 19:30 cutoff. Owners are roles; replace them with names.

1. **Fri 21:00 to Sat 00:00, wallet spike** (Frontend dev): WizardConnect connects in Paytaca and Selene; a covenant spend is signed on mainnet. Telegram confirmation is done.
2. **Sat 08:30, contract done** (Contract dev): all three paths and every security test in the contract section pass on chipnet.
3. **Sat 20:30, mainnet loop** (Contract dev + Frontend dev): bond, refund and forfeit work on mainnet from the Vercel app; the maintainer pane works.
4. **Sun 08:30, Action + freeze** (Integration dev): the Action labels and refunds or forfeits on the demo repo; a pre-aged reclaim bond is funded; features are frozen.
5. **Sun 16:30, story done** (Pitch owner): Widget Factory deck, 2-minute video, README, and one outsider test run cold.
6. **Sun 18:30, submit** (everyone): DoraHacks entry with all links; recheck the live demo in an incognito window.

## Open questions

- [ ] Which charity address receives forfeits in the demo: a BCH ecosystem fund or a well-known charity that accepts BCH?
- [ ] Is the default bond about $5, or should repos set it in BCH only (no fiat peg in v1)?
- [ ] Does Paytaca or Selene sign the reclaim covenant spend over WizardConnect, or does reclaim need the fallback key?
- [ ] Should bonds also gate PRs in v1, or issues only, to keep scope down?
- [ ] Do we also enter the SolidCash bounty (3.5 BCH)? That would mean writing the contract in SolidCash instead of CashScript; check its requirements first.
