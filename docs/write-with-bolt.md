# Write with Bolt
AI Service Listing Generator

## Summary
Hosts currently spend several minutes filling a service form, leading to drop-offs. Write with Bolt lets a host enter only the service title and automatically generates all remaining listing content. The host reviews the generated content before publishing.

## Goals
- Reduce time to publish.
- Increase listing completion.
- Improve content quality.
- Produce SEO/AEO/GEO-ready listings.
- Never publish without host review.

## User Flow
1. Host opens Create Service.
2. Enters service title.
3. Clicks "✨ Write with Bolt".
4. AI fills every supported field.
5. Host edits if required.
6. Host publishes.

## Generated Fields
- Title
- Short Description
- Long Description
- Included Items
- Excluded Items
- FAQs
- Important Note
- Category (when confidently inferred)

Price, duration and other factual values are never invented.

## Content Standards
Generated content must:
- Match the host's intent.
- Be natural and human-readable.
- Follow Book A Sloth's writing style.
- Be optimized for search engines, answer engines and AI search.
- Never fabricate prices, reviews, ratings, certifications or guarantees.

## Validation
Every response must:
- Match the form schema.
- Respect character limits.
- Pass server-side validation.
- Retry automatically on invalid output.
- Populate only valid fields.

## Usage Limits
Starter: 1 generation / 6 months
Host+: 2 generations / 3 months
Studio: 2 generations / month

Regenerations inside the same draft session are free.

## Technical Overview
Frontend sends the title to the backend.
Backend generates structured content using Claude.
Validated data is returned and populates the existing form.
Publishing continues through the normal save flow.

## Success Metrics
- Higher completion rate
- Lower time to publish
- Feature adoption
- Publish rate
- Validation success
- Generation latency
- Cost per generation

## Future
- Multi-language
- Per-field regeneration
- Prompt caching
- Additional schema types
