# TweakMyRoute — strona główna

Screenshoty z prawdziwego Chromium, w polskiej wersji językowej, na etapie
ręcznej akceptacji propozycji. Każdy plik pokazuje całą stronę:

- [320 px](home-320-pl.png)
- [375 px](home-375-pl.png)
- [768 px](home-768-pl.png)
- [1440 px](home-1440-pl.png)

Obraz mapy jest autorską ilustracją. Trasa i objazd są przykładowymi danymi,
a nie trasą do nawigacji. Formularz obok demonstracji korzysta z właściwego API;
sama demonstracja nie wysyła żądań do API.

Testy generujące screenshoty: `e2e/tests/landing.spec.ts`. Raport Playwright
zawiera dodatkowo screenshoty w emulacji Pixel 7 oraz diagnostykę przeglądarki.

Weryfikacja: 52/52 testów pełnej regresji E2E, 72/72 testów frontendu,
ESLint, TypeScript i build produkcyjny. Po końcowej korekcie położenia dymku
na telefonie ponownie przeszło 14/14 testów strony głównej, z dodatkowym
sprawdzeniem, że znacznik mety nie jest zasłonięty. Statystyki: `verification.json`.

Dodatkowo: [widok przed przebudową](home-before-1440-pl.png).

[Gotowa trasa — wersja EN](home-ready-1440-en.png) pochodzi z dodatkowego
przebiegu w rzeczywistym czasie na lokalnej aplikacji (`http://localhost:8150`).
Pełny cykl trwał około 15,7 s, bez błędów konsoli i bez żądań do API,
które było blokowane w przeglądarce. Zapis: `browser-smoke.json`.
