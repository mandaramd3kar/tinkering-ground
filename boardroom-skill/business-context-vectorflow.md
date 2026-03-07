# Business Context - VectorFlow AI

## Business Overview

**Company Name**: VectorFlow AI

**What We Do**: Developer-first vector database and RAG orchestration platform that makes it simple to build production-grade AI applications with accurate, up-to-date information retrieval.

**Who We Serve**: Software engineers and AI/ML teams at mid-market companies (50-500 employees) building customer-facing AI features. Primary personas: Backend engineers (30%), ML engineers (45%), Technical founders (25%).

**Stage**: Early revenue / Growth stage

## Revenue & Metrics

**Business Model**: SaaS with usage-based pricing (storage + compute), plus enterprise annual contracts

**Current MRR/ARR**: $42K MRR ($504K ARR run rate)

**Revenue Streams**: 
- Self-serve monthly plans: $28K MRR (67%)
- Enterprise annual contracts: $14K MRR (33%)

**Key Metrics**:
- Customer count: 87 paying customers (312 free tier)
- Average deal size: $485/month (self-serve), $4,200/month (enterprise)
- Customer acquisition cost (CAC): $820
- Lifetime value (LTV): $8,400 (estimated, 18 month retention)
- Gross margin: 72%
- Burn rate: $115K/month
- Runway: 14 months

**Growth Rate**: 22% month-over-month for past 4 months

## Team

**Total Headcount**: 9

**Team Composition**:
- Engineering: 5 (2 backend, 2 full-stack, 1 ML)
- Product: 1 (Head of Product, also does some eng)
- Sales/Marketing: 1 (Growth lead)
- Operations: 0 (CEO handles)
- Leadership: 2 (CEO/CTO co-founders)

**Key Strengths**: Deep ML expertise, fast shipping velocity (2-week sprint cycles), strong developer relations in AI Twitter community

**Key Gaps**: No dedicated DevRel, no sales team for enterprise motion, limited marketing expertise, no finance/operations person

**Culture Notes**: Fully remote, US/EU timezones, high autonomy, documentation-heavy async culture, weekly demo days

## Products & Services

**Core Offering**: 
- Managed vector database (Postgres + pgvector under the hood)
- RAG orchestration framework (chunking, embedding, retrieval strategies)
- Observability and evaluation tools for RAG pipelines
- Python & TypeScript SDKs

**Differentiators**: 
- 10x simpler API than competitors (5 lines of code vs 50+)
- Built-in evaluation and testing framework (unique in market)
- Opinionated but flexible (good defaults, power user escape hatches)
- Developer experience obsession (docs, DX, examples)

**Tech Stack**: Python backend (FastAPI), PostgreSQL + pgvector, Redis, deployed on AWS (ECS/RDS), OpenTelemetry for observability, Next.js dashboard

**Product Roadmap**: 
- Q2: Multi-modal RAG (images, videos), hybrid search improvements
- Q3: Enterprise SSO/RBAC, on-prem deployment option
- Q4: Fine-tuning pipeline integration, advanced chunking strategies

## Strategic Goals (6-12 Month Horizon)

1. **Reach $1M ARR** - Current trajectory suggests 8-9 months
2. **Launch enterprise tier** - SSO, SLAs, dedicated support (Q3 target)
3. **Establish category leadership** - Be the #1 "RAG platform" in developer mindshare

**Success Metrics**: 
- ARR milestone ($1M by EOY)
- Net Revenue Retention >110%
- >5000 GitHub stars (currently 2,100)
- 3+ Tier 1 enterprise logos ($100K+ ACV)

## Market & Competition

**Market Size**: 
- TAM: $12B (enterprise AI application infrastructure)
- SAM: $2.5B (RAG-specific tooling)
- SOM: $400M (developer-first, self-serve motion)

**Primary Competitors**:
- **Pinecone**: Market leader, $100M+ ARR, closed-source, expensive. Our differentiation: 3x cheaper, better DX, evaluation tools.
- **Weaviate**: Open-source player, strong community, complex setup. Our differentiation: Managed simplicity, faster onboarding, opinionated best practices.
- **LangChain**: Framework approach, very popular but DIY. Our differentiation: End-to-end platform, production-ready, observability included.

**Market Position**: Fast-growing challenger in crowded but expanding market. Winning on developer experience and "full solution" positioning.

**Market Trends**: 
- RAG is becoming table stakes for LLM applications (shift from "experimental" to "production")
- Enterprises moving from POCs to production deployments (buying cycle compressing)
- Open source AI models maturing (less reliance on OpenAI = more control needed)
- Regulatory pressure on AI transparency (observability/evals becoming critical)

## Current Challenges

**Top 3 Challenges**:
1. **Enterprise sales motion unclear** - Self-serve works well, but $100K+ deals need different approach. Don't have sales team or playbook.
2. **Infrastructure costs growing faster than revenue** - 72% margin today, but trend is downward as we add more compute-heavy features. Need to optimize or price differently.
3. **Engineering bandwidth at limit** - Shipping fast, but tech debt accumulating. Choose between new features vs refactoring vs hiring.

**Constraints**:
- Budget: 14 months runway, can't sustain current burn indefinitely
- Time: Pinecone is shipping fast, can't afford to be lapped
- Resources: Engineering team maxed out, can't take on more without hiring
- Other: CEO doing too many hats (sales, ops, some eng), not scalable

## Funding & Ownership

**Funding Stage**: Post-seed ($2.5M raised)

**Total Raised**: $2.5M ($500K pre-seed + $2M seed, led by Accel)

**Investors**: Accel (lead), Unusual Ventures, AI Fund, 12 angel investors (former founders, technical GTM folks)

**Burn Multiple**: 2.7 (spending $2.70 to generate $1 of new ARR)

**Profitability**: Not profitable, path to profitability likely 18-24 months at current trajectory (needs $2-3M ARR at 75%+ margin)

## Additional Context

**Brand Values**: 
- Developers first (not sales-first)
- Transparency (open roadmap, public metrics)
- Pragmatism over perfectionism (ship, learn, iterate)

**Customer Relationships**: 
- Community-driven (Discord with 1,800 members, very active)
- Low-touch self-serve for SMB
- High-touch for enterprise (directly with founders)

**Distribution Channels**: 
- Organic (SEO, docs, GitHub)
- Community (Discord, AI Twitter, conference talks)
- Partnerships (OpenAI, Anthropic ecosystem integrations)
- Content (technical blog posts, tutorials)

**Pricing Strategy**: 
- Free tier (generous limits to drive adoption)
- Self-serve: $99-$499/month (usage-based)
- Enterprise: Custom (starting ~$50K/year)
- Philosophy: Price on value delivered (accuracy improvement, time saved), not just infra costs

**Risk Tolerance**: Moderately aggressive. Willing to take calculated bets (e.g., launched multi-modal before competitors) but not reckless (no crazy spending, measure everything).
