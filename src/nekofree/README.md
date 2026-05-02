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
| `providers.ts` | Чистые типы и helpers для multi-provider системы |

## Type-check

```bash
bun run typecheck:nekofree
```
