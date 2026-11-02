# Strona główna i demonstracja TweakMyRoute

Strona wyjaśnia wspólne ulepszanie trasy i pozostawia decyzję właścicielowi.
Upload korzysta z istniejącego `UploadForm`; nazwa, opis, link zarządzania,
obsługa schowka i przekierowania pozostają w tym komponencie. Rysowanie
prowadzi do istniejącego `/draw`. Wszystkie nowe teksty mają wersje PL i EN.
Na desktopie demo i formularz są obok siebie. Na telefonie link nad demo
prowadzi bezpośrednio do formularza, bez przewijania całej demonstracji.

## Technologia

`web/src/features/landing/route-demo.tsx` renderuje SVG i animacje CSS.
Nie ładuje MapLibre/WebGL, zewnętrznych kafelków ani dodatkowych bibliotek.
To celowy wybór dla lekkiej, zawsze dostępnej ilustracji na stronie głównej.
Kolory odpowiadają mapie aplikacji: niebieska trasa, zielona propozycja,
pomarańczowy punkt końcowy. Nie wykorzystano danych mapowych innego dostawcy.

`demo-data.ts` zawiera niewielki statyczny GeoJSON. Wspólne kotwice oryginalnego
fragmentu i objazdu zapewniają ciągłość. Przykład jest ilustracyjny; nie służy
nawigacji. Nie udaje autentycznej trasy po rzeczywistych drogach.

`demo-model.ts` zawiera reducer z pięcioma etapami. Automatyczny przebieg trwa
15,2 sekundy i kończy się na gotowej trasie, bez uporczywego zapętlania.
Na decyzję są przeznaczone 5 sekund. Ręczne wybranie etapu zatrzymuje automat,
a przycisk akceptacji zastępuje fragment trasy tylko w demonstracji.
Pauza zatrzymuje także rysowanie CSS; restart odtwarza je od początku.

IntersectionObserver zatrzymuje automat poza ekranem. Ukrycie karty również
wstrzymuje odtwarzanie. Każdy efekt usuwa timer, observer i subskrypcje.
`prefers-reduced-motion` wyłącza automatyczne przejścia i animacje; etapy
pozostają dostępne z klawiatury i dotykiem. Początkowy stan SSR/klienta jest
zgodny; ustawienia przeglądarki są odczytywane przez `useSyncExternalStore`.

## Sprawdzenie

- Logika scen, pauzy, odtwarzania i geometrii: `cd web && npm test`.
- Regresje przeglądarkowe: `cd e2e && npm run test:isolated`.
- Tylko strona główna na uruchomionym stosie: `npm test -- tests/landing.spec.ts`.
- Screenshoty i opis: [artifacts/landing](../artifacts/landing/README.md).

Playwright sprawdza także działanie demonstracji przy zablokowanych żądaniach
API, pełny automat, odmontowanie z aktywnym timerem, widoczność komponentu,
PL/EN, klawiaturę i ograniczone animacje. Istniejące testy sprawdzają import GPX,
prywatny link właściciela, rysowanie, wersje, sugestie, komentarze i eksport.
Testowane silniki to Chromium desktop i emulacja telefonu, bez fizycznych
urządzeń ani pełnej walidacji czytnikiem ekranu. Produkcja nie jest wdrażana.

Wynik realizacji: 72/72 testów frontendu i 52/52 pełnej regresji E2E.
Po końcowej zmianie położenia komentarza mobilnego ponownie przeszło
14/14 testów strony głównej. ESLint, TypeScript i build produkcyjny przeszły.
Screenshoty wszystkich czterech szerokości obejrzano i poprawiono zasłanianie
mety przez komentarz. Dodatkowy pełny cykl sprawdzono bez przyspieszania
zegara, na lokalnym frontendzie, przy zablokowanym API: około 15,7 s,
bez błędów konsoli. Playwright MCP nie był dostępny w sesji — użyto
Playwright Test/Chromium uruchamianego z konsoli.
