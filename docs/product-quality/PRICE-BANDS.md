# Meaningful numeric filters

The shared course table no longer exposes arbitrary minimum/maximum price inputs. Both administrator and trainer course management (and other uses of the course preset) use the existing Spartan radio-menu component with:

- All prices
- Free: exactly 0 TND
- Paid · under 50 TND: greater than 0 and less than 50
- 50–under 100 TND
- 100–under 200 TND
- 200 TND and above

Intervals are non-overlapping and cover every nonnegative finite price. Decimal amounts at boundaries are tested; missing/invalid values are not treated as free. Filtering uses existing API records, not static course data.

The audit found three other numeric table filters. They now offer domain-specific choices instead of unrestricted number inputs:
- Learning progress: not started, in progress, completed (0–100%).
- Assessment score: below 50%, 50–under 70%, 70–under 90%, 90–100%. These are numeric bands, not pass/fail labels: assessment pass thresholds can differ.
- Review rating: exact 1–5-star choices.

Band selection intersects with search, categorical and date filters and sorting, resets pagination, and participates in the reset button/count. Existing date-order feedback is preserved. Server validation is unchanged; these controls filter fetched data locally.

## Verification
- Seven table derivation tests passed, including new boundary/domain/intersection/reset cases.
- Twenty new browser checks passed against disposable real API records for administrator and trainer course management: all price intervals, no numeric inputs, reset, dark keyboard focus return, mobile menu bounds.
- Existing dashboard-detail (19) and control (13) browser scenarios passed, with the score scenario updated for the new selection control. Total: 52 browser checks/scenarios, no page runtime errors.
- Angular development build passed: `c8b954240daca1e0`. Existing CommonJS warnings remain. No production-optimization or additional-browser claim.

Run `npm run test:tables` from `front`. With the disposable dashboard API and built-app fixture server running, run `node tests/dashboard-details.browser.cjs`, `node tests/dashboard-controls.browser.cjs`, then `node tests/price-bands.browser.cjs` sequentially. The new browser test creates boundary-price courses in that disposable database only.

Screenshot: `price-bands/mobile-dark.png`.
