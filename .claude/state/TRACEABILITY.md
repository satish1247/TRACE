# Traceability matrix

requirement -> feature -> task -> code -> test -> documentation.
Rows with **NONE** are unimplemented or unverified requirements and are
audit failures, not notes.

| Req | Text | Pri | Features | Tasks | Files | Passing tests | Docs |
|---|---|---|---|---|---|---|---|
| S1 | Live transcription via Web Speech API in Chrome; words appea | must | FEAT-001 | 0 | 0 | **NONE** | - |
| S2 | Five scam-script markers (authority, threat, isolation, dema | must | FEAT-002 | 0 | 0 | **NONE** | - |
| S3 | Deterministic offline scam taxonomy names the call among >=8 | must | FEAT-003 | 0 | 0 | **NONE** | - |
| S4 | Interview flow (not a warning banner): ask who the money is  | must | FEAT-004 | 0 | 0 | **NONE** | - |
| S5 | Writes calls and detections to Firestore; another screen sub | must | FEAT-005 | 0 | 0 | **NONE** | - |
| S6 | Upload audio -> real/fake verdict via pretrained wav2vec2 mo | should | FEAT-006 | 1 | 5 | **NONE** | - |
| S7 | Upload image -> real/fake verdict via pretrained ViT face-de | should | FEAT-006 | 1 | 5 | **NONE** | - |
| S8 | Caller Attestation: an unattested authority claim is shown a | should | FEAT-007 | 0 | 0 | **NONE** | - |
| S9 | Live risk meter 0-100 visible with each of the five markers  | must | FEAT-002 | 0 | 0 | **NONE** | - |
| C1 | SHIELD writes only to its own Firestore collections (calls,  | must | FEAT-005 | 0 | 0 | **NONE** | - |
| C2 | Never run two microphone consumers (recorder + recogniser) a | must | FEAT-001, FEAT-006 | 1 | 5 | **NONE** | - |
| C3 | Model weights for voice/face deepfake detection are download | should | FEAT-006 | 1 | 5 | **NONE** | - |
| C4 | Every classifier (markers, taxonomy) is pure and determinist | must | FEAT-002, FEAT-003 | 0 | 0 | **NONE** | - |
