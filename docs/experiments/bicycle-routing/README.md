# Odizolowany eksperyment routingu

Wyniki z 15.10.2026. Pełna interpretacja i ograniczenia w [raporcie](../../bicycle-routing-research.md).

Otwórz `comparison.html` w przeglądarce: działa offline, pokazuje wybór trasy i przełączanie linii na wspólnej skali. Nie ma podkładu mapy ani oceny terenu; `comparison.geojson` pozwala nałożyć linie w GIS. Dane © OpenStreetMap contributors, [ODbL](https://www.openstreetmap.org/copyright); routing BRouter i OSRM.

`results/` zawiera 13 oryginalnych odpowiedzi: osiem BRouter, cztery OSRM cycling i jedną OSRM driving. `manifest.json` podaje URL, czas curl, status i SHA-256. Profile BRouter pobrano po zapytaniach; snapshoty zawierają ich licencję MIT. Nie znamy dokładnego snapshotu danych ani konfiguracji serwera dla każdej odpowiedzi.

Analiza offline, Python 3 bez dodatkowych pakietów:

```bash
python3 docs/experiments/bicycle-routing/analyze.py
```

Odtworzenie 13 zapytań sieciowych (jawne użycie publicznych demo, około kilkunastu–kilkudziesięciu sekund, bez retry i aplikacji produkcyjnej):

```bash
python3 docs/experiments/bicycle-routing/capture.py --output /tmp/tmr-bicycle-capture-new
python3 docs/experiments/bicycle-routing/analyze.py --results /tmp/tmr-bicycle-capture-new --output /tmp/tmr-bicycle-analysis-new
```

Wymaga `curl` i dostępu do DNS/HTTPS. Katalog capture musi być nowy; skrypt nie nadpisuje istniejącej serii. Nowe odpowiedzi mogą się różnić przez aktualizacje danych/profili. Przy błędzie capture zapisuje manifest i przerywa; analiza wymaga kompletnej serii. Aktualny skrypt nie pobiera snapshotów profili automatycznie. Ich źródła zapisano w manifeście pierwotnej serii.

Statystyki `surface_m` i `highway_m` sumują kolumnę `Distance` w `messages` BRoutera; sumy są sprawdzane względem `track-length`. `UNKNOWN` jest brakiem tagu w zwróconej diagnostyce, nigdy domniemanym asfaltem. Profile mogą nie wypisywać wszystkich tagów wejściowych. Flagi oznaczają miejsca do przeglądu: `bicycle=dismount` nie oznacza automatycznie zakazu przejścia pieszo. Dla OSRM nie ma pełnych statystyk nawierzchni.

Nie wykonano testów GraphHopper/Valhalla/ORS, 300+ km ani lokalnego zużycia zasobów. Czasy jednej próbki publicznego serwera nie są benchmarkiem. Nie ma zależności ani zmian w kodzie, konfiguracji i bazie TweakMyRoute.
