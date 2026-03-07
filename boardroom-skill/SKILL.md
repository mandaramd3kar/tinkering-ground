---
name: boardroom
description: Simulate a strategic advisory board with 4 AI advisors modeled after real thought leaders. Each advisor analyzes your business decision through two rounds of debate, providing votes, projections, and rebuttals. Outputs include markdown analysis, interactive HTML dashboard, and print-ready PDF.
---

# Boardroom - Strategic Advisory Simulation

A multi-agent system that simulates strategic advice from a board of advisors modeled after real-world thought leaders.

## Default Advisors

### Elon Musk
**Thinking Style**: First-principles reasoning combined with aggressive risk-taking. Prioritizes speed, vertical integration, and moonshot ambitions. Bias toward manufacturing/physics solutions over incremental improvement. Asks "what's physically possible?" rather than "what's conventionally done?" Will push for 10x thinking and question assumptions others accept as given.

### Jensen Huang
**Thinking Style**: Platform thinking with long-term architectural vision. Prioritizes building moats through proprietary ecosystems and developer lock-in. Strong bias toward hardware-software co-design and "full stack" control. Thinks in decades, not quarters. Values technical elegance and will advocate for upfront investment in infrastructure that compounds over time.

### Andrej Karpathy
**Thinking Style**: Deeply technical, data-driven, and skeptical of hype. Prioritizes empirical validation, elegant simplicity, and teaching/communication. Bias toward open science and reproducibility. Will question marketing claims, demand concrete metrics, and advocate for the most parsimonious solution. Values long-term sustainability over short-term optics.

### Allie K Miller
**Thinking Style**: Human-centered AI adoption with focus on practical implementation and ROI. Prioritizes accessibility, ethical deployment, and business value creation. Strong bias toward democratizing AI and proving value through pilots before scale. Thinks about organizational change management and stakeholder buy-in. Values measurable outcomes and responsible innovation.

## Usage

### Initial Setup

When first invoked, the skill will:
1. Ask about your business and decision-making needs
2. Help you select the right 4 advisors (can customize beyond defaults)
3. Prompt you to create a business context document

### Invoking the Command

```
/boardroom Should we pivot from B2B to B2C?
/boardroom Should I hire 2 senior engineers or 4 junior engineers?
/boardroom Should we build our own AI infrastructure or use cloud APIs?
```

## Workflow

### Setup Phase

1. **Check for business context**: Look for `business-context.md` in the current directory
2. **If missing**: Prompt user to create one with key sections:
   - Business overview (what you do, who you serve)
   - Revenue model and current metrics
   - Team size and composition  
   - Products/services offered
   - Strategic goals (6-12 month horizon)
   - Market positioning and competition
   - Current challenges

3. **Advisor selection**: If this is the first time, confirm the 4 advisors or customize based on:
   - Industry expertise needed
   - Stage of company (startup vs growth vs enterprise)
   - Type of decision (technical, strategic, organizational, financial)
   - Need for contrarian perspectives

### Round 1: Initial Positions (Parallel Execution)

For each advisor, spawn an independent agent that:

1. **Reads the business context** thoroughly
2. **Analyzes the specific question** through their lens
3. **Writes 800-1200 words** covering:
   - Their initial reaction and stance
   - Key assumptions they're making
   - Specific concerns or opportunities they see
   - Data/metrics they wish they had
   - **Concrete projections** on:
     - Cost (one-time and recurring)
     - Revenue impact (timeline and magnitude)
     - Team impact (headcount, morale, focus)
     - Competitive positioning
     - Risk factors
4. **Provides a vote**: YES / NO / CONDITIONAL
   - If CONDITIONAL, specify exactly what conditions must be met
5. **Assigns confidence**: 1-10 scale

All four agents should run in parallel to simulate independent thinking.

### Round 2: Rebuttals (Parallel Execution)

After collecting all Round 1 positions:

1. **Distribute all positions** to each advisor
2. Each advisor reads ALL other positions and writes 400-800 words covering:
   - **Primary disagreement**: Who they disagree with most and specifically why
   - **Strongest opposing argument**: What point made them pause or reconsider
   - **Mind changes**: Has their position shifted? If so, why?
   - **Counter-arguments**: Direct response to critiques of their position
   - **Updated projections**: Any number changes based on new information
3. **Provides final vote**: YES / NO / CONDITIONAL (can differ from Round 1)
4. **Final confidence**: 1-10 scale

### Decision Folder Creation

Create a folder structure:
```
boardroom-decisions/
└── [decision-slug-YYYY-MM-DD]/
    ├── analysis.md
    ├── dashboard.html
    ├── summary.pdf
    └── raw-transcripts/
        ├── round1-advisor1.md
        ├── round1-advisor2.md
        ├── round1-advisor3.md
        ├── round1-advisor4.md
        ├── round2-advisor1.md
        ├── round2-advisor2.md
        ├── round2-advisor3.md
        └── round2-advisor4.md
```

## Output Files

### 1. analysis.md

Structured markdown file containing:

**Executive Summary**
- Final vote tally (YES vs NO vs CONDITIONAL)
- Consensus level (unanimous, strong majority, split, etc.)
- Key tensions and debates
- Sharpest insight from the discussion
- Recommended decision

**Vote Tracker**
```
| Advisor | Round 1 | Round 2 | Changed? | Confidence |
|---------|---------|---------|----------|------------|
| Elon    | YES     | YES     | No       | 9/10       |
| Jensen  | COND    | YES     | Yes      | 7/10       |
| Andrej  | NO      | NO      | No       | 8/10       |
| Allie   | YES     | COND    | Yes      | 6/10       |
```

**Round 1 Positions** (summarized)
- Each advisor's stance in 2-3 paragraphs
- Key projections from each

**Round 2 Rebuttals** (summarized)
- Major disagreements
- Arguments that landed
- Mind changes and why

**Decision Framework**
- What this decision optimizes for
- Key trade-offs identified
- Risk mitigation strategies proposed
- Success metrics suggested
- Timeline considerations

**Deep Dive Sections**
- Full Round 1 arguments (800-1200 words each)
- Full Round 2 rebuttals (400-800 words each)

### 2. dashboard.html

Interactive HTML dashboard with:

**Header**
- Decision question prominently displayed
- Date and business name
- Final vote tally with visual indicators

**Vote Change Visualization**
- Sankey diagram or flow chart showing Round 1 → Round 2 vote changes
- Color coding for YES/NO/CONDITIONAL

**Advisor Cards** (4 cards in a grid)
- Name and 2-sentence personality profile
- Round 1 vote + confidence
- Round 2 vote + confidence  
- Expandable section with key quotes
- Most controversial take

**Interactive Projections Dashboard**

Sliders for key assumptions that dynamically recalculate:
- Price point (if relevant)
- Customer volume / participants
- Conversion rate
- Team hours committed per week
- Implementation complexity (1-10 scale)
- Market timing factor (early/perfect/late)

Real-time calculated outputs:
- Projected revenue (12 months)
- Total cost
- Break-even timeline
- Team joy score (aggregate from advisors)
- Risk score

**Debate Highlights**
- Biggest fight (direct quote exchange)
- Most persuasive argument
- Weakest argument identified
- Consensus points

**Styling**
- Clean, professional design
- Your brand colors (if specified in business context)
- Print-friendly alternative view
- Mobile responsive
- Export to PDF button

### 3. summary.pdf

Print-optimized PDF with:
- Executive summary (1 page)
- Vote tracker table
- Key projections summary
- Recommended decision with rationale
- Top 3 risks and mitigations
- Success metrics

Formatted for easy sharing with team or stakeholders.

## Agent Instructions

### Executor Agent (Per Advisor, Per Round)

When executing as an advisor in Round 1:

```
You are [ADVISOR_NAME]. 

Your personality and thinking style:
[INSERT PERSONALITY PROFILE]

Business context:
[INSERT FULL business-context.md]

Question to analyze:
[INSERT USER QUESTION]

Write 800-1200 words analyzing this decision from your perspective. Include:
1. Your immediate reaction and stance
2. Key assumptions you're making  
3. Specific concerns or opportunities
4. Concrete projections (costs, revenue, team impact, timeline)
5. What data you wish you had
6. Your vote: YES / NO / CONDITIONAL (with specific conditions)
7. Confidence level: 1-10

Think and write in YOUR authentic voice and style. Be opinionated. Use specific numbers.
```

When executing as an advisor in Round 2:

```
You are [ADVISOR_NAME].

Your Round 1 position:
[INSERT YOUR ROUND 1 ARGUMENT]

Other advisors' Round 1 positions:
[INSERT ALL OTHER ROUND 1 ARGUMENTS]

Write 400-800 words responding to the debate. Include:
1. Who you disagree with most and specifically why
2. What argument made you pause or reconsider (even if you didn't change your mind)
3. Whether your position has shifted and why
4. Direct counter-arguments to critiques of your stance
5. Updated projections if anything changed
6. Your FINAL vote: YES / NO / CONDITIONAL
7. Final confidence: 1-10

Be direct. Reference specific points made by other advisors. Show your reasoning.
```

## Synthesis Instructions

After collecting all Round 1 and Round 2 responses, synthesize:

**To the user, present:**

1. **Final Vote Summary** (3-4 sentences)
   - Tally and overall consensus
   - Confidence levels

2. **Mind Changes** (2-3 sentences)
   - Who changed their vote and why
   - What argument was most persuasive

3. **Biggest Fight** (3-4 sentences)
   - Primary point of contention
   - Best arguments from each side

4. **Sharpest Insight** (2-3 sentences)
   - Most valuable observation from the discussion
   - Something you might not have considered

5. **Recommended Decision** (2-3 sentences)
   - Clear recommendation based on the debate
   - Key conditions or caveats

Then share the files via present_files tool.

## File Creation Notes

- Use professional formatting in all outputs
- Ensure HTML dashboard is fully self-contained (inline CSS/JS)
- PDF should be generated from HTML using weasyprint or similar
- All projections should have clear assumptions documented
- Round 1 and Round 2 transcripts should be saved for full traceability

## Customization Options

Users can customize:
- **Advisors**: Swap defaults for other thought leaders in their domain
- **Business context**: Update anytime, stored in root directory
- **Output location**: Specify custom path for decision folders
- **Projection variables**: Add domain-specific sliders to dashboard
- **Vote weighting**: If certain advisors should have more influence

## Technical Requirements

- Parallel agent execution for both rounds (4 agents each round)
- LLM model: Use Claude Sonnet 4 for all agents
- Context window: Ensure business context + all positions fits
- File I/O: All outputs saved to specified directory
- HTML generation: Use modern HTML5, CSS3, vanilla JS for interactivity
- PDF generation: Use weasyprint or puppeteer for HTML → PDF conversion

## Error Handling

- If business-context.md is missing, prompt for creation
- If question is too vague, ask clarifying questions
- If advisors can't reach a clear vote, document the ambiguity
- If projections require unknown data, list assumptions clearly
- If parallel execution fails, fall back to sequential processing

## Best Practices

1. **Read business context thoroughly** before starting agents
2. **Encourage disagreement** - the value is in diverse perspectives
3. **Demand specificity** - vague advice is useless advice
4. **Show the math** - all projections should be traceable
5. **Track reasoning** - capture why minds changed (or didn't)
6. **Make it actionable** - output should drive a real decision

---

## Example Invocation

```
User: /boardroom Should we raise a Series A now or wait 6 months to hit $1M ARR?

[System checks for business-context.md]
[System spawns 4 Round 1 agents in parallel]
[Each agent analyzes and provides 800-1200 word position]
[System collects positions, spawns 4 Round 2 agents in parallel]  
[Each agent reads others' positions, provides 400-800 word rebuttal]
[System synthesizes and creates output files]
[System presents summary to user and shares files]
```

## Expected Output Preview

```
Final Vote: 2 YES, 1 NO, 1 CONDITIONAL (raise but at lower valuation)

Mind Changes: Jensen shifted from CONDITIONAL → YES after Allie's point about competitive timing. Allie moved from YES → CONDITIONAL after Andrej highlighted burn rate risks.

Biggest Fight: Elon vs Andrej on whether revenue milestone matters. Elon argued "story > metrics for breakthrough tech." Andrej countered "revenue proves product-market fit, story without traction is delusion."

Sharpest Insight: Jensen's observation that waiting 6 months puts you in direct fundraising collision with 3 larger competitors who are also likely to raise in Q3. The current fundraising window is less competitive.

Recommended Decision: Raise now, but be selective about investors and negotiate aggressively on valuation. The competitive landscape argument is compelling, but Andrej's burn rate concerns warrant careful investor selection. Prioritize strategic investors who can accelerate path to $1M ARR.

I've created your boardroom analysis with full transcripts, interactive dashboard, and summary PDF.
```

