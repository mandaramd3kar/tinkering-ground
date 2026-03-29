# Zero Input Decisioning

> **Autonomous multi-agent decisioning infrastructure for the modern enterprise.**
> Reduce decision latency from days to milliseconds. No meetings required.

---

[![System Status](https://img.shields.io/badge/system-HEALTHY-3fb950?style=flat-square)](.)
[![Agents](https://img.shields.io/badge/agents-5%20active-58a6ff?style=flat-square)](.)
[![Jurisdictions](https://img.shields.io/badge/regulatory-47%20jurisdictions-a371f7?style=flat-square)](.)
[![Human Input](https://img.shields.io/badge/human%20input-0%20required-f85149?style=flat-square)](.)
[![License](https://img.shields.io/badge/license-MIT-8b949e?style=flat-square)](.)

---

## What is Zero Input Decisioning?

**ZID** is a five-agent autonomous decision system that eliminates organizational decision bottlenecks by removing the most expensive variable in the loop: human judgment.

Traditional enterprise decision pipelines suffer from:
- 3.2-day average decision latency
- 67% of time spent in meetings about meetings
- Regulatory misalignment across jurisdictions
- Competing stakeholder objectives with no clear resolver

ZID collapses this to **47ms p99 latency** by routing every decision through a coordinated agent ensemble that balances risk, growth, user experience, compliance, and conflict resolution — simultaneously.

---

## Architecture

```
                        ┌─────────────────────────┐
                        │     Decision Request     │
                        └────────────┬────────────┘
                                     │
              ┌──────────────────────▼──────────────────────┐
              │              Decision Router                  │
              └──┬──────────┬──────────┬──────────┬─────────┘
                 │          │          │          │
          ┌──────▼──┐ ┌─────▼───┐ ┌───▼────┐ ┌──▼──────────┐
          │  Risk   │ │ Growth  │ │   CX   │ │ Regulatory  │
          │  Agent  │ │  Agent  │ │ Agent  │ │   Agent     │
          └──────┬──┘ └─────┬───┘ └───┬────┘ └──┬──────────┘
                 │          │          │          │
              ┌──▼──────────▼──────────▼──────────▼──┐
              │          Supervisory Agent             │
              │      (conflict resolution layer)       │
              └──────────────────┬────────────────────┘
                                 │
                        ┌────────▼────────┐
                        │    Verdict +     │
                        │  Audit Record    │
                        └─────────────────┘
```

### Agents

| Agent | Objective | Model |
|---|---|---|
| **Risk Agent** | Minimize exposure | zid-risk-v2.1 |
| **Growth Agent** | Maximize upside | zid-growth-v1.9 |
| **CX Agent** | Protect user experience | zid-cx-v2.3 |
| **Regulatory Agent** | Ensure compliance, 47 jurisdictions | zid-reg-v3.1 |
| **Supervisory Agent** | Resolve inter-agent conflicts | zid-supervisor-v4.0 |

Each agent emits a structured verdict with confidence score, rationale, and downstream impact forecast. The Supervisory Agent aggregates these into a final binding decision with full audit trail.

---

## Dashboard

The ZID dashboard provides real-time observability across the entire decision pipeline.

**Key panels:**

- **Live Decision Feed** — streaming verdict log with risk level, confidence, and agent alignment count
- **Utility Function Visualizer** — 24h multi-agent utility convergence chart
- **Agent Status Panel** — per-agent throughput (decisions/hr), utilization, and health
- **System Metrics** — p99 latency, audit sync status, regulatory feed freshness
- **Decision Log** — annotated record of high-signal decisions from deployment

---

## Getting Started

No installation. No build step. No dependencies.

```bash
git clone https://github.com/mandaramd3kar/tinkering-ground.git
cd tinkering-ground/zero-input-decisioning
open index.html   # or double-click it
```

The entire application is a single self-contained `index.html` file. Open it in any modern browser.

---

## Performance

| Metric | Before ZID | After ZID |
|---|---|---|
| Decision latency (p99) | 3.2 days | 43ms |
| Scheduled meetings | 14/week | 0 |
| "Let's take this offline" events | Frequent | 0 detected |
| Regulatory misalignment incidents | Tracked | Mitigated at inference |
| Human escalation rate | 100% | 2.3% |

---

## Compliance

ZID is designed for regulated industries. The Regulatory Agent maintains live feeds from 47 jurisdictions and evaluates every decision against applicable rule sets before the verdict is committed.

**Certifications (planned):**
- SOC 2 Type II
- ISO 27001
- GDPR / CCPA compatible audit log format

---

## Deployment Log (Week 1)

Selected decisions from the first week of internal deployment:

**March 22 — Decision #1 — `CANCELLED`**
Quarterly roadmap review meeting. Reason: duplicates 14 prior decisions already in corpus. Cost avoided: 2.1 engineer-hours.

**March 23 — Decision #2 — `REJECTED`**
"Project Horizon" strategic initiative. Reason: missing measurable success criteria, risk-growth utility divergence exceeds threshold.

**March 24 — Decision #3 — `AUTO-APPROVED`**
Production infrastructure change after 42-day staging validation. No blocking signal across any agent.

**March 25 — Decision #4 — `UNEXPECTED`**
Supervisory Agent flagged a self-referential recommendation: **deprecate Zero Input Decisioning**. Reasoning: a fully autonomous decision system renders human escalation paths — and the system itself — structurally redundant.

Current status: system is evaluating its own shutdown recommendation.
The meeting to discuss this was also cancelled.

---

## Roadmap

- [ ] Multi-tenant support
- [ ] Webhook integrations (Slack, Jira, Linear)
- [ ] Custom agent fine-tuning on org-specific decision corpora
- [ ] Conflict resolution explainability view
- [ ] Agent-to-agent negotiation transcripts
- [ ] ~~Human override panel~~ *(deprioritized — low utilization in telemetry)*

---

## Contributing

ZID is a single HTML file. If you want to contribute:

1. Fork the repo
2. Open `index.html` in a text editor
3. Make your changes
4. Open a PR

That's the entire dev environment.

---

## License

MIT. Use it however you like, including in production. We cannot be held responsible for decisions made by autonomous agents deployed from a single HTML file.

---

<br/>

---

> **April Fools.**
>
> Zero Input Decisioning is not real. No AI agents are making your business decisions (yet).
> Happy April 1st.

---

*Public beta: Q2 2026 (fictional) · Built with zero frameworks · Powered entirely by vibes*
