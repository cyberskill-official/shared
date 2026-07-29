## [3.23.0](https://github.com/cyberskill-official/shared/compare/v3.22.0...v3.23.0) (2026-07-29)

### ✨ Features

* add RedisStore support for rate limiting in Express ([48c9f61](https://github.com/cyberskill-official/shared/commit/48c9f614ba0c5e35390e9899272df0ccec9fbeac))

### 🧹 Chores

* add JSDoc comment for redisClient.call parameter in createRateLimitStore and remove trailing newline in test file ([230ac6b](https://github.com/cyberskill-official/shared/commit/230ac6b83c8609d71aa98cfbb407656254cfe946))
* **cyberos:** upgrade to 1.12.0 - status v3 + traceability (TASK-DOCS-027) ([9d488b2](https://github.com/cyberskill-official/shared/commit/9d488b2162458603904e68f11d8fb034346ff303))

## [3.22.0](https://github.com/cyberskill-official/shared/compare/v3.21.0...v3.22.0) (2026-07-24)

### ✨ Features

* **express:** forward passOnStoreError and harden git hooks ([#3](https://github.com/cyberskill-official/shared/issues/3)) ([d3f3efe](https://github.com/cyberskill-official/shared/commit/d3f3efe9366942aae5bb0afe9b767fed06ffd71b))

### 🐛 Bug Fixes

* **ci:** ignore docs/status assets in ESLint ([f6345f5](https://github.com/cyberskill-official/shared/commit/f6345f59a45fd1227b599e44591c224e9b5f605b))
* **ci:** ignore package.json in ESLint jsonc indent ([ae943ab](https://github.com/cyberskill-official/shared/commit/ae943abe58668c03081f27849444d3603a5e62d0))
* **ci:** pin Node 24.18.0 matrix; prettier status.css ([69b1d48](https://github.com/cyberskill-official/shared/commit/69b1d48beadb680ceed92015a9eaf4157a6089ad))

### 🧹 Chores

* adopt CyberOS 1.0 protocol (status page, folder-per-FR, auto-sync) ([be19734](https://github.com/cyberskill-official/shared/commit/be19734b7cf855637210bb7d1c9e0f7a969b61b0))
* **ci:** pin Node 24.18.0; upgrade Actions to Node-24 majors ([dbc83c8](https://github.com/cyberskill-official/shared/commit/dbc83c893d4edad13db7cfa3d55f9374e34a8b3f))
* **cyberos:** adopt CyberOS 1.0.0 - status-hub@2 status page ([bcb145e](https://github.com/cyberskill-official/shared/commit/bcb145ee948bcbed2884c176bbd9bea317590076)), closes [#roadmap](https://github.com/cyberskill-official/shared/issues/roadmap) [#backlog](https://github.com/cyberskill-official/shared/issues/backlog) [#changelog](https://github.com/cyberskill-official/shared/issues/changelog)
* **cyberos:** retire the FR vocabulary; adopt CyberOS 1.0.0 (rules_sha d9dbcc8a) ([2aab2a5](https://github.com/cyberskill-official/shared/commit/2aab2a531be71a79107c03d48ccd6e1259d3cbea))
* require Node.js >=24; remove dangling agent skill links ([63698c6](https://github.com/cyberskill-official/shared/commit/63698c6e578b0523dc5acbf36cf75ee17521b2b7))
