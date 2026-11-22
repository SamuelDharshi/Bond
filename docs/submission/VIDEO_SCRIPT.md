# Bond demo video script (about 3 minutes, mainnet)

Record the screen and your voice. One take is fine. Speak slowly. Open these tabs first:

1. https://bond.luffyy.tech
2. https://github.com/SamuelDharshi/Bond/issues/3
3. https://bond.luffyy.tech/deck (backup)
4. Cashonize on your phone or computer, set to mainnet, with at least 60,000 sats

## Before you press record

- [ ] GitHub secret `BOND_MAINTAINER_WIF` is added and the labels `bonded ✓`, `valid` and `slop` exist.
- [ ] Issues #1 to #3 exist. Use #3 for the live deposit (nothing has been bonded on it yet).
- [ ] Do one practice deposit first so nothing surprises you on camera.
- [ ] Close other tabs, hide bookmarks, set the browser zoom to 110%.

## Scenes

| Time      | Show                                                 | Say                                                                                                                                                                                                                                       |
| --------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0:00–0:20 | Home page, banner visible                            | "Open-source maintainers are drowning in AI spam. In January curl shut down its bug bounty because fake reports cost more to read than real bugs were worth. This is Bond: five dollars to reach a maintainer, refunded if you're human." |
| 0:20–0:40 | Scroll "how it works", then the contract section     | "A contributor locks a small Bitcoin Cash deposit against one specific issue. A CashScript covenant holds it. It can only go to two places: back to the contributor, or to a charity. The maintainer can choose, but can never keep it."  |
| 0:40–1:30 | Bond page: paste issue #3, Load terms, connect       | "Here is a real mainnet deposit. I paste the issue link and the site reads the repo's rules: 0.0005 BCH, the charity address, and the timeout. I connect Cashonize over WizardConnect, press Lock deposit, and approve in my wallet."     |
| 1:30–1:50 | The transaction id and the explorer page             | "That is a real Bitcoin Cash mainnet transaction. The deposit, a note naming the issue, and a small ping so the repo's bot can find it."                                                                                                  |
| 1:50–2:20 | GitHub issue #3, add the label `slop`, then Status   | "The bot labelled the issue bonded. Now I'm the maintainer. I mark this one as spam. The deposit is forfeited to the charity address. Here is the transaction. I never touched a wallet and I never held the money."                      |
| 2:20–2:40 | Status page of a bond that timed out, keyless button | "If a maintainer never answers, after the timeout anyone can press this button and the deposit goes back to the contributor. No wallet, no key."                                                                                          |
| 2:40–2:55 | "What's live" table on the home page                 | "Every step here is a real transaction. These four are the ones I made earlier on mainnet: lock and refund, lock and forfeit. The repo also has twelve end-to-end tests that run against the real network."                               |
| 2:55–3:10 | `/deck`, then the GitHub repo, then `FEEDBACK.md`    | "The deck, the source, and a note on a gap I found in the WizardConnect SDK, with a fix plan. Thank you."                                                                                                                                 |

## If something goes wrong on camera

- Wallet won't connect: say "I'll show the recorded transaction instead" and open the four mainnet transactions in "what's live".
- The bot is slow to label: show the Status page, which reads the chain directly and does not need the bot.
- Never show `.env` or any private key.
