# Docs Index

## Always read for feature work

| File                               | Description                                                                            |
| ---------------------------------- | -------------------------------------------------------------------------------------- |
| [../CONTEXT.md](../CONTEXT.md)     | Canonical product and domain terminology — read before touching any domain-facing code |
| [architecture.md](architecture.md) | System context, component, sequence, and ER diagrams; decision log                     |
| [changelog.md](changelog.md)       | Keep-a-Changelog format; one entry per change under Unreleased                         |

## Reference — load when relevant

| File                                                           | Description                                                                              |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| [money.md](money.md)                                           | Integer-minor-units convention; which fields are cents; display helpers                  |
| [images.md](images.md)                                         | Image entity model, upload flow, R2 storage, and crop docs                               |
| [materials.md](materials.md)                                   | Finish Library and material entity docs                                                  |
| [plans-context.md](plans-context.md)                           | Plans workspace implementation context; calibration, measurements, derived images        |
| [design-system.md](design-system.md)                           | Design tokens, component conventions, Tailwind config                                    |
| [accessibility.md](accessibility.md)                           | Accessibility guidelines and ARIA conventions                                            |
| [contributing.md](contributing.md)                             | Branching, PR conventions, commit format, migrations, ADRs                               |
| [agent-setup-handoff.md](agent-setup-handoff.md)               | Current agent setup handoff: architecture context, strengths, gaps, and improvement plan |
| [runbook.md](runbook.md)                                       | Deployment, rollback, log access, secret rotation, DB migrations                         |
| [troubleshooting.md](troubleshooting.md)                       | Debugging guide and runbook for common issues                                            |
| [roadmap.md](roadmap.md)                                       | Feature roadmap — not needed for implementation work                                     |
| [privacy.md](privacy.md)                                       | Privacy policy and data handling — not needed for implementation work                    |
| [adr/](adr/)                                                   | Architecture Decision Records                                                            |
| [generated/architecture-map.md](generated/architecture-map.md) | Generated import/module map; refresh with `pnpm arch:scan`                               |
