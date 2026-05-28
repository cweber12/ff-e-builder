# Docs Index

## Always read for feature work

| File                               | Description                                                                            |
| ---------------------------------- | -------------------------------------------------------------------------------------- |
| [../CONTEXT.md](../CONTEXT.md)     | Canonical product and domain terminology — read before touching domain-facing behavior |
| [architecture.md](architecture.md) | System context, component boundaries, sequence and ER diagrams                         |
| [changelog.md](changelog.md)       | Keep-a-Changelog history; start with `Unreleased`                                      |

## Context docs (`docs/context/`)

| File                                                                           | Description                                                                    |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| [context/plans-context.md](context/plans-context.md)                           | Plans workspace context: calibration, measurement, canvas flows, and contracts |
| [context/materials-context.md](context/materials-context.md)                   | Finish Library/materials subsystem context and behavior                        |
| [context/generated-item-table-state.md](context/generated-item-table-state.md) | FF&E/Proposal generated-item table state and consolidation plan                |

## Reference docs (`docs/reference/`)

| File                                                                     | Description                                                 |
| ------------------------------------------------------------------------ | ----------------------------------------------------------- |
| [reference/money.md](reference/money.md)                                 | Integer-minor-units conventions and money handling rules    |
| [reference/images.md](reference/images.md)                               | Image entities, upload flows, R2 storage, and crop behavior |
| [reference/design-system.md](reference/design-system.md)                 | Design tokens, UI conventions, and Tailwind patterns        |
| [reference/accessibility.md](reference/accessibility.md)                 | Accessibility guidelines and ARIA conventions               |
| [reference/privacy.md](reference/privacy.md)                             | Privacy and data-handling policy                            |
| [reference/cli-command-reference.md](reference/cli-command-reference.md) | Reusable CLI command templates and update rules             |

## Ops docs (`docs/ops/`)

| File                                             | Description                                                      |
| ------------------------------------------------ | ---------------------------------------------------------------- |
| [ops/runbook.md](ops/runbook.md)                 | Deployment, rollback, secrets, and operational procedures        |
| [ops/troubleshooting.md](ops/troubleshooting.md) | Common debugging and incident diagnostics                        |
| [ops/testing-matrix.md](ops/testing-matrix.md)   | Risk-based verification levels and change-type test expectations |

## Process and architecture docs

| File                                 | Description                                                    |
| ------------------------------------ | -------------------------------------------------------------- |
| [agent-routing.md](agent-routing.md) | Agent ownership boundaries, routing defaults, and escalation   |
| [contributing.md](contributing.md)   | Branching, PR conventions, commit format, migrations, and ADRs |
| [adr/](adr/)                         | Architecture Decision Records                                  |

## Generated docs

| File                                                           | Description                                                |
| -------------------------------------------------------------- | ---------------------------------------------------------- |
| [generated/architecture-map.md](generated/architecture-map.md) | Generated import/module map; refresh with `pnpm arch:scan` |
| [generated/database-map.md](generated/database-map.md)         | Generated schema map; refresh with `pnpm db:map`           |
