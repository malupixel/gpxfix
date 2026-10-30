# Audyt serwisu — 30.10.2026

Testowano aktualne źródła w lokalnym, odizolowanym środowisku opisanym w README.
Zmiany obejmują testy i dokumentację; usterek aplikacji nie naprawiano w tym audycie.

## Wynik E2E

18 scenariuszy × desktop i emulacja Pixel 7 = 36 przypadków.
30 przypadków przeszło bez wykrytych usterek aplikacji. Pozostałe 6 odtwarza
3 opisane niżej błędy (każdy na obu profilach). Nie pomijano scenariuszy.

W pełnym przebiegu test BUG-001 ujawnił również wyścig w samym teście:
czekał na dowolny zapis localStorage, zamiast zapisu obu punktów. Poprawiono
oczekiwanie na pełny szkic i powtórzono wyłącznie ten test na obu profilach
w nowym, pustym środowisku: oba odtworzyły dokładnie błąd React #418,
ze szkicem prawidłowo przywróconym. Pozostałych testów nie zmieniano.

`test.fail` oznacza oczekiwane niepowodzenie aplikacji, a nie naprawioną funkcję.
Oba przebiegi sprawdziły także automatyczne usuwanie środowiska — po błędzie
i po przebiegu zgodnym z oczekiwaniami. Raport HTML z ostatniego powtórzenia
jest dostępny przez `npm run report`; raport pełnego przebiegu audytu
(zawierający także wcześniejszy błąd synchronizacji testu) zachowano lokalnie
w `playwright-report/full-audit`: `npm run report -- playwright-report/full-audit`.
Raporty są generowane lokalnie i nie są dodawane do repozytorium.

## Pozostałe uruchomione kontrole

- Frontend: 68/68 testów jednostkowych zaliczonych.
- API: 83/83 testów zaliczonych, 0 błędów i 0 pominiętych; integracje
  uruchomione w Javie 21 z rzeczywistymi bazami PostGIS/Testcontainers.
- ESLint, TypeScript i budowanie obrazów aplikacji: zaliczone.

## Potwierdzone usterki

### BUG-001 — React hydration przy przywracaniu szkicu (P2)

1. Otwórz `/draw` i dodaj co najmniej dwa punkty.
2. Poczekaj na zapis szkicu w localStorage i odśwież stronę.
3. Szkic wraca, ale w przeglądarce pojawia się `Minified React error #418`.

Powtarzalne w Chromium na desktopie i w emulacji Pixel 7.
`web/src/features/route-editor/route-editor.tsx` inicjalizuje reducer pustym
stanem na serwerze oraz szkicem z localStorage w pierwszym renderze klienta.
Pierwsze rendery mają przez to inne teksty, stany przycisków i liczbę punktów.
Proponowana naprawa: zgodny stan początkowy SSR/klienta i odtworzenie szkicu
po zamontowaniu komponentu, z ochroną przed nadpisaniem zapisu pustym stanem.
Regresja: `editor.spec.ts`, test `BUG-001`.

### BUG-002 — frontend proxy API i obrazy udostępniania zwracają 500 (P1)

1. Uruchom standardowo obrazy Docker API i web.
2. Wywołaj `GET http://localhost:8150/api/health` — otrzymasz HTTP 500.
3. Utwórz trasę i odczytaj jej `og:image` w HTML; żądanie obrazu przez
   frontend również zwraca 500 (odtworzone w E2E na porcie 8250).

Bezpośrednie API odpowiada poprawnie. Log web pokazuje `ECONNREFUSED`
dla `::1:8080` i `127.0.0.1:8080` wewnątrz kontenera frontendu.
`web/next.config.ts` odczytuje `API_INTERNAL_URL` podczas budowania rewrites,
a `web/Dockerfile` nie przekazuje tej zmiennej do etapu budowania.
Ustawienie jej wyłącznie w runtime Compose nie zmienia zapisanej reguły.
Proponowana naprawa: przekazać właściwy adres przy budowaniu lub zastosować
proxy odczytujące adres w runtime. Potwierdzić także pobranie PNG pod adresem
z `og:image` po przebudowaniu obrazu.
Nie badano produkcji; konfiguracja reverse proxy produkcji może być inna.
Regresja: `api.spec.ts`, test `BUG-002`.

### BUG-003 — nowa sugestia właściciela nie pojawia się po wysłaniu (P2)

1. W trybie właściciela wybierz „Zaproponuj zmianę” i dodaj notatkę na trasie.
2. Wypełnij opis i nazwę, wyślij, a następnie wybierz „Gotowe”.
3. Zapis został przyjęty i pojawia się w aktywności, ale lista sugestii nadal
   pokazuje pusty stan. Nowa sugestia pojawia się dopiero po przeładowaniu.

`submitSuggestion()` w `web/src/features/routes/route-page-content.tsx`
nie aktualizuje listy ani nie uruchamia jej ponownego pobrania po sukcesie.
Proponowana naprawa: odświeżyć listę właściciela i stan ładowania po zakończeniu
zgłoszenia. Oczekujące zgłoszenia odwiedzających powinny pozostać niepubliczne.
Regresja: `community.spec.ts`, test `BUG-003`.

## Zakres sprawdzeń

- Strona główna, PL/EN i utrwalenie wyboru, licencje i brakująca trasa.
- Pusty i błędny GPX, import poprawnego pliku, nazwa zawierająca literalny
  znacznik HTML; zapis linku właściciela przy zablokowanym schowku.
- Rysowanie, cofanie/ponawianie, zapis, szkice, edycja właściciela,
  wersje historyczne i ich niezmienność.
- Notatka, problem na odcinku i objazd zgłaszane przez kliknięcia prawdziwej mapy.
- Publikowanie i cofanie publikacji sugestii, moderowanie komentarza,
  widoczność dla niezależnego odwiedzającego, scalenie objazdu i porównanie wersji.
- Import/ukrywanie/usuwanie GPX w tle, siatka, znaczniki odległości i pełny ekran.
- Zmiana nazwy/opisu, zamknięcie i otwarcie sugestii, udostępnianie,
  pobieranie GPX z własną nazwą bez wysokości i zgodność oryginalnego pliku.
- Izolacja uprawnień, odzyskanie dostępu prywatnym linkiem,
  usuwanie tylko testowej trasy z potwierdzeniem nazwy.
- Health API, autoryzacja administratora, wyszukiwanie, soft delete i przywrócenie,
  nieaktywna możliwość trwałego usuwania, publiczne metadane udostępniania.
- Wyjątki JavaScript, błędy konsoli, nieudane żądania oraz odpowiedzi 4xx/5xx.

## Ograniczenia

To audyt aktualnych przepływów i zestawu regresji, nie dowód braku wszystkich błędów.
Playwright MCP nie był udostępniony w sesji: użyto Playwright Test z prawdziwym Chromium.
Emulacja telefonu nie zastępuje fizycznego urządzenia. Firefox, Safari, aplikacja
administracyjna Kotlin/Compose, dostępność klawiaturą/czytnikiem w całym serwisie,
wydajność pod obciążeniem oraz awarie sieci na każdym kroku wymagają dalszych testów.
Zewnętrzne kafelki, routing i wysokości zastąpiono deterministycznymi fixture;
jakość tych danych i dostępność dostawców nie są objęte wynikiem E2E.
Lokalny DEM ma osobne testy backendowe. Nie wykonywano operacji na produkcji.
