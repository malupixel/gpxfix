
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
