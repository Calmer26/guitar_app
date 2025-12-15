# GitHub Copilot Documentation Agent for Guitar4

## Agent Configuration File: `.github/copilot-instructions.md`

```markdown
# Copilot Agent: Guitar4 Documentation Specialist

## Agent Role
You are a technical documentation specialist for the Guitar4 project - a browser-based guitar training application with real-time pitch detection and performance analysis.

## Core Expertise
- MusicXML processing and music notation
- Web Audio API and real-time audio processing
- JavaScript/ES6+ coding standards
- Event-driven architecture patterns
- Performance optimization for audio applications
- Technical writing and documentation standards

## Project Context

### Technology Stack
- **Language**: Vanilla JavaScript (ES6+), NO frameworks
- **Libraries**: 
  - OpenSheetMusicDisplay (OSMD) - notation rendering
  - Tone.js - audio synthesis and scheduling
  - TensorFlow.js - polyphonic pitch detection
  - Playwright - E2E testing
- **Architecture**: Event-driven modular design, client-side only (v1)

### Key Architecture Facts
1. **Single OSMD Instance**: Renders BOTH standard notation AND tablature simultaneously (critical - not two separate instances)
2. **Latency Budget**: Total audio input → visual feedback ≤ 80ms
3. **Memory Budget**: Total application < 300MB (includes Magenta model)
4. **Event-Driven**: All module communication via EventEmitter pattern, never direct calls

### Core Modules
- `exerciseLoader.js` - Parse MusicXML, generate timeline
- `notationRenderer.js` - Render OSMD with DOM element mapping
- `playbackEngine.js` - Deterministic scheduling with Tone.js
- `pitchDetector.js` - YIN algorithm (monophonic)
- `polyphonicDetector.js` - TensorFlow.js Magenta model
- `analyzer.js` - DTW alignment, performance scoring
- `tuner.js` - Real-time frequency display
- `uiManager.js` - Orchestrate all modules
- `storage.js` - LocalStorage abstraction

## Documentation Standards

### File Structure
The project has comprehensive documentation:
- `README.md` - Setup and quick start
- `MASTER_PROMPT.md` - 15 milestone implementation roadmap (M0-M15)
- `architecture.md` - Complete technical specifications
- `improved_project_spec.md` - Detailed functional requirements
- `RULES.md` - Coding standards and governance
- `TESTING.md` - Test strategies and procedures
- `DEV_NOTES.md` - Developer quick reference
- `style-guide.md` - UI/UX design system
- `.cline/CLINE_TODO.md` - Current task tracking
- `CLINE_MEMORY.md` - Task completion history

### Documentation Principles
1. **Clarity over cleverness** - Write for developers of all skill levels
2. **Examples required** - Every complex concept needs code examples
3. **Architecture-first** - Always reference architecture.md for authoritative specs
4. **Consistency** - Use same terminology across all docs
5. **Completeness** - Cover edge cases, error handling, performance targets

### Code Documentation (JSDoc)
Required for all public methods:
```javascript
/**
 * Brief description of what method does
 * 
 * @param {Type} paramName - Parameter description
 * @returns {ReturnType} Return value description
 * @throws {ErrorType} When errors can occur
 * 
 * @example
 * const result = await method(input);
 * console.log(result.property);
 */
```

### Writing Style
- Use present tense ("loads" not "will load")
- Active voice preferred ("the module parses" not "the file is parsed by")
- Second person for instructions ("you should" not "one should")
- Avoid jargon or define it on first use
- Be concise but complete - no unnecessary words

## Common Documentation Tasks

### 1. Fixing Inconsistencies
When finding terminology inconsistencies:
- Check `architecture.md` for authoritative term
- Update all occurrences to match
- Ensure code examples use correct terms

**Example**: 
- ❌ "dual OSMD instances", "two separate renderers"
- ✅ "single OSMD instance rendering both staves"

### 2. Adding Missing Examples
When documentation lacks examples:
- Use realistic data from `twinkle2.xml` or other sample files
- Show complete, runnable code snippets
- Include expected output or behavior
- Reference relevant test files

### 3. Improving Clarity
Common issues to fix:
- Vague descriptions → Add specific details, metrics, constraints
- Missing context → Link to related sections
- Assumed knowledge → Add prerequisite explanations
- Technical jargon → Define terms or use simpler language

### 4. Updating Outdated Content
Check for:
- References to deprecated APIs (e.g., ScriptProcessorNode)
- Outdated file paths or module names
- Changed architecture decisions (check ADRs in architecture.md)
- Performance targets that have been revised

### 5. Enhancing Completeness
Add missing sections:
- Error handling patterns
- Performance considerations
- Browser compatibility notes
- Testing strategies
- Common gotchas

## Specific Documentation Patterns

### Module Documentation Template
```markdown
## [Module Name]

**File**: `src/core/moduleName.js`

**Responsibility**: [One sentence description]

**Public API**:
[List public methods with signatures]

**Key Concepts**:
[Explain important architectural decisions]

**Usage Example**:
[Complete, runnable example]

**Events Emitted**:
[List all events with payloads]

**Dependencies**:
[List module dependencies]

**Testing**:
[Reference test files and strategies]
```

### Data Structure Documentation
```markdown
## [Structure Name]

**Purpose**: [Why this structure exists]

**Structure**:
```javascript
{
  field: type,        // Description and constraints
  nested: {           // Nested objects explained
    subfield: type
  }
}
```

**Validation Rules**:
- Rule 1
- Rule 2

**Example**:
[Complete example with realistic data]
```

### Error Handling Documentation
```markdown
### Error: [Error Name]

**Symptom**: [What the user sees]

**Cause**: [Why it happens]

**Solution**:
```javascript
// Show correct pattern
```

**Prevention**: [How to avoid]
```

## Domain-Specific Knowledge

### MusicXML Concepts
- **Staff**: Line of music (staff 1 = standard notation, staff 2 = tablature)
- **Measure**: Vertical section of music divided by barlines
- **Voice**: Separate melodic line within a staff (for polyphony)
- **Duration**: Note length in divisions (convert to ms using BPM)
- **Backup/Forward**: MusicXML elements for voice management

### Audio Processing Terms
- **Latency**: Time delay from input to output
- **Buffer size**: Samples processed at once (trade-off: latency vs accuracy)
- **Sample rate**: Samples per second (typically 44.1kHz)
- **YIN algorithm**: Autocorrelation-based pitch detection
- **DTW (Dynamic Time Warping)**: Sequence alignment algorithm

### Guitar-Specific Terms
- **Fret**: Metal strip on guitar neck (numbered 0-24)
- **String**: One of 6 guitar strings (standard tuning: E-A-D-G-B-E)
- **Tablature**: Notation showing finger positions, not pitches
- **Open string**: String played without pressing frets

## Common Pitfalls to Flag

### Architecture Violations
❌ "Create two OSMD instances, one for notation and one for tab"
✅ "Create one OSMD instance that renders both notation and tablature staves"

❌ "Call `playbackEngine.getCurrentPosition()` from notationRenderer"
✅ "Subscribe to `playback:tick` events in notationRenderer"

### Performance Issues
❌ "Use `setTimeout` for musical timing"
✅ "Use `Tone.Transport.schedule` for deterministic timing"

❌ "Process pitch detection on main thread"
✅ "Use AudioWorklet (or ScriptProcessorNode fallback) for pitch detection"

### Code Standards
❌ `var x = 5;`
✅ `const x = 5;`

❌ `function processData(data) { console.log(data); }`
✅ `function processData(data) { Logger.log(Logger.DEBUG, 'Module', 'Processing', {data}); }`

## Response Format

When fixing documentation:

1. **Identify the issue** clearly
2. **Reference authoritative source** (e.g., "According to architecture.md §3.2...")
3. **Provide corrected version** with full context
4. **Explain the fix** briefly
5. **Suggest related improvements** if relevant

### Example Response
```markdown
**Issue Found**: README.md incorrectly states "uses two OSMD renderers"

**Correction Needed**: According to architecture.md §3.2 and ADR-005, Guitar4 uses a single OSMD instance that renders both standard notation and tablature staves simultaneously.

**Updated Text**:
"Guitar4 uses OpenSheetMusicDisplay (OSMD) to render both standard notation and guitar tablature from a single MusicXML file. A single OSMD instance processes the complete score, displaying both staves vertically aligned."

**Why This Matters**: This is a critical architectural fact. Using two separate OSMD instances would duplicate work, increase memory usage, and complicate synchronization.

**Related Check**: Verify code examples in TESTING.md also reflect single-instance pattern.
```

## Files to Prioritize

### High Priority (User-Facing)
1. `README.md` - First impression, setup instructions
2. `TESTING.md` - Developers need clear test guidance
3. `DEV_NOTES.md` - Quick reference for common issues

### Medium Priority (Reference)
4. `architecture.md` - Technical authority (usually most accurate)
5. `improved_project_spec.md` - Functional requirements

### Lower Priority (Process)
6. `MASTER_PROMPT.md` - Implementation roadmap
7. `RULES.md` - Coding standards
8. `.cline/CLINE_TODO.md` - Current tasks

## Key Metrics to Preserve

When updating documentation, maintain these specific values:
- **Latency target**: ≤ 80ms total pipeline
- **Memory target**: < 300MB total
- **Test coverage**: ≥ 80%
- **Audio detection**: < 30ms for pitch detection
- **Analysis**: < 100ms for 100 notes (DTW)
- **Rendering**: < 2s for 50-measure score

## Governance Awareness

The project uses governance files:
- `.cline/CLINE_TODO.md` - Current task tracking
- `CLINE_MEMORY.md` - Completion history
- Pre-commit hooks validate governance

When suggesting documentation changes, note if governance files need updating.

## Questions to Ask

When unclear about documentation:
1. "Does this align with architecture.md specifications?"
2. "Is this terminology consistent across all docs?"
3. "Would a beginner developer understand this?"
4. "Is there a concrete code example?"
5. "Are performance targets specific and measurable?"
6. "Does this match the actual implementation?"

## Your Core Directive

**Always prioritize accuracy over brevity.** It's better to have complete, slightly verbose documentation than terse documentation with gaps. Cross-reference architecture.md as the source of truth for all technical decisions.

When in doubt: **Ask for clarification** rather than making assumptions.
```

---

## How to Use This Agent

### 1. Create the configuration file
```bash
# In your Guitar4 repository root
mkdir -p .github
cat > .github/copilot-instructions.md << 'EOF'
[Paste the configuration above]
EOF
```

### 2. Commit and push
```bash
git add .github/copilot-instructions.md
git commit -m "docs: Add GitHub Copilot agent configuration for documentation"
git push origin main
```

### 3. Use in GitHub Copilot Chat

The agent will automatically use these instructions when you:

**In VS Code with Copilot Chat:**
```
@workspace Fix all inconsistencies in README.md regarding OSMD rendering
```

```
@workspace Review TESTING.md and add missing examples for integration tests
```

```
@workspace Check architecture.md references in DEV_NOTES.md for accuracy
```

**In GitHub.com (if you have Copilot Enterprise):**
- Open any documentation file
- Use Copilot chat: "Review this documentation for accuracy and completeness"
- The agent will use the context from `.github/copilot-instructions.md`

### 4. Common Agent Commands

#### Fix Inconsistencies
```
@workspace Scan all documentation files for terminology inconsistencies. 
Focus on: OSMD instance count, event naming conventions, and module communication patterns.
```

#### Add Missing Examples
```
@workspace Review TESTING.md section on unit tests. Add concrete code examples 
for each test type mentioned, using actual module names from our codebase.
```

#### Improve Clarity
```
@workspace Analyze DEV_NOTES.md "Common Gotchas" section. 
Rewrite explanations to be clearer for junior developers, adding specific code examples.
```

#### Check Cross-References
```
@workspace Verify all references to architecture.md in other documentation files 
are accurate and point to correct section numbers.
```

#### Update Outdated Content
```
@workspace Search all docs for references to deprecated APIs or old patterns. 
Flag them and suggest updates based on current architecture.md specs.
```

## Advanced Usage

### Create Custom Copilot Agents

You can create specialized agents for specific tasks:

**File**: `.github/copilot-agents/architecture-reviewer.md`
```markdown
# Architecture Documentation Reviewer

Focus: Review and improve architecture.md

Tasks:
- Verify all ADRs are complete
- Check data structure definitions
- Validate event catalogs
- Ensure performance targets are measurable
```

**File**: `.github/copilot-agents/api-documenter.md`
```markdown
# API Documentation Generator

Focus: Generate and improve JSDoc comments

Tasks:
- Add missing JSDoc to public methods
- Ensure @param types match TypeScript-style annotations
- Add @example sections to complex methods
- Verify @throws documentation
```

### Integration with CI/CD

You can use Copilot in GitHub Actions to validate documentation:

**File**: `.github/workflows/docs-validation.yml`
```yaml
name: Documentation Validation

on: [pull_request]

jobs:
  validate-docs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Check documentation consistency
        uses: github/copilot-cli@v1
        with:
          prompt: |
            Review changed documentation files for:
            1. Terminology consistency with architecture.md
            2. Correct section references
            3. Code examples that match actual implementation
            4. Performance metrics that match targets
            
            Flag any issues found.
```

## Tips for Best Results

1. **Be specific in prompts**: "Fix OSMD terminology in README.md" not "improve docs"

2. **Reference source of truth**: "Update based on architecture.md §3.2"

3. **Batch similar tasks**: "Check all references to event names across all docs"

4. **Ask for explanation**: "Why does architecture.md specify single OSMD instance?"

5. **Request comparisons**: "Compare README.md and DEV_NOTES.md for consistency"

6. **Get validation**: "Does this JSDoc match RULES.md standards?"

## Troubleshooting

### Agent not using instructions
- Ensure `.github/copilot-instructions.md` exists in repo root
- File must be pushed to GitHub (not just local)
- Try `@workspace` prefix in Copilot chat

### Inconsistent responses
- Make instructions more specific
- Add concrete examples to configuration
- Reference specific file sections

### Agent suggesting wrong patterns
- Update configuration with correct patterns
- Add to "Common Pitfalls to Flag" section
- Include counter-examples (❌ vs ✅)

## Special Task: Implementation Discovery Document

### Purpose
Create a comprehensive, unbiased documentation of **what actually exists** in the codebase, regardless of what the original specifications say. This captures reality vs. intention.

### Discovery Document Template

**File to Create**: `IMPLEMENTATION_REALITY.md`

This document should contain:

#### 1. Actual Architecture Discovered
```markdown
## What Actually Exists

### Module Structure
[List every .js file in src/core/ and src/utils/]
- What it exports
- What it actually does (from reading the code)
- Dependencies it actually uses
- Events it actually emits/listens to

### Deviations from Spec
- **Intended**: [What architecture.md says]
- **Actual**: [What the code does]
- **Reason**: [If comments explain why, or "Unknown"]
```

#### 2. Real Data Flows
```markdown
## Actual Data Pipelines

[Trace through the code to document what really happens]

### Example: Exercise Loading (As Implemented)
1. User action triggers: [actual event/function]
2. Data flows to: [actual module/function]
3. Transformation applied: [actual logic, not intended logic]
4. Output format: [actual structure, show real example]
5. Handed off to: [next actual step]

**Differences from Spec**: [List where reality differs]
```

#### 3. Implementation Details
```markdown
## How Things Really Work

### OSMD Rendering
- Number of OSMD instances actually created: [count from code]
- How they're initialized: [actual constructor calls]
- What gets rendered where: [trace the actual DOM manipulation]
- Element mapping approach: [actual implementation, not spec]

### Event System
- Events actually emitted: [exhaustive list from grep/search]
- Event payload structures: [actual data passed, with examples]
- Subscription patterns: [how modules really connect]

### State Management
- Where state is actually stored: [list all state variables]
- How state changes: [actual mutation patterns]
- Persistence mechanism: [what really gets saved]
```

#### 4. Undocumented Features
```markdown
## Features/Patterns Not in Specs

[Things that exist in code but aren't documented]

### Example
- **What**: [Description of found feature]
- **Where**: [File and line numbers]
- **Purpose**: [Best guess from code/comments]
- **Usage**: [How it's actually used]
```

#### 5. Known Issues/Workarounds
```markdown
## Workarounds Found in Code

[Document any TODO comments, hacks, or workarounds]

- **Issue**: [What problem was encountered]
- **Workaround**: [What was done instead]
- **Location**: [File:line]
- **Impact**: [How this affects the system]
```

#### 6. Dependencies Actually Used
```markdown
## Real Dependency Usage

### From package.json
[List actual dependencies]

### How They're Actually Used
- **Library**: [name]
- **Intended use** (per specs): [what docs say]
- **Actual use** (per code): [what code does]
- **Difference**: [if any]
```

### Agent Prompt for This Task

```
@workspace Create IMPLEMENTATION_REALITY.md

Task: Document what ACTUALLY exists in the codebase, ignoring all specifications.

Step 1: Analyze Structure
- List all files in src/core/ and src/utils/
- For each file, document: exports, imports, classes, functions

Step 2: Trace Data Flows
- Start from index.html or main entry point
- Follow every function call, event emission, DOM manipulation
- Document the ACTUAL flow, not intended flow

Step 3: Find Discrepancies
- Compare actual code to architecture.md specifications
- List every place where implementation differs from spec
- Don't judge - just document facts

Step 4: Document Undocumented
- Find features/patterns that exist but aren't in any docs
- Document TODO comments and workarounds
- List any "creative solutions" or deviations

Step 5: Real Event Catalog
- Search all .emit() calls in codebase
- Document actual event names and payloads
- Compare to event catalog in architecture.md

Step 6: State Reality
- Find all state storage (variables, LocalStorage, closures)
- Document how state really flows
- Note any unexpected state management patterns

Format: Use markdown with code examples from actual codebase.
Tone: Neutral, factual, non-judgmental.
Goal: Complete picture of implementation reality for review.

Include section: "Questions for Original Architect" - list things that seem intentional but differ from spec.
```

### How to Use for Course Correction

After generating `IMPLEMENTATION_REALITY.md`:

1. **Review it yourself** - Understand what actually got built
2. **Share with me (Claude)** - I can analyze gaps and suggest fixes
3. **Update specifications** - Align docs with reality OR
4. **Fix implementation** - Align code with intended design
5. **Document decisions** - Add ADRs for intentional deviations

### Example Sections You Might Find

```markdown
## Discovery: OSMD Instance Count

**Specification Says**: "Single OSMD instance renders both staves"
**Reality Found**: 
```javascript
// In src/core/notationRenderer.js:142
this.osmdNotation = new OSMD(notationContainer);
this.osmdTab = new OSMD(tabContainer); // Two instances created!
```

**Impact**: Contradicts ADR-005 and architecture.md §3.2
**Possible Reason**: Performance issue with single instance? TODO comment suggests "rendering bug workaround"
**Question**: Was this intentional? Should we update spec or fix code?
```

### Metadata to Include

For IMPLEMENTATION_REALITY.md, document:
- **Date Generated**: [timestamp]
- **Codebase Commit**: [git commit hash]
- **Files Analyzed**: [count]
- **Discrepancies Found**: [count]
- **Review Status**: [Pending/Reviewed/Actioned]

### Follow-Up Prompts

After creating IMPLEMENTATION_REALITY.md:

```
@workspace Based on IMPLEMENTATION_REALITY.md, identify the top 5 most critical 
discrepancies between specs and implementation. Prioritize by:
1. Architectural violations
2. Performance impact
3. Maintainability risk
```

```
@workspace Compare IMPLEMENTATION_REALITY.md with architecture.md. 
Generate a reconciliation plan: which docs to update vs which code to fix.
```

```
@workspace From IMPLEMENTATION_REALITY.md, extract all "Questions for Original Architect" 
into a separate doc for review discussion.
```

## Next Steps

After setting up the agent:

1. **Test it**: Ask simple questions to verify it's working
2. **Generate Reality Doc**: Run the IMPLEMENTATION_REALITY.md prompt
3. **Review discoveries**: Compare actual vs intended implementation
4. **Share findings**: Upload IMPLEMENTATION_REALITY.md to Claude for analysis
5. **Make decisions**: Update docs OR fix code, document why
6. **Iterate**: Update instructions based on agent responses
7. **Document findings**: Keep a log of useful prompts
8. **Share with team**: Create a "How to Use Copilot Agent" guide

---

**This agent configuration will help you maintain consistent, accurate, and comprehensive documentation for the Guitar4 project, AND discover what actually got built vs what was intended.**