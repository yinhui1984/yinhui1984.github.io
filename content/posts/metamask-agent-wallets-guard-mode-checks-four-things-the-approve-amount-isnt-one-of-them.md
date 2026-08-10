---
title: "MetaMask Agent Wallet's Guard Mode Checks Four Things. The approve() Amount Isn't One of Them"
date: 2026-08-10T09:17:23+08:00
draft: false
author: yinhui
categories: ["security"]
tags: ["agent", "approve", "defi", "metamask"]
description: "MetaMask Agent Wallet launched publicly on August 6, 2026, with a documented three-layer security pipeline. Walking one approve(spender, type(uint256).max) pattern through Guard Mode's outflow limit, allowlist, threat scan, and --intent field shows which one never looks at the approval amount at all."
---

MetaMask Agent Wallet launched publicly on August 6, 2026. Its security model is a real, well-built pipeline. I read the pipeline against one specific pattern — an ERC20 `approve` that grants more than the task needs — and it still goes through.

<!--more-->

## The example, again

In [an earlier note](https://yinhui1984.github.io/agent-approve-task-boundary/) from June 25, 2026, I looked at one small case. A user asks an agent to swap 8 USDC for ETH. The agent's last on-chain action is:

```text
approve(MetaSwap, type(uint256).max)
```

That corresponds to a real Ethereum mainnet transaction, `0x8e0a15886616d1e7bc59c4c398fa3091fa5516a042af69ce44cdd06afe78a582`, block `22350004`. I re-checked it against a public RPC endpoint while writing this piece:

```json
{
  "to": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
  "input": "0x095ea7b3000000000000000000000000881d40237659c251811cec9c364ef91dc08d300c
             ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
  "value": "0x0"
}
```

`to` is the USDC contract. The selector `0x095ea7b3` is `approve(address,uint256)`. Decoding the two words gives `spender = 0x881d40237659c251811cec9c364ef91dc08d300c` and `amount = 2^256 - 1`, i.e. `type(uint256).max`. Signature valid, calldata well-formed, token contract doesn't revert, gas spent normally. MetaSwap is a DEX aggregator, not an obviously malicious contract.

The task needed at most 8 USDC of spending power. What actually got granted was a standing, effectively unlimited allowance to a router. I called that gap `Authorization Surplus`:

```text
Authorization Surplus = granted capability - task requirement
```

That note was written while MetaMask's Agent Wallet was still in early access, running transactions through the same three checks — simulation, threat scanning, MEV protection — that define the pipeline today, and it argued that none of the three would catch this particular `approve`. Six weeks later Agent Wallet left early access and shipped to the public with the same pipeline, now fully documented. That's a good occasion to check the earlier reasoning against the actual spec instead of against a guess.

## What actually shipped

Everything below is quoted or directly reproduced from MetaMask's own sources: the [launch post](https://metamask.io/news/introducing-metamask-agent-wallet), the [architecture reference](https://docs.metamask.io/agent-wallet/reference/architecture/), the [trading-modes reference](https://docs.metamask.io/agent-wallet/reference/trading-modes/), the [outflow-policy reference](https://docs.metamask.io/agent-wallet/reference/outflow-policy/), MetaMask's own security post, [What actually keeps an AI agent from draining your wallet](https://metamask.io/news/agentic-wallet-security), and MetaMask's open-source [agent-skills](https://github.com/MetaMask/agent-skills) repository. Where I couldn't verify a claim against a primary source, I've left it out or flagged it explicitly — this piece isn't trying to repeat marketing copy as fact.

The `agent-skills` repo is the same one MetaMask's own [quickstart](https://docs.metamask.io/agent-wallet/quickstart) tells you to install with `npx skills add MetaMask/agent-skills` — it's the set of Markdown skill files that teach an LLM agent which `mm` CLI commands to run and when. I pulled it directly with `gh repo clone MetaMask/agent-skills`, pinned to commit `f0fd1e947dbcf9f80e14815616d7b618fcde4ffe` — "update skills for v6.0.0", dated 2026-08-06, the same day Agent Wallet left early access. Anyone can reproduce this with either command; both resolve to the same public repository. The part relevant here is one directory:

```text
skills/metamask-agent-wallet/
├── SKILL.md
├── references/
│   ├── decode.md
│   ├── polling.md
│   ├── signing.md
│   ├── swap.md
│   ├── transaction.md
│   ├── wallet.md
│   └── ... (auth, chain, earn, errors, market-data, perps, predict,
│            transfer, tx-history, x402)
├── workflows/
│   └── swap.md, bridge.md, earn-*.md, perps-*.md, predict-*.md, ...
└── scripts/
    ├── amount_to_hex.py
    └── x402_pay.py
```

I also installed the real CLI — `npm install @metamask/agent-wallet@6.0.0`, the same version number as the "update skills for v6.0.0" commit in the skills repo above — and ran `mm <command> --help` against the shipped binary itself for every command this piece relies on: `decode`, `wallet send-transaction`, `wallet sign-typed-data`, `wallet policy get/set/template`, `wallet trading-mode set`. The live binary's `--help` JSON matches the skill markdown's documented flags word for word, including `--intent`: "Human-readable summary of what is being signed, forwarded with the request" on `sign-typed-data`, and the transaction-level equivalent on `send-transaction`. So this isn't just prompt-file documentation that an LLM agent happens to read — it's the actual flag surface of the CLI a human or agent runs. `mm wallet policy template`, which would print the live policy schema, requires `mm login` first. Creating a real account crosses from reading a public spec into operating a live financial product, which is a different kind of claim than this piece is making — so that's where the verification stops.

Agent Wallet ships two trading modes, chosen at `mm init`:

- **Guard Mode** (default): a network allowlist, an address allowlist, a token-recipient allowlist, and a rolling 24-hour outflow limit. Anything outside those triggers 2FA.
- **Beast Mode**: no allowlists, no outflow limit. Threat scanning still runs, and flagged transactions still require 2FA.

Both modes run the same mandatory three-step pipeline on every supported EVM transaction before it signs: transaction simulation (shows balance changes, allowances, and gas routing before you sign), threat scanning powered by Blockaid, and MEV protection via Smart Transactions. Eligible transactions that pass all three and still lose money are covered up to $10,000/month under Transaction Protection.

Keys, in server-wallet mode, live in a TEE that the agent can't reach. When a transaction needs 2FA, it enters an `AWAITING_MFA` state and the CLI returns a `pollingId`; you approve or reject via MetaMask Mobile or an email link, and the request auto-expires if you don't respond.

This is a genuinely solid architecture. Key isolation, mandatory (not opt-in) security checks, and an escalation path to a human are all the right defaults. None of what follows is an argument that MetaMask built this carelessly. It's an argument that one specific class of capability — how much a single `approve` grants — sits outside every check this pipeline runs.

## Walking the approve through each check

Take the exact case from June: agent asked to swap 8 USDC for ETH, MetaSwap (or any allowlisted router) as spender, `amount = type(uint256).max`. Run it through Guard Mode's four control points, one at a time, using only what MetaMask's own docs say each one does.

**The outflow limit.** The [outflow-policy reference](https://docs.metamask.io/agent-wallet/reference/outflow-policy/) defines it precisely: it tracks "token outflow from your account" — transfers, swaps, and deposits — and "before signing, MetaMask simulates the transaction value and adds that value to your 24-hour total once the transaction is confirmed." An `approve` call moves zero tokens. Its simulated value is $0. The one numeric ceiling Guard Mode enforces literally cannot see it, by the same definition that makes the limit work correctly for transfers and swaps. The same reference page adds, separately: "Signatures (for example, Permit2) are not included in the outflow calculation as of now" — a second, explicit statement that capability-granting operations sit outside this particular ledger. The `agent-skills` repo corroborates that the limit is a flat scalar, not a per-transaction cap: `skills/metamask-agent-wallet/references/wallet.md` documents `mm wallet policy set --policy "maxDailyOutflow: 1000"` as the entire shape of the policy — one number, no field for bounding a single call's allowance.

**The address allowlist.** For the swap itself to be permitted at all, the router has to be on the allowlist — that's the whole point of the allowlist. But the allowlist checks identity, not scope. An `approve` to that same already-allowlisted router passes the identity check whether the amount is 8 USDC or `2^256 - 1`. The allowlist answers "is this a contract you said you'd trade with," not "how much of your balance is this specific call requesting."

**Blockaid threat scanning.** This is a reputation and malice classifier — known drainers, fake tokens, honeypots, flagged contracts. MetaMask's own security post states the underlying design principle directly: *"An agentic wallet is secure when it treats the AI agent as an unfamiliar transaction proposer rather than a trusted signer,"* and, even more to the point, *"an agent scoped to check balances doesn't need the authority to approve unlimited token spending."* That's the exact least-privilege argument this piece is making, in MetaMask's own words. But it's stated as design philosophy in a blog post, not implemented as a calldata-level check in Guard Mode. A legitimate router asking for excess allowance and the same router asking for exact allowance look identical to a scanner built to answer "is this contract malicious," because the excess itself isn't the signal that scanner reads.

**The `--intent` field.** This is the one I didn't expect to find, and it's the cleanest illustration of the whole gap. `skills/metamask-agent-wallet/references/signing.md` documents `wallet sign-typed-data` — and `references/transaction.md` documents `wallet send-transaction` the same way — as taking an optional `--intent` flag: "Human-readable summary of what is being signed, forwarded with the request." The example given in `signing.md` is:

```bash
mm wallet sign-typed-data --chain-id 137 --payload '{"types":...}' --wait --intent "Approve 10 USDC"
```

`--intent` is attached to the request purely so a human can read it during 2FA review — `SKILL.md` and `references/polling.md` both state this explicitly, in identical wording: transfers, swaps, and other actions "attach a human-readable `intent` summary to their wallet request... so the user can confirm what they are approving." Nothing in either file says this string is checked against the payload it's attached to. The agent that builds `--payload` also writes `--intent`. Both are self-reported by the same untrusted process. An agent can caption an unlimited-allowance payload `"Approve 10 USDC"` and nothing in the documented pipeline compares the caption to the calldata.

There's a `mm decode` command, documented in `references/decode.md`, that turns raw calldata back into a plain-language `intent` string — genuinely useful, and it would correctly report `Call approve(spender: 0x..., amount: 115792089237316195423570985008687907853269984665640564039457584007913129639935)` for this exact transaction. But its documented use is scoped to calldata "unfamiliar or was not constructed by you" — a safety net for relaying a foreign contract's suggested call, not a self-consistency check the agent is required to run against its own output before signing.

Put the four together: outflow limit sees $0, address allowlist sees an allowlisted counterparty, threat scan sees a non-malicious contract, and `--intent` is whatever string the agent chose to write. All four pass. The transaction goes through Guard Mode without a single 2FA prompt — structurally, based on what each check is documented to look at, not because any one of them is broken.

## Skills are prompts, not hooks

There's a second, different kind of gap worth naming here, because it sits behind all four checks rather than alongside them. Everything in `agent-skills` — decode unfamiliar calldata first (`references/decode.md`), don't skip the quote review step (`workflows/swap.md`), attach a meaningful `--intent` — is a prompt, not a hook. It's Markdown text an LLM agent is trusted to read and follow, and nothing in the CLI or the wallet service requires any of it to have actually happened. The installed binary confirms this directly: `mm swap quote --help` documents `--yes` as "skip interactive confirmation" — exactly the step `workflows/swap.md` tells the agent not to skip. `mm swap execute --help` runs straight from `--from`/`--to`/`--amount`/`--from-chain-id`, no prior `--quote-id` required. `mm wallet send-transaction --help` has no dependency on `mm decode` at all — calldata can go from agent to signature with nothing decoded in between. An agent that never installs the skill, or installs it and ignores the advice, isn't bypassing a control; there was never a code-level control there to bypass. Which means the outflow limit, the address allowlist, and Blockaid's threat scan aren't just the three checks that don't look at an `approve` amount — they're also the only parts of this pipeline guaranteed to run at all, independent of which agent framework or which model is issuing the commands.

That leaves a real question for whoever is actually running this: what are you trusting when you turn Guard Mode on? The rules MetaMask enforces, you don't have to trust the agent to respect — they run whether the agent is careful or not. The rules the skill recommends — decode before sending, show the quote, write an honest `--intent` — you do have to trust the agent to respect, because nothing downstream checks whether it actually did. A capable, well-aligned agent probably follows them. A cheaper model, a buggy agent framework, or one that never loaded the skill in the first place has no code standing in its way, and Guard Mode has no way to tell which kind of agent it's talking to — because it was never checking that layer to begin with.

I want to be precise about what this argument is and isn't. I don't have an Agent Wallet early-access account, so I haven't run this against live infrastructure, and I'm not claiming to. What I have is MetaMask's own specification, quoted above, and a real on-chain transaction with the exact shape the specification says would pass. That's a design-level analysis, not a live exploit — closer to reading an audit report against a contract than to draining a wallet. If MetaMask's actual runtime does something the public docs don't mention, this is exactly the kind of claim that gets updated the moment better evidence shows up.

## The one place this might already be handled

One documented feature complicates the picture, and it deserves to be stated rather than buried. `references/swap.md` notes: "ERC-7821 batch execution: on eligible chains and accounts, the CLI automatically batches approval + trade into a single `execute()` transaction... No flag is needed — this is automatic when supported." `workflows/swap.md` repeats it: "The user sees 'Approval and swap submitted as a single transaction.'" On accounts that support ERC-7821 batched calls, the `approve` never exists as its own signed transaction at all — it's bundled atomically with the trade.

That's a real improvement over the classic two-step "approve, then swap" flow the June transaction used, and it closes off one attack surface: there's no window where an unlimited allowance sits live on-chain with no trade attached to it. But it doesn't answer the actual question here, because nothing in the public docs says what amount gets encoded into the approval *inside* that batch. If the batch encoder sizes the allowance to the exact swap amount, the gap is closed for eligible accounts specifically because someone made that choice — not because Guard Mode's allowlist or outflow limit would have caught an oversized one. If it still encodes `type(uint256).max` inside the bundle for gas or UX reasons, the surplus is just as unlimited, and it's now also invisible as a standalone entry in the wallet's transaction history. I can't verify which from the outside, and I'd rather say that plainly than round it off in either direction. It's the one part of this analysis that's a genuinely open question, not a documented gap.

For accounts that don't support ERC-7821 — which is most EOA-based server wallets today — the flow reverts to the plain two-step pattern, and the four checks above apply exactly as described.

## Naming the missing layer

None of the four controls Guard Mode ships are wrong. Outflow limits should track realized value moved, not hypothetical future capacity — that's the correct definition for what they're for. Allowlists should check counterparty identity — that's the correct definition for what they're for. Threat scanning should flag malicious contracts — a legitimate router isn't one, regardless of how much it's been approved for. The gap isn't a bug in any one of these; it's that none of them was ever the right tool for the question "does this specific grant match what this specific task needs." That's a different axis than "is this transaction safe."

The check that's missing is small enough to describe in one line:

```text
approve.amount <= task.max_input + buffer
```

Where would it live, concretely, given what's actually in the open-source repo? `mm decode` (`references/decode.md`) already produces exactly the structured output needed — `functionName`, `params`, spender, amount. The missing piece is a required step in the swap/transfer skill workflow, not a new wallet-level primitive: before `wallet send-transaction` or `wallet sign-typed-data` is called with agent-constructed calldata, decode it, compare `amount` against the task's stated bound (8 USDC, in this case), and refuse — or force explicit user confirmation — if the decoded amount exceeds it. That's a change to `skills/metamask-agent-wallet/references/transaction.md` and `signing.md`, commit `f0fd1e9` and onward, in a public repo anyone can send a pull request to — not a change to Blockaid's threat model or to the outflow ledger's definition. The other half of the fix is operational: if a task genuinely needs a temporarily larger allowance, grant it, but revoke it when the task ends —

```text
approve(spender, 0)
```

— instead of leaving `type(uint256).max` sitting in `_allowances` indefinitely, which is what the June transaction did and what a Guard-Mode-passed equivalent would still do today.

The deeper point carries past this one product. `approve`'s on-chain semantics only know `spender` and `amount` — they have no concept of "task." Every check discussed here — outflow, allowlist, threat scan, even the human-facing `--intent` caption — operates on the transaction as MetaMask's pipeline receives it, which is already downstream of the point where the user's actual instruction got compressed into a `spender` and an `amount` chosen by the agent itself. An agent wallet that wants to bind the two has to carry the task's bound through that compression step and check the calldata against it explicitly, because nothing below the wallet layer is going to do it for free.
