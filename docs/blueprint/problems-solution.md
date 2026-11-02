# Problems, solutions and open risks

| Problem | Current mitigation / proposed solution | Status |
|---|---|---|
| Previously simulated Linux boot | Base PWA now starts real v86 and Buildroot Linux 6.8.12 demo; status avoids claiming guest readiness until prompt observed | Working in tested Chromium; guest outdated |
| Old unmaintained guest | Obtain/build maintained guest with tracked licenses, pin hashes and test; block production release until ready | Open |
| Data lost on VM restart | IndexedDB local text workspace; explicit guest copy; warn guest copies are temporary | Partial; browser data can be evicted, full shared filesystem absent |
| Storage failures or quota | Show IndexedDB and transaction errors; design quota/persistence UI and backup | Partial |
| Concurrent edits | Atomic revision checks reject stale saves and deletes, including delete/recreate; add conflict recovery and live tab refresh | Partial |
| Hash verification is not authenticity | Pin assets during build and check runtime hashes; adopt signed trusted manifest and rotation | Partial; unsigned runtime manifest |
| Terminal/editor errors in old preview | Runtime uses verified xterm serial console and text workspace, not old Monaco integration | Old widgets not integrated into new desktop |
| GitHub Pages headers | Do not claim isolation; use host with real COOP/COEP when required and test policy | Open deployment decision |
| Offline caching / updates | Version cache from build contents; test reload, fallback, updates and storage versioning | Partial |
| Simulated benchmarks | Remove fixed claims; measure defined milestones on specified hardware and report distributions | Open measurement plan |
| Readiness detection | Current guest prompt text `~%` is heuristic and image-specific; a 60-second warning is shown; use explicit guest agent or reliable milestone | Partial |
| Browser security | Explicit disclosure and no external guest network relay; maintain guest, threat-model, independently review | Partial |
| Missing complete desktop | Build apps against storage and VM abstractions after foundation gates | Planned |

No browser VM should be presented as a secure malware-analysis sandbox without a dedicated threat model and independent testing.
