# JourneyOS repository instructions

## Persistent project context

`JOURNEYOS_CONTEXT.md` is the canonical project handoff and decision log.

Whenever a task changes JourneyOS behavior, architecture, integrations, environment-variable requirements, setup commands, voice-agent instructions, UX decisions, test coverage, deployment, or Git/PR state, update `JOURNEYOS_CONTEXT.md` during the same task.

Keep the document concise and current. Replace obsolete statements instead of accumulating contradictory history. Update its `Last updated` date and validation status when relevant.

Never write API keys, access tokens, passwords, context secrets, private credentials, or personal phone numbers into the context document. Record environment-variable names and redacted examples only.

Pure questions that do not alter the project do not require a context-file edit.

