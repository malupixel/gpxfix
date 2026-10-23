# Propozycja integracji po lokalnym PoC — bez zmian API/UI w etapie 1

## Aktualny punkt zaczepienia

Przeczytano `api/src/main/java/pl/routecommunity/api/routing/{RoutingService,OsrmRoutingService,RoutingController}.java` oraz `web/src/features/route-editor/routing.ts`. Obecny interfejs to `route(from,to) → List<List<Double>>`; kontroler POST `/api/routing/route` waliduje dwa punkty i zwraca tylko `{coordinates}`. Adapter domyślnie woła OSRM `/route/v1/cycling/...` i redukuje odpowiedź do geometrii, bez metadanych, jawnych timeoutów ani typowanych błędów. Frontend przekazuje opcjonalny AbortSignal. W tym etapie **nie zmieniono żadnego z tych plików ani app.routing.base-url**.

Dalsze wnioski z wcześniejszego audytu: ROAD/GRAVEL nie są tym samym co ROUTED/DIRECT. Historia zapisuje geometrię, a nie przepis na jej przyszłe przeliczenie. Dokument v1 i backendowe DTO nie mają profilu segmentu. Reducer nadpisuje końce wyniku surowymi kliknięciami, istnieją wyścigi ROUTED→DIRECT i undo/redo. GPX otwierany jest bez wywołań routingu. DETOUR obecnie składa łamaną; merge nie korzysta z routera i porzuca editorDefinition. Przed zmianą tych zachowań potrzebna jest odrębna regresja.

## Kontrakt domenowy v2 (propozycja, nie nowe publiczne API)

Oddzielić `RoutingProvider` od kontrolera i od `OsrmRoutingService`. Żądanie domenowe:

```json
{
  "requestId": "opaque-id",
  "waypoints": [[21.011522,52.230740],[20.9974,52.2465]],
  "travelProfile": "ROAD",
  "profileRevision": "1.0.1",
  "region": "pl-border",
  "snapPolicy": {"maxDistanceMeters": 30},
  "deadlineMillis": 12000
}
```

Limit snapu 30 m jest **propozycją do kalibracji**, nie ustawieniem już działającym w PoC. Dla importu GPX/map matching potrzebny osobny kontrakt. Publiczny klient nie dostaje URL routera ani dowolnej nazwy `.brf`; backend mapuje enum + rewizję na zaufany profil. Nie przekazywać `profile:*`, ścieżek, `nogos` ani innych surowych parametrów BRoutera z przeglądarki. Region wybiera backend na podstawie pokrycia całego korytarza i polityki zasięgu, a nie tylko kraju startu.

Wynik domenowy:

```json
{
  "requestId": "opaque-id",
  "coordinates": [[21.011522,52.230740],[20.9974,52.2465]],
  "distanceMeters": 3216,
  "snappedWaypoints": [
    {"inputIndex":0,"requested":[21.011522,52.230740],"snapped":[21.011522,52.230740],"distanceMeters":0},
    {"inputIndex":1,"requested":[20.9974,52.2465],"snapped":[20.9974,52.2465],"distanceMeters":0}
  ],
  "provenance": {
    "engine":"BROUTER", "engineVersion":"1.7.10",
    "travelProfile":"ROAD", "profileRevision":"1.0.1",
    "profileSha256":"<full hash>",
    "region":"pl-border", "dataGeneration":"<immutable manifest hash>"
  },
  "warnings":[{"code":"UNKNOWN_SURFACE","distanceMeters":123}],
  "computedAt":"<UTC timestamp>"
}
```

Współrzędne i snap w przykładzie są **ilustracją schematu**, nie pełną geometrią zmierzonej trasy. Metryki muszą pochodzić z jednej odpowiedzi. Backend waliduje FeatureCollection, prawidłowy LineString, min. 2 skończone punkty w zakresie, długość, waypointy i zgodność profilu; usuwa wysokość tylko na granicy kontraktu 2D. Brak wymaganej diagnostyki oznacza unknown/unavailable, nie zero. Nie kopiować wszystkich tagów do odpowiedzi klienta.

## Snap i waypointy

1. Zachować requested i snapped osobno; nie zastępować pierwszego/ostatniego punktu polilinii surowym kliknięciem. Odcinek łączący kliknięcie z drogą nie jest potwierdzoną legalną trasą. Nie rysować go jako zwykłej części ROUTED.
2. Dopasowanie musi uwzględniać profil, kierunek i ciągłość grafu. W PoC `waypoint_nearest_vertex` to tylko minimalna odległość do wierzchołka linii; nie potwierdza snapu, kolejności ani dokładnego legu. Samo `exportWaypoints=1` zwraca wejście. Poprawić/przetestować eksport poprawionych waypointów albo zastosować sprawdzony adapter biblioteczny BRoutera udostępniający matchedWaypoints. Dopiero wtedy oferować gwarantowany kontrakt snappedWaypoints dla wszystkich via.
3. Wprowadzić max snap i odrzucenie SNAP_TOO_FAR. Nie przyjmować równoległej drogi za rzeką, ogrodzeniem czy na drugim poziomie mostu na podstawie samej małej odległości.
4. Zmierzyć snap na izolowanych wyspach grafu — testy PoC pokazały timeout, a kontrolny syntetyczny graf zwraca `target island detected`. Jawnie raportować NO_ROUTE; nie zamieniać na prostą.
5. Nie porzucać waypointów (`correctMisplacedViaPoints=false`). Niezależne pary segmentów mogą dawać różne snapy wspólnego punktu i nawroty. Przy serii zgodnych profili rozważyć grupowanie i przypisanie legów, ale nie zmieniać geometrii innych segmentów podczas jednej edycji.

## Budżety i błędy

Startowe propozycje: connect 1 s, interaktywny deadline engine 8 s / backend 10 s / frontend 12 s, dłuższa operacja 25/28/30 s. PoC 160 km trwa około 7–10 s i bywa wolniejsze; frontend powinien rozróżnić długą operację od edycji krótkiego segmentu. Podane progi trzeba dostroić, nie są spełnionym SLO.

Backend ma **ograniczoną kolejkę i maksymalnie 1–2 aktywne obliczenia**. BRouter MAXTHREADS nie jest bezpieczną kolejką: przy 4 klientach i 2 wątkach potrafi przerwać wcześniejsze żądania (wykazano pomiarem). Nadmiar odrzucać w adapterze przed wysłaniem, kontrolować fairness i budżet użytkownika. Preferować start od 1 aktywnego żądania na współdzielonym VPS; dobrać po pomiarze stanu serwera.

| Błąd domenowy | Proponowany HTTP | Zasada |
|---|---:|---|
| INVALID_COORDINATES / INVALID_PROFILE | 400 | Bez wywołania dostawcy |
| OUT_OF_COVERAGE | 422 | Jawnie brak regionu/kafla; bez pobrania świata on demand |
| NO_ROUTE / SNAP_TOO_FAR | 422 | Zachować geometrię/draft; wskazać fragment |
| ROUTING_BUSY | 429 | Retry-After, ograniczony retry klienta |
| PROVIDER_UNAVAILABLE | 503 | Brak automatycznego przeliczenia |
| PROVIDER_TIMEOUT | 504 | Timeout to nie dowód braku legalnej trasy |
| INVALID_PROVIDER_RESPONSE | 502 | Nie przyjmować uszkodzonego JSON/geometrii |

BRouter używa 400 także dla timeoutów, wysp grafu i przerwania wskutek contention. **Nie mapować każdego 400 na NO_ROUTE.** Rozpoznawać komunikaty na przypiętej wersji w testach kontraktowych, a nierozpoznane odpowiedzi traktować jako błąd dostawcy. Anulowanie HTTP nie gwarantuje zatrzymania obliczenia silnika; potrzebny deadline także w silniku. Brak fallbacku do OSRM samochodowego, brak automatycznego ROAD→GRAVEL/DIRECT. Retry dopiero dla błędów przejściowych w obrębie całościowego deadline, nie w pętli przeciążenia.

Cache: dokładne współrzędne z kolejnością, region i generacja grafu, profil + rewizja + hash, polityka snapu i opcje. Nie zaokrąglać przez barierę. Nie cache'ować czasowych błędów jako braku trasy. Same hashe nie wymagają publikowania prywatnych tras w logach.

## Zapis segmentu i wersjonowanie

Dokument v2: `mode: ROUTED|DIRECT`, niezależnie `travelProfile: ROAD|GRAVEL` dla ROUTED, provenance zaakceptowanego wyniku i geometria jako źródło prawdy. DIRECT nie wykonuje requestu; może zapamiętywać preferencję przyszłego profilu, ale nie udaje obliczonego ROAD. Dla importu GPX/v1 provenance = unknown, bez przypisywania szosy na podstawie kształtu.

Czytnik zachowuje v1, geometrie i istniejące wersje bitowo w ich kontrakcie; nie wykonuje migracji geometrii przez router. Aktualizacja danych/profilu nigdy nie przelicza automatycznie zapisanej wersji. Jawne przeliczenie tworzy nową wersję, stara pozostaje. Zmiany obejmują Java DTO, walidację, serializację editorDefinition, lokalne drafty i undo/redo; nie wystarczy dodać pola w TypeScript.

Token odpowiedzi obejmuje identyfikator/revizję segmentu, mode, profil i waypointy. Zmiana trybu/profilu, undo/redo i usunięcie unieważniają token; AbortController ogranicza pracę, lecz poprawność zapewnia walidacja tokenu. Insert dziedziczy istniejącą geometrię i profil. Delete między różnymi profilami wymaga jawnej polityki, a nie arbitralnego wyboru. Nie zapisywać nieudanego ROUTED jako udanej prostej. Merge korzysta z zapisanej geometrii i zachowuje pochodzenie; jeśli utrzymanie dokumentu v2 jest niemożliwe, jawnie unknown, bez ponownego routingu.

## Regiony i aktualizacja danych

Region registry: bbox/poligon pokrycia, generacja/manifest, zgodność lookup, silnik, dostępne profile, adres prywatny i status zdrowia. Polska to pierwsza konfiguracja, nie stały warunek w domenie. Wyznaczanie między regionami wymaga spójnego snapshotu korytarza na jednym silniku albo jawnego, przetestowanego łączenia; nie sklejać automatycznie różnych dostawców po granicy.

Aktualizacja: pobrać nową generację poza aktywnym katalogiem; budżet dysku na starą+nową; sprawdzić rozmiary/hash/lookup i regresję; uruchomić oddzielny proces, przełączyć atomowo konfigurację dopiero po osobnej decyzji wdrożeniowej. Rollback wraca do starego snapshotu, nigdy nie nadpisuje zapisanych tras. Obecny setup jest instalatorem PoC, nie gotowym aktualizatorem produkcyjnym.

## Kolejny etap

1. Wyjaśnić izolowane punkty Kabat/Wisły i politykę nietagowanych ścieżek, ręcznie zweryfikować fragmenty z flagami oraz końcowy dojazd na Święty Krzyż. Dodać kontrolowane przypadki zakazów skrętu, conditional i barier; obecny test syntetyczny sprawdza tylko mostowy łącznik z zakazem.
2. Naprawić/wybrać sprawdzoną obsługę snapu wszystkich waypointów, dodać testy kontraktowe odpowiedzi i typowania błędów, benchmark kolejki backendowej i limitów.
3. Dodać adapter BRouter za flagą na stagingu bez zmiany domyślnego OSRM ani istniejących tras; testy porównawcze na zapisanym korpusie.
4. Wprowadzić kompatybilny dokument v2, profil segmentu i zabezpieczenia async; potem wybór ROAD/GRAVEL w edytorze oraz osobno DETOUR. Bez przebudowy całego UI.
5. Zmierzyć rzeczywisty zapas zasobów VPS i obciążenie innych usług; dłuższy test na stagingu, aktualizacja/rollback i monitoring. Dopiero odrębne zatwierdzenie produkcyjne może przełączyć backend. Ten etap niczego nie wdraża.
