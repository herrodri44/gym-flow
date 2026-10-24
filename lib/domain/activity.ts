// Attendance thresholds shared by the dashboard and the members list.
// Pure constants (no DB imports) so client components can use them in labels.

/** A member with a visit in the last N days counts as "still coming". */
export const RECENT_VISIT_DAYS = 30

/** Lapsed or never-paid members with no activity for N days are offered for deactivation. */
export const STALE_AFTER_DAYS = 60
