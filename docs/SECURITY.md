# Security Policy

## Supported Versions

| Package Version | Built For Node | Supported              |
| --------------- | -------------- | ---------------------- |
| 3.x             | >=24.0.0       | ✅ Active support      |
| 2.x             | ^20.0.0        | ⚠️ Security fixes only |
| 1.x             | <20.0.0        | ❌ End of life         |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue, please report it responsibly.

### How to Report

1. **Do NOT** open a public GitHub issue for security vulnerabilities
2. **Email** [support@cyberskill.world](mailto:support@cyberskill.world) with details
3. Include:
    - Description of the vulnerability
    - Steps to reproduce
    - Affected versions
    - Potential impact

### Response Timeline

| Action                 | Timeline        |
| ---------------------- | --------------- |
| Initial acknowledgment | Within 48 hours |
| Assessment and triage  | Within 1 week   |
| Fix and release        | Within 2 weeks  |

### What to Expect

- You will receive an acknowledgment of your report
- We will investigate and provide updates on the fix timeline
- We will credit you in the release notes (unless you prefer anonymity)
- We follow [coordinated disclosure](https://en.wikipedia.org/wiki/Coordinated_vulnerability_disclosure)

## Security Best Practices

This library implements:

- ✅ npm provenance for supply chain attestation
- ✅ Dependency auditing via `pnpm audit` in CI
- ✅ Pinned GitHub Actions to commit SHAs
- ✅ Strict TypeScript configuration
- ✅ Automated dependency updates via Renovate
