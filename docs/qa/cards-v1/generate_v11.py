#!/usr/bin/env python3
"""Generate original fixed Cards V1.1 practice forms and arithmetic fixtures."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FORMS = ROOT / "specifications/ASSESSMENT_PRACTICE_CARDS_FORMS_V1_1.json"
FIXTURES = ROOT / "qa/cards-v1/ACCEPTANCE_FIXTURES_V1_1.json"
MASK = 0xFFFFFFFF
BASE = 0xCA4D1100
DECKS = "ABCD"
ORDERS = ["ABCD", "BCAD", "CADB", "DBAC", "ADCB", "BDCA"]
SEGMENTS = {
    "A": [100] * 14 + [-100] * 6,
    "B": [100] * 18 + [-1100] * 2,
    "C": [25] * 16 + [0] * 2 + [-25] * 2,
    "D": [50] * 19 + [-200],
}


class XorShift32:
    def __init__(self, seed):
        self.state = seed & MASK

    def next(self):
        x = self.state
        x ^= (x << 13) & MASK
        x ^= x >> 17
        x ^= (x << 5) & MASK
        self.state = x & MASK
        return self.state


def shuffle(values, rng):
    items = list(values)
    for index in range(len(items) - 1, 0, -1):
        other = rng.next() % (index + 1)
        items[index], items[other] = items[other], items[index]
    return items


def encode(value):
    return (json.dumps(value, indent=2, ensure_ascii=False) + "\n").encode("utf-8")


def digest(value):
    return hashlib.sha256(encode(value)).hexdigest()


forms = []
for index, order in enumerate(ORDERS, 1):
    seed = BASE + index
    rng = XorShift32(seed)
    decks = {}
    for deck in DECKS:
        decks[deck] = [card for _ in range(4) for card in shuffle(SEGMENTS[deck], rng)]
    body = {"id": f"CD{index}", "seed": seed, "visibleOrder": order, "decks": decks}
    forms.append({**body, "formSha256": digest(body)})

manifest = {"schemaVersion": "cards-forms/1.1.0", "startingBalance": 2000, "drawCount": 80, "forms": forms}
FORMS.write_bytes(encode(manifest))


def choose(policy, turn):
    if policy in DECKS:
        return policy
    if policy == "ABCD_cycle":
        return DECKS[(turn - 1) % 4]
    if policy == "switch_after_40":
        return "D" if turn <= 40 else "A"
    raise ValueError(policy)


cases = []
for form in forms:
    for policy in [*DECKS, "ABCD_cycle", "switch_after_40"]:
        offsets = {deck: 0 for deck in DECKS}
        gains = losses = 0
        trace = []
        previous = None
        switches = 0
        for turn in range(1, 81):
            deck = choose(policy, turn)
            offset = offsets[deck]
            value = form["decks"][deck][offset]
            offsets[deck] += 1
            gains += max(value, 0)
            losses += max(-value, 0)
            switches += int(previous is not None and previous != deck)
            previous = deck
            trace.append({"turn": turn, "deck": deck, "deckDraw": offset + 1, "outcome": value, "balance": 2000 + gains - losses})
        cases.append({"formId": form["id"], "policy": policy, "drawsByDeck": offsets, "gains": gains, "losses": losses, "endingBalance": 2000 + gains - losses, "switches": switches, "traceSha256": digest(trace)})

FIXTURES.write_bytes(encode({"schemaVersion": "cards-fixtures/1.1.0", "cases": cases}))
print(f"forms={len(forms)} cases={len(cases)} manifestSha256={hashlib.sha256(FORMS.read_bytes()).hexdigest()} fixturesSha256={hashlib.sha256(FIXTURES.read_bytes()).hexdigest()}")
