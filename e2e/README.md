# Testy E2E serwisu

Wymagania: Docker z Compose v2, Node.js 18+ i npm (aplikacja buduje się w Dockerze z Node.js 24). Porty 8250 i 8251 muszą być wolne.
Testy nie korzystają z głównego `.env`, lokalnej bazy na 8152 ani produkcji.
Adresy są celowo stałe i wskazują wyłącznie `127.0.0.1`.

Z katalogu projektu:

```bash
cd e2e
npm ci
npx playwright install --with-deps chromium
npm run env:up
npm test
npm run report
```

Pełny przebieg jednym poleceniem (tworzy pusty stos i usuwa go także po błędzie):

```bash
npm run test:isolated
```

Nie uruchamiaj dwóch przebiegów izolowanych jednocześnie — używają tych samych
portów i projektu Compose. `npm ci` i instalacja Chromium są potrzebne wcześniej.

Dodatkowe sposoby uruchamiania:

```bash
npm test -- --project=desktop
npm test -- --project=mobile
npm test -- --grep 'moderation'
npm run test:ui
```

`env:up` buduje aktualne źródła API i frontendu oraz czeka na ich gotowość.
Po zmianach aplikacji uruchom je ponownie. Testy korzystają z rzeczywistego
Spring Boot, Next.js, PostGIS, plików GPX i Chromium z WebGL. Tryb mobilny
emuluje Pixel 7 w Chromium; nie zastępuje testu na fizycznym telefonie.

Każdy test tworzy własne trasy, a Playwright izoluje cookies i localStorage.
Baza jest w tmpfs, pliki GPX w kontenerze API. Ponowne testy mogą korzystać
z uruchomionego stosu; dla zupełnie pustego środowiska:

```bash
npm run env:down
npm run env:up
npm test
```

Zatrzymanie i usunięcie wyłącznie środowiska E2E:

```bash
npm run env:down
```

Stos działa jako projekt Compose `boostmytrack-e2e`. Nie uruchamiaj tych poleceń
z inną nazwą projektu. Sekret administratora w Compose to publiczna wartość
wyłącznie testowa. API testowe jest dostępne tylko przez lokalny interfejs.

Zewnętrzne usługi wysokości/routingu zastępuje lokalny serwer fixture.
Playwright podstawia minimalistyczny styl mapy, zachowując MapLibre,
renderowanie trasy, kliknięcia, wybieranie odcinków i kontrolki mapy.
Testy nie oceniają dostępności zewnętrznych kafelków, jakości routingu ani DEM.

Raport HTML: `playwright-report/index.html`; wynik JSON: `test-results/results.json`.
Każdy test dołącza `browser-diagnostics` (wyjątki JS, konsola, odpowiedzi HTTP
z błędami, nieudane żądania). Dla błędów zachowywane są trace, nagranie i zrzut.
Oczekiwane 4xx, np. brak dostępu właściciela i odrzucenie GPX, są zapisywane;
nieoczekiwane wyjątki JS, komunikaty konsoli i błędy 5xx/sieci oblewają test.

Regresje `BUG-001`, `BUG-002` i `BUG-003` są zwykłymi testami, bez znacznika
`test.fail`. Sprawdzają odtworzenie szkicu, proxy API/obraz udostępniania
i widoczność nowej sugestii dla właściciela oraz odwiedzającego.
Historia audytu, napraw i ograniczenia znajdują się w `AUDIT.md`.

Regresje strony głównej (`tests/landing.spec.ts`) sprawdzają demonstrację,
PL/EN, ograniczone animacje i screenshoty 320/375/768/1440 px. Zachowane
artefakty i opis są w [artifacts/landing](../artifacts/landing/README.md).
