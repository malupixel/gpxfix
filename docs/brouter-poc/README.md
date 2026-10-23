# BRouter ROAD / GRAVEL — lokalne PoC, etap 1

Stan: 16.10.2026. **To jest eksperyment lokalny, nie kwalifikacja produkcyjna.** Wyniki i decyzja w [REPORT.md](REPORT.md), przyszły kontrakt w [INTEGRATION.md](INTEGRATION.md). Nie zmieniono backendu, publicznego API, edytora, konfiguracji OSRM ani konfiguracji produkcyjnej. Nie wdrażano ani nie commitowano zmian. Przeczytano wcześniejszą [analizę](../bicycle-routing-research.md), skrypty i wyniki `docs/routing-poc/` oraz dodatkowe `docs/experiments/bicycle-routing/`.

## Uruchomienie na Ubuntu bez Dockera

Wymagania: Python 3.10+, Java i javac 17+ (JDK do testów), `taskset` z util-linux, HTTPS do GitHuba i brouter.de podczas pobierania. Nie potrzeba Maven/Gradle/PostGIS/Next.js ani kluczy API. `javac --release 17` unika konfliktu zainstalowanych javac 21 i java 17.

Z katalogu repozytorium:

```bash
# Domyślna ścieżka jest poza repo; /tmp może zostać wyczyszczone przez system.
export BROUTER_POC_HOME=/tmp/tmr-brouter-poc
python3 docs/brouter-poc/poc.py setup
python3 docs/brouter-poc/test_profiles.py
python3 docs/brouter-poc/test_fixture.py
python3 docs/brouter-poc/poc.py run --output docs/brouter-poc/results/my-native-run
python3 docs/brouter-poc/render.py docs/brouter-poc/results/my-native-run
python3 docs/brouter-poc/verify_results.py docs/brouter-poc/results/my-native-run
```

`setup` pobiera przypięty ZIP, sprawdza SHA-256, rozpakowuje go poza Gitem i pobiera tylko sześć kafli. Kompletnych plików nie nadpisuje. Pobrania używają `.part`; finalne pliki mają manifest SHA-256. Dla nowych pobrań zapisywane są nagłówki HTTP i data pobrania. Pierwsze pobranie tej sesji wykonano przez curl; jego pochodzenie/czasy z indeksu opisano w raporcie. Nie ma automatycznej aktualizacji grafu ani publicznych wywołań routingu. `run` sam uruchamia i zatrzymuje swój serwer; wymaga nowego katalogu wyników. Wystawia tylko `127.0.0.1:17777` i odmawia startu, jeżeli port jest zajęty.

Serwer do ręcznej pracy (foreground):

```bash
python3 docs/brouter-poc/poc.py serve --heap 640 --threads 2 --port 17777
# Ctrl-C kończy usługę. Z innego terminala użyj SIGTERM do PID tego procesu Java.
```

Uruchomienie w tle i zatrzymanie własnego procesu:

```bash
python3 docs/brouter-poc/poc.py serve > /tmp/tmr-brouter-foreground.log 2>&1 &
tmr_brouter_pid=$!
# ... praca lokalna ...
kill -TERM "$tmr_brouter_pid"
wait "$tmr_brouter_pid"
```

Przykładowe żądanie:

```bash
curl --get 'http://127.0.0.1:17777/brouter' \
  --data-urlencode 'lonlats=21.011522,52.230740|20.9974,52.2465' \
  --data-urlencode 'profile=road-v1' \
  --data-urlencode 'format=geojson' \
  --data-urlencode 'alternativeidx=0' \
  --data-urlencode 'exportWaypoints=1'
```

Współrzędne: **lon,lat**, waypointy w zadanej kolejności, brak optymalizacji. Serwer ma deadline 30 s; klient pomiarowy 40 s. `correctMisplacedViaPoints=false` zapobiega automatycznemu usuwaniu objazdów przez via. `exportWaypoints=1` eksportuje punkty zadane, **nie potwierdzony snap wszystkich via**. Początek/koniec geometrii stanowi obserwowany snap końców. Nie używać samego `exportCorrectedWaypoints=1`: odkryto błąd eksportu tej wersji, opisany w raporcie.

`serve` ogranicza heap JVM i przydziela dwa dostępne logiczne CPU przez taskset. Heap **nie jest limitem całego RSS**. [Przykładowa jednostka systemd](brouter-poc.service.example) pokazuje MemoryMax/MemorySwapMax/CPUQuota. Nie została zainstalowana ani aktywowana; wymaga podstawienia użytkownika i ścieżek. Nie kopiować jej na produkcję w ramach tego etapu. Dla systemd pełen limit obowiązuje cgroup, także pamięć poza heapem. Uruchamianie/zatrzymywanie po świadomej lokalnej instalacji nowej jednostki: `systemctl start brouter-poc` / `systemctl stop brouter-poc`.

## Powtarzalny benchmark z pełnym limitem RAM/CPU

Docker jest opcjonalnym narzędziem pomiarowym. Nie jest zależnością aplikacji ani silnika. W sesji wykorzystano już dostępny lokalnie obraz `maven:3.9-eclipse-temurin-21`; nie uruchamia on Mavena. Digest i wersja Java są w `benchmark.json`. Przy odtwarzaniu należy podać ten sam image ID/digest lub jawnie odnotować zmianę JVM. Obraz może być dowolnym zgodnym obrazem z `java` i `sh` oraz cgroup v2.

```bash
python3 docs/brouter-poc/poc.py run --container --heap 640 --memory 1024 \
  --output docs/brouter-poc/results/my-1g-run
python3 docs/brouter-poc/poc.py run --container --quick --heap 320 --memory 512 \
  --output docs/brouter-poc/results/my-512m-run
python3 docs/brouter-poc/poc.py run --container --quick --heap 128 --memory 256 \
  --output docs/brouter-poc/results/my-256m-run
```

Pełny zestaw zawiera także celowo problematyczne punkty i trwa kilka minut. `--quick` wybiera miasto, Warszawa–Łódź i trasę 12-punktową. Sekwencje współbieżności wykonują po osiem zapytań przy 1/2/4 klientach, `MAXTHREADS=2`. Nie uruchamiać kilku benchmarków równocześnie. `--port` pozwala uniknąć konfliktu z inną lokalną usługą. Kontener ma 2 CPU, limit RAM, brak swapu, woluminy tylko do odczytu, brak uprawnień root/capabilities i publikację wyłącznie na localhost; po pomiarze skrypt zatrzymuje i usuwa **wyłącznie swój nowy kontener**. Oryginalne dane i istniejące usługi pozostają.

W razie wymuszonego zabicia procesu sterującego sprawdź `docker ps --filter name=tmr-brouter-poc-` i zatrzymaj tylko osierocony kontener danej próby. Nie uruchamiać `docker system prune`.

## Pochodzenie i zasięg

- Oficjalny stabilny silnik: [BRouter v1.7.10](https://github.com/abrensch/brouter/releases/tag/v1.7.10), opublikowany 17.07.2026. ZIP z tego wydania, SHA-256 `023fec3ba997758e8cd7ab9e1bae52e962af3f00b57683e3de86b84ffad01532` pochodzi z GitHub Release API (`digest`), zgodność sprawdzona lokalnie.
- `lookups.dat` z tego samego archiwum: schema 11, minor 2. Nie pobieramy przypadkowej wersji z `master`. Dane pobranej generacji są zgodne w rzeczywistych testach.
- RD5: [oficjalny indeks segments4](https://brouter.de/brouter/segments4/), `E10_N45`, `E10_N50`, `E15_N45`, `E15_N50`, `E20_N45`, `E20_N50`. Prostokąt **10≤lon<25, 45≤lat<55**, zawiera Polskę i bufor lądowy; nie jest równomiernym buforem przy każdym punkcie granicy. Północna krawędź zbliża się do polskiego wybrzeża. Dalszy objazd może wymagać nowego kafla, nie obiecujemy światowego zasięgu.
- Gotowe kafle mają około 649 MiB. Nie pobrano świata ani PBF Polski. Regionalnych RD5 nie przebudowywano. Jedyny lokalny import to miniaturowy **syntetyczny** graf testowy, osobny od prawdziwych danych.
- Manifest zawiera rozmiary i SHA-256. Publiczny URL RD5 jest zmienny; pobranie za miesiąc nie odtworzy identycznych danych. Zachowanie snapshotu i manifestu jest warunkiem ścisłej reprodukcji. Indeks nie daje wiarygodnej daty snapshotu OSM, więc nie przypisujemy mu zmyślonej daty.
- Dane i wyniki pochodne © OpenStreetMap contributors, [ODbL](https://www.openstreetmap.org/copyright). Profile/skrypty PoC: MIT, [LICENSE](LICENSE). Profile są własną polityką kosztu, inspirowaną analizą `fastbike`/`trekking` przypiętej wersji, nie są przemianowanymi gotowymi profilami.

## Profile i polityka

Wersje `road-v1` i `gravel-v1` odpowiadają rewizji **1.0.1**. Pliki `.brf` są samodzielne, SHA-256 zapisany przy każdym pomiarze. Kolejna zmiana reguł wymaga nowej rewizji, regresji i osobnych metadanych/cache; nie zmienia zapisanych tras.

Wspólne reguły:

- Twarda lista dozwolonych klas highway wyklucza także tory tramwajowe/kolejowe, drogi wodne i inne krawędzie grafu bez drogi rowerowej; profil nie może obniżyć ich zakazu przez ograniczenie kosztu. Twarde `costfactor=10000`: motorway/trunk i ich łączniki, `motorroad=yes`, schody, budowa, porzucone/proponowane drogi, zakazany dostęp i kierunek. Brak ratowania zakazu przez członkostwo w trasie rowerowej. Twardy próg w interpreterze silnika sprawdzono, nie stosujemy `min 9999` obniżającego wykluczenie.
- Hierarchia `bicycle > vehicle > access`, dopuszczenie tylko missing/yes/designated/permissive na odpowiednim poziomie. `motor_vehicle=no` nie blokuje roweru. `bicycle=no/private/dismount/use_sidepath/destination/permit` blokuje. Destination/customers/delivery/agricultural/forestry również blokowane bez bardziej szczegółowego dopuszczenia roweru. To polityka publicznego przejazdu, może wykluczyć legalny dojazd do celu.
- `path`, `footway`, `pedestrian`, `bridleway` wymagają `bicycle=yes/designated/permissive`. Sam `route_bicycle_*` nie dowodzi dostępu. Wykluczenie wszystkich nietagowanych `path` może powodować długie objazdy lub brak połączenia; w PoC świadomie preferujemy fałszywą odmowę nad domniemaniem legalności ścieżki pieszej.
- Zakazy kierunkowe `bicycle:forward/backward=no`; `oneway`, `oneway=-1`, roundabout/circular i `oneway:bicycle=no/yes`. Nie wnioskujemy kontrapasa z samego `cycleway=opposite`: przy braku poprawnego oneway:bicycle profil może odmówić legalnego kierunku. Kierunkowe `bicycle:*=yes` nie podnosi ogólnego zakazu bicycle=no — konserwatywne ograniczenie, do rozszerzenia dopiero po regresji.
- Węzły: osobna hierarchia dostępu; `bicycle=no/dismount`, prywatne bariery i m.in. stile/wall/kissing_gate blokowane kosztem 1 000 000. Bramki rowerowe/gate mają karę. Nie znamy szerokości każdej bariery ani konieczności zejścia z roweru bez tagów. Parametr `nodeaccessgranted=false` uniemożliwia obchodzenie tych zasad trasą rowerową.
- `smoothness=very_bad/horrible/very_horrible/impassable`, `mtb:scale` poza missing/0/0-/0+ i dowolny `sac_scale` blokowane. Jest to konserwatywna ocena techniczności, nie ocena terenowa.
- Koszt primary=9, secondary=5, tertiary=2.2, lokalna około 1.15–1.5, cycleway=1; dodatkowa kara maxspeed 70+. **Nie jest to rzeczywisty ruch**. `cycleway=lane` na arterii nie znosi kary, bo nie dowodzi fizycznego oddzielenia.
- Respektujemy zakazy skrętu, które dotarły do RD5, przez `considerTurnRestrictions=true`. Nie gwarantujemy reprezentacji wszystkich ograniczeń warunkowych/prawa lokalnego. W przypiętym lookups nie ma pełnego `*:conditional`; profil nie interpretuje dat/godzin ani pogody. Nie da się odzyskać tagów odrzuconych przez importer.

Różnice nawierzchni, mnożniki kosztu:

| Nawierzchnia / dowód | ROAD | GRAVEL |
|---|---:|---:|
| asphalt | 1 | 1 |
| concrete / paved | 1.15 / 1.3 | 1 |
| paving_stones | 1.8 | 1.15 |
| fine_gravel / compacted | 14 | 1.15 |
| gravel / unpaved | 22 | 1.4 / 1.8 |
| ground / dirt / earth | 35 | 1.8 |
| sand / mud / rock / stone / pebblestone | 100 | 15 |
| sett / cobblestone | 7 | 2 |
| missing/unknown na lokalnej drodze | 2 | 1.6 |
| missing/unknown na cycleway | 2.5 | 1.6 |
| missing/unknown na track/path/footway | 14 | 3 |

ROAD nigdy nie utożsamia braku `surface` z potwierdzonym asfaltem. Pozostawia jednak przejezdne drogi lokalne bez tagu, co zapobiega automatycznemu odcinaniu regionów. Nawierzchnie mają **silne kary, a nie bezwzględny zakaz**: przy złych alternatywach ROAD może nadal wybrać znany grunt. Klasa, smoothness i tracktype nie stają się dowodem asfaltu. `tracktype=grade2/3/4/5` dodatkowo mnoży koszt ROAD ×3/7/12/20, GRAVEL ×1.1/2/5/9. Brak smoothness nie dowodzi gładkości; `bad` karane ×4 / ×2. GRAVEL dopuszcza łatwy teren, ale nie wymusza jazdy szutrem zamiast spokojnego asfaltu. Warunki mokre, piach i stan sezonowy nie są wiarygodnie znane.

## Testy i artefakty

- `test_profiles.py` → 166 przypadków rzeczywistego interpretera BRoutera, w obu kierunkach i kontekstach way/node. To dowód polityki tagów, nie kompletności danych OSM.
- `test_fixture.py` + `FixtureBuilder.java` → mały PBF/RD5 poza repo, dwie publiczne drogi połączone jedynym łącznikiem; warianty bicycle=yes/no/dismount. Dodatni wynik kontrolny i odmowa obu profili bez legalnego przejazdu. To syntetyczny test end-to-end, nie twierdzenie o konkretnym prywatnym terenie.
- `cases.json` → stałe współrzędne, oczekiwania i cele. Oprócz wymaganych przypadków zachowano także nieudane testy snapowania i no-go. Kontrolna trasa 12-punktowa zamraża punkty z pierwszej zaakceptowanej geometrii; osobny test punktów arbitralnych pozostaje w zestawie.
- `summary.json` → długość, czas ścienny i CPU, klasy dróg i nawierzchnie, flagi z lokalizacją/tagami, snap końców, bliskość via względem wierzchołków. `accepted` oznacza tylko brak wykrytych sprzeczności i zgodność sum diagnostycznych; **nie akceptację terenową/produkcyjną**.
- `routes.geojson` → pełna geometria 3D z BRoutera, `comparison.html` → nakładka offline, `comparison.csv` → tabela, `review-flags.geojson` → punkty do QGIS. Nie ma zależności od publicznych map/API.
- Mianownik udziału nawierzchni: suma `Distance` wszystkich wierszy `messages`; kontrolujemy zgodność z track-length (tolerancja max 10 m / 0.1%). Są to dystanse diagnostyczne, nie precyzyjny pomiar terenowy. Missing i unknown nie są potwierdzoną nawierzchnią. WayTags/NodeTags są zredukowanymi tagami RD5, nie kompletnym OSM.
- `quality-audit.json` z `verify_results.py` → niezależna kontrola hashy, sum diagnostycznych, niedozwolonych klas i snapów >30 m (próg proponowany do przyszłej integracji, nie dowód przeszkody).
- `benchmark.json` → środowisko, JVM, limity, startup, idle i peak RSS, czasy/CPU zapytań, serie 1/2/4, rozmiary aplikacji/grafu, hashe profili i danych. RSS próbkowane co 50 ms plus VmHWM procesu; CPU z `/proc/PID/stat`. `cgroup-final.txt` → memory.peak, memory.events i cpu.stat; brak swapu. Osobno przechowujemy log serwera i próbki RSS.
- Cache OS nie był czyszczony; restart JVM oznacza zimny proces, **nie zimny dysk/cache**. Tylko po kilka próbek: nie traktujemy p95/p99 jako miarodajnego SLO. CPU laptopa i tło systemu różnią się od VPS. Cgroup memory peak może różnić się od RSS przez współdzielone biblioteki i wcześniej naliczony cache plików.

Duże dane są poza repo. `.gitignore` chroni RD5/APK i katalogi runtime, ale nie ignoruje dokumentacji/profili/wyników tekstowych. Usunięto wyłącznie dokładny wpis `docs` z lokalnego `.git/info/exclude` na życzenie zadania. To ustawienie lokalne Gita, nie plik możliwy do commitowania. Wcześniejsze materiały też pojawią się jako untracked; nie należy ich mylić z nowymi pomiarami ani automatycznie commitować całego `docs`.
