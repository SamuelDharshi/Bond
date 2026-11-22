<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="packages/web/public/brand/bond-logo-dark.svg">
    <img src="packages/web/public/brand/bond-logo-light.svg" alt="bond" height="64">
  </picture>
</p>

**Spam pays. Humans don't.** $5 to reach a maintainer, refunded if you're human.

> **BCH BLAZE 2026 · Mainnet Track · new project, built 20–22 Nov 2026**
>
> - Presentation: _TODO: paste the Widget Factory deck link (anyone with the link)_
> - Source code: _TODO: this repository's public URL_
> - Vote with EMBER2026: _TODO: token-aware `bitcoincash:z…` address_
> - Live site: _TODO_ · Video: _TODO_

Bond lets open-source maintainers require a small, **refundable** Bitcoin Cash deposit before an issue or PR gets their attention. A CashScript covenant holds the deposit, bound to one specific issue:

- Maintainer labels **`valid`** → refunded to the contributor.
- Maintainer labels **`slop`** → forfeited to a **charity**. The maintainer can never receive it.
- Nobody acts before the timeout (about 10 minutes for the sample repo, about 14 days by default for real repos) → **anyone** can send it back to the contributor, with no key needed.

The maintainer never touches a wallet. A GitHub Action holds a refund/forfeit-only key, and the contract limits that key to paying the contributor or the charity. A stolen key can grief, but it can't steal.

Why now: in January 2026 curl ended its bug bounty because AI-generated slop reports cost more to triage than they were worth.

## How Bond meets the BLAZE requirements

| Requirement                      | How                                                                                                                                    | Proof                                                                                                        |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Real BCH transactions            | Fund, refund, forfeit and keyless reclaim are built, signed and broadcast through real Fulcrum servers. No mocks.                      | [`docs/proof/DEMO_TXIDS.md`](docs/proof/DEMO_TXIDS.md) (chipnet now; mainnet txids are added after the flip) |
| Live site judges can use         | Static site, mainnet by default in production builds, with a "Practice on testnet" switch.                                             | _TODO: live URL_ · judge guide: [`docs/JUDGE.md`](docs/JUDGE.md)                                             |
| WizardConnect wallet flow        | Contributor connects and signs the funding transaction over WizardConnect (`@wizardconnect/react`, relays configurable).               | [`packages/web/src/lib/wallet.ts`](packages/web/src/lib/wallet.ts)                                           |
| Original work disclosed          | New project built during the hackathon. It uses open-source libraries (CashScript, libauth, WizardConnect, React, three.js) as listed. | the banner text, `package.json` files                                                                        |
| Public repo, README, limitations | This file.                                                                                                                             | [Limitations](#limitations-honest-list)                                                                      |

## Try it in 3 steps

1. **Open the live site** → _TODO: live URL_ → **Judges: start here** (a 90-second guide, also in [`docs/JUDGE.md`](docs/JUDGE.md)).
2. **Bond the sample issue**: connect a WizardConnect wallet (scan the QR or tap the link) and press **Lock deposit**. You get a real txid.
3. **Act as the maintainer**: open **Maintainer**, press **Refund** (or **Forfeit to charity**), then check **Status**. Every step links to the explorer. After the timeout (about 10 minutes) a bond shows **Return deposit to contributor**, which needs no wallet. If the network says "Not yet", wait a few minutes and retry.

## How it works

```
contributor ──(WizardConnect)──► funding tx
   out[0] deposit → Bond covenant (unique per issue)
   out[1] OP_RETURN "BOND" v1 | subjectHash | contributorPkh
   out[2] 546 sats → repo registry address   (so the bot can find it with plain Electrum)
   out[3] change

GitHub Action (label valid / slop, schedule) ──► refund() / forfeit() / reclaim()
```

- Contract: [`packages/contracts/Bond.cash`](packages/contracts/Bond.cash). Protocol spec: [`docs/PROTOCOL.md`](docs/PROTOCOL.md). Architecture: [`README.md`](README.md#how-it-works).
- No backend, no indexer, no database. The web app and the Action read everything live from Electrum servers. Discovery re-derives the contract from the repo's own `bond.json` and requires an exact bytecode match, so the OP_RETURN hint is only a pointer.

## Install it on your repo (maintainers)

1. **Make a key** (this is the bot's refund/forfeit-only key): `pnpm wallets:new`, then copy `MAINTAINER_WIF` and its `pkh`.
2. **Add `.github/bond.json`** (see [demo-repo/.github/bond.json](demo-repo/.github/bond.json)):
   ```json
   {
     "version": 1,
     "network": "mainnet",
     "maintainerPkh": "<pkh hex>",
     "charityAddress": "bitcoincash:q…",
     "minValueSats": 50000,
     "reclaimBlocks": 2016,
     "maxFeeSats": 1500
   }
   ```
3. **Add the workflow**: copy [demo-repo/.github/workflows/bond.yml](demo-repo/.github/workflows/bond.yml) and point `uses:` at this repo's `packages/action`.
4. **Add the secret** `BOND_MAINTAINER_WIF` (Settings → Secrets → Actions) and create the labels `bonded ✓`, `valid`, `slop`.

The key never needs funds: fees come out of the bond (capped by `maxFeeSats`).

## Develop

```bash
pnpm install
pnpm wallets:new           # 3 chipnet wallets → .env (never overwrites)
pnpm faucet                # chipnet coins for the contributor (captcha: you type the sum)
pnpm balance
pnpm build                 # compile contract, typecheck all, bundle Action, build web
pnpm test:unit             # pure functions only (codec, subjectHash, config)
pnpm e2e                   # REAL chipnet: 5 positive + 7 negative cases (needs ~400k sats)
pnpm demo:seed             # bonded / refunded / forfeited / reclaimable demo bonds → docs/proof/DEMO_TXIDS.md
pnpm demo:repo             # publish demo-repo/ to GitHub (uses gh, or prints manual steps)
pnpm --filter @bond/web dev
pnpm check:network         # proves no network strings exist outside packages/core/src/network.ts
```

Deploy: `vercel --prod` (uses `vercel.json`), or push to `main` for GitHub Pages (`.github/workflows/pages.yml`). Production builds default to **mainnet** and **refuse to build** unless `VITE_BLAZE_PRESENTATION_URL`, `VITE_BLAZE_SOURCE_URL` and `VITE_BLAZE_EMBER_ADDRESS` are set. Also set `VITE_DEMO_MAINTAINER_WIF` (a public shared key that must match the maintainer key in the repo's bond.json) and `VITE_DEMO_REPO`. CI builds use `BOND_SKIP_BANNER_CHECK=1` only to check that the code compiles. The mainnet flip is in [docs/MAINNET.md](docs/MAINNET.md).

## Limitations (honest list)

- **A bond proves money, not identity.** A well-funded spammer can still pay. Bond raises the cost of slop; it doesn't detect it.
- **Maintainer griefing is possible.** The bot key (or a malicious maintainer) can forfeit a genuine bond to charity. It can never take the money, but the contributor still loses it.
- **GitHub scheduled runs can lag** by minutes to hours, and label events depend on Actions being enabled. The keyless reclaim button in the web app works regardless.
- **The demo key is public.** Anyone can refund or forfeit demo-repo bonds (still only to the contributor or the charity). Use real secrets on real repos.
- **Changing `bond.json`** (maintainer key, charity, timeout, fee cap) changes the derived address, so the Action stops finding older bonds. They stay safe and reclaimable by their contributor via `reclaim()` with the old parameters.
- **Wallet support:** the funding flow needs a wallet that speaks WizardConnect and signs P2PKH inputs on chipnet. It's coded against the official packages but hasn't been tested with every wallet.
- **Discovery cost** grows with the registry address history (one tx fetch per funding). Fine for a repo; a busy repo should rotate its registry address.
- **Unaudited.** Experimental software; don't use it with amounts you can't lose.

## Community Choice

Token-aware donation address: `bitcoincash:z…` _(placeholder: fill in before submission)_

## License

MIT, see [LICENSE](LICENSE).
