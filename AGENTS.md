# Project collaboration

- Use `gpt-5.6-sol` with `medium` reasoning as the primary supervisor when that configuration is available. The primary agent owns requirements, architecture, decisions, integration, review, and final verification.
- Delegate bounded implementation, visual execution, repository exploration, and other useful parallel work to the project agent `luna_high`, configured as `gpt-5.6-luna` with `high` reasoning.
- The primary agent must review subagent output, integrate changes deliberately, and run relevant verification before reporting completion.
- Keep urgent blocking decisions and tightly coupled integration work in the primary thread. Give the subagent concrete scope, expected output, and file ownership.
- If an exact requested model is unavailable, state the fallback clearly and use the closest available configuration.
- Preserve the author's direct, approachable coding style while improving file boundaries, naming, and testability.
