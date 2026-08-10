# v6 Experiments

Experiments are now active in M3; M1 was implementation, not experimentation. See `PLAN.md`.

**Empty until milestone M2.** M1 is implementation, not experimentation — see `PLAN.md`.

One directory per material candidate, named `NNN-slug`, numbered from `001`. v6 numbering starts fresh;
v5's 95 experiments keep their numbers under `data/reference/v5/experiments/`.

## Required contents

| File | Contents |
| --- | --- |
| `experiment.md` | Hypothesis, pre-registered sample, held-out units, promotion gate, rejection rule, maximum calls. **Written before the experiment runs.** |
| `inputs.json` | Sample manifest — the exact cities and parameters |
| `<city>.json` | One raw model response per city, unedited |
| `<city>-telemetry.json` | Calls, searches, tokens, latency, blocks |
| `results.json` | Deterministic scoring output, with `schemaVersion` |
| `verdict.md` | Exactly one verdict: reject / revise and retest / promote / accept |

## Rules carried over from v5, which got this part right

- **Pre-register before running.** A gate chosen after seeing results is not a gate.
- **Retain raw responses unedited**, including failures and blocks.
- **Score with a deterministic script**, supporting `--check` where practical.
- **One verdict per experiment.** Do not rescue a failed candidate with ad hoc exceptions.
- **Independently verify any explanation a model gives for a failure.** It is a hypothesis, not evidence.
- A directory with no `verdict.md` is an experiment that has not concluded. A directory with no raw
  responses is an experiment that never ran — say so explicitly, as
  `data/reference/v5/experiments/095-dated-hostel-inventory-panel/verdict.md` does.

## Rules new in v6

Read `LOOP-PROMPT-V6.md` §5 in full before starting. The binding ones:

- **Three strikes.** Three consecutive experiments failing the same gate for the same structural reason
  means the gate is the defect. Stop; do not run a fourth.
- **Per-field budget: 8 experiments.** Reaching it means the field takes its best available grade and the
  loop moves on.
- **Grade D is a completed field**, not a blocked one.
- Check `data/reference/v6/README.md` and `LOG.md` before collecting anything. v5 collected a great deal
  that was never used.
