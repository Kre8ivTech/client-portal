# TODO

- [x] Fix the broken "Request Access" link on the login page by creating a signup page.
- [x] Review the `(dashboard)` section of the application.
  - [x] Implement role-based navigation in the `DashboardSidebar` to dynamically render navigation items based on the user's role, as defined in the PRD.
- [x] Review the `lib` directory to understand the application's core logic and utilities.
  - [x] Improve secret key handling in `crypto.ts` by using a key derivation function (KDF) to derive a key of the correct length.
  - [x] Fix the security vulnerability in `vault.ts` by adding authorization checks.
- [ ] Review the `components` directory to get an overview of the reusable UI components.