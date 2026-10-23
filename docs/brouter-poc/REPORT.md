# Raport lokalnego PoC BRouter ROAD / GRAVEL

16.10.2026. **Zbudowano i uruchomiono lokalne PoC, ale profile i integracja nie są jeszcze gotowe do produkcji.** Aktualna rewizja to **1.0.1**. Jest wyraźna poprawa względem wcześniejszych próbek gotowych profili/publicznego OSRM, lecz pozostają timeout ROAD w Kabatach, snapy rzędu 200–260 m i przerwania obliczeń przy przeciążeniu. Nie deklarujemy gwarancji asfaltu, legalności ani bezpieczeństwa na podstawie niepełnego OSM.

Nie zmieniono konfiguracji produkcyjnej, istniejących danych, publicznego API ani UI. Nie wykonano deployu ani commita. Usunięto lokalne wykluczenie `docs` z `.git/info/exclude`, dodano ochronę plików RD5/runtime w `.gitignore`. Wcześniejsze materiały w `docs/` zachowano.

## Co dokładnie uruchomiono

Oficjalne stabilne [BRouter v1.7.10](https://github.com/abrensch/brouter/releases/tag/v1.7.10), wydanie 17.07.2026. Przypięty ZIP i SHA-256 z GitHub Release API sprawdzony lokalnie; engine i `lookups.dat` z tego samego archiwum, lookup 11.2. Regionalne RD5 z [segments4](https://brouter.de/brouter/segments4/), sześć kafli w prostokącie [10,45,25,55), zgodnych w rzeczywistym routingu. Indeks w chwili pobrania wskazywał 16.10.2026 01:03 dla wszystkich sześciu plików; nie jest to pewna data źródłowego snapshotu OSM. Manifest zawiera hashe i bajty; nie pobrano świata.

Dane, JAR/APK, importy testowe, cache i pliki robocze: `/tmp/tmr-brouter-poc`, poza repo. PoC ma natywne uruchomienie Java oraz opcjonalne kontenery do wymuszenia limitów. Dostęp wyłącznie przez localhost; usługi są zatrzymywane po pomiarze. Instrukcje i konfiguracja: [README](README.md).

Środowisko lokalne: Ubuntu, kernel i architektura zapisane w każdym benchmark.json, 8 dostępnych logicznych CPU, około 31.1 GiB RAM hosta. Proces natywny ograniczony do dwóch logicznych CPU przez taskset; kontenery mają quota 2 CPU, 1 GiB / 512 MiB / 256 MiB i brak swapu. JVM: natywnie OpenJDK 17.0.20.1, kontener Temurin 21.0.12.1. To **nie jest pomiar produkcyjnego VPS** ani porównanie identycznych JVM.

## Jakość końcowych tras

Pełna seria: [v1.0.1-1024m/summary.json](results/v1.0.1-1024m/summary.json), [porównanie offline](results/v1.0.1-1024m/comparison.html), [geometrie do GIS](results/v1.0.1-1024m/routes.geojson), [punkty wymagające przeglądu](results/v1.0.1-1024m/review-flags.geojson), [audyt integralności i snapu](results/v1.0.1-1024m/quality-audit.json). Każda odpowiedź ma oryginalny plik i hash. Liczby poniżej pochodzą z pojedynczych zapytań tej serii, nie z uśrednienia różnych rewizji.

| Przypadek | Profil | km | Czas s | Unknown % | Primary+secondary km |
|---|---|---:|---:|---:|---:|
| warszawa-lodz | road-v1 | 160.884 | 8.473 | 4.890 | 0.779 |
| warszawa-lodz | gravel-v1 | 158.145 | 5.473 | 8.720 | 0.614 |
| warszawa-gora-kalwaria | road-v1 | 42.704 | 2.126 | 0.010 | 0.597 |
| warszawa-gora-kalwaria | gravel-v1 | 38.550 | 2.305 | 5.250 | 0.506 |
| bodzentyn-swiety-krzyz | road-v1 | 33.359 | 0.274 | 5.560 | 1.807 |
| bodzentyn-swiety-krzyz | gravel-v1 | 31.521 | 0.256 | 9.520 | 1.633 |
| kabaty-powsin | road-v1 | — | 30.009 | — | — |
| kabaty-powsin | gravel-v1 | 7.141 | 0.520 | 0.000 | 0.000 |
| kabaty-through | road-v1 | 10.864 | 0.304 | 7.590 | 0.033 |
| kabaty-through | gravel-v1 | 8.307 | 0.198 | 2.170 | 0.033 |
| city-river-access-problem | road-v1 | 2.962 | 0.140 | 0.000 | 0.000 |
| city-river-access-problem | gravel-v1 | 2.962 | 0.120 | 0.000 | 0.000 |
| city-cycleway | road-v1 | 3.216 | 0.149 | 0.000 | 0.000 |
| city-cycleway | gravel-v1 | 3.216 | 0.151 | 0.000 | 0.000 |
| city-local | road-v1 | 2.595 | 0.141 | 0.000 | 0.000 |
| city-local | gravel-v1 | 2.595 | 0.136 | 0.000 | 0.000 |
| multi-arbitrary-snap-problem | road-v1 | 202.990 | 1.763 | 6.120 | 1.829 |
| multi-arbitrary-snap-problem | gravel-v1 | 199.117 | 1.556 | 10.290 | 1.598 |
| multi-200km | road-v1 | 160.888 | 1.220 | 4.890 | 0.780 |
| multi-200km | gravel-v1 | 161.108 | 1.249 | 6.220 | 0.693 |

`Primary+secondary` jest sumą klas z łącznikami, **nie pomiarem natężenia ruchu**. Nieznana nawierzchnia: brak lub unknown w diagnostyce, mianownik = suma Distance w messages. Wszystkie odpowiedzi 200 mają zgodne sumy z długością trasy w przyjętej tolerancji. Nie znamy dokładności tagów w terenie. Pełne nawierzchnie i klasy, także tertiary, track/path/cycleway, znajdują się w JSON.

Najważniejsze obserwacje:

1. **Warszawa–Łódź:** ROAD 160.884 km, GRAVEL 158.145 km. Zero motorway/trunk/motorroad w zwróconych tagach, brak A1/A2 w klasyfikacji autostradowej. ROAD nie ma w diagnostyce znanego gruntu/szutru, ale **4.89% pozostaje nieznane**. Nie jest to gwarancja asfaltu. GRAVEL ma m.in. 2.492 km unpaved, 187 m compacted i 195 m gravel. Końcowy snap około 6 m.
2. **Warszawa–Góra Kalwaria:** ROAD 42.704 km, primary/secondary **597 m**, w poprzedniej publicznej próbce fastbike 23.381 km. To duża poprawa proxy, choć zmieniły się także dane i konfiguracja silnika, więc nie przypisujemy całej różnicy wyłącznie jednej regule. GRAVEL 38.550 km i 506 m tych klas, kosztem m.in. 1.230 km compacted, 354 m gravel, 816 m unpaved i 321 m dirt/ground. Objazd ROAD względem GRAVEL około 10.8%. Snap celu 26.3 m, nadal wymaga oceny strony drogi.
3. **Bodzentyn–Święty Krzyż:** 33.359 / 31.521 km, zamiast krótkiego leśnego skrótu. ROAD: 31.454 km asfaltu, 1.856 km nieznane; GRAVEL dodatkowo 264 m sett i 187 m cobblestone. Konserwatywne dopuszczenie ścieżek i dostęp powodują znaczny objazd. Brak wykrytych zakazanych tagów nie stanowi potwierdzenia regulaminu parku, dostępu czasowego ani legalności dojazdu pod klasztor. Nie wykonano terenowej weryfikacji końcowego odcinka.
4. **Kabaty–Powsin:** ROAD przekracza 30 s (`pass0 timeout`), więc nie ma akceptowalnej geometrii. Nie wiemy, czy brak legalnej rozsądnej trasy, czy trudny snap/search; timeout nie dowodzi NO_ROUTE. GRAVEL 7.141 km, ale **snap celu 259.51 m**. Tego wyniku nie wolno włączyć do edytora jako dokładnego dojazdu do kliknięcia.
5. **Kabaty w poprzek:** ROAD 10.864 km, GRAVEL 8.307 km. ROAD wybiera asfalt/paved i 825 m unknown; GRAVEL ma 1.652 km dirt. Rozróżnienie profili działa, ale **snap początku 219.2 m**, końca 31.67 m. Trzeba odrzucić/wyjaśnić dopasowanie przed użyciem w produkcie.
6. **Miasto:** dwa krótkie zestawy 3.216 i 2.595 km, około 0.14–0.15 s w pełnej serii, oba profile identyczne w tych korytarzach. Rzeczywiście korzystają z cycleway; ich udział jest w highway_m. Nie oznacza to pokrycia wszystkich miejskich konfliktów/drogowych skrętów. Dodatkowa trasa nad Wisłą po poprawce 2.962 km zamiast timeoutu, ale snap celu **86.34 m** i 92 m kostki/bruków również dla ROAD — soft penalty nie oznacza absolutnego zakazu nawierzchni.
7. **Wiele waypointów:** arbitralny zestaw 12 punktów daje **202.990 km ROAD / 199.117 km GRAVEL**, 1.763 / 1.556 s. ROAD ma 6.12% unknown oraz 91 m cobblestone i 12 m metal — kolejny konkretny kompromis. Kontrolny zestaw 12 zamrożonych punktów z wcześniejszej geometrii ma 160.888 / 161.108 km, około 1.22–1.25 s. Szybkość z via wynika z podziału wyszukiwania na krótsze problemy i rozgrzanego procesu; nie ekstrapolować na dowolną trasę 200 km. Bliskość wierzchołków do via nie jest pełną walidacją snapu/kolejności legów.

W pełnym audycie rewizji 1.0.1: **0 wykrytych niedozwolonych klas/tagów sposobu jazdy** w odpowiedziach 200, ale **7 odpowiedzi ze snapem końca/początku >30 m**, w tym dwie duplikujące kontrolę no-go. Próg 30 m jest proponowanym progiem integracji. Nie sprawdziliśmy wszystkich źródłowych tagów OSM, ograniczeń warunkowych ani faktycznego ruchu. Niektóre flagi pokazują tylko przybliżoną lokalizację początku grupy diagnostycznej.

## Testy negatywne i błędy wykryte podczas pracy

**166/166 testów polityki** w rzeczywistym interpreterze BRF: [wyniki](results/profile-tests-1.0.1.json). Obejmują dostęp, wyjątki rowerowe, kierunki, prowadzenie roweru, piesze ścieżki bez dopuszczenia, nawierzchnie, bariery i nieobsługiwane krawędzie. To nie zastępuje end-to-end.

**6/6 testów end-to-end na syntetycznym RD5:** [wyniki](results/v1.0.1-synthetic/summary.json). Dwie publiczne drogi mają jedyny łącznik. `bicycle=yes` daje 12.390 km obu profilom; `bicycle=no` oraz `bicycle=dismount` dają HTTP 400 `target island detected for section 0`, bez geometrii. Publiczne odcinki i punkty są identyczne między wariantami; zakazany łącznik jest jedyną zmianą. Nie przypisujemy tego testu konkretnemu terenowi w Polsce. Nie wybrano wiarygodnie zweryfikowanej rzeczywistej pary OSM, dla której wiadomo z niezależnej kontroli, że nie istnieje legalne połączenie.

Brak kafla poza regionem: żądanie Nowy Jork zwraca `datafile W75_N40.rd5 not found` dla obu profili; nie ma fallbacku ani pobierania danych świata.

Odkryte i zachowane problemy:

- **Pierwsza rewizja 1.0.0 dopuszczała 6 m toru tramwajowego przy celu Łódź.** Ograniczenie soft kosztu do 9998 obniżało domyślny koszt nieobsługiwanej krawędzi. Kontrola samej liczby motorway tego nie wykrywała. Dodano twardą listę highway i regresję rail/tram, rewizja 1.0.1. Efekt uboczny poprawki: zniknęły wcześniejsze timeouty Wisły i arbitralnych via. Nie dowodzi to, że każdy timeout powodowało wyłącznie to samo miejsce. Historyczne profile i wyniki zachowano; nie kwalifikują się do wdrożenia.
- **BRouter 1.7.10, samotne `exportCorrectedWaypoints=1`:** jeśli nie ma correctedpoint, FormatJson dodaje przecinek po ostatniej funkcji i daje niepoprawny JSON. Nie naprawiano otrzymanego JSON po cichu. PoC używa `exportWaypoints=1`, ale to eksport wejścia; pełny kontrakt snapu wymaga dalszej pracy.
- Początkowy `exportCorrectedWaypoints=true` był błędem klienta: silnik oczekuje liczby, zwracał 500. Naprawiono; tamta seria jest nieważna.
- Wczesny healthcheck portu Dockera mierzył gotowość proxy przed startem Java; poprawiono na odpowiedź HTTP samego serwera. Tamta seria jest nieważna.
- **Kontrola ogromnego no-go obejmującego oba waypointy była źle zaprojektowanym testem NO_ROUTE.** `RoutingContext.cleanNogoList` w tej wersji usuwa obszary zawierające waypointy. Rewizja 1.0.1 daje identyczną geometrię jak bez no-go, co sprawdzono w [nogo-semantics.json](results/v1.0.1-1024m/nogo-semantics.json). Oryginalne summary zachowuje `accepted=false` wobec błędnego oczekiwania. Nie interpretujemy tego jako zignorowania zakazu bicycle=no ani jako testu legalności. W bieżącym cases.json zmieniono oczekiwanie tej kontroli na dodatnie. Właściwy test braku połączenia to fixture z zakazanym łącznikiem.

Indeks wszystkich prób, także odrzuconych: [results/README.md](results/README.md).

## Benchmark końcowej rewizji

Jeden JVM na serię, quota 2 CPU, dwa wątki routingu; kolejno jakościowe zapytania i po osiem mieszanych zapytań przy 1/2/4 klientach. Powtórzenia są ciepłe, bez czyszczenia cache OS. Startup = czas od uruchomienia procesu/kontenera do poprawnej odpowiedzi HTTP, **nie pierwszy routing ani cold boot VPS**. RSS próbkowane co 50 ms + VmHWM. Memory.peak/events cgroup i surowe CPU są zachowane. Krótkie różnice CPU mają rozdzielczość ticków, więc procenty dla milisekundowych błędów nie są miarodajne.

| Próba | Heap MiB | Startup s | RSS idle MiB | Peak RSS MiB | Cgroup peak MiB | OOM | Miasto ROAD/GRAVEL s | Łódź ROAD/GRAVEL s |
|---|---:|---:|---:|---:|---:|---|---|---|
| [v1.0.1-1024m](results/v1.0.1-1024m/benchmark.json) | 640 | 0.457 | 44.5 | 236.5 | 216.4 | nie | 0.149 / 0.151 | 8.473 / 5.473 |
| [v1.0.1-512m](results/v1.0.1-512m/benchmark.json) | 320 | 0.460 | 44.5 | 218.5 | 198.3 | nie | 0.213 / 0.171 | 7.782 / 6.063 |
| [v1.0.1-256m](results/v1.0.1-256m/benchmark.json) | 128 | 0.452 | 44.5 | 238.8 | 218.4 | nie | 0.148 / 0.162 | 8.281 / 5.326 |
| [v1.0.1-native](results/v1.0.1-native/benchmark.json) | 640 | 0.165 | 43.1 | 478.3 | bez limitu cgroup | nie (log) | 0.237 / 0.210 | 12.490 / 6.846 |

Seria 1 GiB zawiera pełny korpus, pozostałe krótszy korpus kontrolny; peak między seriami nie jest porównaniem identycznej pracy. Czasy w dwóch ostatnich kolumnach to pierwsza odpowiedź danej pary w serii, nie mediana.

Natywna próba Java 17 osiągnęła **478.3 MiB RSS**, wyraźnie więcej niż kontenery Java 21 (**218.5–238.8 MiB** w końcowych seriach). Nie izolowano przyczyny tej różnicy; różnią się JVM, zarządzanie pamięcią i przebieg rozgrzewania. Nie traktować najniższego wyniku jako uniwersalnego minimum BRoutera.

Cgroup memory.peak i RSS mogą się różnić: RSS liczy współdzielone mapowania bibliotek, a cgroup może nie dostać kosztu pliku już naliczonego cache innego procesu. Dlatego mała próba przy 256 MiB **nie dowodzi**, że 256 MiB wystarczy w zimnym środowisku lub dla innych tras. Nie wykonano długotrwałego soak testu, czyszczenia cache systemowego ani testu pod obciążeniem wszystkich produkcyjnych usług.

CPU w pełnej serii: Warszawa–Łódź ROAD 16.65 CPU-s / 8.47 s wall (~196.5% jednego CPU), GRAVEL 8.90 CPU-s / 5.47 s (~162.6%). Arbitralna trasa ~200 km: 3.51 / 3.07 CPU-s, około dwóch aktywnych rdzeni. Timeout Kabaty ROAD zużył 31.10 CPU-s. Pamięć nie jest jedynym ograniczeniem; trudne snapy potrafią zajmować CPU przez cały deadline.

W pełnej serii 1 GiB:

| Klienci | Żądania | Cała seria | Wynik | Ciepłe Warszawa–Łódź |
|---|---:|---:|---|---|
| 1 | 8 | 19.206 s | 8/8 HTTP 200 | 4.45–5.12 s |
| 2 | 8 | 12.424 s | 8/8 HTTP 200 | 5.91–6.07 s |
| 4 | 8 | 11.865 s | **4/8 błędów 400** | ukończone 9.63–9.84 s |

Błędy: `operation killed by thread-priority-watchdog`. MAXTHREADS=2 **nie tworzy bezpiecznej kolejki**; nowe żądania potrafią przerwać aktywne. Krótsza seria z większą liczbą klientów nie oznacza większej przepustowości, gdy połowa pracy jest porzucana. Konieczny backendowy limit aktywnych obliczeń i bounded queue/429. Nie liczymy wiarygodnego p95/p99 na ośmiu żądaniach i nie deklarujemy spełnienia SLO. Nie wykonano benchmarku publicznych demo.

Dysk: RD5 **680 492 514 B (~649 MiB)**, rozpakowana dystrybucja **8 549 939 B (~8.15 MiB)**, ZIP i zapisane metadane około 6.54 MiB. Nie uwzględnia to całego obrazu Docker/JDK jako części BRoutera; skorzystano z istniejącego obrazu narzędziowego. Do przyszłych atomowych aktualizacji potrzebna rezerwa na co najmniej dwie generacje grafu plus download i testy. Gotowe regionalne RD5 nie wymagały lokalnego importu PBF ani płatnego API.

## Rekomendacja dla obecnego VPS: 2 vCPU / około 8 GB RAM

**Nie rekomenduję jeszcze włączania tego na współdzielonym VPS produkcyjnym.** Mały RSS w lokalnej próbce obala wyłącznie założenie, że silnik musi stale potrzebować kilku GB. Nie dowodzi zapasu pamięci/CPU na serwerze obsługującym wiele aplikacji. Nie odczytywano usług, pamięci ani obciążenia VPS i niczego na nim nie uruchamiano.

BRouter pozostaje dobrym kandydatem. Po naprawie snapu i kolejki można rozważyć izolowaną próbę stagingową z budżetem **1 GiB RAM, heap 640 MiB, maksymalnie 1–2 aktywne zadania**. Ograniczenie 512 MiB jest obiecujące dla zmierzonych tras, lecz nie zatwierdzone jako produkcyjne minimum. 256 MiB nie rekomenduję: brak zapasu na zimny cache i bardziej wymagające trasy. CPU ustalić po inwentaryzacji wolnych zasobów; quota 2 CPU na obecnym VPS może w praktyce konkurować z całym backendem/DB/Next i pozostałymi aplikacjami.

Jeśli brak stabilnego zapasu na współdzielonym serwerze, uruchomić BRouter na oddzielnej własnej instancji z prywatnym dostępem. Nadal zero płatnych zewnętrznych API routingu i zero zależności produkcyjnej od demo. Koszt VPS i aktualizacji jest kosztem utrzymania infrastruktury, nie opłatą za publiczne API.

Warunki kolejnego etapu: ręczny przegląd flag i przypadków park/las, ustalenie dopuszczalnego snapu i objazdu, kontrola poprawionych waypointów, typowane błędy i kolejka, pomiary zasobów staging/VPS, regresja aktualizacji grafu. Docelowy kontrakt, zgodność v1/v2, ROAD/GRAVEL niezależne od DIRECT/ROUTED, zachowanie historii geometrii oraz plan backend/frontend opisano w [INTEGRATION.md](INTEGRATION.md). Żadnego automatycznego fallbacku do samochodu ani przeliczania istniejących wersji.
