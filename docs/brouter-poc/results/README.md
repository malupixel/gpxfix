# Indeks pomiarów

Nie łączyć statystyk różnych rewizji jako jednego pomiaru. Bieżące profile: 1.0.1, twarda lista klas highway. Dokumentacja i raport w katalogu nadrzędnym.

## Aktualna rewizja 1.0.1

- `profile-tests-1.0.1.json`: 166/166 testów interpretera.
- `v1.0.1-1024m/`: pełny korpus jakości + benchmark, heap 640 MiB / cgroup 1024 MiB / 2 CPU. Snapshot cases.json zachowuje pierwotne błędne oczekiwanie NO_ROUTE dla `nogo-timeout-problem`; `nogo-semantics.json` wyjaśnia usuwanie no-go obejmujących waypointy i identyczną geometrię kontroli. Nie zaliczać tego jako nieudanego testu bicycle=no. Bieżący cases.json ma skorygowaną kontrolę dodatnią `nogo-endpoint-exemption`.
- `v1.0.1-512m/`: korpus krótki/długi/12 punktów + obciążenie, heap 320 MiB / 512 MiB.
- `v1.0.1-256m/`: analogicznie, heap 128 MiB / 256 MiB.
- `v1.0.1-native/`: analogicznie bez Dockera, Java 17, heap 640 MiB, dwa logiczne CPU przez affinity.
- `v1.0.1-synthetic/`: sześć testów end-to-end na kontrolnym RD5, dozwolony łącznik oraz bicycle=no/dismount.
- `data-manifest.json`: niezmienny manifest pobranych regionalnych danych i ZIP; brak dużych danych w Gicie.

## Odrzucona rewizja 1.0.0 i próby techniczne

Zachowano do audytu i reprodukcji błędów, **nie są wynikiem końcowego profilu**:

- `profiles-1.0.0/`: oba historyczne profile odpowiadające hashom w pierwszych seriach. Zawierały błąd: min 9998 dopuszczało skrajnie kosztowną krawędź bez highway (6 m toru tramwajowego przy celu w Łodzi). Niezależny `quality-audit.json` pierwszej pełnej serii wykrywa ten błąd mimo wcześniejszego accepted=true.
- `profile-tests.json`: pierwotne 156 testów; brakowało regresji dla torów, uzupełnionej w 1.0.1.
- `native-640m/`, `cgroup-1024m/`: puste katalogi po odmowie sandboxa / konflikcie portu, nie pomiary.
- `native-640m-run1/`: zły typ parametru diagnostycznego, serwer zwracał 500; wyniki nieważne.
- `native-640m-run2/`: BRouter zwrócił niepoprawny JSON z samotnym exportCorrectedWaypoints=1; seria przerwana po rozpoznaniu problemu, bez benchmark.json.
- `cgroup-1024m-run1/`: sprawdzanie samego portu Dockera za wcześnie uznało usługę za gotową; connection reset, wyniki nieważne. Naprawiono weryfikacją odpowiedzi HTTP.
- `cgroup-1024m-final/`, `cgroup-512m-final/`, `cgroup-256m-final/`, `native-final/`: ukończone pomiary rewizji 1.0.0, odrzuconej po przeglądzie geometrii i diagnostyki. Słowo final w starych nazwach nie oznacza aktualnej rekomendacji.
- `synthetic-access/`: rzeczywisty NO_ROUTE `target island detected` był pierwotnie oznaczony failed przez zbyt wąskie oczekiwanie tekstu błędu; zachowano. `synthetic-access-final/`: test oczekiwań poprawiony, oba profile odmawiają no/dismount, kontrola yes przejeżdża; nadal profil 1.0.0.

Raw JSON z błędnym trailing comma zachowano celowo, nie poprawiano go po cichu. Wszystkie foldery bez aktywnej rewizji są materiałem diagnostycznym; nie importować ich automatycznie do zbiorczego benchmarku.
