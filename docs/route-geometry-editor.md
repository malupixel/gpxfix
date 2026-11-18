# Operacje edytora geometrii

## Audyt i wykorzystana architektura

Routing korzystał z `OsrmRoutingService` i OSRM `/route/v1/cycling`.
Backend odczytywał wyłącznie `routes[].geometry`, pomijając `waypoints[].location`.
Reducer edytora następnie zastępował końce wyniku współrzędnymi kliknięć.
To dwie przyczyny pozostawania kontrolek poza drogą.

Wersja zawiera osobno:

- dokładny ślad 2D w PostGIS `route_versions.track_geometry`;
- plik GPX z segmentami i próbkami wysokości, czasem zagęszczonymi przez istniejący `RouteElevationEnricher`;
- opcjonalny `editor_definition` JSONB: kontrolki oraz geometrie odcinków ROUTED/DIRECT.

Sugestie mają niezmienną wersję bazową, pozycje i dystanse na tamtej wersji.
Nie przenosimy ich indeksów na przekształconą trasę. Istniejąca obsługa historii,
archiwalnych sugestii i bezpiecznego scalania nadal określa ich zastosowanie.
Komentarze pozostają powiązane z sugestiami.

## Snapping

Ten sam endpoint routingu przyjmuje teraz `points` (2–100 współrzędnych),
zachowując obsługę wcześniejszego `from`/`to`. Zwraca `coordinates`, `waypoints`
i `segments`. Geometrie poszczególnych odcinków pochodzą ze `steps` odpowiednich
`legs`; dopasowanie wspólnej kontrolki odbywa się raz w tym samym zapytaniu.
OSRM otrzymuje limit `radiuses`. Backend dodatkowo weryfikuje dystans każdego
dopasowania i zgodność końców geometrii z waypointami.

Pierwsza kontrolka jest dopasowywana zapytaniem z dwoma identycznymi punktami.
Dodanie i zakończenie przeciągania uruchamiają routing. W czasie przeciągania
mapa pokazuje lokalny podgląd, bez zapytań. Sąsiadujące zmienione odcinki
są liczone wspólnie; nowsza operacja przerywa wcześniejszą i obejmuje jej
niedokończone odcinki. Odpowiedź jest stosowana atomowo tylko do zgodnego
stanu dokumentu. Cofnięcie, ponowienie, zmiana trybu i przywracanie szkicu
nie mogą pozostawić oczekiwania na przerwane zapytanie.

Istniejąca projekcja na geometrię odcinka służy do wstawiania kontrolek;
nie przelicza zachowanego przebiegu. Kontrolki DIRECT można swobodnie przesuwać.
Błąd routingu lub przekroczenie limitu zachowuje widoczny ślad, pokazuje błąd
i wymaga świadomego potwierdzenia zapisu niedopasowanego odcinka.
Nie dodano osobnego wyszukiwania najbliższych dróg ani skrótu Alt.

## Odwracanie i przenoszenie START/META

Menu „Więcej” właściciela aktualnej wersji zawiera obie operacje.
Osobny widok mapy wykorzystuje istniejący `EditorMap`, podgląd oraz zatwierdzenie.
Wszystkie komunikaty mają wersje PL/EN. Dostępne są anulowanie, Escape,
kontrola fokusu oraz obsługa kliknięć/dotyku.

Odwrócenie odwraca dokładny ślad PostGIS oraz osobno segmenty i próbki GPX.
Nie wywołuje routingu ani ponownego pozyskiwania wysokości. Istniejący dokument
kontrolek zostaje odwrócony wraz z geometriami odcinków. Odwrócenie zachowuje dystans wersji źródłowej, również dla GPX z rozłącznymi
segmentami: przerwy nie stają się przejazdem. Przeniesienie STARTU przelicza
dystans nowej geometrii. Profil, podjazdy i zjazdy pochodzą z zachowanych próbek GPX.

Przeniesienie STARTU używa istniejącej projekcji na ślad. API przyjmuje indeks
segmentu i ułamek jego długości, rozróżniając kolejne przejazdy tym samym miejscem.
Podział interpoluje wysokość. Dopasowanie do gęstszego profilu przechodzi po kolejnych wystąpieniach oryginalnych wierzchołków, aby zachować także zerowe segmenty z odmiennymi próbkami wysokości. Geometria mapy i gęstszy profil GPX są obracane
osobno, a współrzędne nowego STARTU/METY uzgadniane dokładnie. Nowe otwarcie
edytora odbudowuje kontrolki istniejącym `documentFromGeometry`, zachowując
wszystkie wierzchołki śladu. Można jednocześnie odwrócić kierunek.

Rozdzielone końce łączy ten sam serwis routingu. Nie wolno zmieniać starych
końców: dopuszczalna jest jedynie mała tolerancja numeryczna. Nadmierny objazd
jest odrzucany. Domknięcie jest pomarańczową linią przerywaną z podaną długością.
Połączenie proste jest osobnym, jawnym wyborem i również wymaga podglądu.
Wysokości brakujące na nowym odcinku uzupełnia istniejący mechanizm wysokości.

Ręczna deklaracja pętli należy do nowej wersji (`loop_declared`), a nie do
zmiennej geometrii trasy. Zwykła edycja i scalenie tworzą kolejną wersję
bez odziedziczonej deklaracji, a automatyczny warunek jest oceniany ponownie.
Odwrócenie i dokładne kopiowanie zachowują deklarację. Publiczne pole `loop`
w DTO stosuje ten sam próg co operacja przenoszenia STARTU.

## API i atomowość

Endpointy wymagają istniejącej autoryzacji właściciela i obsługują `?branch=`:

- `GET /api/routes/{id}/owner/geometry/options` — rozpoznanie pętli, deklaracja, przerwa i próg;
- `POST /api/routes/{id}/owner/geometry/preview` — przygotowanie podglądu;
- `POST /api/routes/{id}/owner/geometry/versions` — zapis zaakceptowanego wyniku.

Żądanie zawiera `baseVersionNumber`, `operation` (`REVERSE`/`RELOCATE`),
`segmentIndex`, `segmentFraction`, `declareLoop`, `reverse`, `directClosure`.
Zapis wymaga ponadto `previewHash` z podglądu. Serwer ponownie przygotowuje
wynik; zmiana wersji lub wyniku routingu daje 409 i wymaga ponownego podglądu.
Podgląd nie tworzy pliku ani wersji.

Zapis blokuje trasę i korzysta ze wspólnego `RouteVersionCreationService`.
Deklaracja pętli jest ustawiana przed INSERT, zgodnie z istniejącą blokadą
niezmienności wersji w bazie. Publikacja wersji, historia i aktywność należą
do jednej transakcji. Istniejący callback usuwa nowy plik GPX po rollbacku.

## Konfiguracja i wdrożenie

Migracja Flyway: `V13__version_loop_declaration.sql`. Dodaje boolean domyślnie
`false`, bez zmiany dawnych geometrii i powiązań. Nowych zależności brak.
API i frontend należy wdrożyć razem; Flyway wykona migrację przy starcie API.

| Zmienna | Domyślnie | Znaczenie |
| --- | ---: | --- |
| `ROUTING_PROFILE` | cycling | profil istniejącego OSRM |
| `ROUTING_MAX_SNAP_METERS` | 50 | maksymalny dystans dopasowania |
| `ROUTE_LOOP_THRESHOLD_METERS` | 150 | automatyczne rozpoznanie pętli |
| `ROUTE_MAX_CLOSURE_RATIO` | 5 | maksymalny stosunek długości domknięcia do przerwy |
| `ROUTE_CLOSURE_ENDPOINT_TOLERANCE_METERS` | 1 | tolerancja połączenia z zachowanymi końcami |

Repozytorium nie miało wyboru profilu w interfejsie. Profil jest konfigurowany
na backendzie, wspólnie dla edytora i domknięć. Faktyczna dostępność dróg
rowerowych/pieszych zależy od danych i profilu załadowanego w serwerze OSRM;
sama nazwa parametru nie zamienia jego grafu routingu.

## Granice działania

- Przy samoprzecięciu projekcja wybiera pierwsze równie bliskie przejście zgodnie z istniejącą funkcją; zachowuje kolejność pozostałych przejazdów.
- GPX z kilkoma rozłącznymi segmentami można odwrócić; przenoszenie STARTU odrzuca taki plik, aby nie tworzyć przerw ani dodatkowych połączeń.
- Końce oddalone od sieci drogowej nie są dowolnie przesuwane na potrzeby domknięcia. Użytkownik może poprawić ślad lub świadomie zatwierdzić linię prostą.
- Rzeczywista jakość dopasowania na wiaduktach i równoległych drogach zależy od OSRM. Testy deterministyczne sprawdzają kontrakt i spójność, nie jakość zewnętrznej mapy.
- Testy mobilne emulują dotykowy Chromium; nie zastępują fizycznego telefonu.

## Weryfikacja

Testy backendu uruchomiono w Java 21 z rzeczywistym PostGIS w Testcontainers;
107 testów przeszło, bez pominięć. Frontend: 99 testów w Node 24, kontrola
typów i ESLint bez błędów. Obie aplikacje budują się w obrazach projektu.
Konfigurację głównego Compose sprawdzono z `.env.example` bez zmieniania
istniejącego stosu aplikacji.

Testy jednostkowe obejmują kontrakt OSRM i limit snapowania, spójność kontrolek,
odpowiedzi poza kolejnością, cofanie i przerwane zapytania, odwracanie,
powtarzające się wierzchołki, zerowe i krótkie segmenty, interpolację wysokości,
samoprzecięcia oraz błędną geometrię. Integracje sprawdzają nowe wersje,
autoryzację, niezmienność oryginału, komentarze i sugestie, eksport GPX,
podgląd i zatwierdzenie, domknięcie, nadmierny objazd i końce poza drogą.

Przeglądarkę uruchomiono przez istniejący Playwright CLI (Playwright MCP nie
był dostępny w sesji). Diagnostyka obejmuje wyjątki JS, konsolę, nieudane
żądania i odpowiedzi HTTP. Testy mobilne używają emulacji Pixel 7,
tapnięcia na mapie oraz zdarzeń dotykowych przy przeciąganiu kontrolki.
Łącznie pozytywnie zweryfikowano 88 różnych scenariuszy E2E w kilku przebiegach.
Pierwszy pełny przebieg (2 workery) miał 83 sukcesy, dwa timeouty mobilnych testów
mapy i zakończył się sygnałem SIGTERM przed zamknięciem raportu. Odrębne
powtórzenie (1 worker) zaliczyło cztery regresje pokrycia mapy. Test siatki
właściciela wymagał poprawki przygotowania: czeka teraz na zakończenie
asynchronicznego przełączenia do edytora i wybiera zamontowaną instancję mapy.
Po poprawce przeszedł osobno, a końcowe powtórzenie na ostatnim obrazie API
zaliczyło wszystkie 12 scenariuszy transformacji i trzech trybów siatki na
obu rozmiarach ekranu (2 workery). Nie powtarzano ponownie jednym poleceniem
całego kosztownego zestawu 88 testów. Nie pozostały niezweryfikowane scenariusze
z tego zestawu; jakość usług zewnętrznych i fizyczny telefon pozostają poza
zakresem tej weryfikacji.

[Zestawienie wyników i przypadków](../artifacts/route-geometry/verification.json),
[pierwszy przebieg](../artifacts/route-geometry/e2e-full-attempt.log),
[końcowe powtórzenie](../artifacts/route-geometry/e2e-focused-final.log).

[Zrzuty podglądu desktop/mobile](../artifacts/route-geometry/README.md).
