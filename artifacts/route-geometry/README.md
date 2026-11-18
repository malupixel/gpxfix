# Podgląd operacji geometrii

Zrzuty z testu Playwright `move start on open track requires declaration and previews routed closure`:

- [Desktop — podgląd domknięcia i odwrócenia](desktop-closure.png)
- [Emulacja Pixel 7 — ten sam przepływ](mobile-closure.png)

Test działa na izolowanym API, PostGIS i prawdziwym MapLibre w Chromium.
Pusta mapa bazowa i prosty przebieg domknięcia pochodzą z deterministycznych
fixture; zrzuty pokazują interfejs i wyróżnienie dodanego odcinka, nie jakość
zewnętrznego routingu. Polskie etykiety, idealna pętla i zapis nowej wersji
są w osobnym teście `closed loop automatically detected Polish preview and save`.

Opis implementacji i konfiguracji: [edytor geometrii](../../docs/route-geometry-editor.md).

Wyniki: [verification.json](verification.json). Pełna próba została przerwana; pozytywne wyniki 88 różnych przypadków pochodzą z kilku przebiegów. Końcowe 12 testów na ostatnim obrazie API przeszło bez błędów.
