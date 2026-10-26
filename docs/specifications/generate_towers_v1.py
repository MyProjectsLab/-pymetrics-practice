"""Generate original, structurally matched Towers V1.0 forms and review fixtures.

Run from the repository root. --check compares exact committed bytes.
"""

from collections import deque
from hashlib import sha256
from pathlib import Path
import json
import sys

ROOT = Path(__file__).resolve().parent
FORMS = ROOT / "ASSESSMENT_PRACTICE_TOWERS_FORMS_V1_0_DRAFT.json"
FIXTURES = ROOT / "ASSESSMENT_PRACTICE_TOWERS_FIXTURES_V1_0_DRAFT.json"

# Bottom-to-top board order. Relabeling both boards gives six distinct,
# equal-difficulty original forms without adding extra levels or move rules.
START = ((4, 2, 5), (), (3, 1))
TARGET = ((1, 2, 3, 4, 5), (), ())
PERMUTATIONS = (
    (1, 2, 3, 4, 5),
    (2, 3, 4, 5, 1),
    (3, 4, 5, 1, 2),
    (4, 5, 1, 2, 3),
    (5, 1, 2, 3, 4),
    (2, 1, 4, 3, 5),
)
VISUALS = (
    {"id": 1, "color": "#e9ce36", "pattern": "horizontal-bars", "name": "Gold"},
    {"id": 2, "color": "#ce65c9", "pattern": "dots", "name": "Orchid"},
    {"id": 3, "color": "#5e78de", "pattern": "diagonal-bars", "name": "Cobalt"},
    {"id": 4, "color": "#e55d50", "pattern": "crosshatch", "name": "Coral"},
    {"id": 5, "color": "#5dcc68", "pattern": "rings", "name": "Leaf"},
)


def shortest(start, target):
    queue = deque([start])
    predecessor = {start: None}
    while queue:
        board = queue.popleft()
        if board == target:
            path = []
            while predecessor[board] is not None:
                prior, src, dst = predecessor[board]
                path.append([src, dst])
                board = prior
            return list(reversed(path))
        for src in range(3):
            if not board[src]:
                continue
            for dst in range(3):
                if src == dst:
                    continue
                copy = [list(stack) for stack in board]
                copy[dst].append(copy[src].pop())
                following = tuple(tuple(stack) for stack in copy)
                if following not in predecessor:
                    predecessor[following] = (board, src, dst)
                    queue.append(following)
    raise AssertionError("unreachable target")


def make_board(board, permutation):
    return [[permutation[disk - 1] for disk in stack] for stack in board]


def encode(data):
    return (json.dumps(data, sort_keys=True, separators=(",", ":"), ensure_ascii=False) + "\n").encode()


def main():
    forms = []
    fixtures = []
    for index, permutation in enumerate(PERMUTATIONS, 1):
        start = make_board(START, permutation)
        target = make_board(TARGET, permutation)
        path = shortest(tuple(map(tuple, start)), tuple(map(tuple, target)))
        assert len(path) == 9
        form = {"formId": f"TW{index}", "formVersion": "towers-form-v1.0-draft",
                "start": start, "target": target, "disks": VISUALS,
                "limitMs": 120000, "optimalMoves": len(path)}
        forms.append(form)
        fixtures.append({"formId": form["formId"], "minimumMoves": len(path),
                         "oneShortestPath": path, "planningMs": 3000,
                         "solveMs": 55000, "sampleReport": {"status": "solved",
                         "movesMade": 9, "optimalMoves": 9, "excessMoves": 0, "planningMs": 3000,
                         "solutionMs": 55000, "undoCount": 0, "resetCount": 0}})
    assert len({encode(form) for form in forms}) == 6
    output = ((FORMS, {"schemaVersion": "towers-forms-v1.0-draft", "forms": forms}),
              (FIXTURES, {"schemaVersion": "towers-fixtures-v1.0-draft",
                          "scenarios": fixtures, "actionCases": [
                              {"id": "extra-placement-then-undo", "formId": "TW1",
                               "prefix": [[0, 1], "undo"], "then": fixtures[0]["oneShortestPath"],
                               "expected": {"status": "solved", "movesMade": 10,
                                            "optimalMoves": 9, "excessMoves": 1,
                                            "undoCount": 1, "resetCount": 0}},
                              {"id": "extra-placement-then-clear", "formId": "TW1",
                               "prefix": [[0, 1], "reset"], "then": fixtures[0]["oneShortestPath"],
                               "expected": {"status": "solved", "movesMade": 10,
                                            "optimalMoves": 9, "excessMoves": 1,
                                            "undoCount": 0, "resetCount": 1}},
                              {"id": "timeout-after-one-placement", "formId": "TW1",
                               "prefix": [[0, 1]], "terminal": "expired",
                               "expected": {"status": "incomplete timeout", "movesMade": 1,
                                            "optimalMoves": 9, "excessMoves": None,
                                            "planningMs": 3000, "solutionMs": None,
                                            "timeUsedMs": 120000}},
                              {"id": "interruption-before-placement", "formId": "TW1",
                               "prefix": [], "terminal": "interrupted",
                               "expected": {"status": "interrupted", "movesMade": 0,
                                            "optimalMoves": 9, "excessMoves": None,
                                            "planningMs": None, "solutionMs": None}},
                          ], "interactionCases": [
                              {"id": "occupied-destination-top-disk-hit", "formId": "TW1",
                               "start": forms[0]["start"],
                               "actions": [{"kind": "select", "tower": 2, "diskId": 1},
                                           {"kind": "board-click", "tower": 0, "hitDiskId": 5}],
                               "expectedBoard": [[4, 2, 5, 1], [], [3]],
                               "expectedMove": {"diskId": 1, "from": 2, "to": 0}},
                              {"id": "cancel-before-switch", "formId": "TW1",
                               "actions": [{"kind": "select", "tower": 2, "diskId": 1},
                                           {"kind": "cancel", "via": "Escape"},
                                           {"kind": "select", "tower": 0, "diskId": 5}],
                               "expectedPendingSource": 0, "expectedMoves": 0},
                          ], "replayCases": [
                              {"id": "try-again-after-first-solve", "fromFormId": "TW1",
                               "retainedExposedForms": ["TW1"], "action": "Try Again",
                               "expectedNewAttemptFormId": "TW2", "expectedStage": "guide",
                               "priorReportRetained": True, "priorAttemptExtended": False},
                          ], "deadlineCases": [
                              {"id": "move-before-deadline", "atMs": 119999,
                               "moveAccepted": True},
                              {"id": "move-at-deadline", "atMs": 120000,
                               "moveAccepted": False},
                              {"id": "move-after-deadline", "atMs": 120001,
                               "moveAccepted": False}]}))
    for path, value in output:
        data = encode(value)
        if "--check" in sys.argv:
            assert path.read_bytes() == data, f"stale {path.name}"
        else:
            path.write_bytes(data)
        print(path.name, sha256(data).hexdigest())


if __name__ == "__main__":
    main()
