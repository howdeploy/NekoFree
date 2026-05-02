# NekoFree Clean Zone

Эта директория — **единственная зона проекта** с включённым `strict: true`.

## Правила

- Всё новое пишется здесь.
- Не импортируй напрямую `src/QueryEngine.ts`, `src/components/*`, `src/ink/*` и другой legacy-код Claude Code.
- Если нужно стыковаться с legacy — делай это через `adapters/` (thin facade).
- Каждый файл проходит `bun run typecheck:nekofree`.

## Структура

| Путь | Назначение |
|------|-----------|
| `types.ts` | Общие типы NekoFree (провайдеры, gateway, конфиг) |
| `gateway.ts` | Утилиты nekocode.app gateway (CCH signing и т.д.) |
| `adapters/` | Thin adapters к legacy-модулям Claude Code |
| `auth/` | Generic Auth Framework — любые API и подписки (API Key, Bearer, OAuth2, Basic) |
| `auth/oauth-client.ts` | Generic OAuth 2.0 client с PKCE + browser flow + auto-refresh |
| `auth/tool.ts` | Helper для вызова API из skills/tools (`callConnectionApi`) |
| `providers.ts` | Чистые типы и helpers для multi-provider системы |

## Type-check

```bash
bun run typecheck:nekofree
```
