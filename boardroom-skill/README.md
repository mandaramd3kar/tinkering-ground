# Boardroom - AI Strategic Advisory Board

Transform complex business decisions into multi-perspective strategic analysis with AI advisors modeled after real-world thought leaders.

## What This Does

Boardroom simulates a strategic advisory board by:

1. **Recruiting 4 expert advisors** - Each modeled after real thought leaders with distinct reasoning styles
2. **Running a 2-round debate** - Advisors independently analyze your question, then respond to each other's arguments
3. **Generating actionable outputs** - Markdown analysis, interactive HTML dashboard, and print-ready PDF
4. **Providing clear recommendations** - Final votes, mind changes, key tensions, and a recommended decision

## Quick Start

### Prerequisites

- [Claude Code](https://docs.claude.com/en/docs/build-with-claude/claude-code) installed
- Node.js 18+ (for HTML/PDF generation)
- A business with strategic decisions to make

### Installation

1. Clone or download this skill package:
```bash
git clone <your-repo-url>
cd boardroom-skill-package
```

2. Link the skill to Claude Code:
```bash
# Option A: Symlink to Claude Code skills directory
ln -s "$(pwd)" ~/.local/share/claude-code/skills/boardroom

# Option B: Copy to Claude Code skills directory
cp -r . ~/.local/share/claude-code/skills/boardroom
```

3. Verify installation:
```bash
claude-code list-skills
# Should show "boardroom" in the list
```

### First Time Setup

1. **Create your business context document**:
```bash
cd ~/your-business-directory
cp ~/.local/share/claude-code/skills/boardroom/evals/files/business-context-template.md ./business-context.md
```

2. **Fill out the template** with your real business details:
   - Revenue, metrics, team size
   - Products, goals, market position
   - Current challenges and constraints

3. **(Optional) Customize your advisors**:
   - Edit `SKILL.md` to replace default advisors
   - Search online for personality profiles of domain experts
   - Include their thinking style, biases, and priorities

## Usage

### Basic Command

From any directory with a `business-context.md` file:

```bash
/boardroom Should we [your strategic decision]?
```

### Examples

```bash
# Hiring decisions
/boardroom Should we hire 2 senior engineers or 4 junior engineers?

# Pricing strategy
/boardroom Should we double our prices to position as premium?

# Fundraising timing
/boardroom Should we raise Series A now or wait 6 months?

# Product strategy
/boardroom Should we build our own infrastructure or use existing tools?

# Market expansion
/boardroom Should we expand to enterprise or focus on PLG motion?

# Organizational change
/boardroom Should we restructure engineering into product teams?
```

### Output Structure

After running, you'll get:

```
boardroom-decisions/
└── your-decision-slug-2026-02-15/
    ├── analysis.md           # Full written analysis
    ├── dashboard.html        # Interactive projections
    ├── summary.pdf           # Print-ready summary
    └── raw-transcripts/      # All advisor arguments
        ├── round1-elon.md
        ├── round1-jensen.md
        ├── round1-andrej.md
        ├── round1-allie.md
        ├── round2-elon.md
        ├── round2-jensen.md
        ├── round2-andrej.md
        └── round2-allie.md
```

## Default Advisors

### Elon Musk
**Style**: First-principles reasoning, aggressive risk-taking, 10x thinking
**Biases**: Manufacturing/physics solutions, speed over perfection, moonshots
**Best For**: Bold moves, technical feasibility, contrarian perspectives

### Jensen Huang
**Style**: Platform thinking, long-term architectural vision, ecosystem strategy
**Biases**: Full-stack control, hardware-software co-design, decades-long planning
**Best For**: Infrastructure decisions, moat-building, technical architecture

### Andrej Karpathy
**Style**: Data-driven, empirically validated, teaching-focused
**Biases**: Simplicity, open science, skeptical of hype
**Best For**: Technical validation, questioning assumptions, data requirements

### Allie K Miller
**Style**: Human-centered AI, practical implementation, ROI-focused
**Biases**: Democratization, ethical deployment, change management
**Best For**: Adoption strategy, organizational impact, responsible scaling

## Customizing Advisors

You can swap advisors based on your industry and decision type:

### Tech Infrastructure Decisions
- Werner Vogels (AWS CTO) - Scalability, distributed systems
- Kelsey Hightower (Google) - DevOps, platform engineering
- Julia Liuson (Microsoft) - Enterprise developer tools
- Guillermo Rauch (Vercel CEO) - Developer experience

### Consumer Product Strategy
- Julie Zhuo (ex-Facebook VP) - Product design, user experience
- Brian Chesky (Airbnb CEO) - Brand, community, host experience
- Tobi Lütke (Shopify CEO) - Merchant empowerment, platform thinking
- Whitney Wolfe Herd (Bumble CEO) - Community-driven growth

### Enterprise SaaS
- Frank Slootman (Snowflake CEO) - Enterprise sales, aggressive growth
- Dharmesh Shah (HubSpot CTO) - Product-led growth, culture
- Aaron Levie (Box CEO) - Enterprise positioning, competitive strategy
- Christoph Janz (Point Nine Capital) - SaaS metrics, scaling

### To customize, edit the "Default Advisors" section in `SKILL.md` with:
1. Name
2. 2-3 sentence personality profile
3. Their thinking style, priorities, and biases

## How It Works

### Round 1: Independent Analysis (Parallel)
Each advisor independently:
- Reads your business context thoroughly
- Analyzes the question through their unique lens
- Writes 800-1200 words with specific projections
- Provides a vote: YES / NO / CONDITIONAL
- Assigns confidence: 1-10 scale

### Round 2: Debate & Rebuttal (Parallel)
Each advisor:
- Reads ALL other advisors' Round 1 positions
- Identifies who they disagree with most and why
- Responds to critiques of their position
- Updates projections based on new insights
- Provides FINAL vote (can change from Round 1)
- Assigns final confidence

### Synthesis
Claude analyzes all positions and creates:
- Executive summary with vote tally
- Analysis of mind changes and persuasive arguments
- Key tensions and biggest fights
- Sharpest insights from the discussion
- Recommended decision with conditions

## Interactive Dashboard Features

The HTML dashboard includes:

- **Vote visualization**: See how votes changed between rounds
- **Advisor cards**: Expandable profiles with key quotes
- **Dynamic projections**: Sliders that recalculate in real-time
  - Price points
  - Customer volume
  - Team hours
  - Implementation complexity
  - Market timing
- **Calculated outputs**: Revenue, costs, timeline, risk scores
- **Debate highlights**: Biggest fights, strongest arguments
- **Export options**: Print view, PDF generation

## Best Practices

### Writing Good Questions

✅ **Good**: "Should we hire 2 senior engineers at $180K each or 4 junior engineers at $95K each?"
- Specific options
- Concrete numbers
- Clear trade-off

❌ **Bad**: "Should we expand?"
- Too vague
- No options presented
- Unclear scope

✅ **Good**: "Should we raise Series A now at $500K ARR or wait 6 months to hit $1M ARR?"
- Time-bound decision
- Specific milestones
- Clear alternatives

### Updating Business Context

Your `business-context.md` should be:
- **Honest**: Real numbers, not aspirational
- **Current**: Update quarterly or after major changes
- **Specific**: "22% MoM growth" not "growing fast"
- **Complete**: Include constraints and challenges, not just wins

### Interpreting Results

- **Unanimous votes**: High confidence decision, but check for groupthink
- **Split votes**: Dig into the tension - often the most valuable insight
- **Mind changes**: Pay special attention - shows strong arguments
- **Conditional votes**: Usually the most nuanced position
- **Low confidence**: You might need more data before deciding

## Troubleshooting

### "Business context not found"
**Solution**: Create `business-context.md` in your current directory using the template

### "Question too vague"
**Solution**: Be more specific. Include options, numbers, timeframes.

### "HTML dashboard won't open"
**Solution**: Check browser console for errors. Ensure all JavaScript loaded.

### "PDF generation failed"
**Solution**: Verify weasyprint or puppeteer is installed. Check HTML renders first.

### "Advisors agreeing too much"
**Solution**: This can happen if question has obvious answer. Try more nuanced decisions, or add contrarian advisors.

## Advanced Usage

### Running Multiple Decisions

You can compare decisions side-by-side:

```bash
/boardroom Should we hire senior engineers?
# Wait for results

/boardroom Should we hire junior engineers?
# Compare the two analyses
```

### Chaining Decisions

Use conditional votes as gates:

```bash
/boardroom Should we raise now if we can get >$20M valuation?
# If CONDITIONAL → YES above $20M, then:

/boardroom What valuation should we target in fundraising?
```

### Testing Advisor Profiles

Try the same question with different advisor sets to see how framing changes:

```bash
# Default tech advisors
/boardroom Should we open source our core product?

# Then customize to include:
# - DHH (Ruby on Rails) - Open source advocate
# - Peter Levine (a16z) - Proprietary moats
# - Mitchell Hashimoto (HashiCorp) - Open core model
# - Solomon Hykes (Docker) - Community-driven

/boardroom Should we open source our core product?
```

## Example Output

Here's what you can expect:

### Executive Summary
```
Final Vote: 3 YES, 1 CONDITIONAL

Consensus: Strong majority supports hiring senior engineers, with one 
conditional vote requiring we also invest in mentorship structure.

Mind Changes: Allie shifted from YES → CONDITIONAL after Andrej's 
argument about knowledge transfer risks. Jensen increased confidence 
from 6 → 8 after seeing Elon's speed-to-market calculation.

Biggest Fight: Elon vs Andrej on whether velocity or sustainability 
matters more. Elon: "Ship fast, fix later." Andrej: "Technical debt 
compounds exponentially."

Sharpest Insight: Jensen's observation that 2 seniors will create a 
knowledge silo unless we explicitly build pairing time into sprints. 
This conditional requirement was adopted by 3 of 4 advisors.

Recommended Decision: Hire 2 senior engineers, but allocate 20% of 
their time to knowledge sharing and documentation. This captures the 
velocity upside while mitigating the tribal knowledge risk.
```

## Contributing

To improve this skill:

1. Test with your own business decisions
2. Note what worked and what didn't
3. Propose advisor profile improvements
4. Share interesting decision analyses
5. Submit PRs with enhancements

## License

MIT License - Feel free to customize for your needs

## Support

- **Issues**: Open a GitHub issue
- **Questions**: Start a discussion
- **Feature requests**: Submit an issue with "enhancement" label

## Changelog

### v1.0.0 (2026-02-15)
- Initial release
- 4 default advisors (Elon, Jensen, Andrej, Allie)
- 2-round debate structure
- Markdown, HTML, and PDF outputs
- Interactive projection dashboard
- 5 example evaluations

---

**Built for founders, operators, and strategic thinkers who want multiple perspectives on high-stakes decisions.**
