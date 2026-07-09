/**
 * dependency-cruiser config — enforces the hexagonal dependency rule.
 * Identical ruleset to the adequa-all blueprint.
 *
 *   npm run depcruise          validate (fails on error)
 *   npm run depcruise:graph    render an SVG (needs graphviz `dot`)
 */
module.exports = {
  forbidden: [
    {
      name: 'domain-no-app-or-adapters',
      comment: 'Domain is the centre of the hexagon: it must not depend on application or adapters.',
      severity: 'error',
      from: { path: '^src/contexts/[^/]+/domain' },
      to: { path: '^src/contexts/[^/]+/(application|adapters)' },
    },
    {
      name: 'domain-no-platform',
      comment: 'Domain must not depend on infrastructure (src/platform).',
      severity: 'error',
      from: { path: '^src/contexts/[^/]+/domain' },
      to: { path: '^src/platform/' },
    },
    {
      name: 'app-no-adapters',
      comment: 'Application orchestrates via ports; it must not import concrete adapters.',
      severity: 'error',
      from: { path: '^src/contexts/[^/]+/application' },
      to: { path: '^src/contexts/[^/]+/adapters' },
    },
    {
      name: 'app-no-platform',
      comment: 'Application must not depend on infrastructure (src/platform).',
      severity: 'error',
      from: { path: '^src/contexts/[^/]+/application' },
      to: { path: '^src/platform/' },
    },
    {
      name: 'core-no-npm',
      comment: 'Domain and application stay framework-agnostic: no npm packages.',
      severity: 'error',
      from: { path: '^src/contexts/[^/]+/(domain|application)' },
      to: { dependencyTypes: ['npm', 'npm-dev', 'npm-optional', 'npm-peer', 'npm-bundled'] },
    },
    {
      name: 'no-cross-context',
      comment: 'Contexts talk only via ACL out-ports (fulfilled in main), never by importing each other directly.',
      severity: 'error',
      from: { path: '^src/contexts/([^/]+)/' },
      to: {
        path: '^src/contexts/([^/]+)/',
        pathNot: ['^src/contexts/$1/'],
      },
    },
  ],
  options: {
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
    doNotFollow: { path: 'node_modules' },
    // testWorld.ts fixtures are shared test-only wiring (seed an in-memory fake for use-case
    // specs); they live beside the use-cases they exercise but, like *.test.ts, are excluded
    // from the hexagon rules since they intentionally reach into adapters/out/fake.
    exclude: { path: '(^|/)__[^/]*$|\\.(test|spec)\\.[jt]sx?$|(^|/)testWorld\\.[jt]sx?$' },
  },
}
