# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

A Foxquilt fork of the open-source `node-saml` library, published as `@foxden/node-saml`. Provides SAML 2.0 authentication for Node.js. The primary export is the `SAML` class. Consumed by `foxden-saml-passport` and the auth service.

## Key Commands

```bash
# Build (compiles TypeScript src/ → lib/)
yarn build          # or: npm run build / npx tsc

# Test (builds first, then runs mocha with nyc coverage)
yarn test           # npm run build && nyc mocha --config .mocharc.json

# Watch modes for development
yarn tsc-watch      # TypeScript compiler in watch mode
yarn lint-watch     # ESLint in watch mode
yarn watch          # All watchers concurrently

# Linting
yarn lint           # ESLint + prettier-check
yarn lint:fix       # ESLint --fix + prettier-format

# Release (cleans, installs, lints, tests, builds, then release-it)
yarn prerelease && yarn release
```

Note: Tests use **npm scripts** internally (e.g. `npm run build`) even though the repo has a `yarn.lock`. Use `yarn test` at the top level.

## Structure

```
src/                  # TypeScript source (compiled to lib/)
  index.ts            # Public exports
  saml.ts             # Core SAML class — authentication flows, request/response handling
  types.ts            # All TypeScript interfaces and types
  crypto.ts           # PEM normalization, key utilities (RFC7468 compliant)
  xml.ts              # XML parsing, signature validation, xpath helpers
  algorithms.ts       # Signature algorithm definitions
  constants.ts        # Default values (identifier format, etc.)
  date-time.ts        # Timestamp generation and parsing
  in-memory-cache-provider.ts  # Default CacheProvider implementation
  metadata.ts         # SP metadata generation
  saml-post-signing.ts  # HTTP-POST binding request signing
  utility.ts          # Assertion helpers
lib/                  # Compiled output (committed; do not edit)
test/                 # Mocha test specs (.spec.ts files)
  samlTests.spec.ts
  samlRequest.spec.ts
  saml-post-signing-tests.spec.ts
  tests.spec.ts
  xml.spec.ts
  crypto.spec.ts
  cache.spec.ts
  test-signatures.spec.ts
  static/             # Test certificates, XML fixtures
```

## Key Exports

From `src/index.ts`:
- `SAML` — main class (instantiate with `SamlConfig`, then call `getAuthorizeUrlAsync`, `validatePostResponseAsync`, etc.)
- `generateServiceProviderMetadata` — generates SP metadata XML
- All TypeScript types: `SamlOptions`, `SamlConfig`, `Profile`, `CacheProvider`, `CacheItem`, `ValidateInResponseTo`, etc.

## Architecture Notes

- Compiled output goes to `lib/` (set as `"main"` in package.json) — the `lib/` directory is committed and published, not generated at install time by consumers.
- `prepare` script runs `tsc`, so `lib/` is rebuilt on `yarn install` in dependent projects.
- TypeScript target is `es2018`, module format is `commonjs`.
- The `CacheProvider` interface must be implemented by consumers to handle `InResponseTo` replay prevention. A default `InMemoryCacheProvider` is included but not suitable for multi-instance deployments.
- XML signature validation uses `xml-crypto`; encryption uses `xml-encryption`; parsing uses `@xmldom/xmldom` + `xml2js`.
- Test framework is **Mocha + Chai + Sinon** (not Jest) with nyc for coverage.

## Versioning

Current version is `5.1.1`. The `CHANGELOG.md` is generated via `yarn changelog` (uses `gren`). Releases are managed with `release-it`.
