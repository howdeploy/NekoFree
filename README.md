![Bun](https://img.shields.io/badge/Bun-000000?logo=bun&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Linux](https://img.shields.io/badge/Linux-FCC624?logo=linux&logoColor=black)

# nekofree

Терминальный AI-агент для работы с кодом. Форк [free-code](https://github.com/paoloanzn/free-code), отшлифованный под gateway [nekocode.app](https://nekocode.app). Экономия токенов, вырезанная телеметрия, кот в статуслайне.

<p align="center">
  <img src="demo.gif" alt="nekofree demo" width="720" />
</p>

---

## Что это

Полнофункциональный AI-агент в терминале: пишет код, читает файлы, запускает команды, работает с git, ставит плагины. Всё через диалог на естественном языке.

nekofree — это free-code, доведённый до ума:

- Вычищена вся телеметрия — OpenTelemetry, Datadog, Sentry, event logging, session tracing
- Снят `CYBER_RISK_INSTRUCTION` — промпт-ограничение, которое инжектируется поверх модели
- Убран `ManagedSettingsSecurityDialog` — никто не навязывает настройки удалённо
- Предустроен gateway nekocode.app
- Встроена система экономии токенов
- Пиксельный кот-маскот с реактивными эмоциями

Запустил `./nekofree`, вписал API-ключ — и работаешь.

---

## Возможности

- **Предустроен gateway nekocode.app** — Opus 4.6 по умолчанию
- **Нет телеметрии** — все analytics-модули заменены на заглушки, ноль данных наружу
- **Нет prompt-guardrails** — модель отвечает как модель, без навешанных ограничений
- **Read-once hooks** — кеширует прочитанные файлы, при повторном чтении экономит тысячи токенов
- **Diff mode** — при изменении файла отдаёт только дельту вместо полного перечитывания
- **Output cap 16k** — вместо 64k по умолчанию, auto-escalate при необходимости
- **Контекст 200k** — 1M отключён для экономии квоты
- **Маскот** — пиксель-арт кот 16x16, меняет эмоции в реальном времени
- **Статуслайн** — ctx%, стоимость сессии, текущая директория, модель
- **185 spinner verbs** — кото-мемные фразы при обдумывании
- **CCH signing** — xxHash64 integrity hash для запросов к gateway
- **54 экспериментальных флага** — разблокированы в dev-full билде
- **Инструменты, плагины, скиллы, MCP, plan mode, voice mode, IDE bridge**

---

## Требования

- [Bun](https://bun.sh) >= 1.3.11
- Linux или macOS (Windows через WSL)

```bash
curl -fsSL https://bun.sh/install | bash
```

---

## Установка

```bash
git clone https://github.com/howdeploy/NekoFree.git
cd NekoFree
bun install
bun run build
./nekofree
```

Бинарник готов. Можно добавить алиас:

```bash
echo 'alias nekofree="/путь/до/NekoFree/nekofree"' >> ~/.zshrc
source ~/.zshrc
```

---

## Сборка

| Команда | Бинарник | Описание |
|---|---|---|
| `bun run build` | `./nekofree` | Стандартная сборка |
| `bun run build:dev` | `./nekofree-dev` | Dev-версия с меткой |
| `bun run build:dev:full` | `./nekofree-dev` | Все 54 экспериментальных флага |
| `bun run compile` | `./dist/nekofree` | Альтернативный путь |

Конкретные флаги:

```bash
bun run ./scripts/build.ts --feature=ULTRAPLAN --feature=ULTRATHINK
```

---

## Конфигурация

Всё хранится в `~/.nekofree/config.json`:

```json
{
  "baseUrl": "https://gateway.nekocode.app/alpha",
  "apiKey": "ваш-ключ",
  "model": "claude-opus-4-6"
}
```

Переопределяется через переменные окружения:

| Переменная | Назначение |
|---|---|
| `ANTHROPIC_API_KEY` | API-ключ (приоритет над конфигом) |
| `ANTHROPIC_BASE_URL` | Свой endpoint (любой провайдер) |
| `ANTHROPIC_MODEL` | Модель по умолчанию |
| `CLAUDE_CODE_MAX_OUTPUT_TOKENS` | Лимит output-токенов (по умолчанию 16000) |
| `CLAUDE_CODE_DISABLE_1M_CONTEXT` | Отключить 1M контекст (по умолчанию включено) |
| `READ_ONCE_DISABLED` | Отключить read-once кеш |
| `READ_ONCE_DIFF` | Включить diff mode для кеша |

---

## Экономия токенов

nekofree экономит токены на трёх уровнях:

**Read-once кеш** — при повторном чтении неизменённого файла агент получает уведомление, что содержимое уже в контексте. Экономия ~2000+ токенов за каждый хит. При включённом diff mode изменённые файлы показывают только дельту — экономия 80-95%.

**Output cap** — дефолтный лимит output-токенов снижен с 64k до 16k. 99% ответов укладываются в этот лимит. Если ответ реально упирается — автоматический escalate до 64k на следующей попытке.

**Контекст 200k** — 1M контекст отключён по умолчанию. Меньше контекст — меньше расход квоты на каждый запрос.

---

## Маскот

Пиксельный кот в статуслайне реагирует на происходящее в реальном времени:

- **idle** — спокойный, нейтральные глаза
- **thinking** — синий пиксель, агент генерирует текст
- **tool_running** — глаза `ー ー`, синее свечение, выполняется инструмент
- **done** — зелёные искорки `+`, задача завершена

Под котом — статистика: заполненность контекста, стоимость сессии, рабочая директория, модель.

---

## Основано на

- [free-code](https://github.com/paoloanzn/free-code) — форк с вырезанной телеметрией и снятыми guardrails, отправная точка nekofree
- [Boucle Framework](https://github.com/Bande-a-Bonnot/Boucle-framework) — фреймворк автономных агентов с хуками безопасности
- [claude-code-mascot-statusline](https://github.com/TeXmeijin/claude-code-mascot-statusline) — идея маскота в статусной строке

---

## Лицензия

Исходный код основан на публично доступном снимке npm-дистрибуции. Используйте на свой страх и риск.
