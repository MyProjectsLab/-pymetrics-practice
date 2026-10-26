# F2 case-by-case browser outcomes

All rows passed. `delivered`, `delayed`, and `unavailable` describe BroadcastChannel delivery. First-onset counts come from actual retained production journals. Delete-all removes durable markers even when an actual onset remains in the invalid tab journal. The reservation column is the final durable claim.

| Delivery | Boundary | Deletion | Onsets | Durable marker | Reservation | Chain eligible |
|---|---|---|---:|---|---|---|
| delivered | before-arm | drill | 0 | absent | absent | False |
| delivered | before-arm | all | 0 | absent | absent | False |
| delivered | before-arm | unrelated | 1 | confirmed | absent | True |
| delivered | fixation | drill | 0 | absent | absent | False |
| delivered | fixation | all | 0 | absent | absent | False |
| delivered | fixation | unrelated | 1 | confirmed | absent | True |
| delivered | delete-first | drill | 0 | absent | absent | False |
| delivered | delete-first | all | 0 | absent | absent | False |
| delivered | delete-first | unrelated | 1 | confirmed | absent | True |
| delivered | present-first | drill | 1 | confirmed | absent | False |
| delivered | present-first | all | 1 | absent | absent | False |
| delivered | present-first | unrelated | 1 | confirmed | absent | True |
| delivered | after | drill | 1 | confirmed | absent | False |
| delivered | after | all | 1 | absent | absent | False |
| delivered | after | unrelated | 1 | confirmed | absent | True |
| delayed | before-arm | drill | 0 | absent | absent | False |
| delayed | before-arm | all | 0 | absent | absent | False |
| delayed | before-arm | unrelated | 1 | confirmed | absent | True |
| delayed | fixation | drill | 0 | absent | absent | False |
| delayed | fixation | all | 0 | absent | absent | False |
| delayed | fixation | unrelated | 1 | confirmed | absent | True |
| delayed | delete-first | drill | 0 | absent | absent | False |
| delayed | delete-first | all | 0 | absent | absent | False |
| delayed | delete-first | unrelated | 1 | confirmed | absent | True |
| delayed | present-first | drill | 1 | confirmed | absent | False |
| delayed | present-first | all | 1 | absent | absent | False |
| delayed | present-first | unrelated | 1 | confirmed | absent | True |
| delayed | after | drill | 1 | confirmed | absent | False |
| delayed | after | all | 1 | absent | absent | False |
| delayed | after | unrelated | 1 | confirmed | absent | True |
| unavailable | before-arm | drill | 0 | absent | absent | False |
| unavailable | before-arm | all | 0 | absent | absent | False |
| unavailable | before-arm | unrelated | 1 | confirmed | absent | True |
| unavailable | fixation | drill | 0 | absent | absent | False |
| unavailable | fixation | all | 0 | absent | absent | False |
| unavailable | fixation | unrelated | 1 | confirmed | absent | True |
| unavailable | delete-first | drill | 0 | absent | absent | False |
| unavailable | delete-first | all | 0 | absent | absent | False |
| unavailable | delete-first | unrelated | 1 | confirmed | absent | True |
| unavailable | present-first | drill | 1 | confirmed | absent | False |
| unavailable | present-first | all | 1 | absent | absent | False |
| unavailable | present-first | unrelated | 1 | confirmed | absent | True |
| unavailable | after | drill | 1 | confirmed | absent | False |
| unavailable | after | all | 1 | absent | absent | False |
| unavailable | after | unrelated | 1 | confirmed | absent | True |

`delete-first` holds the deletion lock until first-onset admission is requested; no paint occurs while it is held. `present-first` holds successful admission before the frame callback; deletion remains uncommitted until presentation is released. The common-clock request/confirmation/deletion observations are in the three matrix JSON files.

Every delete-all row also creates replacement-installation work and checks five old-store operations (arm, reserve, saveChain, saveDraft, deleteAll): all reject with InstallationClearedError and leave replacement bytes unchanged.
