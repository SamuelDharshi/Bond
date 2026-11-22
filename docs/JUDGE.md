# For judges: 2 minutes, one real mainnet round trip

You lock a small deposit against a GitHub issue and see it settle. The minimum deposit is **0.0005 BCH** (about 9 cents), and a refund returns it minus a network fee of under 1,500 sats.

## Before you start

- A **WizardConnect** wallet (for example Cashonize) holding a little BCH on **mainnet**. The site opens on mainnet.
- Nothing to install, no account. To try with free test coins instead, use **Practice on testnet** in the footer.

## The flow

1. Open https://bond.luffyy.tech and press **bond_an_issue**.
2. Paste an issue link from the repo, for example `https://github.com/SamuelDharshi/Bond/issues/3`, and press **Load terms**. You see the deposit, where it goes on each outcome, and the timeout.
3. Press **Continue**, connect your wallet (scan the QR or paste the `wiz://` link), press **Lock deposit** and approve in the wallet. The page shows the transaction id with an explorer link.
4. Open **my_bonds** or **Status** to follow it. When the repo maintainer labels the issue `valid` the deposit is refunded, and `slop` sends it to the charity address. If nobody acts before the timeout, the Status page shows **Return deposit to contributor**, which anyone can press with no wallet.

## Real transactions already recorded

Lock, refund and forfeit on mainnet are listed in [`proof/TXIDS.md`](proof/TXIDS.md) and in the "what's live" table on the home page.

## If something goes wrong

Every step shows a plain error and a **Retry** button.

- _No coins found in this wallet_: the wallet is on a different network than the site, or has no spendable coins.
- _The wallet did not answer in time_: the wallet app was closed or offline. Retry the connection.
- _Not yet: the network's timelock hasn't passed_: wait the number of minutes shown and press the button again.
