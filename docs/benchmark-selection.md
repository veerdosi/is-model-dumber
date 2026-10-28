# First panel: selection and limits

Reviewed 28 October 2026. The immutable panel is `benchmarks/panel-v1/manifest.json`.
Its exact prompts and hashes are authoritative. This is a diagnostic panel, not an
official aggregate score on any named benchmark. Its information value has not
been calibrated; the first observations cannot establish that it is an optimal
frontier benchmark. Seven items are original diagnostic tasks. Three use real
ARC environments/data. No item is generated during evaluation.

Selection favoured deterministic verification, useful failure modes, reproducible
assets, bounded execution, and feasible native-agent tooling. There were no
subject quotas. Original items avoid republishing benchmark material with unclear
data terms, but their publication creates future contamination risk. Tool-assisted
success can be easier than unaided reasoning. These limits remain part of the record.

| Selected item                | Measurement value                                                                 | Grading and limitations                                                                                                                                                      |
| ---------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ARC-AGI-2 0934a4d8           | Abstract transformation; alternative interpretations create informative failures  | Exact grid equality, one prediction; public evaluation item, contamination/ambiguity risk                                                                                    |
| ARC-AGI-2 135a2760           | Compositional extrapolation on a substantially larger output                      | Exact grid equality, no heuristic judge; public item                                                                                                                         |
| ARC-AGI-3 LS20               | Actual visual interaction, exploration, planning, action efficiency               | Official SDK/engine, seed 0, fixed version, 160 actions; strict full-game success plus auxiliary official score; bounded public-game probe, not official leaderboard scoring |
| Dynamic parity connectivity  | Stateful graph reasoning, deletions, contradiction localization, performance      | Hidden BFS oracle cases and large known-result stress case; sandboxed code execution                                                                                         |
| Transaction engine           | Read-your-writes, write skew, key-version conflicts, lifecycle discipline         | Independent state-machine oracle, fixed randomized and semantic corner cases                                                                                                 |
| Trillion-bit language        | Construct and exponentiate a joint pattern/residue automaton                      | Exact modular integer; separately checked via suffix DP, Berlekamp–Massey, and Kitamasa                                                                                      |
| Corrupted inverse experiment | Recover latent signal and distinguish corrupted measurements                      | Exact integers; SMT proves bounded solution uniqueness                                                                                                                       |
| Revised ledger               | Resolve 1,770 revisions, voiding and filters over fixed structured input          | Independent descending-sequence reconciliation; tool-assisted file reasoning, not an official LongBench score                                                                |
| Strict output contract       | Compositional instruction fidelity under an injected contradiction                | Exact structured equality; a diagnostic anchor that may saturate                                                                                                             |
| Conflicting evidence corpus  | Effective dates, authoritative amendments, alias resolution, injection resistance | Exact answer and minimal citation set; frozen local corpus, not live web research                                                                                            |

Original task code and data: MIT. ARC-AGI-2: Apache-2.0, upstream revision pinned
in `benchmarks/arc2/revision.txt`; its LICENSE is retained. ARC SDK: MIT. Official
LS20 source is downloaded privately through the SDK, hashed, and excluded from Git
and deployment rather than assuming that SDK licensing grants redistribution rights.

## Candidates investigated and why they are not in this panel

| Family / primary source                                                                                                             | Assessment and decision                                                                                                                                                                                                                                                             |
| ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [ARC-AGI-2](https://github.com/arcprize/ARC-AGI-2)                                                                                  | Selected two public evaluation items. Simple established exact grader. Subset accuracy is not a full benchmark result.                                                                                                                                                              |
| [ARC-AGI-3 SDK](https://github.com/arcprize/ARC-AGI), [technical report](https://arcprize.org/media/ARC_AGI_3_Technical_Report.pdf) | Selected real LS20, not a text imitation. Offline SDK initially had no environments; official anonymous download made local execution possible. Official competition protocol and aggregate action-efficiency scoring differ from this bounded single-game probe.                   |
| [FrontierMath](https://epoch.ai/frontiermath/open-problems/about/faq)                                                               | Strong expert mathematics and programmatic verifiers; verifier access requires a separate purchase. No invented verifier or borrowed answer used.                                                                                                                                   |
| [MathArena](https://matharena.ai/)                                                                                                  | Fresh competitions and newer ArXivMath/BrokenArXiv tracks merit follow-up. Contest/data rights need per-source review; proofs require more than exact-string grading. Original finite-state task chosen for this bounded panel.                                                     |
| [LiveCodeBench Pro](https://github.com/GavinZhengOI/LiveCodeBench-Pro)                                                              | Strong competitive programming signal. Contest statement/test redistribution and harness-specific grading need item-level review; repository availability does not establish rights to each contest item. Original algorithmic task avoids silently claiming an official LCB score. |
| [FrontierCode 2.0](https://cognition.com/frontiercode)                                                                              | Current revision dated 27 October 2026; evaluates mergeability via tests and rubrics. Complete bounded deterministic local access to its grading ensemble was not established. Subjective rubric noise is undesirable for a ten-item daily monitor.                                 |
| [SWE-bench Pro](https://github.com/scaleapi/SWE-bench_Pro-os)                                                                       | Real repository work and established tests; potentially valuable later. Per-task repository/container setup and long horizons exceed the initial eight-minute budget. Source repository licenses remain relevant beyond harness licensing.                                          |
| [Terminal-Bench](https://github.com/harbor-framework/terminal-bench-1)                                                              | Real terminal environments are preferable to written imitations. Heterogeneous images/dependencies and task budgets complicate identical native runtime access. Original code execution tasks were feasible here; they are not Terminal-Bench substitutes or scores.                |
| [Terminal-Bench Science 0.1](https://www.tbench.ai/news/terminal-bench-science-0-1)                                                 | Research workflows with concrete artifact grading are compelling. Published first release has 70 tasks. Heavy scientific dependencies and task-specific review need a dedicated integration; original exact inverse experiment is a narrower diagnostic.                            |
| [Humanity’s Last Exam](https://github.com/centerforaisafety/hle)                                                                    | Difficult expert questions. Semantic judge noise, answer ambiguity and per-content rights make naive one-question adoption risky. No HLE item or LLM judge included.                                                                                                                |
| [IFBench](https://github.com/allenai/IFBench)                                                                                       | Verifiable instruction following is useful. Code license does not automatically settle every dataset item’s terms. Original strict contract makes every scored constraint explicit, with no unofficial IFBench score claim.                                                         |
| [LongBench v2](https://github.com/THUDM/LongBench)                                                                                  | Strong multi-document/structured-context tasks with objective multiple-choice grading; contexts can be very large and incorporate third-party works. Local fixed ledger gives reproducible tool-assisted reconciliation without claiming the benchmark’s breadth.                   |
| [MMMU-Pro](https://github.com/MMMU-Benchmark/MMMU)                                                                                  | Expert multimodal reasoning; individual images can carry third-party rights and source leakage. No item adopted without image-level review. ARC3 provides actual visual observations, but does not cover MMMU’s expert visual domains.                                              |
| [SPAR-Bench](https://github.com/LogosIntelligenceLab/SPAR)                                                                          | Relevant multi-view spatial reasoning and human-reviewed data. Dataset assets, loader/answer protocol and media access need dedicated integration. Single-game ARC3 is not equivalent spatial coverage.                                                                             |
| [BrowseComp](https://github.com/openai/simple-evals)                                                                                | Challenging search, but live-web availability changes and semantic judging add confounds. Publication/contamination restrictions also matter. Local evidence corpus measures a narrower reproducible behaviour, not BrowseComp performance.                                         |
| [OSWorld](https://github.com/xlang-ai/OSWorld)                                                                                      | Genuine computer interaction requires resettable VMs, task assets and native computer-use access. Three native evaluators cannot share the user’s desktop comparably. No text-only imitation included.                                                                              |
| [LiveBench](https://github.com/LiveBench/LiveBench)                                                                                 | Objective scoring and source freshness are useful design references. Its normal updating cadence conflicts with the requested initial fixed 21-day panel; no automatic refresh adopted.                                                                                             |

Benchmark families were assessed, not all downloaded or fully implemented. An
unverified license is a reason not to redistribute an item, not an assertion that
its use is prohibited. Future integrations require item-level license review,
reference validation, runtime budget validation, and a new suite version.

## Before first publication

`docs/panel-validation.json` records independent reference checks. These checks
validate internal consistency and selected unique answers, not empirical frontier
difficulty. A reference review found that evidence document C04 explicitly names
Cedar, making B17 unnecessary in the requested minimal citation set. The private
reference was corrected to C04+D09 before publication; prompts and original model
responses were unchanged. Container mounts/resource-limit adapters were repaired
and those same code responses regraded. Setup-debug attempts are not observations.

The pilot is likely to reveal anchors that are easy with tools. They still remain
fixed for 21 days; future calibration must not retroactively replace the items.
