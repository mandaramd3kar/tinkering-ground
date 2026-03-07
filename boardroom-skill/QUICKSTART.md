# Boardroom Quick Start Guide

## 5-Minute Setup

### Step 1: Install the Skill
```bash
# Navigate to your Claude Code skills directory
cd ~/.local/share/claude-code/skills/

# Clone or copy the boardroom skill
git clone <repo-url> boardroom
# OR
cp -r /path/to/boardroom-skill-package ./boardroom
```

### Step 2: Create Your Business Context
```bash
# In your project directory
cd ~/my-startup

# Copy the template
cp ~/.local/share/claude-code/skills/boardroom/evals/files/business-context-template.md ./business-context.md

# Edit with your real business details
vim business-context.md  # or use your favorite editor
```

### Step 3: Run Your First Decision
```bash
# Start Claude Code
claude-code

# At the prompt:
/boardroom Should we hire 2 senior engineers or 4 junior engineers?
```

That's it! The skill will:
1. Read your `business-context.md`
2. Run a 2-round advisory board debate
3. Generate analysis.md, dashboard.html, and summary.pdf
4. Present you with a synthesis and recommendation

---

## Example Session

### Input
```
You: /boardroom Should we raise Series A now at $500K ARR or wait 6 months to hit $1M ARR?
```

### What Happens Behind the Scenes

**Round 1 (4 parallel agents, ~3-5 minutes)**
- Elon analyzes through first-principles lens
- Jensen evaluates long-term platform implications  
- Andrej demands empirical validation
- Allie assesses organizational readiness

**Round 2 (4 parallel agents, ~2-3 minutes)**
- Each advisor reads all Round 1 positions
- They debate, counter-argue, and update their stances
- Some change votes based on compelling arguments

**Synthesis (~1 minute)**
- Claude aggregates all positions
- Identifies key tensions and insights
- Generates interactive dashboard
- Creates print-ready PDF

### Output (Synthesized Summary)

```
Final Vote: 2 YES (raise now), 1 NO (wait), 1 CONDITIONAL (raise if valuation >$20M)

Mind Changes: 
- Jensen shifted from CONDITIONAL → YES after Allie's argument about competitive timing
- Elon increased confidence from 7 → 9 after seeing runway projections

Biggest Fight: 
Andrej vs Elon on whether $500K ARR is credible enough for institutional investors.

Elon: "Story > metrics for breakthrough technology. SpaceX raised before revenue."
Andrej: "Revenue proves product-market fit. Without it, you're just another slide deck."

Jensen mediated: "Both true. But in THIS market, with THIS tech, earlier is better 
because 3 larger competitors will raise in Q3. Small window of opportunity."

Sharpest Insight:
Allie's observation that waiting 6 months saves ~3% dilution but risks missing the 
current fundraising window. If competitors raise first, your story becomes "me too" 
instead of "category leader." The competitive narrative matters more than the ARR 
milestone.

Recommended Decision:
Raise now, but be aggressive on valuation. Target $25M+ valuation (10% dilution max). 
If you can't get favorable terms, Jensen's conditional point stands: walk away and 
hit $1M ARR first. But the base case is: raise now while window is open.

Key Conditions:
1. Must get $20M+ valuation (justified by market momentum)
2. Select investors who can accelerate path to $1M ARR
3. Avoid party rounds - pick 1-2 strategic leads

I've created your boardroom analysis:
📄 analysis.md - Full debate transcripts and vote tracker
🎛️ dashboard.html - Interactive projections dashboard  
📋 summary.pdf - Print-ready summary for team
```

---

## Understanding the Outputs

### 1. analysis.md (Comprehensive Written Analysis)

**Structure:**
- Executive Summary (votes, consensus, insights)
- Vote Tracker Table (Round 1 vs Round 2)
- Round 1 Positions (800-1200 words each)
- Round 2 Rebuttals (400-800 words each)
- Decision Framework (trade-offs, risks, metrics)
- Recommended Decision

**When to use:**
- You want full argumentation details
- You need to see the reasoning behind votes
- You're preparing for a team discussion

**Example section:**
```markdown
## Round 1: Elon Musk

Vote: YES | Confidence: 7/10

First principles: What's the fastest path to market dominance? 

Raising now at $500K ARR is unconventional but strategically sound. Here's why:

1. **Time is the ultimate constraint.** Six months is an eternity in AI. Your 
   competitive moat isn't ARR—it's speed to market leadership...

[continues for 1000+ words with specific projections]
```

### 2. dashboard.html (Interactive Analysis)

**Features:**
- Real-time projection sliders
- Vote change visualization
- Advisor personality cards
- Debate highlights with quotes
- Print-friendly view

**When to use:**
- You want to explore "what if" scenarios
- You're presenting to non-technical stakeholders
- You need a visual summary

**Interactive elements:**
Adjust sliders → See live updates:
- Revenue projections
- Break-even timeline
- Risk scores
- Team impact

### 3. summary.pdf (Print-Ready Brief)

**Structure:**
- 1-page executive summary
- Vote tracker
- Key projections
- Recommended decision
- Top 3 risks + mitigations

**When to use:**
- Sharing with board members
- Team meeting handout
- Offline review

---

## Customization Examples

### Example 1: Industry-Specific Advisors

**SaaS Growth Decision:**
```
Default advisors: Elon, Jensen, Andrej, Allie
Custom advisors: 
- Jason Lemkin (SaaStr) - PLG expert
- Hiten Shah (FYI) - Product analytics
- April Dunford (Positioning) - Category creation
- Tomasz Tunguz (Theory Ventures) - SaaS metrics
```

Edit `SKILL.md` to replace advisor profiles with domain experts.

### Example 2: Projection Variables

**For a Pricing Decision:**
Add these sliders to dashboard:
- Current price vs new price
- Churn rate impact
- Upgrade conversion
- Competitive response delay

**For a Hiring Decision:**
Add these sliders:
- Ramp-up time (months)
- Mentorship overhead (%)
- Productivity multiplier
- Retention risk

Edit the HTML template's slider section to customize.

### Example 3: Advisor Weighting

If certain advisors should have more influence:

In `business-context.md`, add:
```markdown
## Advisor Preferences

Weight technical advisors 2x for infrastructure decisions.
Weight business advisors 2x for GTM decisions.
```

The skill will factor this into final recommendations.

---

## Best Practices

### 1. Keep Business Context Current
✅ Update quarterly or after major changes
✅ Be honest about challenges, not just wins  
✅ Include real numbers, not aspirational ones
❌ Don't embellish metrics to get better advice

### 2. Ask Specific Questions
✅ "Should we hire 2 senior engineers ($180K each) or 4 juniors ($95K each)?"
✅ "Should we raise now at $500K ARR or wait for $1M ARR?"
❌ "Should we grow?"
❌ "What should we do next?"

### 3. Trust the Debate Process
✅ Let advisors disagree strongly
✅ Pay attention to conditional votes (most nuanced)
✅ Look for mind changes (shows strong arguments)
❌ Don't expect unanimous agreement
❌ Don't ignore dissenting voices

### 4. Use Outputs Appropriately
✅ Share dashboard with team for discussion
✅ Use PDF for stakeholder updates
✅ Reference analysis.md for detailed reasoning
❌ Don't treat recommendations as absolute truth
❌ Don't skip reading the rebuttals

### 5. Iterate on Decisions
✅ Run related questions to explore decision space
✅ Test conditional scenarios separately  
✅ Compare outputs side-by-side
❌ Don't make major decisions from one run only

---

## Troubleshooting

### "Advisors all agreeing"
**Cause:** Decision has obvious answer, or advisors too similar
**Fix:** 
- Try a more nuanced question
- Add contrarian advisor (e.g., DHH for anti-cloud stance)
- Split question into component parts

### "Projections seem off"
**Cause:** Advisors making different assumptions
**Fix:**
- Specify assumptions in question
- Add constraints to business context
- Use dashboard sliders to explore sensitivity

### "Round 2 not adding value"
**Cause:** Round 1 positions didn't have real tension
**Fix:**
- Ensure question has legitimate trade-offs
- Choose advisors with different priorities
- Add specific constraints that force hard choices

### "Too much detail / Not enough detail"
**Cause:** Word count targets may be wrong for your use case
**Fix:** Edit `SKILL.md` to adjust:
- Round 1: Default 800-1200 words
- Round 2: Default 400-800 words
- Adjust up for complex decisions, down for simpler ones

---

## Common Decision Types

### Hiring Decisions
Best advisors: Allie (culture), Jensen (long-term planning), Andrej (tech depth)
Key sliders: Ramp time, mentorship overhead, salary cost
Watch for: Team velocity vs quality trade-offs

### Pricing Decisions  
Best advisors: Jensen (platform), Allie (customer impact), Elon (market position)
Key sliders: Price point, churn impact, volume changes
Watch for: Short-term revenue vs long-term positioning

### Technical Architecture
Best advisors: Andrej (engineering rigor), Jensen (scalability), Elon (speed)
Key sliders: Complexity, technical debt, performance gains
Watch for: Build vs buy, time-to-market vs future-proofing

### Fundraising Timing
Best advisors: All four (diverse perspectives critical)
Key sliders: Runway burn, valuation expectations, milestone timing
Watch for: Dilution vs optionality trade-offs

### Go-to-Market Strategy
Best advisors: Allie (adoption), Elon (contrarian), Jensen (ecosystem)
Key sliders: CAC, LTV, sales cycle length, market penetration
Watch for: PLG vs sales-led, pace vs profitability

---

## Next Steps

1. **Run your first decision** using the quick start above
2. **Review the outputs** to understand the format
3. **Customize advisors** for your industry/stage
4. **Update business context** monthly or after major changes
5. **Build a decision library** by saving all boardroom sessions

**Pro tip:** Create a `boardroom-decisions/` directory in your project root to keep all decisions organized and searchable. This becomes your strategic decision archive.

---

## Getting Help

- **Issues:** Open a GitHub issue with your question details
- **Feature requests:** Describe your use case and desired output
- **Customization help:** Share your business context template (anonymized)
- **Advisor suggestions:** Propose domain expert profiles with reasoning style

Happy decision-making! 🚀
