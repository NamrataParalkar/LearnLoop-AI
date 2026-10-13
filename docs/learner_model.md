# Learner Model (BKT)

The Learner Model tracks per-concept mastery using Bayesian Knowledge Tracing (BKT), adjusted for difficulty and confidence.

## Core Concepts
1. **Idempotency**: All updates run through an idempotency gate tracking `MasteryEvent` by `(source_type, source_id, concept_id)`.
2. **Bayesian Knowledge Tracing (BKT)**: `p_known` is updated probabilistically based on correct/incorrect attempts.
   - Initial state: `p_init` = 0.1 (updated after diagnostics).
   - Parameters: `p_learn=0.15`, `p_slip=0.10`, `p_guess=0.05-0.25` (based on question type).
3. **Difficulty-Aware Evidence**: Getting a "hard" question correct moves mastery up more than an "easy" question. Interpolated via a `weight` variable [0.5, 1.5].
4. **Confidence Adjustments**:
   - High confidence + Wrong = Stronger penalty (`confidence_mismatch`).
   - Low confidence + Correct = Weaker increase (possible guess).
5. **Decay / Forgetting Curve**: Mastery decays over time based on `stability_days`. Spaced repetition increases stability.
6. **Prerequisite Readiness**: Topics are locked if direct dependencies are below `READY_THRESHOLD=0.6`.
