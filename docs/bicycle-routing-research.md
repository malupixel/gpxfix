# TweakMyRoute — audyt i wybór routingu rowerowego

Data weryfikacji: **15 października 2026**. Zakres: kod lokalnego checkoutu, aktualna dokumentacja i mały eksperyment publicznych API. Nie zmieniono kodu aplikacji, routingu, konfiguracji produkcyjnej ani bazy; nie uruchamiano wdrożenia. Nie sprawdzano przez SSH efektywnego środowiska usług na VPS. Wnioski o domyślnym dostawcy dotyczą konfiguracji repozytorium, a nie potwierdzonej konfiguracji procesu produkcyjnego.

## 1. Najważniejszy wynik

**Obecny adapter używa OSRM z nazwą `cycling` w URL, co nie wybiera rowerowego grafu.** Domyślny host to `https://router.project-osrm.org`. W rzeczywistym eksperymencie Warszawa–Łódź odpowiedzi dla `cycling` i `driving` były identyczne bajt w bajt. Zawierały kroki `mode=driving`, **90,140 km A2 i 16,552 km A1**. To konkretny mechanizm wyjaśniający zgłoszony problem, nie dowód, że sam OSRM nie potrafi wyznaczać tras rowerowych. OSRM wybiera transport przez profil Lua podczas przygotowania danych. [Dokumentacja API OSRM](https://project-osrm.org/docs/v5.24.0/api/), [profile OSRM](https://github.com/Project-OSRM/osrm-backend/blob/master/docs/profiles.md).

Rekomenduję **BRouter z własnymi, wersjonowanymi profilami szosa/gravel jako pierwszy kandydat do dalszej walidacji**, na osobnej małej instancji. Gotowe `fastbike` i `trekking` nie spełniają jeszcze wymagań produktu. Najlepsza alternatywa operacyjna: **GraphHopper Directions API z zatwierdzonymi profilami custom**, jeśli koszt utrzymania i strojenia własnego serwera przewyższy abonament. Nie ma podstaw, aby uznać wyższość jakościową nad GraphHopperem bez jego rzeczywistego testu.

Decyzja do omówienia: czy inwestujemy w pełną kontrolę profili BRoutera, czy kupujemy obsługę danych i dostępność w GraphHopperze. Żaden publiczny serwer demonstracyjny nie jest rekomendowany jako docelowy backend produkcyjny.

## 2. Audyt kodu

### 2.1. Przepływ żądania

```mermaid
sequenceDiagram
    participant U as Użytkownik / MapLibre
    participant E as RouteEditor
    participant A as Spring RoutingController
    participant S as OsrmRoutingService
    participant O as OSRM
    U->>E: dodaj punkt / zakończ przeciąganie / przelicz
    E->>A: POST /api/routing/route {from,to}
    A->>S: route(from,to)
    S->>O: GET /route/v1/cycling/lon,lat;lon,lat
    O-->>S: routes[0].geometry.coordinates
    S-->>E: {coordinates}
    E->>E: routing-success(segmentId,requestVersion)
```

Frontend używa `apiClient` (`credentials: include`); domyślnie żądanie jest same-origin, Next.js przepisuje `/api/*` do backendu. Współrzędne wszędzie w kontrakcie routingu to **[longitude, latitude]**, nie odwrotnie. MapLibre renderuje i obsługuje interakcje, ale nie liczy tras.

Pliki stanowiące podstawę ustaleń (ścieżki względem katalogu głównego):

| Obszar | Plik i istotne zachowanie |
|---|---|
| Konfiguracja | `api/src/main/resources/application.yml`, `app.routing.base-url`, fallback `ROUTING_BASE_URL:https://router.project-osrm.org` |
| HTTP frontend | `web/src/features/route-editor/routing.ts`: interfejs `route(from,to,signal?)`, bez profilu |
| Proxy / fetch | `web/next.config.ts`, `web/src/lib/api-client.ts` |
| HTTP backend | `api/src/main/java/pl/routecommunity/api/routing/RoutingController.java`: dwa punkty, kontrola zakresów i skończoności liczb |
| Adapter | `.../routing/OsrmRoutingService.java`: `overview=full&geometries=geojson`, pierwsza alternatywa, tylko geometria |
| Interfejs backendowy | `.../routing/RoutingService.java`: `List<List<Double>> route(from,to)` — punkt zaczepienia dla nowego adaptera już istnieje |
| Edytor | `web/src/features/route-editor/route-editor.tsx`, `model.ts`, `editor-map.tsx` |
| Zapis | `.../route/CreateDrawnRouteRequest.java`, `RouteService.java`, `RouteVersionCreationService.java` |
| Sugestie | `web/src/features/routes/suggestion-workspace.tsx`, `route-page-content.tsx`, backend `RouteSuggestionService.java` |
| Merge | `.../route/SuggestionMergeService.java`, `DetourMergeHandler.java` |

W `.env`, `.env.example` i `docker-compose.yml` nie znaleziono nadpisania `ROUTING_BASE_URL`. Nie odczytywano ani nie kopiowano sekretów. Systemd może mieć własne nadpisanie; to pozostaje do osobnego sprawdzenia przy późniejszej integracji.

### 2.2. Routing, snap i profile

Nie ma osobnego wywołania OSRM `/nearest` ani `/match`. „Przyciąganie do dróg” to liczenie drogi między dwoma punktami, podczas którego silnik dopasowuje końce do swojego grafu. To nie jest map matching całego GPX.

Osobne znaczenie ma „snap do istniejącej trasy”: `splitSegmentGeometry` i wybór kotwic sugestii projektują kliknięcie na istniejącą polilinię lokalnie w przeglądarce. Takie działanie nie kontaktuje się z dostawcą.

W aplikacji są tryby **ROUTED / DIRECT**, a nie profile szosa/gravel. API nie przyjmuje profilu. OSRM jako silnik obsługuje rower: dostarcza `bicycle.lua`, hierarchię `bicycle > vehicle > access`, nawierzchnie i jazdę/prowadzenie roweru. Odpowiedni graf trzeba jednak zbudować i udostępnić. Zmiana `cycling` na `bike` ani samo `exclude=motorway` na samochodowym grafie nie zapewnią dostępu do dróg tylko dla rowerów. [Źródło profilu bicycle.lua](https://raw.githubusercontent.com/Project-OSRM/osrm-backend/master/profiles/bicycle.lua).

**Bez wymiany silnika**: możliwy własny OSRM z rowerowymi grafami i profilem Lua; dwa warianty najprościej jako osobno przygotowane grafy/usługi. **Bez zmiany obecnej publicznej usługi**: nie da się jej przeprogramować parametrem żądania. Można zmienić host na usługę OSRM z udokumentowanym rowerowym grafem, ale nadal trzeba rozwiązać dwa profile i warunki użycia. FOSSGIS udostępnia osobny routing rowerowy oraz limity publicznego serwera; nie jest to tożsame z obecnym hostem. [Serwer i zasady FOSSGIS](https://routing.openstreetmap.de/about.html).

### 2.3. Waypointy i edycja fragmentów

Edytor przechowuje uporządkowane `points` i `segments` z `fromId/toId`, trybem, geometrią, `intendedGeometry`, statusem i numerem żądania. Każdy segment ROUTED liczy osobnym żądaniem dwóch punktów. Kolejność waypointów jest zachowana; nie ma optymalizacji kolejności ani jednego żądania z całą trasą.

| Operacja | Aktualne zachowanie |
|---|---|
| Dodanie / przedłużenie początku | Powstaje jeden segment; ROUTED wywołuje API, DIRECT rysuje prostą |
| Przeciąganie | `drag` zmienia lokalny podgląd; API dopiero na `dragend`; przelicza maksymalnie dwóch sąsiadów ROUTED |
| Wstawienie punktu na odcinku | Podział istniejącej geometrii bez zapytania do API, zachowanie kształtu |
| Usunięcie punktu wewnętrznego | Łączy sąsiadów; ROUTED wygrywa nad DIRECT i zleca przeliczenie nowego odcinka |
| Zmiana trybu / retry | DIRECT zastępuje odcinek prostą; ROUTED / retry liczy ten odcinek |
| Undo / redo | Historia całego dokumentu, ograniczona do 100 operacji; odpowiedzi async osobno aktualizują stan |
| Błąd | Pozostawia geometrię/podgląd, oznacza odcinek `failed`; nie ma fallbacku samochodowego w kodzie |
| Odczyt GPX | `documentFromGeometry` zachowuje wszystkie wierzchołki, tworząc około 100 segmentów; brak automatycznego routingu przy otwarciu |

`requestVersion` chroni przed starszą odpowiedzią po rozpoczęciu nowszego żądania dla tego samego segmentu. Nie rozwiązuje wszystkich wyścigów: zmiana ROUTED→DIRECT w trakcie żądania nie unieważnia go; odpowiedź może zmienić geometrię segmentu DIRECT. Undo/redo i przywrócenie segmentu również wymagają testów z odpowiedziami async. `signal` istnieje w adapterze frontendowym, ale `routeSegment` nie przekazuje AbortControllera.

### 2.4. Czy ten sam routing obsługuje sugestie?

**Rysowanie nowej trasy i edycja właściciela: tak**, to ten sam `RouteEditor` i `apiRoutingService`.

**Sugestie DETOUR: nie.** `detourCoordinates` składa `[kotwica start, ...kliknięte waypointy, kotwica koniec]` jako łamaną. `suggestionRequest` wysyła ją w `proposedGeometry`. Backend sprawdza geometrię i zgodność końców z kotwicami, a merge wkleja zapisany fragment. PROBLEM i NOTE nie wyznaczają drogi. Wprowadzenie wspólnego routingu sugestii będzie osobnym rozszerzeniem tego przepływu, a nie samą podmianą adaptera.

Zapis narysowanej trasy/edycji składa geometrie segmentów; backend nie liczy ich ponownie. GPX, wersjonowanie i merge pracują na zapisanej geometrii. Merge tworzy nową wersję `SUGGESTION_MERGE`, obecnie z `sourceType=GPX` i `editorDefinition=null`: po merge punkty kontrolne są odtwarzane z geometrii, a nie zachowywane ze starego dokumentu.

### 2.5. Ograniczenia dla wymiany silnika

1. Kontrakt dwóch punktów zwracający tylko tablicę nie przenosi profilu, odległości snapu, ostrzeżeń, metryk, odcinków prowadzenia roweru ani wersji danych.
2. Backend usuwa `waypoints`, `legs`, dystans i metadane OSRM. Trudno wykryć zły profil lub duży snap.
3. Reducer **nadpisuje pierwszy i ostatni wierzchołek odpowiedzi surowymi kliknięciami**. Nie wstawia jawnych łączników do snapu, lecz przesuwa końce polilinii. Może powstać odcinek przez przeszkodę. Odpowiedź o <2 punktach zamienia na prostą i uznaje za sukces. To ryzyko niezależne od silnika.
4. Brak jawnych timeoutów adaptera, budżetu całej operacji, limitu współbieżności, cache i rozróżnienia `NoRoute`, niedostępności, limitu API. Wyjątki najczęściej kończą jako 502.
5. Niezależne pary waypointów nie przenoszą kierunku wjazdu/wyjazdu: możliwe nawroty i różne snapy wspólnego punktu na równoległych jezdniach.
6. Dokument ma wersję **1**, backend wymaga `version==1`; rekord `Segment` nie ma profilu. Dodanie pola tylko na froncie nie zapewni jego zachowania przy zapisie przez Java DTO. Draft lokalny również potrzebuje zgodności.
7. Limity zapisu: 10 000 punktów kontrolnych i 20 000 wierzchołków na segment. Pełna geometria długiej trasy może osiągnąć limit; nie usuwać wierzchołków bez tolerancji błędu i testów.
8. Zapis jest blokowany podczas `routing`, ale nie przy `failed`. Nowy nieudany segment może pozostać prostą w trybie ROUTED. Przed integracją ustalić jawne zaakceptowanie niezroutowanego fragmentu albo blokadę zapisu.
9. Reguła „ROUTED wygrywa” przy scaleniu sąsiadów nie określa, co zrobić przy dwóch różnych profilach. Nie można arbitralnie wybrać jednego.

## 3. Porównanie rozwiązań

Oceny jakościowe poniżej to ocena możliwości i dopasowania, nie ranking zmierzonej jakości. Rzeczywiste pomiary wykonano tylko dla obecnego publicznego OSRM i BRoutera. Wszystkie silniki zależą od kompletności OSM; klasa drogi, `maxspeed` i infrastruktura są przybliżeniem ruchliwości, nie pomiarem natężenia ruchu.

### 3.1. Profile, nawierzchnie i ograniczenia

| Rozwiązanie | Szosa / gravel i OSM | Spokojne drogi i legalność | Dopasowanie |
|---|---|---|---|
| **GraphHopper self-hosted** | `racingbike`, `bike`, `mtb` jako bazy; custom models z `surface`, `smoothness`, `road_class`, `track_type`, `mtb_rating`, siecią rowerową po dodaniu wymaganych encoded values | Jawna polityka kar/wykluczeń; bazować na bike access, nie car access; zakazy skrętów rowerowych wymagają właściwej konfiguracji turn costs | Duża kontrola, dobre narzędzia diagnostyczne; gravel trzeba zdefiniować, `mtb` nie jest jego zamiennikiem |
| **GraphHopper API** | Profile rowerowe i custom models/custom profiles; dostępność konkretnego modelu i wartości zależy od oferty/endpointu | Można penalizować klasy/nawierzchnie; nie zakładać, że plan Free obejmuje potrzebne customizacje | Najprostsze operacyjnie; trzeba zweryfikować dostęp do modeli przed zakupem |
| **Valhalla** | `costing=bicycle`, `bicycle_type=road` lub `cross`; `avoid_bad_surfaces`, `use_roads`, `use_hills`; powierzchnie przetwarzane do kategorii grafu | Wbudowane preferencje infrastruktury i dróg o niższej prędkości; rowerowy dostęp. `use_roads` nie znaczy „preferuj asfalt” | Dobre parametry runtime; ścisłe własne reguły MTB/tagów mogą wymagać zmiany importerów/C++ |
| **BRouter** | Profile `.brf`; pełna kontrola funkcji kosztu na tagach zachowanych w RD5. `fastbike` i `trekking` to punkty startowe | Możliwe preferencje `estimated_traffic_class`, lokalnych dróg i sieci rowerowej; trzeba oddzielić jazdę od prowadzenia | Najbardziej bezpośrednio nastawiony na rower i strojenie; wymaga właściciela profili i regresji |
| **OSRM obecny host** | W zmierzonym wywołaniu graf samochodowy; brak rzeczywistego przełączenia na rower | Test potwierdził A2/A1; nie spełnia podstawowego wymagania | Odrzucić jako routing rowerowy w obecnej konfiguracji |
| **OSRM z własnym bicycle.lua** | Nawierzchnie, klasy, dostęp w Lua przy imporcie; osobne warianty danych dla szosy/gravel | Możliwa modyfikacja kosztów i wykluczeń; sprawdzić tryby pchania roweru i metric `duration` vs `cyclability` | Najmniej zmian protokołu; więcej prac przy grafach i mała elastyczność runtime |
| **openrouteservice (ORS)** | `cycling-road`, `cycling-regular`, `cycling-mountain`, surface/waytype i opcje profilu | Baza rowerowa, preferencje i ograniczenia; brak prostego utożsamienia regular z docelowym gravel | Sensowna dodatkowa alternatywa, zwłaszcza bez budowy własnego grafu; zakres customizacji API mniejszy niż własnych profili |

Podstawy techniczne: [profile i CH/LM GraphHoppera](https://raw.githubusercontent.com/graphhopper/graphhopper/master/docs/core/profiles.md), [custom models](https://raw.githubusercontent.com/graphhopper/graphhopper/master/docs/core/custom-models.md), [aktualny przykład konfiguracji](https://raw.githubusercontent.com/graphhopper/graphhopper/master/config-example.yml), [Directions API](https://docs.graphhopper.com/openapi), [Valhalla bicycle options](https://raw.githubusercontent.com/valhalla/valhalla/master/docs/docs/api/route/api-reference.md), [implementacja bicycle costing](https://github.com/valhalla/valhalla/blob/master/src/sif/bicyclecost.cc), [profile BRoutera](https://brouter.de/brouter/costfunctions.html), [filtry OSM ORS](https://giscience.github.io/openrouteservice/technical-details/tag-filtering), [opcje ORS](https://giscience.github.io/openrouteservice/api-reference/endpoints/directions/routing-options).

**Ważne rozróżnienia:**

- `bicycle=no` może dopuszczać przejście pieszo. Wynik z takim tagiem nie może być prezentowany jako ciągła jazda; produkt powinien go odrzucić lub jawnie oznaczyć prowadzenie roweru, zależnie od ustalonej polityki.
- W BRouterze gotowe profile potrafią przyznać skończoną karę zamiast twardego wykluczenia dla prowadzenia roweru, ograniczeń dostępu lub wyjątków związanych z siecią rowerową. Nie wystarczy nazwać profilu „szosa”. [fastbike.brf](https://raw.githubusercontent.com/abrensch/brouter/master/misc/profiles2/fastbike.brf), [trekking.brf](https://raw.githubusercontent.com/abrensch/brouter/master/misc/profiles2/trekking.brf).
- `surface` bez wartości i `surface=unknown` muszą pozostać „nieznane”. Nie traktować jako asfalt. `paved`, kostka i `sett` również nie oznaczają gładkiego asfaltu.
- Dostęp, bariery, dozwolony kierunek i trudność są ważniejsze od preferencji. Dopuszczenie `motor_vehicle=no,bicycle=yes` jest wymagane. Regionalne i czasowe ograniczenia nie są jednolicie obsługiwane przez wszystkie importery; testować na przypiętej wersji. Nie obiecywać pełnego odwzorowania wszystkich przepisów przez samą mapę.

### 3.2. Waypointy, dystans i integracja

| Rozwiązanie | Waypointy | 100–300 km i dłuższe | Trudność integracji z tym repo |
|---|---|---|---|
| GraphHopper self-hosted | Uporządkowane punkty i odcinki; limity konfigurowalne | CH bardzo szybkie dla stałych profili; LM kompromis elastyczności; flexible potrzebuje limitów czasu/węzłów | Średnia: adapter JSON, path details; osobna usługa JVM |
| GraphHopper API | Limity planu: Free 5, Basic 30, Standard 80, Premium 200 lokalizacji/żądanie | Zewnętrzna infrastruktura; brak lokalnego benchmarku, uzgodnić dystanse i tryb custom | Mała/średnia: HTTP, klucz tylko backend, limity kredytów i kolejkowanie |
| Valhalla | `break/through/via/break_through`; kontrola nawrotów i legs | Limity dystansu/liczby lokalizacji w serwerze; długie bicycle trzeba zmierzyć, nie ekstrapolować wydajności auto | Średnia: JSON lon/lat, dekodowanie shape (często polyline6), costing i błędy |
| BRouter | Lista `lonlats`, via/nogo; wyłączyć samoczynne pomijanie źle umieszczonych via | Eksperyment 136–145 km działa; koszt zależy od terenu, profilu, heap i współbieżności; 300+ km jeszcze nie zmierzono | Mała/średnia: FeatureCollection, wysokość w trzeciej składowej, profile, kontrola snapu |
| OSRM | Wiele punktów i legs; produkt obecnie wysyła tylko dwa | CH/MLD szybkie na przygotowanych danych; dwa profile zwiększają koszt grafów | Najmniejsza przy pozostaniu przy OSRM; wysiłek w danych i profilach |
| ORS API / self-hosted | Publiczne API: do 50 waypointów | Publiczny limit cycling 6000 km; alternatywy/round trip 100 km, avoid areas 150 km — inne niż zwykły route | Mała/średnia; HTTP, API key i extra info; własna instancja JVM cięższa operacyjnie |

Limity API: [GraphHopper pricing](https://www.graphhopper.com/pricing/), [ORS restrictions](https://openrouteservice.org/restrictions/). Limity nie są gwarancją opóźnienia. Dla wielu waypointów można zachować obecną edycję parami, a później grupować zgodne profile; uwzględnić, że para niezależnych zapytań może dać inną trasę niż jedno żądanie z `through`.

### 3.3. Hosting, infrastruktura i aktualizacja OSM

Poniższe liczby to **autorskie budżety startowe do próby dla Polski z buforem przy granicach, dwóch profili i małego ruchu**, nie wymagania producentów ani wyniki benchmarku. Obejmują sam routing, bez Springa/Next/PostgreSQL. Dane Europy/świata mogą wymagać wielokrotnie więcej. Przed doborem VPS zmierzyć RSS, cache OS, peak importu, rozmiar danych i p95 pod obciążeniem.

| Usługa | Serwowanie: RAM / vCPU / SSD | Przygotowanie / aktualizacja |
|---|---|---|
| BRouter z gotowymi RD5 | 2–4 GB / 2 / rezerwa 10–20 GB | Pobieranie potrzebnych kafli 5×5° i zgodnego `lookups.dat`; budżet dysku na dwie generacje. Brak lokalnego importu PBF. Własna budowa RD5 wymaga osobnego pomiaru i większej maszyny |
| GraphHopper własny | 4–8 GB / 2–4 / 20–40 GB | Osobny builder orientacyjnie 8–16 GB / 4–8 vCPU; import PBF + CH/LM dla profili; przestrzeń na stary/nowy graf i PBF |
| Valhalla własna | 4–8 GB / 2–4 / 20–40 GB | Builder orientacyjnie 8–16 GB / 4–8 vCPU; tiles + opcjonalne dane wysokości; weryfikacja spójności i przełączenie generacji |
| OSRM, dwa grafy | 4–8 GB / 2–4 / 20–40 GB | Builder orientacyjnie 8–16 GB / 4–8 vCPU; extract + partition/customize MLD lub contract CH dla wariantów |
| ORS własny | 4–8 GB / 2–4 / 20–40 GB | Builder orientacyjnie 8–16 GB / 4–8 vCPU; koszt rośnie z liczbą profili i extra info |
| GraphHopper / ORS API | Brak lokalnego grafu; niewielki dodatkowy koszt proxy/cache | Aktualizacje po stronie operatora; bez własnego importu i dodatkowego PostGIS |

Nie da się z dokumentacji rzetelnie podać uniwersalnego minimum RAM dla Polski. Dokumentacja GraphHoppera rozdziela pamięć importu i serwowania, ORS opisuje zależność od obszaru i profili, a domyślne 128 MB heap / 1 wątek w przykładowym kontenerze BRoutera nie jest rekomendacją produkcyjną dla równoczesnych długich tras. [Deploy GraphHopper](https://github.com/graphhopper/graphhopper/blob/master/docs/core/deploy.md), [system requirements ORS](https://giscience.github.io/openrouteservice/run-instance/system-requirements), [README BRoutera](https://raw.githubusercontent.com/abrensch/brouter/master/README.md), [architektura Valhalli](https://github.com/valhalla/valhalla).

Koszt aktualizacji to transfer, CPU buildera, podwójny dysk, testy i czas operatora, nie tylko pobranie OSM. Dla BRoutera najtańszy wariant to gotowe RD5 publikowane tygodniowo. Profile działają na zachowanych tagach; dodanie nowego tagu może wymagać przebudowy danych, nie tylko edycji `.brf`. `processUnusedTags=false` może pomijać tagi w diagnostyce odpowiedzi. [Format danych i profilowanie BRoutera](https://github.com/abrensch/brouter/blob/master/docs/developers/profile_developers_guide.md).

Proponowany cykl self-hosted: pobranie/build do osobnego katalogu, zapis daty OSM/hash profili/wersji silnika, testy sentinel i kompletności kafli, atomowa zmiana generacji, restart wyłącznie routera jeśli wymagany, możliwość cofnięcia. Nie podmieniać plików odczytywanych przez aktywne zapytania. Dla małej instalacji aktualizacja tygodniowa; importerów nie uruchamiać na VPS aplikacji w godzinach ruchu. Przy GraphHopper API operator deklaruje aktualizacje OSM co najmniej raz w tygodniu. [Warunki planów](https://www.graphhopper.com/pricing/).

### 3.4. Koszt API i licencje

Odczytany cennik GraphHoppera w EUR pokazuje Free 0, Basic **69 €/mies.**, Standard **199 €/mies.**, Premium **479 €/mies.**; odpowiednio 500 / 5000 / 15 000 / 50 000 kredytów dziennie. Free jest wyłącznie niekomercyjny, ma ograniczone profile i brak flexible mode. Wybór okresu rozliczeń i VAT sprawdzić w ofercie przed zakupem. Limity Basic/Standard/Premium to 1/2/10 req/s oraz 100/400/1000 kredytów/min. [Cennik i przypisy](https://www.graphhopper.com/pricing/).

Zwykły route z 2–10 punktami kosztuje 1 kredyt; >10 punktów: liczba punktów / 10. Alternatywy i round trip 2 kredyty. Edycja z 30 pojedynczymi przeliczeniami i 10 przesunięciami dwóch sąsiadów to około **50 kredytów**, nie jeden „zapis trasy”. Przykładowe 100 takich sesji/dzień zużywa 5000 kredytów przed retry i sugestiami, a równoległe pary już mogą przekroczyć 1 req/s Basic. [Definicja kredytów](https://www.graphhopper.com/faq/what-is-one-credit/).

ORS ma bezpłatny klucz Standard. Oficjalna strona planów przekierowuje do HeiGIT; aktualna strona informacyjna jest renderowana dynamicznie. Oficjalna wersja staging nadal podaje 2000 Directions/dzień i 40/min; traktować te wartości jako orientacyjne do potwierdzenia w panelu konta, nie gwarantowany aktualny plan. [HeiGIT API](https://api.heigit.org/), [plany](https://account.heigit.org/info/plans), [oficjalny staging planów](https://staging.openrouteservice.org/plans/). Nie ma potrzeby zakładać obowiązkowego płatnego API, ale brak opłat nie oznacza SLA ani nieograniczonego ruchu.

| Oprogramowanie | Licencja silnika / warunki |
|---|---|
| GraphHopper OSS | Apache-2.0; oddzielnie komercyjne warunki Directions API. [Licencja](https://raw.githubusercontent.com/graphhopper/graphhopper/master/LICENSE.txt) |
| Valhalla | MIT; projekt OSS nie ma jednego abonamentu za usługę hostowaną, oferta zewnętrznego operatora wymaga osobnej wyceny. [Repozytorium](https://github.com/valhalla/valhalla) |
| BRouter | MIT; publiczne demo bez przyjętego tutaj SLA i bez zakładania prawa do nieograniczonego ruchu. [Licencja](https://github.com/abrensch/brouter/blob/master/LICENSE) |
| OSRM | BSD-2-Clause; publiczny endpoint nie zapewnia własnych profili ani umownego SLA. [Licencja](https://raw.githubusercontent.com/Project-OSRM/osrm-backend/master/LICENSE.TXT) |
| ORS | Repozytorium zawiera GPL-3.0/LGPL-3.0; sprawdzić komponent i przypięte wydanie przy dystrybucji, osobno warunki publicznej usługi. [Repozytorium i licencje](https://github.com/GIScience/openrouteservice) |

Dane OSM mają ODbL i wymagają odpowiedniej atrybucji; licencja silnika nie zastępuje warunków danych, RD5 ani użytej usługi. API-key pozostaje w backendzie. [Prawa do OSM](https://www.openstreetmap.org/copyright).

Budżet porównawczy, **bez oferty handlowej**: na mały dedykowany router założyć 10–30 €/mies., a na utrzymanie początkowo 1–3 h/mies. Przy wewnętrznej stawce 50 €/h daje to 60–180 €/mies., czyli API za 69 € może być tańsze całkowicie. Te liczby są założeniem ekonomicznym, nie zweryfikowanym cennikiem VPS. Nie znamy obecnego ruchu ani wolnych zasobów produkcji; nie rekomenduję współdzielenia RAM „w ciemno”.

## 4. Odizolowany proof of concept — rzeczywiste wyniki

### 4.1. Reprodukcja i zakres

Eksperyment nie importuje aplikacji, nie używa kluczy ani DB. `docs/routing-poc/compare.py` wykonuje 8 zapytań BRoutera (4 pary punktów × 2 profile) i 2 kontrolne OSRM dla Warszawa–Łódź. Zapytania sekwencyjne, przerwa ≥1,1 s, timeout 45 s, bez retry. Pomiary HTTP pochodzą z **2026-10-15 09:28:27–09:28:44 UTC**. Wszystkie 10 zakończyło się HTTP 200. BRouter zgłasza `BRouter-1.7.10`; wersji profilu i daty OSM publiczna odpowiedź nie poświadcza.

Artefakty:

- [Surowe odpowiedzi i summary.json](routing-poc/results/20261015T092827Z/summary.json) — URL, punkty, czas, hash SHA-256, status i metryki.
- [Porównanie geometrii offline](routing-poc/results/20261015T092827Z/comparison.html) — przełączanie warstw, północ u góry; szkic bez podkładu.
- [Wszystkie geometrie GeoJSON](routing-poc/results/20261015T092827Z/routes.geojson) — do otwarcia w QGIS i kontroli na podkładzie OSM.
- [Skrypt pobierający](routing-poc/compare.py) i [generator metryk/podglądu](routing-poc/render.py).

```bash
# Tylko gdy chcemy ponowić niewielki eksperyment publicznych API:
python3 docs/routing-poc/compare.py --run
# Offline, bez nowych zapytań; podać katalog wybranego przebiegu:
python3 docs/routing-poc/render.py docs/routing-poc/results/20261015T092827Z
```

Pierwszy przebieg `20261015T092220Z` zachowuje błędy DNS sandboxa i **nie jest pomiarem silników**. Udany przebieg wykonano po dopuszczeniu połączeń sieciowych. Każdy przebieg ma osobny katalog, więc stary plik nie może udawać nowej odpowiedzi.

Wybrane punkty to jawne próbki, nie geokodowane automatycznie centra ani ustalone przez użytkownika kotwice:

| Przypadek | Start [lon,lat] | Koniec [lon,lat] |
|---|---|---|
| Warszawa → Łódź | [21.0122,52.2297] | [19.4560,51.7592] |
| Warszawa → Góra Kalwaria | [21.0122,52.2297] | [21.2156,51.9760] |
| Bodzentyn → okolice Świętego Krzyża | [20.9576,50.9415] | [21.0525,50.8586] |
| Krótki wariant w rejonie Lasu Kabackiego | [21.0585,52.1102] | [21.0910,52.1000] |

Nazwy testowych profili: **fastbike = kandydat szosa**, **trekking = kandydat gravel**. To nie są docelowe profile TweakMyRoute. Nie testowano GraphHopper API (brak przekazanego klucza), Valhalli, ORS ani własnego serwera. Nie budowano grafu Polski ani nie uruchamiano benchmarku 300+ km. Dzięki temu eksperyment jest mały, ale nie stanowi pełnego porównania jakości wszystkich dostawców.

### 4.2. Dystans i nawierzchnia

Metryki nawierzchni to suma kolumny `Distance` dla `WayTags` w odpowiedzi BRoutera, nie osobna inspekcja OSM. Dla każdego wyniku suma kategorii zgadza się z `track-length`. „Utwardzone” obejmuje asfalt, `paved`, beton, kostkę i `sett`. „Inne” obejmuje np. `compacted`, gravel, ground, dirt, wood i pebblestone. `surface=unknown` i brak tagu są nieznane. Kategorie są uproszczeniem diagnostycznym, nie oceną jakości dla szosy.

| Trasa | Profil | Dystans km | Utwardzone km | Inne znane km | Nieznane km | HTTP s |
|---|---|---:|---:|---:|---:|---:|
| Warszawa–Łódź | fastbike | 136,367 | 134,772 | 0,000 | 1,595 | 2,016 |
| Warszawa–Łódź | trekking | 145,077 | 112,192 | 6,799 | 26,086 | 2,175 |
| Warszawa–Góra Kalwaria | fastbike | 33,842 | 33,324 | 0,000 | 0,518 | 0,852 |
| Warszawa–Góra Kalwaria | trekking | 35,716 | 32,753 | 1,554 | 1,409 | 0,682 |
| Bodzentyn–Święty Krzyż | fastbike | 26,286 | 26,227 | 0,010 | 0,049 | 0,500 |
| Bodzentyn–Święty Krzyż | trekking | 17,221 | 13,740 | 1,337 | 2,144 | 0,170 |
| Las Kabacki | fastbike | 3,985 | 3,065 | 0,465 | 0,455 | 0,146 |
| Las Kabacki | trekking | 4,256 | 1,209 | 3,047 | 0,000 | 0,129 |

Czas HTTP to pojedynczy czas end-to-end z tego środowiska, obejmuje sieć i ewentualny cache serwera. Nie jest czasem CPU silnika ani p95 i nie uzasadnia obietnicy wydajności produkcyjnej.

### 4.3. Ocena poszczególnych przypadków

**Warszawa–Łódź.** Gravel/trekking jest dłuższy o 8,710 km (+6,4%). Suma primary/secondary spada z 30,900 do 13,184 km, a `highway=cycleway` rośnie z 4,428 do 27,513 km. To mierzalna zmiana zachowania, ale klasa drogi nie dowodzi ruchliwości. Nieznana nawierzchnia obejmuje około 18% trekkingu. W tagach jest **54 m `bicycle=dismount` i 5 m `bicycle=no`**; brak oznaczenia prowadzenia roweru w produkcie byłby niedopuszczalny. Nie ustalono, czy te konkretne przejścia dopuszczają prowadzenie roweru. W fastbike nie wykryto tych flag w zwróconych tagach. Oba BRoutery mają 0 m motorway/trunk w analizowanych danych; OSRM ma 136,045 km, w tym wymienione wyżej A2/A1 i identyczne odpowiedzi obu nazw profilu.

**Warszawa–Góra Kalwaria.** Trekking dodaje 1,874 km (+5,5%), zmniejsza primary/secondary **23,381 → 2,379 km** i zwiększa cycleway **2,297 → 9,303 km**. Fastbike ma około 69% trasy po primary/secondary mimo preferencji produktu dotyczącej spokoju. Wniosek: mocniej stroić kary ruchliwych dróg w profilu szosowym; nie kopiować gotowego fastbike bez zmian. Nie wykryto flag motorway/trunk, `bicycle=no/private/dismount` ani `access=no/private` w zwróconych tagach. To kontrola flag, a nie pełny audyt legalności.

**Bodzentyn–okolice Świętego Krzyża.** Różnica 9,065 km: szosa 26,286 km, trekking 17,221 km. Szosa niemal cała po znanej nawierzchni utwardzonej, trekking zawiera 1,027 km ground, 0,310 km pebblestone i 2,144 km nieznanych nawierzchni. To może być uzasadniona różnica warunków, ale **nie potwierdzono**, że dłuższa droga jest zbędnym objazdem ani że krótsza jest łatwa technicznie i dostępna na całej długości. Brak flag nie rozstrzyga ruchu w parku. Opublikowany dokument ŚPN wskazuje dopuszczenie rowerów na odcinku Huta Szklana–Święty Krzyż; nie oznacza to dopuszczenia wszystkich leśnych skrótów. Pełny przebieg trzeba skonfrontować z aktualnym udostępnieniem parku i identyfikatorami dróg. [Dokument ŚPN, załącznik o szlakach](https://swpn.gov.pl/uploads/files/6825a15a75643820469614.pdf).

**Krótki odcinek przy Lesie Kabackim.** Fastbike zawiera 3,065 km asfaltu, ale również **312 m dirt, 145 m ground, 8 m fine_gravel** i 455 m bez nawierzchni. Nie spełnia ścisłej szosy. Trekking ma 493 m gravel, 2,113 km dirt, 441 m ground i 1,209 km asfaltu/betonu; jest o 271 m dłuższy. Próbka pokazuje rzeczywistą alternatywę asfalt–drogi nieutwardzone/szuter, lecz nie jest czystym testem dwóch równoległych dróg wyłącznie asfalt vs gravel. Do akceptacji należy dodać ręcznie sprawdzony taki przypadek i opcjonalny pośredni waypoint wymuszający ten sam korytarz. Sam `ground` nie mówi, czy przejazd jest łatwy po deszczu.

**Lasy i trudność MTB:** w krótkim przypadku suma track/path/footway/bridleway wynosi 0,908 km fastbike i 3,137 km trekking, ale nie zmierzono procentu przebiegu w poligonach `landuse=forest/natural=wood`. Nie wykonano przecięcia z pokryciem terenu ani oględzin techniczności. Brak `mtb:scale` w odpowiedzi nie oznacza skali 0: domyślne profile mogą nie eksportować nieużywanych tagów. Te elementy pozostają jawnie do wykonania na przypiętych danych z pełniejszą diagnostyką.

Nie nazywam żadnej trasy w pełni legalną ani najlepiej dobraną na podstawie braku kilku flag. Pomiary nie obejmują znaków w terenie, prac drogowych ani wszystkich ograniczeń czasowych. Publiczne odpowiedzi są materiałem porównawczym, nie wynikiem certyfikacji.

## 5. Propozycja architektury — bez implementacji na tym etapie

### 5.1. Kontrakt niezależny od silnika

Rozszerzyć istniejący backendowy interfejs do modelu domenowego, np.:

```java
interface RoutingProvider {
    RoutingCapabilities capabilities();
    RoutingResult route(RoutingRequest request);
}
// RoutingRequest: requestId, ordered waypoints, profileId, preferences,
//                snap policy, deadline, optional incoming/outgoing headings
// RoutingResult: legs, geometry [lon,lat], distanceMeters, snappedWaypoints,
//               warnings, provider, engineVersion, profileRevision, dataVersion
```

Spring `RoutingService` staje się orkiestratorem: walidacja, mapowanie `ROAD`/`GRAVEL` na wersjonowany profil dostawcy, timeout, limit współbieżności, cache i normalizacja błędów. Adaptery `BRouterProvider`, `GraphHopperProvider`, ewentualnie `ValhallaProvider` pozostają wewnątrz backendu. Konfiguracja wybiera implementację; frontend nie zna URL ani parametrów silnika. Nie pozwalać klientowi podawać dowolnego hosta czy nazwy pliku profilu.

Nowy endpoint / wersja kontraktu przyjmuje uporządkowane waypointy i jeden profil na żądanie. Odpowiedź ma legs mapowane na identyfikatory segmentów; na start można nadal wysyłać parę punktów, aby zachować obecny model edytora. Jedno żądanie batch nie może przemilczeć częściowego niepowodzenia.

Walidować odpowiedź: ≥2 skończone punkty, zakresy WGS84, dystans i maksymalny rozmiar, ciągłość legs, snap w dopuszczalnym promieniu, zgodny profil oraz brak cichej zmiany trybu. Tolerancja snapu np. 30–50 m w mieście jest propozycją do testu, nie uniwersalną stałą. Trzecia składowa BRoutera/wysokość i polyline6 Valhalli są normalizowane w adapterze. Brak informacji o nawierzchni to „unknown”, nie brak ostrzeżeń.

### 5.2. Profil całej trasy czy fragmentu?

**Domyślny profil dokumentu + jawny profil na segmencie.** Zmiana domyślnego profilu wpływa na przyszłe segmenty. Zmiana istniejącej geometrii wymaga wybrania fragmentu lub „Przelicz całość”, podglądu i zatwierdzenia. Ustawienie profilu nie może samo przeorać importowanego GPX.

Przy utworzeniu segmentu zapisać efektywny profil, aby późniejsza zmiana defaultu nie wpływała na retry. Stare segmenty otrzymują oznaczenie `legacy/unknown` dla pochodzenia i zachowują geometrię; nie przypisywać im retrospektywnie sprawdzonego profilu szosowego. Pierwsze jawne przeliczenie wymaga aktualnego profilu użytkownika.

Podział segmentu dziedziczy profil i geometrię bez routingu. Przesunięcie liczy sąsiadów zgodnie z ich profilami. Usunięcie granicy ROAD/GRAVEL wymaga jawnego wyboru profilu dla powstałego odcinka albo zachowania tej granicy jako punktu technicznego. DIRECT jest niezależnym trybem, nie profilem; nadal omija router.

### 5.3. Geometria, snap i historia

Rozdzielić pozycję kliknięcia od `snappedCoordinate`. Kontrolny punkt zachowuje stabilny identyfikator; interfejs pokazuje przesunięcie lub jawny łącznik. Nie nadpisywać końców geometrii bez kontroli. Dla kotwic sugestii na oryginalnej trasie zachować wymaganą zgodność, a nie przesuwać ich arbitralnie do sieci. Nadmierny lub nielegalny łącznik powinien kończyć się komunikatem, nie dopisaniem prostej.

Wersja dokumentu edytora 2 może dodać `defaultProfile`, `segment.profileId`, `routingProvenance`, ostrzeżenia oraz odrębne koordynaty snapu. Czytnik przyjmuje v1 i v2; nowe pola zapisują frontend i Java DTO. To propozycja późniejszej ewolucji JSON; **w tym etapie żadnej migracji nie wykonano**. Sprawdzić, czy przechowywany typ JSON/tekst wystarcza, zanim w ogóle zaplanuje się migrację SQL.

Wersja trasy przechowuje zaakceptowaną geometrię jako źródło prawdy. Otwarcie, eksport GPX, podgląd wersji i merge nie wywołują routera. Odpowiedź routingu wchodzi wyłącznie do lokalnego draftu; dopiero świadomy zapis tworzy wersję istniejącym pipeline'em. Profil/revision/dataVersion służą audytowi; zmiana danych nie zmienia historii.

Dodać generację dokumentu oraz token rewizji segmentu unieważniany przez move, mode, profile, remove, undo/redo i unmount. Akceptować wynik tylko przy zgodnym tokenie, punktach i profilu. AbortController oszczędza zapytania, ale prawidłowość gwarantuje sprawdzanie tokenów. Uzgodnić, że undo/redo odtwarza zaakceptowaną geometrię i nie zamawia nowej. Nie dopuszczać zapisu nierozstrzygniętego routingu pod etykietą poprawnie zroutowanego odcinka.

### 5.4. Sugestie i merge

Udostępnić w tworzeniu DETOUR ten sam klient domenowy routingu i wybór DIRECT/ROAD/GRAVEL. Kotwice na trasie bazowej pozostają stałe. Preview sugestii jest wyliczony raz, a po wysłaniu zapisany jako `proposedGeometry` i ewentualne metadane. Merge używa tej geometrii, nie odtwarza trasy przez dostawcę. Zachować obecne blokady wersji, walidację kotwic i zasady rebase.

Jeżeli chcemy utrzymywać profile po merge, nowy dokument musi złożyć punkty/metadane prefix + detour + suffix ze stabilnym mapowaniem. Przy braku takiego mapowania bezpieczniej zachować finalną geometrię i jawne pochodzenie „nieznane” niż wymyślać profile. Obecny merge już porzuca editorDefinition; naprawa tej straty jest osobną częścią integracji.

### 5.5. Błędy, timeouty i brak fallbacku samochodowego

Proponowane wartości startowe: connect 2 s, całkowity deadline interaktywnego odcinka 12 s, długiej operacji 30 s. Timeout engine < timeout Spring < timeout proxy/frontend; sprawdzić konfigurację Next/reverse proxy podczas implementacji. Anulowanie UI nie zawsze zatrzymuje pracę zdalnego API, dlatego potrzebne są również limity serwera i debouncing.

| Kod domenowy | HTTP | Zachowanie |
|---|---|---|
| INVALID_COORDINATES / INVALID_PROFILE | 400 | Popraw dane, brak zmiany geometrii |
| OUT_OF_COVERAGE / NO_ROUTE / SNAP_TOO_FAR | 422 | Pokaż konkretny punkt/fragment i możliwość przesunięcia |
| RATE_LIMITED | 429 | Retry-After; zachowaj draft |
| PROVIDER_UNAVAILABLE | 503 | Zachowaj geometrię i błąd fragmentu |
| PROVIDER_TIMEOUT | 504 | Bez uznawania prostej za sukces |
| INVALID_PROVIDER_RESPONSE | 502 | Brak akceptacji uszkodzonej geometrii |

Brak fallbacku na samochód i brak automatycznego przełączenia ROAD→GRAVEL/DIRECT. Ewentualny drugi dostawca tylko przy jawnie zdefiniowanym równoważnym profilu i zapisanej informacji o pochodzeniu. Początkowo rekomenduję błąd i ręczne retry, co daje bardziej przewidywalne wyniki.

Cache kluczowany dokładnymi waypointami, profileRevision, preferencjami i generacją danych; ostrożnie z zaokrąglaniem po obu stronach bariery. Ograniczyć współbieżność do zmierzonego budżetu, łączyć identyczne żądania, mierzyć błędy i latency. Nie logować kluczy ani pełnych prywatnych tras bez potrzeby. Informacja o możliwościach dostawcy pozwala później dodać preferencje bez kodowania nazw silnika w UI.

## 6. Rekomendacja i plan dalszych prac

### 6.1. Wybór warunkowy

**Pierwszy wybór: BRouter na osobnym serwerze, dwa własne profile.** Uzasadnienie: profilowanie bez przebudowy całego edytora, bez opłat za każde przeciągnięcie, dostępne gotowe dane regionalne, analiza tagów odpowiedzi, rzeczywiste poprawne ukończenie naszych próbek. Najważniejszą pracą będzie polityka dostępu i nawierzchni, nie samo wywołanie HTTP. Obecne pomiary **nie kwalifikują gotowych profili do wdrożenia**.

Startowy profil ROAD: twarde wykluczenie motorway/motorroad, niedozwolonego rowerowego dostępu, schodów i technicznych szlaków; wysoka kara dla primary/secondary bez infrastruktury i złych nawierzchni; preferencja dobrego asfaltu i lokalnych dróg. Brak surface rozpatrywany ostrożnie według klasy/smoothness, z jawnym ostrzeżeniem. Nie wymagać `surface=asphalt` na każdej drodze lokalnej, bo to może odciąć poprawne połączenia.

Startowy GRAVEL: te same twarde reguły prawne, dopuszczenie compacted/fine_gravel/gravel i łatwego gruntu; wykluczenie trudnego MTB, bardzo złej smoothness i nadmiernych trudności technicznych. Próg np. `mtb:scale>=2` jest propozycją produktu do kalibracji, nie gwarancją trudności. Obsługa braku tych tagów musi być konserwatywna. Prowadzenie roweru domyślnie wyłączone albo wyraźnie wydzielone — wymaga wspólnej decyzji.

**Alternatywa: GraphHopper API.** Wygrywa, jeśli priorytetem jest brak własnych aktualizacji i operacji. Przed wyborem: ten sam zestaw punktów, custom ROAD/GRAVEL, dostęp do wymaganych encoded values/path details, wyniki legalności i potwierdzony plan. Basic może mieć zbyt niski limit chwilowy dla obecnego przeliczania dwóch sąsiadów; potrzebna kolejka albo wyższy plan. Przy bardzo małym ruchu warto osobno sprawdzić darmowy ORS.

Valhalla jest dobrym wyborem przy przyszłej nawigacji i szerszym routingu multimodalnym; obecnie nie daje tak bezpośredniego strojenia reguł tego konkretnego produktu jak BRouter/GraphHopper. Własny OSRM pozostaje realną opcją minimalnej zmiany protokołu, lecz dwa statyczne grafy i strojenie Lua osłabiają korzyść z pozostania przy nim.

### 6.2. Sposób hostowania

Proponuję wydzielony Linux VPS z 2 vCPU, 4 GB RAM i 20 GB SSD jako **budżet pierwszej próby BRoutera**. Osobny kontener lub systemd, przypięta wersja/digest, dostęp tylko z backendu, gotowe RD5 pokrywające Polskę z buforem. Backend Spring/Next/PostGIS pozostają niezależne. Heap i limit zadań dobrać po pomiarze; zacząć od małej współbieżności. Nie wystawiać bezpośrednio publicznego portu routera. Nie uruchamiano ani nie kupowano tej instancji.

Współdzielenie obecnego VPS dopiero po inwentaryzacji rzeczywiście wolnego RAM/CPU/dysku. Przy braku zasobów lub właściciela utrzymania wybrać API zamiast rozbudowy infrastruktury na siłę.

### 6.3. Kolejność integracji po decyzji

1. Zatwierdzić semantykę profili: prowadzenie roweru, unknown surface, trudność MTB, promień snapu, dopuszczalny objazd i zasięg geograficzny.
2. Przypiąć silnik, dane i profile. Uruchomić izolowany regionalny router oraz analogiczne testy GraphHoppera, jeśli dostępny klucz. Rozszerzyć próbki o 300/500 km i wiele waypointów.
3. Zbudować i ocenić własne ROAD/GRAVEL; ręcznie sprawdzić krytyczne drogi, zakazy, lasy i odcinki bez tagów. Wybrać dostawcę na podstawie wyników i kosztu całej obsługi.
4. Wprowadzić kontrakt domenowy `RoutingProvider`, odpowiedzi z snapem i błędami, timeouty, adaptery i testy kontraktowe. Domyślnego routingu jeszcze nie przełączać.
5. Dodać v2 dokumentu z czytnikiem v1, profile per segment, obsługę draftów i jawne przeliczenie. Poprawić granice snapu oraz wyścigi async.
6. Podłączyć ten kontrakt do rysowania, edycji i osobno DETOUR. Zachować zapis geometrii i wszystkie blokady wersji/merge.
7. Wykonać regresję na stagingu i pomiar limitów/szczytów RAM. Ustalić alerty i cykl aktualizacji grafu. Porównać koszt API przy faktycznej liczbie operacji edytora.
8. Dopiero po przeglądzie i osobnej decyzji produkcyjnej przełączyć dostawcę. Rollback przywraca konfigurację usługi, nie przelicza istniejących geometrii; nie wraca po cichu do niebezpiecznego routingu samochodowego.

Orientacyjny nakład, nie estymacja kontraktowa: adapter i kontrakt 1–3 dni, dokument/edytor/sugestie 3–6 dni, profile i regresja terenowa 3–7 dni, operacje i pomiary 1–3 dni. Strojenie trudnych przypadków może zdominować całość.

## 7. Kryteria akceptacji i regresja

### 7.1. Jakość i dostęp

- 0 odcinków jazdy po motorway/motorroad, `bicycle=no/private`, niedozwolonym `access` i zakazach kierunkowych w zweryfikowanym zestawie. Poprawnie respektowane wyjątki `bicycle=yes` na drogach zamkniętych dla aut. Nie usuwać legalnych połączeń tylko z powodu `motor_vehicle=no`.
- Schody, trudne MTB i bariery w zestawie negatywnym są wykluczone; legalne rowerowe kontrapasy działają. `bicycle=dismount` nigdy bez jawnego komunikatu/ustalonej polityki.
- ROAD omija znane dirt/ground/gravel/sand/mud przy rozsądnej asfaltowej alternatywie. Próbka Kabaty jest obecnie testem wykrywającym niespełnienie tego wymagania, nie wzorcem poprawnej szosy.
- GRAVEL używa łatwych, legalnych dróg nieutwardzonych, lecz nie wymusza jazdy terenowej kosztem jakości. Mokra nawierzchnia pozostaje ograniczeniem danych.
- Dla Warszawa–Góra Kalwaria nowa szosa ma mniej primary/secondary niż obecne 23,381 km fastbike, jeśli ręcznie potwierdzona alternatywa asfaltowa to umożliwia. Z góry zdefiniować korytarze i budżet objazdu, np. do 20% względem ręcznie zaakceptowanej trasy; większa różnica wymaga wyjaśnienia, nie bezwarunkowego odrzucenia.
- Dla Bodzentyna potwierdzić dostępność każdego leśnego skrótu i końcowy dojazd. Osobno sprawdzić pokrycie lasem, trudność i miejsca bez surface.
- Unknown surface jest jawnie liczona w diagnostyce; brak tagu nie jest traktowany jako potwierdzony asfalt. Metryki procentowe mają określony mianownik i nie mieszają „brak informacji” z „dobrze”.

### 7.2. Poprawność aplikacji

| Regresja | Wymagany wynik |
|---|---|
| Import, otwarcie i eksport starego GPX; zmiana defaultu | Brak wywołań routingu i brak zmiany geometrii istniejącej wersji |
| Nowa trasa: ROAD / GRAVEL / DIRECT | Odpowiednie profile; DIRECT = 0 wywołań silnika |
| Drag punktu między różnymi profilami | Tylko odpowiedni 1–2 odcinki, każdy swoim profilem; pozostałe identyczne |
| Insert / delete / mixed profiles | Insert zachowuje kształt i profil; delete nie wybiera arbitralnie nowego profilu |
| Async: szybki drag, zmiana mode/profile, undo/redo, usunięcie i ponowne przywrócenie | Starsza odpowiedź nigdy nie nadpisuje nowego stanu; żądania anulowane gdy możliwe |
| Snap poza drogą, rzeka, równoległe jezdnie, mała wyspa grafu | Brak ukrytego łącznika/prostej i brak dużego przesunięcia bez komunikatu |
| Timeout, 429, brak trasy, 5xx, uszkodzony JSON, pusty wynik | Właściwy komunikat, zachowana geometria, brak fallbacku samochodowego |
| Nieudany pierwszy segment i zapis | Brak zapisania prostej jako poprawnie zroutowanej bez jawnej decyzji |
| Zapis/ponowne otwarcie v1 i v2, draft | Profile i zaakceptowana geometria zachowane, stare dokumenty czytelne |
| DETOUR: rysowanie, zapis, podgląd, merge/rebase/conflict | Preview = zapisana geometria; merge nie wywołuje routera; kotwice i historia poprawne |
| Merge → ponowna edycja | Jawne zachowanie/odtworzenie metadanych profili; żadnego zgadywania profilu historycznego |
| Aktualizacja danych/profilu/dostawcy | Cache rozdzielony; zapisane trasy/wersje identyczne; nowe wyniki mają pochodzenie |

Istniejące testy `route-editor-model.test.ts`, `owner-editor-model.test.ts`, `suggestion-request.test.ts` i testy wersjonowania stanowią bazę, ale nie badają jakości routingu ani wszystkich zmian profilu/wyścigów. W tym etapie nie uruchamiano całych testów aplikacji, ponieważ nie zmieniono jej implementacji. Zweryfikowano artefakty eksperymentu offline.

### 7.3. Wydajność i operacje

Na przypiętej regionalnej instancji testować 10/100/300/500 km, 2/10/50/100 waypointów, kolejno i przy 1/2/4 aktywnych użytkownikach. Osobno zimny/ciepły cache, fragment miasta i lasu, niepołączony graf, trasa wzdłuż granicy kafli. Publicznych dem nie używać do testów obciążeniowych.

Propozycja SLO do uzgodnienia: p95 lokalnego odcinka <2 s, 100–300 km <8 s, pojedynczy deadline 30 s dla długiej operacji, bez OOM i bez degradacji DB/aplikacji. Rejestrować p50/p95/p99, błędy, max RSS, CPU, rozmiar grafu i czas aktualizacji. Aktualne pojedyncze pomiary BRoutera nie dowodzą spełnienia tych progów.

Odbiór wymaga też kontrolowanej aktualizacji danych, wykrycia brakującego kafla, zgodności profili/lookupów i odwrócenia nieudanej aktualizacji routera. Dopiero po tych testach można zatwierdzić silnik i hosting do wdrożenia.

## 8. Co pozostaje do wspólnej decyzji

1. Czy szosa/gravel dopuszczają krótkie **prowadzenie** roweru, czy wymagamy wyłącznie odcinków do jazdy?
2. Jak konserwatywnie traktujemy brak surface oraz brak danych o techniczności i jakie objazdy akceptujemy?
3. Czy na start obsługujemy Polskę, czy Europę/świat? To zmienia koszty i sens API.
4. Czy mamy właściciela profili i aktualizacji, czy preferujemy stały koszt zarządzanego API?

Raport i PoC są gotowe do przeglądu. Katalog `docs` jest lokalnie ignorowany przez istniejący wpis w `.git/info/exclude`; pliki istnieją w workspace, ale nie pojawią się w zwykłym `git status`. Nie zmieniano tego wykluczenia i nie tworzono commita.
