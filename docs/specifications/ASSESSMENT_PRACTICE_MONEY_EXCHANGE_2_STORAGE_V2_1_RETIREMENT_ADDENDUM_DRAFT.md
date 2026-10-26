# Money Exchange 2 storage V2.1 retirement clarification

Agent-authored under founder delegation. DRAFT for independent exact-byte review before the affected implementation. This narrowly supersedes the storage V2 addendum's blanket prohibition on retired request IDs in payload-bearing records. Preserve the frozen V1 packet and V2 addendum bytes. Gameplay, forms, event/report versions, storage V2 schema and all other privacy/authority requirements remain unchanged.

## Two distinct reasons for fencing a request

1. **Erased-play retirement:** the associated attempt has been deleted. All its private command/event/proof/result/receipt/activity data must be erased. The ID may remain only in the V2 allowlisted value-free fences and familiarity metadata. No comparison hash or reconstructed deleted payload is allowed.
2. **Obsolete-navigation fencing:** a navigation receipt no longer serves a current or admitted pending successor chain. Discard its receipt/body and retain only its value-free ID fence. The same ID may still occur inside an undeleted attempt's immutable event journal and separate private replay proof where that exact historical navigation operation is needed to derive the survivor's state. Its original event/proof bytes, including time/reason, remain private data of that survivor and must not be copied into fences or receipts.

Only the second category permits this surviving-proof reference. This is not permission to retain deleted attempt data, every obsolete receipt, arbitrary raw commands, or any old display capability. A new storage version marker is unnecessary: validation derives the category and any survivor binding from the existing typed checkpoint/proof and attempt inventory. Implementations may use an explicitly validated value-free category field if needed; absence or an untrusted category claim alone never establishes this exception.

## Validation and readback

To accept a fenced navigation ID within a survivor proof, independently validate all of the following: the attempt exists and is not tombstoned; the historical operation is a navigation/withdrawal operation needed by the valid original event sequence; its request identity and authority match that survivor; the proof derives the byte-preserved survivor state/journal; the ID has no obsolete actionable receipt or public body; and it carries no data belonging to a deleted attempt. An arbitrary reference to an undeleted attempt does not satisfy these conditions. Reject duplicate or conflicting proof ownership and any mixed-use request ID that cannot be resolved uniquely. Existing legitimate value-free successor-chain receipts retain V2 treatment until obsolete.

A replay/readback of an obsolete fenced ID returns the typed retired/fenced result, with no mutation, old success, private proof payload or screen authority, regardless of an exact or conflicting submitted payload. Internal proof replay for validation is never a public request replay. Only current authorized history/report access may show the surviving attempt under existing V1/V2 rules.

When that survivor is later deleted, erase its entire journal/proof and all payload-bearing references to the ID in the same deletion checkpoint transaction. Retain only the permitted value-free fence; never reclassify it to restore a receipt. Delete all removes these private proofs and fences under the existing reset contract. In both deletion orders, unrelated survivor bytes, counters, form familiarity and current successor authority remain governed by V2.

## Migration and finite acceptance

Apply the same distinction during validated V1-to-V2 migration and V2 checkpoint validation/reload. Do not transform surviving event/report bytes or recover deleted payloads. A failed migration/deletion remains unconfirmed and atomic. No silent reset or old-data backup.

Required additional checks, incorporated into the existing grouped B1/B2 candidate rather than a separate product milestone:

- Reproduce Incomplete A after Close, arm B, delete B. Deletion succeeds; A journal/state/proof is unchanged and independently valid; A's obsolete exit receipt is absent. Repeat for completed A and both deletion orders.
- Delete A afterwards and inspect the complete durable root: A's events/proof/payloads gone, no retained low-entropy fingerprint; only allowed fences/familiarity remain. Reload validates.
- Exact/conflicting retries and held old callbacks for the fenced navigation ID neither echo the survivor's private data nor restore navigation or deleted state.
- Native IndexedDB and V1 migration equivalents; preserve byte-identical surviving event/report data. Include existing V2 reload and failed transaction behavior.
- Negative fixtures: tombstoned/missing survivor, a scored request disguised as obsolete navigation, conflicting proof ownership, forged survivor binding and payload from deleted B. Each rejects without write or reset.

The prior failing regression remains and becomes a passing acceptance case only after implementation. This clarification and its independent review establish specification readiness only; fresh developer evidence and a separate exact-SHA whole-game audit remain required. No founder acceptance, qualification, deployment or release claim.
