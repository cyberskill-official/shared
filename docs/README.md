<div align="center">
  <img src="https://res.cloudinary.com/cyberskill/image/upload/v1742786793/cyberskill/favicon/favicon-96x96.png" width="96" height="96" alt="CyberSkill Logo">

# CyberSkill Shared

**Enterprise-grade utility library for consistent, scalable development across CyberSkill projects**

[![📦 npm version](https://img.shields.io/npm/v/@cyberskill/shared?style=for-the-badge&logo=npm)](https://npmjs.com/package/@cyberskill/shared)
[![📥 npm downloads](https://img.shields.io/npm/dm/@cyberskill/shared?style=for-the-badge&logo=npm)](https://npmjs.com/package/@cyberskill/shared)
[![📚 JSDoc Documentation](https://img.shields.io/badge/JSDoc-Documentation-blue?style=for-the-badge&logo=javascript)](https://www.jsdocs.io/package/@cyberskill/shared)
[![📄 License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge&logo=opensourceinitiative)](../LICENSE)

</div>

---

## 🎯 Overview

CyberSkill Shared is a comprehensive TypeScript-first utility library that standardizes development across CyberSkill projects. It provides shared utilities, configurations, and components for both frontend and backend development.

| Feature             | Benefit                                                 |
| ------------------- | ------------------------------------------------------- |
| **🔄 Consistency**  | Standardized patterns and utilities across all projects |
| **⚡ Productivity** | Pre-built solutions for common development tasks        |
| **🛡️ Reliability**  | Type-safe implementations with comprehensive testing    |
| **📈 Scalability**  | Modular architecture that grows with your needs         |
| **🚀 Performance**  | Optimized for production with minimal bundle impact     |
| **🔒 Security**     | Built-in security best practices and npm provenance     |

---

## ✨ Key Features

| Module      | Highlights                                                                  |
| ----------- | --------------------------------------------------------------------------- |
| **config/** | ESLint, Vitest, Commitlint, env parsing, GraphQL Codegen, Storybook         |
| **node/**   | Express middleware, MongoDB ODM, WebSocket, CLI tools, file upload, logging |
| **react/**  | Apollo Client, i18n (i18next + next-intl), Loading, Toast, Storage hooks    |
| **util/**   | String processing, object manipulation, validation, serialization           |

> For the full module map and architecture, see [CODEBASE.md](CODEBASE.md).

---

## 🚀 Installation

**Prerequisites:** Node.js ≥ 24.0.0 · pnpm ≥ 10.0.0 · TypeScript ≥ 5.0.0

```bash
pnpm add @cyberskill/shared
```

Add to your `tsconfig.json`:

```json
{
    "compilerOptions": {
        "baseUrl": ".",
        "paths": {
            "@cyberskill/shared/*": ["node_modules/@cyberskill/shared/src/*"]
        }
    }
}
```

---

## 🏃 Quick Start

### Utility Functions

```typescript
import { validateEmail } from '@cyberskill/shared/util';
import { RESPONSE_STATUS } from '@cyberskill/shared/constant';

validateEmail('user@example.com'); // true
```

### React Integration

```tsx
import { ApolloProvider } from '@cyberskill/shared/react/apollo-client';
import { LoadingProvider, useLoading } from '@cyberskill/shared/react/loading';

function App() {
    return (
        <ApolloProvider options={{ uri: 'https://api.example.com/graphql' }}>
            <LoadingProvider>
                <MyApplication />
            </LoadingProvider>
        </ApolloProvider>
    );
}
```

### Node.js Integration

```typescript
import { createCorsOptions } from '@cyberskill/shared/node/express';
import { mongo } from '@cyberskill/shared/node/mongo';
import { RESPONSE_STATUS } from '@cyberskill/shared/constant';
import cors from 'cors';
import express from 'express';

const app = express();
app.use(cors(createCorsOptions({
    isDev: process.env.NODE_ENV === 'development',
    whiteList: ['https://example.com']
})));

await mongo.connect({ uri: process.env.MONGODB_URI });
```

---

## 🛠️ Development

```bash
git clone https://github.com/cyberskill-official/shared.git && cd shared
pnpm install && pnpm run build
```

| Command             | Description                            |
| ------------------- | -------------------------------------- |
| `pnpm run dev`      | Start development mode with hot reload |
| `pnpm run build`    | Build for production                   |
| `pnpm run lint`     | Check for linting issues               |
| `pnpm run lint:fix` | Fix linting issues automatically       |
| `pnpm run test`     | Run tests                              |
| `pnpm run inspect`  | Inspect project dependencies           |
| `pnpm run reset`    | Reset project state                    |
| `pnpm run ready`    | Prepare project for development        |

---

## 📚 Documentation

| Document                           | Description                                                 |
| ---------------------------------- | ----------------------------------------------------------- |
| [API.md](API.md)                   | API reference and usage examples                            |
| [CODEBASE.md](CODEBASE.md)         | Architecture, modules, and conventions                      |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Development guidelines, code standards, and release process |
| [SECURITY.md](SECURITY.md)         | Vulnerability disclosure policy                             |
| [CHANGELOG.md](CHANGELOG.md)       | Release history                                             |

---

## 🆘 Support

- **🐛 Issues**: [GitHub Issues](https://github.com/cyberskill-official/shared/issues)
- **💬 Discussions**: [GitHub Discussions](https://github.com/cyberskill-official/shared/discussions)
- **📚 API Reference**: [JSDocs](https://www.jsdocs.io/package/@cyberskill/shared)
- **📧 Email**: [support@cyberskill.world](mailto:support@cyberskill.world)

---

## 📄 License

MIT — see [LICENSE](../LICENSE) for details.

---

<div align="center">
  <p>Made with ❤️ by the <a href="https://github.com/cyberskill-official">CyberSkill Team</a></p>

  <p>
    <a href="https://cyberskill.world">Website</a> ·
    <a href="https://github.com/cyberskill-official/shared/issues">Issues</a> ·
    <a href="https://github.com/cyberskill-official/shared/discussions">Discussions</a>
  </p>

  <p>
    <sub>If this project helps you, please consider giving us a ⭐ on GitHub!</sub>
  </p>
</div>
