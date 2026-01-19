# Daily Report

Generate a daily report of completed work with tweet drafts.

## Steps

1. **Fetch completed issues**: Use Linear to get all issues marked as "Done" that were updated today:
   - Team: Habitron
   - State: Done
   - Updated: -P1D (last 24 hours)

2. **Filter to today only**: From the results, identify which issues were actually completed today (check updatedAt timestamp).

3. **Generate tweet drafts**: For each completed issue, write a short, engaging tweet that:
   - Is concise (under 280 characters)
   - Highlights the user benefit or the "why"
   - Uses casual, human tone (not corporate speak)
   - Avoids hashtags unless specifically requested

4. **Present the report**: Show a summary with:
   - List of completed issues (ID, title)
   - A draft tweet for each one
