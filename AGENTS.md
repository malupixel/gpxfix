
## Browser testing

After implementing any frontend or backend change:

1. Start the application in the local development environment.
2. Use Playwright MCP to open the application in a real browser.
3. Test the complete user flow affected by the change.
4. Check browser console errors and failed network requests.
5. Verify that the UI behaves correctly.
6. If any test fails, investigate and fix the issue.
7. Repeat until all relevant checks pass.
8. Add or update automated regression tests.
9. Report what was tested and any remaining limitations.

Do not claim a feature works unless it has been verified.

Never test destructive operations against production.
Use test accounts, test data and sandbox payment providers.

## Local Development Environment and Test Execution

The primary development machine is a laptop with an Intel Core i7-6700HQ (4 cores / 8 threads), 32 GB RAM, running Ubuntu Linux.

The machine has limited CPU performance and must remain responsive during development.

### Resource limits

- Never run large test suites with unrestricted parallelism.
- Playwright E2E tests must use **at most 2 workers**, preferably **1 worker** for browser-heavy or map-intensive tests.
- Avoid running multiple Playwright test commands simultaneously.
- Do not run frontend builds, backend builds, and E2E tests concurrently.
- Avoid spawning multiple browser instances unless explicitly required by the test.
- Do not enable video recording for all tests by default.
- Prefer Playwright `video: 'retain-on-failure'` or `video: 'off'`. Use `retain-on-failure` when video evidence is useful for debugging.
- Use screenshots and traces primarily for failed tests.
- Avoid repeated full test-suite executions when targeted tests are sufficient.

### Test execution strategy

1. During implementation, run targeted tests related to modified functionality.
2. After completing a feature, run the relevant unit and integration tests.
3. Run E2E tests with limited parallelism.
4. Run the complete test suite when necessary for final verification, but execute resource-intensive suites sequentially.
5. Never skip required tests merely to reduce CPU usage. Reduce concurrency instead.
6. If a test suite is unusually resource-intensive, investigate the cause before repeating it.

### Playwright

When executing Playwright locally, explicitly limit workers:

```bash
npx playwright test --workers=1
```

If running tests from another directory or through npm scripts, apply the equivalent worker limit.

Do not override these resource limits with Playwright's default worker count.

### Reporting

In the final implementation report, include:
- Which test suites were executed.
- Whether they passed or failed.
- Which tests were not executed and why.
- Any significant performance or resource issues encountered during testing.

These restrictions apply to local development and agent-driven test execution. CI environments may use higher parallelism when appropriate.