# Cloudify

_[English version](README.md)_

Приложение для SoundCloud на компьютер. Сделано на Tauri 2: ядро на Rust и
интерфейс на React — весит несколько мегабайт, а не тащит с собой целый
браузер.

> **Неофициальный клиент. Не связан с SoundCloud. Используй на свой страх и
> риск.** Приложение ходит во внутренний API SoundCloud — тот же, которым
> пользуется сам soundcloud.com, — потому что ключей для сторонних приложений
> SoundCloud не выдаёт с 2015 года. Если SoundCloud поменяет свой API,
> приложение может сломаться.

## Что сейчас

**Приложение переписывается с нуля.** Первая версия
([solarka892/Cloudify-Player](https://github.com/solarka892/Cloudify-Player))
работала, но обросла пятью скинами, несколькими брошенными редизайнами и
кучей кода, который страшно трогать. Здесь всё заново: те же функции, новый
код, новый интерфейс.

Что приложение будет уметь и в каком порядке это делается —
[docs/features.md](docs/features.md).

## Как собрать

Нужны [Rust](https://rustup.rs), [Node.js](https://nodejs.org) 24+ и
[pnpm](https://pnpm.io), а ещё
[то, что просит Tauri](https://v2.tauri.app/start/prerequisites/) для твоей
системы.

```sh
pnpm install
pnpm tauri dev      # запустить приложение
pnpm tauri build    # собрать установщик для этой системы
```

Проверки:

```sh
pnpm check                                      # типы, линтер, тесты фронтенда
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
```

## Из чего состоит

- `crates/soundcloud` — всё общение с SoundCloud, и больше никто туда не
  ходит. Заметки про API: [docs/soundcloud-api.md](docs/soundcloud-api.md).
- `src-tauri` — само приложение: окна, вход, хранилище, загрузки.
- `src` — интерфейс на React.

Подробнее — в [docs/architecture.md](docs/architecture.md).

## Приватность

Токен SoundCloud хранится в системной связке ключей (keyring) — не в файле и
не в логах. Приложение ходит только в SoundCloud и в
[LRCLIB](https://lrclib.net) за текстами песен. Никакой телеметрии, аналитики
и своего сервера.

Релизы выходят только здесь, на GitHub, — не в App Store и не в Google Play.

## Лицензия

[MIT](LICENSE)
