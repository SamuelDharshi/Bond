# Judges: 90 seconds

You will lock a tiny deposit and get it back. On mainnet the deposit is **0.0005 BCH** (about 9 cents at today's price), refunded in full minus a network fee of under 1,500 sats.

## Before you start

- A **WizardConnect** wallet with a little BCH on the network the site is on (shown as a badge in the top bar). The site opens on **mainnet**. To try it with free test coins instead, use **Practice on testnet** in the footer.
- Nothing to install, no account.

## The flow

1. **Open the site → Judges: start here.**
2. **Bond the sample issue** (step 2 card). Press _Continue_, then _Connect with WizardConnect_ and scan the QR with your wallet. Press _Lock deposit_ and approve in the wallet. The page shows the transaction id and an explorer link.
3. **Act as the maintainer** (step 3 card → Maintainer). Press **Refund**. The deposit goes back to the wallet that bonded it. The page shows the refund transaction id.
4. **Check the proof** (step 4 card → Status). The bond shows as _refunded_, with every transaction linked to the explorer.

Try **Forfeit to charity** on a second bond to see the money go to the charity address instead. After the timeout, a bond nobody acted on shows **Return deposit to contributor**, which needs no wallet.

## If something goes wrong

Every step shows a plain error and a **Retry** button. Common ones:

- _No coins found in this wallet_: the wallet is on a different network than the site, or has no spendable coins.
- _The wallet did not answer in time_: the wallet app was closed or offline. Retry the connection.
- _Not yet: the network's timelock hasn't passed_: wait the number of minutes shown and press the button again.

## No wallet?

Watch the video (linked from the Judges page) or open the real transactions listed on the Judges page and in [`docs/proof/DEMO_TXIDS.md`](docs/proof/DEMO_TXIDS.md).

## About the Maintainer console

It signs with a **public shared key** so one person can try both sides. The contract only allows that key to pay the person who bonded or the charity, so it can refund or forfeit but can never take the money. In a real repository the key lives only in a GitHub Actions secret.
