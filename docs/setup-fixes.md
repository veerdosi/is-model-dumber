# Evaluation setup fixes

These are implementation notes, not evaluation observations. Setup-debug responses,
scores, native session logs and run plans are excluded from Git and public history.

| Cause | Fix | Prevention |
| --- | --- | --- |
| Integer-to-enum construction was incompatible with the installed ARC engine | Resolve actions by their named enum members (`ACTION1` through `ACTION4`) | Pin SDK/engine versions; broker and independent replay use the same named mapping |
| Interactive deadline started when a broker process launched, before its evaluator was ready | Start the 480-second interactive clock on the first authenticated request | Queueing/startup time cannot consume the playing window; enforce the limit inside the broker |
| A container's file-size hard limit was lower than the trusted runner's requested limit | Match the Docker hard limit and Python resource limit at 1 MiB | Keep both values together when editing the execution adapter |
| A host temporary directory was outside the macOS VM's shared mounts | Put submission files in the ignored project-local private directory and use a strict bind mount | A missing source now causes a mount error instead of silently creating a directory |
| Native session finals used `phase=final_answer` instead of `channel=final` | Accept both documented runtime record forms | Model and reasoning evidence still come from `turn_context`, never the response text |
| An interrupted chat can interrupt its active evaluation agents | Treat interrupted/incomplete work as unfinished; replace setup-debug contexts before accepting a baseline | Resume the run plan, keep published data gated, and never invent terminal responses |

Reference and output data are separate from task execution. Adapter repairs regrade
the unchanged original response when execution was valid. A setup problem that
changes available task time requires a fresh context with the correct environment.
Only verified measurements are eligible for public publication.
