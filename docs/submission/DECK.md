# Bond: deck text for the "Widget Factory" template

Paste one block per slide. Keep the headline as the slide title and the bullets as the body. Speaker notes are in _italics_.

---

## 1. Title

**Bond**
$5 to reach a maintainer. Refunded if you're human.

BCH BLAZE 2026 · Mainnet Track

_Hi, we built Bond: refundable anti-spam deposits for open-source issues, enforced by a Bitcoin Cash covenant._

---

## 2. Problem

**Maintainers are drowning in AI slop**

- In January 2026 curl ended its bug bounty: AI-generated "vulnerability reports" cost more to triage than real bugs paid out.
- Opening an issue costs a bot nothing. Reading it costs a maintainer an hour.
- Blocking new accounts or CAPTCHAs hurts real first-time contributors most.

_The asymmetry is the problem: spam is free to send and expensive to read._

---

## 3. Solution

**A refundable deposit, bound to one issue**

- The contributor locks a small BCH deposit for one specific issue or PR.
- Maintainer labels `valid` → refunded. `slop` → sent to charity.
- Nobody acts → anyone can return it to the contributor after a timeout.
- The maintainer never touches a wallet and can never keep the money.

_Humans get their $5 back. Spam pays a charity. Nobody profits from blocking._

---

## 4. Live demo

**Try it in 2 minutes**

[QR code → web app URL]

1. Bond the demo issue with a chipnet wallet over WizardConnect.
2. Press Refund or Forfeit in the demo maintainer pane.
3. Watch the status page link to every real transaction.

_Show the full loop live: connect, lock, label, settle._

---

## 5. The contract

**Three paths. Two destinations. Zero trust in the maintainer.**

```
function forfeit(pubkey pk, sig s) {
    require(hash160(pk) == maintainerPkh);
    require(checkSig(s, pk));
    int i = this.activeInputIndex;
    require(tx.outputs[i].lockingBytecode == charityLock);   // ← ONLY the charity
    require(tx.outputs[i].value >= tx.inputs[i].value - maxFee);
}
```

- `refund` → contributor only · `forfeit` → charity only · `reclaim` → contributor, no key, after timeout.
- The output index equals the input index, the value is checked against the real input, and the fee is capped.
- The GitHub Action's key can grief, never steal.

_Highlight the charityLock line: this is why a leaked bot key isn't a disaster._

---

## 6. Proof

**Real transactions, not mocks**

- Fund, refund, forfeit and keyless reclaim run on chain: _[paste txids from docs/proof/DEMO_TXIDS.md]_
- 6 attack cases, each rejected by the node **and** the CashScript VM: wrong payee, non-charity forfeit, two bonds into one output, fee too high, early reclaim, wrong key.
- A forged bond with an attacker-chosen maintainer key is ignored by discovery.

_Every claim on this slide links to an explorer._

---

## 7. Why BCH

- Fees are fractions of a cent, so a $5 deposit loses almost nothing on the round trip.
- Native covenants (CashScript introspection) enforce "maintainer can't keep it" without a custodian.
- Relative timelocks (`this.age`) make "silence means refund" a consensus rule, not a promise.
- WizardConnect brings wallet UX to a static site, with no backend at all.

---

## 8. Roadmap

- GitHub App with one-click install (no secret to copy).
- CashTokens badge for contributors whose bonds were refunded: a portable "known human" reputation.
- Per-label amounts (e.g. a security report bond vs. a feature request bond).
- Optional maintainer tip on `valid` (contributor opt-in), plus support for GitLab and Codeberg.
- A security audit before mainnet defaults.

---

## 9. Team

**[Name]**: [role, one line]
**[Name]**: [role, one line]

Repo: [github link] · Demo: [web app link] · Community Choice: [bitcoincash:z… token-aware address]

_Thank you. Questions?_
