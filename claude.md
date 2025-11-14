# Development Strategy for Claude Code

## Testing Approach

### Prefer CLI-Based Testing Over Browser Testing

**Why:**
- Claude can see CLI output directly in the terminal
- No need for user to manually check browser and relay results
- Faster feedback loop
- Results are verifiable and can be included in the conversation
- Better for automated verification

**Implementation:**

When developing new features:

1. **Create CLI test scripts** instead of HTML test pages
   - Example: `scripts/test-segment-loader.ts`
   - Run with: `npm run test:segments`

2. **Use Node.js to test modules** before browser integration
   - Import the module in a Node script
   - Run test cases
   - Print results to console
   - Exit with appropriate code (0 = success, 1 = failure)

3. **Only create browser tests when** testing requires:
   - Visual rendering (3D graphics, UI)
   - Browser-specific APIs
   - User interaction

### Example

**Bad approach (browser test):**
```typescript
// public/test-something.html
// Claude: "Please open this page and tell me what you see"
// User: "I see X, Y, Z..."
```

**Good approach (CLI test):**
```typescript
// scripts/test-something.ts
import { something } from '../src/something.ts';

console.log('Testing something...');
const result = something();
console.log('Result:', result);
console.log(result.isValid ? '✓ Pass' : '✗ Fail');

// Claude can see the output directly
```

### Benefits

1. **Immediate feedback** - Claude sees results instantly
2. **Reproducible** - Same test can be run multiple times
3. **Scriptable** - Can be added to package.json scripts
4. **CI-ready** - Can be run in automated pipelines later
5. **Less context switching** - No need to switch between terminal and browser

### When to Use Each Approach

**CLI Testing (preferred):**
- Data loading and parsing
- Algorithm verification
- Data transformation
- API functionality
- Performance measurements
- Edge case validation

**Browser Testing (only when needed):**
- 3D rendering verification
- Visual appearance checks
- User interaction flows
- Browser-specific behavior
- Integration with Babylon.js scene

## Current Project Structure

### CLI Tools (preferred)
- `scripts/generate-segments.ts` - Generate segments.json
- `scripts/generate_borders.mjs` - Generate borders.bin

### Modules to Test
- `src/segmentLoader.ts` - Load and convert segments (should have CLI test)
- `src/borderLoader.ts` - Load border data (should have CLI test)

### Test Script Pattern

```json
// package.json
{
  "scripts": {
    "test:segments": "tsx scripts/test-segment-loader.ts",
    "test:borders": "tsx scripts/test-border-loader.ts"
  }
}
```

### Test Script Template

```typescript
#!/usr/bin/env node
/**
 * Test script for [module name]
 */

// 1. Import the module
import { something } from '../src/something';

// 2. Set up test data
console.log('=== Testing [Module] ===\n');

// 3. Run tests
try {
    console.log('Test 1: [description]');
    const result1 = something();
    console.log(result1 ? '  ✓ Pass' : '  ✗ Fail');

    console.log('\nTest 2: [description]');
    const result2 = somethingElse();
    console.log(result2 ? '  ✓ Pass' : '  ✗ Fail');

    // 4. Report results
    console.log('\n=== All tests passed ===');
    process.exit(0);

} catch (error) {
    console.error('\n✗ Test failed:', error.message);
    process.exit(1);
}
```

## Summary

**Default to CLI testing** unless visual/interactive verification is required. This creates a faster, more reliable development workflow for both Claude and the developer.
