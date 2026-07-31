#!/usr/bin/env bash
# Отдать сборку по HTTPS внутри своей сети Tailscale (F-12, «Как поставить на iPhone»).
#
# Зачем это, если есть GitHub Pages: Pages публичен, а тут адрес виден только твоим устройствам, и
# сертификат настоящий — значит service worker зарегистрируется, а без него офлайна не бывает.
#
# Ноутбук нужен включённым только на время установки и обновления. За столом приложение работает
# из кэша телефона, и хост ему не нужен вовсе — это проверено с погашенным сервером.
#
#     ./scripts/serve-tailnet.sh
#
# Остановить раздачу: tailscale serve reset

set -euo pipefail

cd "$(dirname "$0")/.."

if ! /usr/local/bin/tailscale status >/dev/null 2>&1; then
  echo "Tailscale не в сети. Запусти приложение из /Applications и войди в свою учётную запись."
  exit 1
fi

echo "Собираю…"
npm run build >/dev/null

# Каталог отдаётся самим Tailscale: отдельный http-сервер не нужен. Если однажды окажется, что
# индексный файл так не находится, замени эти две строки на пару
#   npx http-server out -p 4321 -a 127.0.0.1 --silent &
#   tailscale serve --bg 4321
/usr/local/bin/tailscale serve reset >/dev/null 2>&1 || true
/usr/local/bin/tailscale serve --bg "$PWD/out"

echo
echo "Адрес для телефона:"
/usr/local/bin/tailscale serve status | sed -n 's#^\(https://[^ ]*\).*#  \1#p' | sort -u
echo
echo "Открой его в Safari на iPhone → «Поделиться» → «На экран \"Домой\"»."
echo "Дай странице загрузиться до конца — этого достаточно, дальше она работает без сети."
