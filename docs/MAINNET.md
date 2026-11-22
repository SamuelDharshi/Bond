# Running Bond on mainnet

Everything network-specific comes from `BCH_NETWORK` (see `packages/core/src/network.ts`). `pnpm check:network` proves no other source file names a network.

## What is deployed

- **Web app:** production builds default to mainnet. Visitors can switch to chipnet with **Practice on testnet** in the footer.
- **Repo rules:** [`.github/bond.json`](../.github/bond.json) has `"network": "mainnet"`, a refund/forfeit-only bot key (`maintainerPkh`), the charity address, and a 144-block timeout.
- **Bot:** [`.github/workflows/bond.yml`](../.github/workflows/bond.yml) runs the Action with the secret `BOND_MAINTAINER_WIF`.

There is no contract deployment step: the covenant address is derived per repo rules, issue and contributor, and exists as soon as someone funds it.

## Costs

The bot key needs no funds (fees come out of each deposit, capped by `maxFeeSats`). One minimum deposit is 50,000 sats plus a fee of a few hundred sats and a 546-sat ping. About 0.002 BCH covers several test deposits.

## Reproduce the mainnet proof

```bash
# .env needs MAINNET_CONTRIBUTOR_WIF (funded) and MAINNET_MAINTAINER_WIF (matches bond.json)
BCH_NETWORK=mainnet MAINNET_CONFIRM=yes pnpm mainnet:proof
```

It locks and refunds one bond, then locks and forfeits another, and records the transaction ids in `docs/proof/`. It refuses to run without both variables because it spends real BCH.

## Timelock note

Mainnet blocks are 10 minutes today, so one `reclaimBlocks` unit is one block. Chipnet uses Faster Blocks, where a unit is about ten blocks. If mainnet adopts Faster Blocks, change `relativeLockBlocksPerUnit` and `avgBlockSeconds` in `packages/core/src/network.ts`.
