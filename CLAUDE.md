@AGENTS.md

# Claude Delegation Policy

## Agent Routing Table

Delegate via the Agent tool for any task matching the patterns below.
Direct execution only for tasks that match no agent.
When in doubt, delegate.

| Task Pattern | Agent |
|---|---|
| Architecture decisions, system design, navigation structure, state flow planning | `rn-architect` |
| Building screens, implementing flows, auth/chat/settings/profile screens | `rn-screen-builder` |
| Building reusable components, UI primitives, MessageBubble, Avatar, etc. | `rn-component-builder` |
| TypeScript types, interfaces, domain models, API contracts | `type-modeler` |
| Mock data, fixtures, seed data, sample users/messages/chats | `mock-data-gen` |
| Git commit, stage files, push to branch | `git-committer` |

## Rules

1. **Delegate** via Agent tool for any matching task above
2. **Direct execution** only for tasks matching no agent (config edits, shell commands, quick fixes)
3. **When in doubt, delegate** — agents are cheaper and more focused than main context
4. **Parallel execution**: spawn independent agents in a single message for maximum throughput
5. **Branch**: always `claude/telegram-messenger-react-native-Vq4Av`
