# Warianty tras — audyt i projekt

## Audyt
V7 wprowadziła route_versions, based_on_version_id i pojedynczy routes.current_version_id. V8 przywróciła wspólne metadane i soft delete. Geometria PostGIS jest 2D; wysokości zachowuje plik GPX, odczytywany także do profilu. RouteVersionCreationService jest wspólną ścieżką importu, rysowania, edycji i merge. RouteVersionPipeline może uzupełniać wysokości. Kopiowanie wersji musi ominąć wzbogacanie, żeby zachować również brak wysokości.

RouteService, RouteMapper, GpxExportService, RouteShareService, SuggestionMergeService i RouteSuggestionService zakładają jeden head. Historia odczytuje wszystkie wersje według numeru. Ghost i porównanie identyfikują wersje przez publiczny identyfikator trasy oraz numer. Sugestia ma wersję bazową, ale żądanie jej utworzenia nie ma oczekiwanej wersji. DetourMergeHandler dopasowuje zmieniany fragment do aktualnej geometrii i odrzuca niejednoznaczności. Autoryzacja to ciasteczka sesji ograniczone ścieżką trasy; nowe trasy otrzymują niezależny losowy sekret. Usunięcie jest logiczne; publiczne odczyty filtrują deleted_at. Panel administracyjny pokazuje główny przebieg i wszystkie wersje. Worker podglądów operuje na niezmiennych wersjach.

## Model i migracja
V12 doda route_branches (stabilny UUID dla wariantów, main dla głównej, nazwa, opis, punkt rozgałęzienia, head), przypisanie wersji i sugestii do gałęzi, opcjonalną nazwę wersji i informację o pochodzeniu nowej trasy. Wszystkie dotychczasowe rekordy trafiają do main. Żadna geometria ani historia nie jest kopiowana podczas tworzenia wariantu. Wspólni przodkowie są odczytywani przez based_on_version_id. Numer wersji pozostaje unikalnym numerem prezentacyjnym w obrębie trasy, a nie indeksem w gałęzi (historia wariantu może mieć luki). Wewnętrzne klucze BIGINT nie są numerami wersji. Aktualność i liczba wersji będą liczone dla wybranego wariantu.

routes.current_version_id pozostaje wyłącznie kompatybilnym wskaźnikiem main dla starych integracji administracyjnych. Operacje użytkownika korzystają z route_branches. Blokada całej trasy serializuje zmiany i przydział numerów; pozwala bezpiecznie rozwijać różne gałęzie, kosztem równoległości zapisów tej samej trasy. Baza pilnuje przynależności do trasy, poprawności head i niezmienności rodzica/geometrii. Rodzic musi mieć mniejszy numer, co wyklucza cykle.

## API i interfejs
Dotychczasowe URL pozostają main. Parametr branch wybiera wariant w API i publicznych URL. Wersje nadal mają stabilne /versions/{number} i /v/{number}; kontekst branch określa head, historię i sugestie. Dodane będą listowanie/tworzenie wariantów, kopiowanie wersji do nowej trasy i zmiana etykiety wersji. Uprawnienia wariantu dziedziczą uprawnienia całej trasy. Publiczna kopia używa wspólnego serwisu tworzenia i nowego sekretu. Metadane wspólnej trasy i ustawienie przyjmowania sugestii pozostają wspólne; nazwa/opis wariantu są osobne.

Nowe sugestie UI przesyłają oczekiwany numer wersji; niezgodność zwraca 409. Parametr jest wymagany dla wszystkich gałęzi (brak zwraca 409). To celowa zmiana kontraktu zapisu: starszy klient musi odświeżyć aplikację; bez wersji bazowej nie da się wykryć cichego przesunięcia geometrii. Sugestie są filtrowane po gałęzi także gdy mają wspólną geometrię bazową. Merge sprawdza gałąź sugestii i zmienia tylko jej head. Podstawa przyszłego przenoszenia to branch_id, base_version_id, rodzic wersji i istniejące punkty/odcinek geometrii. Przenoszenie i merge gałęzi pozostają poza zakresem.

## Weryfikacja
Testy migracji na danych sprzed V12, integracja API z PostGIS, niezależność gałęzi i uprawnień, konflikty, kopiowanie dokładnych danych GPX, testy UI/menu/PL/EN i Playwright na izolowanym stosie e2e. Testy nie korzystają z produkcji. Playwright MCP nie jest udostępniony w sesji; dostępny jest lokalny Playwright.

## Kontrakt wdrożenia

Nowe endpointy (prefiks `/api/routes/{publicId}`):

- `GET /branches` — lista metadanych wariantów.
- `POST /owner/branches` — `{versionNumber,name,description}`; uprawnienia właściciela całej trasy.
- `PATCH /owner/versions/{number}/label` — `{label}`; pusta nazwa usuwa etykietę.
- `POST /versions/{number}/copy` — `{name,description}`; publiczna operacja tworząca niezależną trasę, nowy sekret i sesję właściciela.

Istniejące odczyty, edycja, sugestie, moderacja, komentarze, merge, aktywność, eksport i metadane udostępniania przyjmują kontekst `?branch={stableId}`. Brak kontekstu wybiera `main`. Numer wersji nadal jednoznacznie wskazuje wersję w obrębie całej trasy. Nowe żądania sugestii muszą przesyłać `baseVersionNumber`; brak lub nieaktualny numer daje 409 bez zapisu. Idempotency-Key uwzględnia wariant.

Publiczne adresy to `/route/{publicId}?branch={stableId}` i `/route/{publicId}/v/{number}?branch={stableId}`. Stare adresy i sekrety działają dla main. Nowa trasa otrzymuje `INITIAL_COPY`, osobny plik GPX (identyczne bajty), dokładną geometrię i statystyki źródłowej wersji, własną v1 i tylko własną aktywność utworzenia. Pochodzenie jest migawką identyfikatorów/nazwy, bez zależności FK do źródła. Soft delete obejmuje całą tożsamość trasy i jej warianty.

Flyway uruchamia V12 podczas startu API. Wdrożenie wymaga skoordynowanego zatrzymania starego API i startu nowego: stary kod nie zapisuje branch_id i nie może pracować po migracji. Migracja jest transakcyjna, bez usuwania danych i bez zmiany plików GPX; przed wdrożeniem należy wykonać standardową kopię bazy i magazynu plików. Produkcja nie była modyfikowana podczas tej pracy. Przywrócenie starej binarki po V12 nie jest obsługiwanym rollbackiem; wymaga przywrócenia kopii lub migracji naprawczej.

Nazwy/opisy trasy, ustawienie sugestii, dostęp właściciela i usuwanie pozostają wspólne dla wariantów. Opcjonalna etykieta wersji jest wspólna wszędzie, gdzie historia wskazuje tę samą wersję. Zapis zmian jest serializowany blokadą trasy; stare wersje i rozwój innych gałęzi nie są nadpisywane. Geometrie PostGIS zachowują dotychczasowy indeks GiST. Dodatkowe indeksy obejmują rodzica wersji, gałąź/numer, gałąź/status sugestii i head gałęzi. Lista wariantów i historia czytają kolumny skalarne, bez geometrii.


## Weryfikacja regresji — 2026-11-05

Aktualne źródła zostały zbudowane i uruchomione w izolowanym stosie `boostmytrack-e2e` (porty 8250/8251, testowy PostGIS i lokalne fixture wysokości/routingu). Produkcja nie była używana.

- Backend Java 21: 89 testów, 0 błędów, 0 niepowodzeń, 0 pominięć.
- Frontend Node 24: 94 testy, 0 niepowodzeń; ESLint i TypeScript przeszły.
- Build obrazów API i Next.js: zakończony powodzeniem.
- Playwright/Chromium: 70/70 scenariuszy (35 desktop, 35 mobile), bez ponowień i pominięć, około 10,6 min.
- Wszystkie wcześniejsze nieudane przypadki (wariant na mobile, edycja właścicielska i pokrycie siatki po zapisie na desktopie) przeszły w pełnym przebiegu. W tym przebiegu nie odtworzono usterki wymagającej zmiany kodu aplikacji.

Sprawdzono m.in. wariant ze starej wersji, sugestię utworzoną kliknięciami na mapie, publikowanie i merge bez zmiany głównej trasy, edycję wariantu, historię, ducha, porównanie, eksport, niezależną kopię z nowymi linkami i przejściem do edycji, etykiety wersji, menu z klawiatury/Escape/kliknięciem poza menu, PL/EN, uprawnienia, moderację komentarzy i dotychczasowe funkcje mapy. Fixture testów sprawdza wyjątki przeglądarki, konsolę oraz nieoczekiwane błędy HTTP i sieci. Zrzuty menu desktop/mobile zostały także obejrzane.

Raporty lokalne: `e2e/playwright-report/index.html`, `e2e/test-results/results.json` oraz `api/target/surefire-reports/`. Playwright MCP nie był dostępny w sesji; wykorzystano lokalny Playwright z rzeczywistym Chromium. Mobile oznacza emulację Pixel 7; testy z lokalnymi fixture nie potwierdzają dostępności zewnętrznych kafelków ani usług DEM/routingu w produkcji.
