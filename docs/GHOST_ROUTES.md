# Ghost Routes / Trasy w tle

## Architektura

`web/src/features/ghost-routes` jest wspólnym modułem dla istniejących map
MapLibre (`RouteMap` i `EditorMap`):

- `model.ts`: typ śladu, limity pamięci, reducer, identyfikatory wersji i GeoJSON.
- `provider.tsx`: stan w pamięci, pobieranie wersji przez istniejące
  `getRouteVersion`, zoom i tymczasowa para porównania A/B.
- `gpx.ts`: lokalny odczyt GPX za pomocą przeglądarkowego DOMParser.
- `map-layer.tsx`: jedno źródło GeoJSON i jedna pasywna warstwa linii.
- `panel.tsx`: import wielu plików, widoczność, kolory, usuwanie i zoom.

Provider w layoucie `/route/[publicId]` zachowuje ślady podczas nawigacji między
wersjami jednej trasy i podczas przechodzenia do edytora właściciela. Nowa trasa
w `/draw` ma osobny provider. Zmiana trasy lub odświeżenie strony usuwa stan.
Nie ma zapisu do localStorage, bazy ani API.

Dane duchów nie należą do dokumentu edytora, geometrii głównej trasy, formularza
sugestii ani modelu profilu wysokości. Nie są argumentami routingu, merge,
eksportu ani zapisu wersji. Uprawnienia właściciela pozostają bez zmian.

## GPX

Dotychczasowy parser aplikacji działa wyłącznie na backendzie w Javie/StAX.
Lokalny parser używa natywnego DOMParser i tych samych granic track/segment.
Obsługuje GPX 1.0 i 1.1 oraz nazwy elementów z przestrzeniami nazw, odrzuca
DTD/ENTITY, niepoprawny XML, brakujące i niepoprawne współrzędne. Każdy `trkseg`
pozostaje oddzielną linią w MultiLineString. Obsługiwane są ślady `trk`, zgodnie
z istniejącym importerem; samodzielne waypointy i `rte` nie tworzą linii.
Segmenty jednoelementowe są pomijane. Nie powstają połączenia między segmentami.

Limity: 10 MiB i 100 000 punktów na plik; 12 śladów oraz 300 000 punktów łącznie
(z parą porównania). Pliki są odczytywane kolejno, z walidacją rozmiaru przed
odczytem. Błąd jednego pliku nie usuwa poprawnie dodanych pozostałych plików.
Geometria nie jest upraszczana ani dopasowywana do dróg.

## Historia i porównywanie

Historia udostępnia „Pokaż jako ducha” oraz wybór dowolnych dwóch wersji A/B.
Pobieranie używa istniejącego publicznego GET `/api/routes/{id}/versions/{n}`;
nie ma nowych endpointów ani zmian reguł widoczności wersji. Geometria pochodzi
z istniejącej reprezentacji wersji w API. Stabilny identyfikator `(id trasy,
numer wersji)` zapobiega duplikatom. Ponowne dodanie pokazuje i przybliża ślad.

Para A/B jest osobnym polem tego samego stanu, renderowanym przez tę samą
warstwę. A ma szerszą fioletową linię, B pomarańczową. Główna trasa, jej
znaczniki, sugestie i uchwyty są tymczasowo ukrywane, a ich interakcje
wstrzymywane. Stan edycji nie jest zmieniany. Zamknięcie przywraca widok i kamerę;
zwykłe duchy zachowują swoje ustawienia. Usunięcie członka pary zamyka porównanie.
Role A/B pozwalają później powiązać parę z analizą różnic; na tym etapie nie ma
algorytmu różnic ani statystyk zmian.

## Warstwy i cykl życia

Od dołu: mapa bazowa, duchy, główna trasa, sugestie, aktywna selekcja i uchwyty.
Duchy są wstawiane z `beforeId` głównej linii. Mają szeroką przerywaną linię,
standardowo opacity 0.45 (A w porównaniu 0.8). Nie rejestrują zdarzeń ani nie są
uwzględniane w zapytaniach o trafienie kursora. Wybór kotwic sugestii nadal
odbywa się wyłącznie przez istniejącą warstwę interakcji głównej trasy.

Zmiany stanu aktualizują wspólne źródło; nie tworzą osobnych instancji mapy.
Przy braku widocznych śladów źródło i warstwa są usuwane. Przy odmontowaniu
odpinane są listenery i usuwane zasoby. Warstwa odtwarza się po załadowaniu stylu,
gdy istnieje główna warstwa mapy. Aplikacja obecnie nie udostępnia przełącznika
stylu; mechanizm nie wprowadza takiego przełącznika.

## Weryfikacja

- `cd web && npm test`: reducer, limity, duplikaty, porównanie i jego zamknięcie,
  niezmienność danych trasy, odrzucenie dużych plików przed odczytem,
  GET geometrii historycznej oraz istniejące testy regresji i tłumaczeń.
- `npm run typecheck`, `npm run lint`, `npm run build` (Node >=20.9).
- `web/scripts/ghost-routes.browser.cjs`: rzeczywisty Next i Chrome/MapLibre,
  izolowana atrapa API i pusty styl bazowy. Wymaga Node 24, Chrome oraz dostępnego
  modułu `playwright-core` wskazanego zmienną `PLAYWRIGHT_MODULE` (lub normalnie
  zainstalowanego w środowisku). Nie dodaje zależności produkcyjnych.

Przykład z katalogu repozytorium:

```bash
PLAYWRIGHT_MODULE=/sciezka/do/playwright-core node web/scripts/ghost-routes.browser.cjs
```

Test przeglądarkowy sprawdza prawdziwy DOMParser (GPX 1.0/1.1, wiele segmentów
oraz śladów, błędny XML i współrzędne), import wielu plików bez uploadu,
widoczność/usuwanie, historię, duplikaty, A/B dwóch wersji historycznych,
niezmienność głównej geometrii, hierarchię warstw, kliknięcia Detour/Issue/Note,
wysłanie notatki bez geometrii ducha, eksport, nawigację wersji, owner mode,
mobile 390 px, tłumaczenia PL/EN, undo/redo oraz zwalnianie zasobów.
Zrzuty mobilne zapisuje w `/tmp/ghost-routes-*.png`. Test używa atrapy backendu;
nie zastępuje weryfikacji infrastruktury ani testów integracyjnych API.

Nie są wymagane migracje ani zmiany backendu. Wdrożenie wymaga przebudowy
frontendu standardowym procesem projektu. Zakres celowo pomija trwałe zapisywanie,
udostępnianie duchów, automatyczne różnice i generowanie nowych tras.
