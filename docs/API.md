# @cyberskill/shared — API Reference

> v3.10.0 · ESM-only · Node ≥ 24

## Quick Install

```bash
pnpm add @cyberskill/shared
```

## Export Paths

### Configuration

| Path                                        | Description                                                                   |
| ------------------------------------------- | ----------------------------------------------------------------------------- |
| `@cyberskill/shared/config`                 | Base config utilities                                                         |
| `@cyberskill/shared/config/commitlint`      | Commitlint preset                                                             |
| `@cyberskill/shared/config/env`             | `getEnv()`, `loadEnvFile()` — environment loading & validation with `envalid` |
| `@cyberskill/shared/config/eslint`          | Shared ESLint config (requires peer dep `@antfu/eslint-config`)               |
| `@cyberskill/shared/config/graphql-codegen` | GraphQL Codegen presets                                                       |
| `@cyberskill/shared/config/lint-staged`     | Lint-staged config                                                            |
| `@cyberskill/shared/config/vitest`          | Vitest config                                                                 |
| `@cyberskill/shared/config/storybook`       | Storybook config                                                              |

### Constants & Types

| Path                            | Description                                                                                                    |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `@cyberskill/shared/constant`   | `RESPONSE_STATUS`, `HTTP_RESPONSE_STATUS`, `GRAPHQL_RESPONSE_STATUS`                                           |
| `@cyberskill/shared/typescript` | `I_Return<T>`, `I_ReturnSuccess`, `I_ReturnFailure`, `isSuccess()`, `unwrapResult()`, `E_Environment`, `I_Log` |

### Node.js Modules

| Path                                    | Key Exports                                                                             |
| --------------------------------------- | --------------------------------------------------------------------------------------- |
| `@cyberskill/shared/node/express`       | `createExpress()`, `createCors()`, `createSession()`, `createNest()`                    |
| `@cyberskill/shared/node/apollo-server` | `createApolloServer()`                                                                  |
| `@cyberskill/shared/node/mongo`         | `MongooseController`, `MongoController`, `mongo` utils (schema, model, slug, migration) |
| `@cyberskill/shared/node/ws`            | `createWsServer()`, `createGraphQLWsServer()`                                           |
| `@cyberskill/shared/node/storage`       | `storage.get()`, `storage.set()`, `storage.remove()`, `storage.keys()`                  |
| `@cyberskill/shared/node/upload`        | `upload()`, `validateUpload()`, `getFileSizeFromStream()`                               |
| `@cyberskill/shared/node/log`           | `log`, `catchError()`, `throwError()`                                                   |
| `@cyberskill/shared/node/fs`            | File system utilities                                                                   |
| `@cyberskill/shared/node/command`       | Shell command execution                                                                 |
| `@cyberskill/shared/node/package`       | Package.json utilities                                                                  |
| `@cyberskill/shared/node/path`          | Path utilities                                                                          |

### React Modules

| Path                                            | Key Exports                                         |
| ----------------------------------------------- | --------------------------------------------------- |
| `@cyberskill/shared/react/apollo-client`        | `createApolloLinks()`, `getClient()`                |
| `@cyberskill/shared/react/apollo-client-nextjs` | Next.js SSR-compatible Apollo Client                |
| `@cyberskill/shared/react/apollo-error`         | `ApolloErrorProvider`, error display components     |
| `@cyberskill/shared/react/loading`              | `LoadingProvider`, loading state management         |
| `@cyberskill/shared/react/i18next`              | i18next integration hooks                           |
| `@cyberskill/shared/react/next-intl`            | next-intl provider                                  |
| `@cyberskill/shared/react/storage`              | `useStorage()` hook                                 |
| `@cyberskill/shared/react/toast`                | `toast`, `Toaster` (re-export from react-hot-toast) |
| `@cyberskill/shared/react/log`                  | Browser-safe logging                                |
| `@cyberskill/shared/react/userback`             | Userback widget integration                         |

### Utilities

| Path                      | Key Exports                                                                                                                                                                                                                                  |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@cyberskill/shared/util` | `deepClone()`, `deepMerge()`, `getNestedValue()`, `setNestedValue()`, `normalizeMongoFilter()`, `isEmpty()`, `isValidIP()`, `generateSlug()`, `generateRandomString()`, `serializer`, `escapeRegExp()`, `removeAccents()`, `isPlainObject()` |

## Usage Examples

### Express Setup

```typescript
import { createExpress, createCors, createSession } from '@cyberskill/shared/node/express';

const app = createExpress({ isDev: true, static: 'uploads' });
app.use(createCors({ isDev: true, whiteList: ['http://localhost:3000'] }));
app.use(createSession({ secret: process.env.SESSION_SECRET }));
```

### MongoDB Controller

```typescript
import { MongooseController, mongo } from '@cyberskill/shared/node/mongo';

const UserModel = mongo.createModel('User', userSchema);
const userController = new MongooseController(UserModel);

const result = await userController.findOne({ email: 'user@example.com' });
if (result.success) {
  console.log(result.result);
}
```

### Apollo Client (React)

```typescript
import { getClient } from '@cyberskill/shared/react/apollo-client';

const client = getClient({
  uri: '/graphql',
  wsUrl: 'ws://localhost:4000/graphql',
});
```

### File Upload

```typescript
import { upload } from '@cyberskill/shared/node/upload';

const result = await upload({
  file: filePromise,
  path: '/uploads/images/photo.jpg',
  type: E_UploadType.IMAGE,
  baseDir: '/uploads', // Path containment validation
});
```

## Peer Dependencies

Config entry points require optional peer dependencies:

| Peer Dependency        | Used By                              |
| ---------------------- | ------------------------------------ |
| `@antfu/eslint-config` | `./config/eslint`                    |
| `@graphql-codegen/cli` | `./config/graphql-codegen`           |
| `eslint-config-next`   | `./config/eslint` (Next.js projects) |
