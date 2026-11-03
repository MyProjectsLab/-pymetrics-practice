# Money 1 Safari result confirmation repair

Base `faae53b4b1d4d4d8b0ea4e2b2c1ded9b96668235`, existing `preview/money1-reference` branch. Founder screenshots show the $2 transfer reaching response-ready, then a false incomplete result in Safari. Main must remain unchanged.

Reproduced in unmodified WebKit at1512×830 and1190×626: exact680×240 SVG URI, decoded/visible/unobscured within the viewport, but the attached image reports natural679×239. A detached decode of the exact same URI reports680×240. At375×667 the320×260 image reports its expected dimensions and succeeds. Read-only diagnostics are external `outputs/money1-safari-20261103/`.

Outcome: strict source-size verification from a detached decoded image, bound to the exact displayed image/URI/render epoch, using the already implemented Money2 pattern. Keep attached-image decode/completion, actual current source, owned DOM, semantics, viewport and hit testing. No tolerance, user-agent exemption, success fabrication or changed rules/timing/scoring/storage. Add a real WebKit full-journey regression before fixing, then verify desktop/phone/compact and negative source/size/late-callback controls. Preserve earlier candidate failures and evidence. Lint/build, complete units, relevant native browser checks and a separate exact-SHA audit precede preview-only push/deployment. No changes to Money2 or other games.
