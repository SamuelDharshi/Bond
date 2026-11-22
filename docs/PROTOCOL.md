# Bond protocol v1

This document specifies everything a third party needs to create, find, verify and settle Bonds without using this codebase.

## 1. Contract

Source: [`packages/contracts/Bond.cash`](../packages/contracts/Bond.cash) (CashScript `^0.14.0`, compiled with `cashc 0.14.0`, artifact committed at `packages/contracts/src/artifact/Bond.json`). The address type is **P2SH32**.

### Constructor parameters

| #   | Name             | Type      | Value                                                                           |
| --- | ---------------- | --------- | ------------------------------------------------------------------------------- |
| 1   | `contributorPkh` | `bytes20` | hash160 of the contributor's compressed pubkey (refund and reclaim destination) |
| 2   | `maintainerPkh`  | `bytes20` | `bond.json.maintainerPkh`: hash160 of the repo's refund/forfeit-only key        |
| 3   | `charityLock`    | `bytes`   | locking bytecode of `bond.json.charityAddress`                                  |
| 4   | `reclaimBlocks`  | `int`     | `bond.json.reclaimBlocks` (1..65535)                                            |
| 5   | `maxFee`         | `int`     | `bond.json.maxFeeSats` (300..2000, default 1500)                                |
| 6   | `subjectHash`    | `bytes32` | see §2                                                                          |

Every parameter changes the bytecode, so every (repo config, issue, contributor) triple has its own address.

### Spending paths

| Function                    | Selector | Who can call                                          | Allowed destination of `outputs[i]`                      |
| --------------------------- | -------- | ----------------------------------------------------- | -------------------------------------------------------- |
| `refund(pubkey pk, sig s)`  | 0        | holder of the key with `hash160(pk) == maintainerPkh` | contributor P2PKH                                        |
| `forfeit(pubkey pk, sig s)` | 1        | same key                                              | `charityLock` only                                       |
| `reclaim()`                 | 2        | **anyone**, no signature                              | contributor P2PKH, only once `this.age >= reclaimBlocks` |

Rules enforced by every path (`i = this.activeInputIndex`):

1. **Output index = input index.** The bond in input `i` is paid by output `i`. Two bonds can't share one output: the second input would read a missing or wrong output.
2. **Value is checked against the real input value**: `outputs[i].value >= inputs[i].value - maxFee`. The spender can take at most `maxFee` as fee, and overfunding a bond can't be skimmed.
3. **Destination is exact bytecode equality**: the P2PKH of `contributorPkh`, or `charityLock`. The maintainer key can't name any other output.
4. **Timeout**: `this.age >= reclaimBlocks` compiles to `OP_CHECKSEQUENCEVERIFY`. The reclaiming input must set `nSequence = reclaimBlocks`, which is a BIP68 block-based relative lock (bit 31 and bit 22 clear). The transaction version must be 2. `reclaimBlocks` is limited to 1..65535 so it is always a block-based lock.

   **Lock units are 10 minutes, not literal blocks.** Under Faster Blocks (CHIP-2025-03), BIP68 block locks keep their legacy 10-minute meaning. On chipnet (1-minute blocks) one unit takes about 10 blocks; on mainnet today it is 1 block. Clients therefore require `confirmations >= reclaimBlocks * relativeLockBlocksPerUnit + relativeLockSafetyBlocks` (chipnet adds a 1-block margin, mainnet 0) (`packages/core/src/network.ts`: chipnet 10, mainnet 1) and treat the node as the final judge: a `non-BIP68-final` rejection means "try again shortly".

What the maintainer key **can** do: choose refund or forfeit, or do nothing. What it **can't** do: receive the funds, redirect them, or take more than `maxFee`. A stolen key can grief (forfeit genuine bonds to charity) but can't steal.

## 2. subjectHash

```
subjectHash = sha256( utf8( "github:" + lower(owner) + "/" + lower(repo) + "#" + number ) )
```

`number` is the decimal issue/PR number with no leading zeros. Example: `github:curl/curl#42` → `17e4b189e3cc816975ae6c156acdd8b6c625fd06736c3df69fab60d703de4b2c`.

Issues and PRs share GitHub's number space, so one formula covers both.

## 3. Funding transaction

Built by the contributor (the web app, signed by their wallet over WizardConnect):

| Output | Content                                                                |
| ------ | ---------------------------------------------------------------------- |
| `0`    | bond amount (≥ `minValueSats`) → Bond contract P2SH32 locking bytecode |
| `1`    | `OP_RETURN` hint, see §4 (0 sats)                                      |
| `2`    | 546 sats (dust) → `registryAddress`                                    |
| `3`    | change → contributor (omitted if below dust)                           |

Output 2 exists so the funding tx shows up in `blockchain.address.get_history(registryAddress)`. No indexer is needed.

## 4. OP_RETURN hint (output 1)

One data push of exactly 57 bytes:

```
6a                      OP_RETURN
39                      push 57 bytes
42 4f 4e 44             "BOND"
01                      version
<32 bytes>              subjectHash
<20 bytes>              contributorPkh
```

Total locking bytecode: 59 bytes. Any other length, magic or version is not a v1 hint.

## 5. Discovery (what the Action and the web app do)

```
history  = blockchain.address.get_history(registryAddress)
for tx in history:
    hint = decode(tx.outputs[1])                    # skip if not a v1 hint
    if hint.subjectHash != subjectHash(issue): skip
    bond = derive(bond.json, issue, hint.contributorPkh)   # repo's OWN config
    require tx.outputs[0].lockingBytecode == bond.lockingBytecode    # the proof
    require tx.outputs[0].value >= minValueSats
    status = spentBy(bond.address, tx.txid:0)
```

**The hint is a pointer, never proof.** Only the exact bytecode match counts. A bond derived with any other `maintainerPkh`, charity, timeout or fee cap gets a different address and is ignored. The e2e suite tests this (test 12).

### Status

| Status        | Meaning                                                                                        |
| ------------- | ---------------------------------------------------------------------------------------------- |
| `unfunded`    | no matching bond in registry history                                                           |
| `bonded`      | UTXO `funding:0` unspent, fewer than `reclaimBlocks × relativeLockBlocksPerUnit` confirmations |
| `reclaimable` | UTXO unspent, confirmations ≥ `reclaimBlocks × relativeLockBlocksPerUnit`                      |
| `refunded`    | spent; output `i` pays the contributor; selector 0                                             |
| `forfeited`   | spent; output `i` pays `charityLock`                                                           |
| `reclaimed`   | spent; output `i` pays the contributor; selector 2                                             |

The spending tx is found in `get_history(bondAddress)`. The selector is the push just before the redeem script in the unlocking bytecode.

## 6. `.github/bond.json`

```json
{
  "version": 1,
  "network": "chipnet",
  "maintainerPkh": "<hex 20 bytes>",
  "charityAddress": "<cashaddr>",
  "registryAddress": "<cashaddr, default: maintainer P2PKH>",
  "minValueSats": 50000,
  "reclaimBlocks": 2016,
  "maxFeeSats": 1500,
  "labels": { "bonded": "bonded ✓", "valid": "valid", "slop": "slop" },
  "appUrl": "<optional web app URL>"
}
```

Validation (zod, `packages/core/src/bondConfig.ts`): `network` must equal the active `BCH_NETWORK`. Addresses must be valid for that network. `maxFeeSats ≤ 2000`. `reclaimBlocks` must be in 1..65535. The charity must not be the maintainer address.

**Changing bond.json changes every future bond address.** Existing bonds stay spendable (the Action can still find them only while the config fields they were derived from are unchanged). See the Limitations section in the README.
