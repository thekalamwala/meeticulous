// "Write with Bolt" AI listing autofill availability.
//
// LIVE as of 2026-07-xx go-live: v3.69 migration applied on both DBs (with RLS
// lockdown), subscription_plans.limits seeded with ai_generations, and
// ANTHROPIC_API_KEY set on the Render backend. When true the ServiceForm button
// is active; when false it renders greyscaled + inactive (the pre-key state).
export const BOLT_ENABLED = true;
