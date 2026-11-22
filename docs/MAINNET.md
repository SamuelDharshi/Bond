# Mainnet flip (documented, not executed)

Everything network-specific comes from `BCH_NETWORK` (see `packages/core/src/network.ts`). `pnpm check:network` proves no other source file names a network.

1. **Switch network.** In `.env` (and in Vercel or GitHub Pages build settings) set `BCH_NETWORK=mainnet`.
2. **New maintainer key.** Move the chipnet keys aside (`mv .env .env.chipnet`), set `BCH_NETWORK=mainnet` in a fresh `.env`, run `pnpm wallets:new`, and store `MAINTAINER_WIF` as the `BOND_MAINTAINER_WIF` secret in the demo repo. **Don't** set `VITE_DEMO_MAINTAINER_WIF` on mainnet unless you accept that anyone can refund or forfeit the demo bonds (they still can't steal them).
3. **bond.json.** `pnpm demo:config` rewrites `demo-repo/.github/bond.json` with `"network": "mainnet"` and `bitcoincash:` addresses. Use a real charity address you control or trust, then push it to the demo repo.
4. **Fund.** Send about **0.002 BCH** (200,000 sats) to the contributor address printed by `pnpm balance`. The seed uses 4 bonds × 50,000 sats plus fees, and most of it comes back.
5. **Seed.** `pnpm demo:seed`. The txids land in `docs/proof/DEMO_TXIDS.md` under a "(mainnet)" section.
6. **Redeploy the web app** with `BCH_NETWORK=mainnet` (`vercel --prod` or push to `main` for Pages).

## The 4 mainnet txids the submission needs

From `docs/proof/DEMO_TXIDS.md` → "demo seed … (mainnet)":

1. **Fund**: `(a: left bonded) fund #1`
2. **Refund**: `(b: refunded) refund #2`
3. **Forfeit to charity**: `(c: forfeited) forfeit #3 -> charity`
4. **Reclaim (permissionless)**: press _Return deposit to contributor_ on the status page for issue #4 once it has `reclaimBlocks` confirmations (mainnet has 10-minute blocks today, so the factor is 1 and `reclaimBlocks: 1` is ~10 minutes; when Faster Blocks activates on mainnet, set `relativeLockBlocksPerUnit` to 10 and `avgBlockSeconds` to 60 in `packages/core/src/network.ts`, as chipnet already has) (or run the Action with `auto-reclaim: true`). Copy the txid shown.

## Web app on mainnet

Production builds already default to mainnet (the local `.env` chipnet setting is ignored for `vite build`; set `BCH_NETWORK` in the build environment only to override). The site shows amounts in BCH with an approximate USD value (Coinbase spot price, display only). Visitors can switch to chipnet with **Practice on testnet** in the footer. Set `VITE_DEMO_MAINTAINER_WIF` to the **mainnet** maintainer key of the sample repo only if you accept that it is public; the contract still limits it to paying the bonder or the charity.
