# Prediction model

This app is a tracking and forecasting tool, not a diagnostic medical device. It does not infer medical causes. All calculations run locally in the browser from confirmed events.

## Data separation
Confirmed events are stored in IndexedDB. Predictions are always derived at runtime and are never stored as confirmed observations.

## Recurrence model
For migraine starts and menstruation starts separately:

1. Sort confirmed event start dates.
2. Calculate start-to-start intervals.
3. If at least five intervals exist, cap extreme interval values at median ± 3 robust standard deviations (MAD × 1.4826) for the recurrence estimate only. Original observations are never changed.
4. Apply recency weights `0.84^age` for migraine and `0.86^age` for menstruation, where the newest interval has weight 1.
5. Estimate a center as `0.6 × recency-weighted mean + 0.4 × recency-weighted median`.
6. Estimate spread from a 50/50 blend of weighted standard deviation and robust MAD, then inflate the spread for small samples by `sqrt(1 + 4/n)`.
7. Build a discrete interval distribution as a 55% recency-weighted Gaussian mixture around observed intervals plus 45% Gaussian around the robust center.
8. Condition the next-event distribution on the event not having been logged before the current date. This assumes events through today have been entered.
9. Project later cycles by discrete renewal convolution. These projections are used for the calendar, while the forecast card refers specifically to the next event.

## Duration model
Duration is calculated inclusively from confirmed start and end dates. Expected duration is a recency-weighted mean. The displayed range is the empirical 25th–75th percentile rounded to whole days. Daily continuation probabilities use a smoothed empirical survival curve.

## Menstruation daily probability
The model first estimates the probability that a menstruation event starts on each future date. Daily probability of being in menstruation is then the start-date probability convolved with the empirical duration survival curve. Predicted daily probability is capped at 95%; a confirmed event is displayed as 100%.

## Migraine relationship to menstruation
For each relative day from −7 to +7 around every confirmed menstruation start, the model measures whether a confirmed migraine was present on that date. Each relative-day rate receives Beta smoothing and is converted to a multiplier relative to the observed migraine-day baseline. Multipliers are capped before being shrunk toward 1 according to the number of confirmed cycles.

This is an observed association only. The model does not label it hormonal or causal.

## Combined migraine probability
A migraine recurrence model independently estimates daily migraine probability from migraine timing and duration. A separate menstruation-phase signal is calculated from the observed relative-day relationship and the predicted menstruation-start distribution.

Signals are combined on the log-odds scale:

`logit(P) = logit(baseline) + w_rhythm × (logit(P_rhythm) − logit(baseline)) + w_phase × ln(phase_multiplier)`

where:

- `w_rhythm = number_of_migraine_intervals / (number_of_migraine_intervals + 5)`
- `w_phase = number_of_confirmed_menstruation_cycles / (number_of_confirmed_menstruation_cycles + 10)`

This intentionally shrinks predictions toward the baseline when data is limited and reduces double-counting of correlated signals.

## Confidence
Confidence is descriptive rather than a probability of correctness.

- Menstruation can be High only after at least 10 confirmed cycles and low relative variability.
- Migraine can be High only after at least 14 migraine events, at least 10 menstruation cycles, and low relative variability.
- The supplied seed dataset therefore cannot produce High confidence.

## Limitations

- Small samples produce wide uncertainty and unstable patterns.
- Missing or late event logging can distort the forecast.
- Calendar probabilities are statistical estimates, not diagnoses.
- A temporal relationship does not prove causation.
- The model is not validated for clinical decision-making.
