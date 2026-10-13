# TweakMyRoute Admin

Osobna aplikacja Kotlin/JVM + Compose Multiplatform Desktop do administracji istniejącym backendem. Nie łączy się z PostgreSQL, nie używa SSH i nie wykonuje poleceń systemowych. Wszystkie dane pochodzą z `/api/admin/*`; aplikacja nie ma trybu demonstracyjnego ani zastępczych danych.

## Uruchomienie na Ubuntu

Wymagane do developmentu: **JDK 21**, dostęp do Maven Central/Google Maven/Gradle oraz środowisko graficzne Ubuntu. Gradle Wrapper jest w repozytorium i sprawdza SHA-256 dystrybucji.

```bash
cd admin-desktop
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
./gradlew run
```

Na ekranie połączenia wybierz **Produkcja** (`https://tweakmyroute.com`) albo **Local** (`http://127.0.0.1:8151`). Sekret wpisz przy pierwszym poprawnym połączeniu; później aplikacja wczyta go automatycznie dla wybranego środowiska. Backend musi być wdrożony i skonfigurowany. Adresy profili można opcjonalnie nadpisać zmiennymi `TMR_ADMIN_PRODUCTION_API_URL` i `TMR_ADMIN_LOCAL_API_URL`. Dotychczasowe `TMR_ADMIN_API_URL` również działa i wybiera początkowy profil:

```bash
TMR_ADMIN_API_URL=https://tweakmyroute.com ./gradlew run
# Lokalny backend:
TMR_ADMIN_API_URL=http://127.0.0.1:8151 ./gradlew run
```

Publiczne linki dla produkcji prowadzą do `https://tweakmyroute.com/route/{publicId}`, a dla Local do `http://127.0.0.1:8150/route/{publicId}`. Adres publicznego frontendu można nadpisać:

```bash
TMR_ADMIN_API_URL=http://127.0.0.1:8151 \
TMR_ADMIN_PUBLIC_URL=http://127.0.0.1:8150 ./gradlew run
```

HTTP dopuszczamy tylko dla literalnego `127.0.0.1` lub `[::1]`. Zdalne API musi mieć poprawny certyfikat HTTPS. Klient nie śledzi przekierowań i nie wyłącza weryfikacji TLS. Podaj od razu końcowy adres serwera.

Na życzenie użytkownika sekret jest zapamiętywany **jawnie w lokalnym pliku**, osobno dla obu środowisk: `~/.config/tweakmyroute-admin/production.json` i `local.json` (lub pod `XDG_CONFIG_HOME`). Katalog ma uprawnienia 700, a pliki 600. Zapis jest atomowy i następuje dopiero po poprawnym uwierzytelnieniu. Sekret pozostaje przypisany także do dokładnego adresu API, więc zmiana adresu profilu wymaga ponownego podania klucza. Nie jest umieszczany w kodzie, pakiecie `.deb` ani logach. Pole sekretu jest maskowane. Przycisk „Zapomnij zapisany klucz” usuwa zapis dla wybranego środowiska. Rozłączenie zamyka klienta, ale zachowuje zapis na kolejne uruchomienie. Systemowy keyring pozostaje opcją przyszłego etapu.

## Instalator Linux

Buduj na Linux x86_64 z JDK 21 i narzędziami `dpkg-deb`/`fakeroot`:

```bash
./gradlew test packageDeb
sudo apt install ./build/compose/binaries/main/deb/tweakmyroute-admin_0.1.1_amd64.deb
```

Pakiet zawiera własny runtime Java. Zainstalowana aplikacja jest dostępna w menu oraz jako `/opt/tweakmyroute-admin/bin/tweakmyroute-admin`. Użytkownik instalatora nie potrzebuje Gradle ani JDK. Pakiet jest przeznaczony na architekturę używaną podczas budowania; nie jest to cross-compilation.

Gotowy pakiet z tej realizacji zbudowano i uruchomiono na Ubuntu 24.04, amd64. Dla starszego Ubuntu buduj na docelowym systemie, aby wygenerować odpowiednie zależności bibliotek systemowych.

## Konfiguracja backendu

Backend domyślnie wyłącza administrację (503), dopóki `ADMIN_SECRET` jest pusty. Wygeneruj **32 losowe bajty**, zapisane jako 64 małe znaki hex:

```bash
openssl rand -hex 32
```

Wartość skonfiguruj jako `ADMIN_SECRET` w istniejącym, prywatnym pliku środowiska backendu. Nie wklejaj jej do repozytorium, README, argumentów procesu ani przykładów curl. Plik powinien mieć ograniczone uprawnienia (np. 600). Backend odrzuca przy uruchomieniu niepoprawny format; format nie zastępuje generowania kryptograficznie losowej wartości.

Docker Compose przekazuje `ADMIN_SECRET` z lokalnego `.env`; `.env.example` zawiera tylko puste pole. Bez sekretu publiczna część serwisu działa jak dotychczas. Dla lokalnego developmentu backendu:

```bash
cd api
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
mvn spring-boot:run -Dspring-boot.run.profiles=local
```

Spring musi dostać `ADMIN_SECRET` z bezpiecznie przygotowanego środowiska procesu. Pozostałe ustawienia PostgreSQL, storage i DEM pozostają zgodne z głównym README i `ELEVATION.md`.

Uwierzytelnienie jest bezstanowe: nagłówek `Authorization: Bearer …` przy każdym zapytaniu, porównanie skrótów SHA-256 przez `MessageDigest.isEqual`, brak kont i sesji administratora. Rotacja sekretu i restart backendu unieważniają dostęp poprzedniego klienta; 401/403 powodują powrót do ekranu logowania. Po 20 nieudanych próbach w minutowym oknie wszystkie kolejne próby otrzymują 429 z `Retry-After`, zanim backend porówna sekret. Limit jest globalny dla jednego procesu, bez ufania nagłówkom IP; w czasie blokady również administrator musi odczekać koniec okna. Poprawne zapytania przed blokadą nie zużywają limitu. Przy wielu instancjach trzeba będzie przenieść limit do wspólnego magazynu/proxy.

## Co wdrożyć na VPS

1. Przygotuj backup PostgreSQL, GPX i preview storage zgodnie z dotychczasową procedurą.
2. Dodaj `ADMIN_SECRET` do istniejącego EnvironmentFile jednostki `tweakmyroute-api.service`; konkretna ścieżka tego pliku nie znajduje się w repozytorium.
3. Wdróż nowy JAR backendu, np. istniejącym `./deploy.sh api`. **To polecenie wdraża produkcję — implementacja nie uruchamia go automatycznie.** Flyway zastosuje nową migrację V11: audyt i indeksy, bez usuwania danych i bez zmian istniejących migracji. Spring zapisze również metadane wersji buildu.
4. Sprawdź, że istniejący HTTPS reverse proxy przekazuje `/api/admin/` i `Authorization` do Spring Boot. Wyłącz cache dla tej ścieżki; odpowiedzi wysyłają `Cache-Control: no-store`. Nie dodawaj logowania nagłówka Authorization. Backend powinien być dostępny z internetu przez HTTPS proxy; bezpośredni port Spring należy ograniczyć do loopback/firewalla. Nie uznajemy dowolnego nagłówka `X-Forwarded-Proto` za dowód bezpiecznego transportu.
5. Uruchom desktop i sprawdź diagnostykę oraz odczyty. Pierwsze operacje zmieniające status wykonuj na świadomie wybranej trasie testowej.

Frontend Next.js nie wymaga zmian ani ponownego budowania. Aplikacji desktopowej nie instaluje się na VPS. Instrukcja opisuje sprawdzony skrypt i nazwy usług z repozytorium; nie zakłada inspekcji ani zmiany prywatnej konfiguracji produkcyjnej.

## Funkcje

- Dashboard: liczby wszystkich/aktywnych/usuniętych tras, utworzenia w ostatnich 7/30 dniach, wersje, sugestie według moderacji, ostatnie trasy i aktywność.
- Trasy: server-side pagination (25 w UI, maks. 100 w API), wyszukiwanie po nazwie/ID/Public ID, status, zakres dat utworzenia w UTC, sortowanie oraz kandydaci do przeglądu. Nazwa i ID są wyszukiwane jako literalny fragment, bez interpretacji `%`/`_` jako wildcardów.
- Kandydaci: mniej niż 1 km, pusta nazwa, `test`/`debug`/`tmp`, ponad 180 dni bez sugestii, brak aktualnej wersji/niepoprawna geometria/za mało punktów/zerowa długość. Żaden filtr niczego nie usuwa. Brak elewacji sam w sobie nie oznacza błędnej trasy.
- Szczegóły: metadane, oryginał GPX, statystyki geometrii, paginowane wersje, sugestie, aktywność i referencje do plików z obecnością/rozmiarem. Komentarze pokazujemy jako rzeczywistą liczbę i zdarzenia, bez osobnego edytora komentarzy.
- Soft delete i restore: potwierdzenie nazwy + świadome zaznaczenie zgody. Nie zmieniają wersji, plików, moderacji ani ustawienia sugestii. Przywrócenie przywraca publiczną widoczność; istniejące linki i ważne sesje właścicielskie znów działają.
- Zbiorczy soft delete: wybór aktywnych tras z bieżącej strony, lista ID/nazw i wymagane wpisanie frazy potwierdzenia. Wybór jest czyszczony przy zmianie strony/filtrów. Backend blokuje trasy w kolejności ID, sprawdza każdą i zatwierdza wszystkie albo żadną.
- Sugestie: tylko odczyt, filtr moderacji, wyszukiwanie trasy, typ, treść, data, integracja i applicability; bez obchodzenia publikacji/scalania właściciela.
- System: prawdziwy test połączenia SQL, wersja backendu z build-info (lub `unknown`), rozmiar bazy, liczba odrębnych referencji GPX i zadań preview. Bez haseł, adresów baz i konfiguracji infrastruktury.
- Permanent delete: tylko dry-run; nie ma endpointu wykonującego trwałe usuwanie ani przełącznika włączającego je. Szczegóły projektu w [ARCHITECTURE.md](ARCHITECTURE.md).

Operacje administracyjne zapisują zdarzenie z aktorem `ADMIN` w `route_activity` oraz wpis w `admin_audit`: czas, operacja, ID i wynik. Zdarzenia ADMIN są widoczne wyłącznie przez API administracyjne; istniejące publiczne i właścicielskie listy zachowują swoje typy zdarzeń i sposób prezentacji. Sukces i audyt są atomowe. Odrzucona transakcja zapisuje odrębnie wynik REJECTED/FAILED, bez sekretu i treści użytkownika. Nie zmieniamy uprawnień publicznych ani właścicielskich.

## API i struktura kodu

```text
admin-desktop/
  src/main/kotlin/com/tweakmyroute/admin/
    api/     DTO, walidacja adresu, Ktor, bezpieczne komunikaty błędów
    state/   StateFlow, stan nawigacji, anulowanie odczytów, polecenia
    preferences/  prywatne pliki lokalnych poświadczeń, osobno dla profili
    ui/      Material 3, ekrany, wspólne komponenty, polskie etykiety
  src/test/  serializacja, MockEngine, stan, opcjonalne smoke testy
api/src/main/java/pl/routecommunity/api/
  admin/     auth filter, DTO, controller, projekcje SQL, audyt
  route/AdminRouteMutationService.java  dostęp do istniejącej domeny
```

Jeden moduł JVM, bez DI frameworka i bez klas ViewModel zależnych od Androida. `AdminStore` pełni rolę ViewModelu i zamyka scope/klienta przy zamknięciu okna. Ktor wykonuje IO poza wątkiem UI; przejście do innego odczytu anuluje poprzedni. Nawigacja jest blokowana podczas zmiany danych. Polecenia nie są automatycznie ponawiane: po utracie odpowiedzi aplikacja odświeża status i informuje, że wynik trzeba sprawdzić.

Wersje przypięte podczas realizacji: Kotlin 2.4.21, Compose 1.12.1, **stabilne Material 3 1.9.0** (zamiast domyślnej alphy), Ktor 3.6.0, Coroutines 1.11.0, Serialization 1.11.0, Gradle 9.5.1. Zgodność i stabilne wydania sprawdzono w [dokumentacji Kotlin](https://kotlinlang.org/docs/gradle-configure-project.html), [wydaniu Compose](https://github.com/JetBrains/compose-multiplatform/releases/tag/v1.12.1) i [wydaniach Ktor](https://ktor.io/docs/releases.html); kompilację i pakowanie sprawdzamy lokalnie.

Endpointy odczytu: `GET /api/admin/dashboard`, `/system`, `/routes`, `/suggestions`, `/routes/{id}`, `/routes/{id}/versions`, `/routes/{id}/activity`, `/routes/{id}/files`, `/routes/{id}/permanent-delete-plan`. Polecenia: `PATCH /api/admin/routes/{id}/status` i `POST /api/admin/routes/bulk-soft-delete`.

Listy nie przesyłają geometrii. Zapytania używają jawnych DTO i wiązanych parametrów, a sortowanie ma whitelistę. Liczniki relacji są częścią jednego zapytania SQL, bez pobierania encji i bez N+1 round trips. Szczegóły także ograniczają ilość danych; wszystkie duże relacje mają osobne strony. Dry-run pokazuje najwyżej 100 referencji plików i kieruje do paginowanej listy przy większej liczbie. Statystyki storage nie skanują całego dysku ani DEM.

## Weryfikacja

```bash
cd api && mvn test
cd ../admin-desktop && ./gradlew test packageDeb
cd ../web && npm test && npm run typecheck
```

Integracyjne testy backendu wymagają Docker/Testcontainers z PostGIS. Sprawdź brak pominiętych testów. Nie wykonują żadnego połączenia do produkcji.

Weryfikacja podczas realizacji (13.10.2026): pełny zestaw **83 testów backendu**, **12 testów desktopu** i **58 istniejących testów frontendu** zakończył się bez błędów i pominięć. Przeszedł także frontend typecheck. Po izolacji zdarzeń ADMIN powtórzono testy administracji i zarządzania właścicielskiego oraz zbudowano finalny JAR. Rzeczywisty lokalny backend przeszedł HTTP smoke z klientem Ktor i graficzny smoke Compose (dashboard, trasy, szczegóły, dry-run, małe okno). Pakiet `.deb` zbudowano, rozpakowano do `/tmp` i uruchomiono jego launcher z dołączonym runtime. Nie instalowano pakietu systemowo i nie wdrażano produkcji.

Aktualizacja **0.1.1**: dropdown Produkcja/Local i zapamiętywanie klucza. **19 testów desktopu** przeszło, w tym restart magazynu, rozdzielenie profili, uprawnienia 700/600, zmiana adresu, usuwanie zapisu, nieudane uwierzytelnienie i błąd zapisu. Ponownie przeszedł lokalny HTTP/UI smoke; po rozłączeniu ekran połączenia automatycznie wczytał zapisany klucz Local. Backend nie wymaga aktualizacji dla tych zmian.

Dodatkowe zadania `apiSmoke` i `uiSmoke` są celowo ograniczone do `http://127.0.0.1:18151`. Wymagają uruchomionego **tymczasowego** backendu z izolowaną bazą/storage i tym samym `ADMIN_SECRET` przekazanym do procesu testowego jako `TMR_ADMIN_SMOKE_SECRET`. `apiSmoke` tworzy dwie rzeczywiste trasy i wykonuje soft delete/restore/bulk. `uiSmoke` potrzebuje środowiska graficznego, `TMR_ADMIN_LOCAL_API_URL=http://127.0.0.1:18151` oraz `XDG_CONFIG_HOME` ustawionego na katalog testowy w `/tmp`. Pokazuje dane w prawdziwym UI, sprawdza zapis/wczytanie testowego sekretu, zapisuje wyłącznie własne okno w `/tmp/tmr-admin-screenshots` i kończy proces. Nie uruchamiaj tych zadań przeciwko bazie z wartościowymi danymi.

## Świadomie odłożone

Mapa osadzona w Compose, systemowy keyring, wiele kont/role, trwałe usuwanie, automatyczne sprzątanie, edycja moderacji/mergowania i pełny monitoring. Polskie etykiety domenowe zebrano w `Pl`; do pełnej lokalizacji należy później przenieść wszystkie teksty ekranów do zasobów. Nie dodajemy teraz pustego przełącznika języka.
