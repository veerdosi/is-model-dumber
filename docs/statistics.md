# Statistical protocol v1

Each item is fixed; each run has one independent fresh agent context per model-item.
An item is not a newly sampled question on each repetition. Scores do not estimate
universal intelligence. Between-model rankings are secondary to within-model history.

For each suite and model, the first six complete comparable observations define a
fixed descriptive mean baseline. Only full ten-item scored panels form task-completion
points. An incomplete observation is visible in the raw record but excluded from
completion comparisons. Latency, errors, and completion are tracked separately. Item response
hashes, per-item flips, input/output usage and action traces remain stored.

After at least nine observations, flag a possible regression only when all three
most recent scores are more than 5 percentage points below baseline and their
mean is at least 10 points lower. “No persistent decline observed” means only that
this descriptive rule did not fire; it is not an equivalence test. A recovery flag
requires a preceding group of three scores at least 10 points below baseline,
followed by three within 5 points of baseline. This heuristic is deliberately not
presented as a calibrated false-positive guarantee.

A two-sided paired sign-test diagnostic compares item-level means of the first
six vs last three observations. Its p-value is exploratory. Dependence between
items, serial dependence, repeated looks and selection invalidate naive claims of
significance. No status is automatically promoted to “statistically supported.”
That requires a reviewed prespecified analysis with dependence/multiplicity control.
There is no fabricated general-population confidence interval for ten purposive items.

Reference literature:

- [Growing Pains](https://arxiv.org/abs/2604.12843): future fixed-parameter calibration;
  preserve item versions, protocol and outcomes now.
- [ATLAS](https://arxiv.org/abs/2511.04689): future psychometric/adaptive testing;
  retain item-level outcomes and provenance, do not fit IRT on this tiny record.
- [LiveBench](https://github.com/LiveBench/LiveBench): objective grading and explicit
  freshness/contamination considerations. This panel remains fixed during baseline.
- [BenchDrift](https://arxiv.org/abs/2608.11694): prompt wording can change outcomes;
  hash and freeze exact wording rather than rotate paraphrases during this period.

These sources motivate data preservation, not a claim that this implementation
reproduces their estimators. No IRT or adaptive task selection is implemented.

## Presentation and task-level diagnostics

The overview leads with within-model item transitions: improved, worsened, or
unchanged strict outcomes against that model’s previous complete run in the same
suite. The first observation has no change value; missing results are never
treated as failed items. Improved and worsened counts are retained separately,
so offsetting changes do not disappear behind an unchanged total. The default
history shows the number of changed pass/fail outcomes, with direction counts
in the tooltip. This describes observed transitions, not statistical support.

Strict task completion is secondary and displayed as passed/graded counts.
Task-specific diagnostics retain their original units where the deterministic
grader records them: checks passed, levels completed, actions, or environment
efficiency. Like-for-like metric differences are descriptive; action-count
increases are not automatically classified as regressions. These outputs are
not averaged into a replacement intelligence index or retroactive partial credit.
Published scores, the frozen panel, graders, and alert thresholds are unchanged.

Outcome variability uses the number of strict-result flips across repeated runs
of the same item and model. One observation cannot establish variability.
Saturation and scoring floors are calibration findings to review after the
21-day freeze, not a reason to rotate questions during the baseline period.
