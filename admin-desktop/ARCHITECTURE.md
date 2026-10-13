# Analiza modelu i projekt bezpiecznego permanent delete

## Zweryfikowany model

Źródłem prawdy są migracje `api/src/main/resources/db/migration/V1__…` do V10 oraz istniejące klasy domenowe, a nie założenia o nazwach tabel.

| Zasób | Referencje i znaczenie |
|---|---|
| `routes` | public_id, metadata, created/updated/deleted_at, suggestions_enabled, owner_token_hash, current_version_id, original_upload_storage_key/filename |
| `route_versions` | immutable geometria PostGIS LineString/SRID 4326, distance_meters, elewacja, GPX storage_key, editor_definition JSONB; route_id, based_on_version_id, merged_suggestion_id |
| `route_suggestions` | route_id, base_version_id, merged_into_version_id; typ NOTE/PROBLEM/DETOUR, moderacja PENDING/PUBLISHED/REJECTED, integracja i applicability, propozycja geometrii |
| `suggestion_comments` | komentarze sugestii, własna moderacja, suggestion_id |
| `route_owner_sessions` | token_hash i expires_at, route_id, cascade przy usunięciu trasy |
| `route_activity` | route_id, version_id, suggestion_id, comment_id; te FK **nie** mają cascade; public/owner-only oraz idempotency keys |
| `route_share_previews` | version_id + name; revision, ready, attempts i next_attempt_at; cascade po wersji |

V7 tworzy wzajemne FK versions ↔ suggestions i current_version_id oraz odraczane triggery weryfikujące właściciela wersji. V8 dodaje soft delete i aktywność; publiczne repozytoria używają `deleted_at IS NULL`. V9/V10 tworzą/regenerują lokalne podglądy, pozostawiając starsze pliki poza referencjami.

`RouteVersionCreationService` zapisuje wygenerowany GPX każdej wersji. Jeśli bytes oryginału odpowiadają bytes wersji, oba korzystają z tego samego klucza. Jeśli wzbogacenie zmienia plik, oryginał ma osobny klucz. Referencje do oryginałów starszych tras mogą być NULL: brak referencji nie dowodzi braku historycznego pliku.

`LocalFileStorage` używa `app.storage.gpx-path` / `GPX_STORAGE_PATH` i wygenerowanych kluczy UUID.gpx. `RoutePreviewStore` zapisuje `{revision}.png` w `app.preview.storage-path`, domyślnie podkatalogu `previews` storage GPX. Nie ma potrzeby udostępniania absolutnych ścieżek desktopowi. Kolejka preview trwa w PostgreSQL i worker działa asynchronicznie. Pliki niezwiązane z referencjami nie są identyfikowane ani usuwane.

Istniejące bezpieczeństwo opiera się na losowym linku właścicielskim, hashu SHA-256 i cookie route_owner z wygasającą sesją. Administrator używa odrębnego filtra Bearer wyłącznie na `/api/admin/*`; jego token nie ustanawia sesji właściciela i nie autoryzuje endpointów publicznych/owner. Publiczny kontrakt API pozostaje taki sam. Jedyna wspólna zmiana domenowa to ponowne użycie `Route.delete` i dodanie `Route.restore`.

Repozytorium zawiera deployment przez SSH/rsync i systemd (`deploy.sh`, `tweakmyroute-api.service`, `tweakmyroute-web.service`), z Java 21 i backendem na porcie 8151. Dostęp HTTPS obsługuje istniejące proxy `/api/`. Dokładny EnvironmentFile, reguły firewalla i pełna konfiguracja Nginx nie są w repozytorium i wymagają sprawdzenia przy wdrożeniu. Desktop nie używa tego mechanizmu deploymentu.

## Implementowany dry-run

`GET /api/admin/routes/{id}/permanent-delete-plan` wymaga administratora i działa w transakcji REPEATABLE_READ. Liczy wersje, sugestie, komentarze, aktywność, sesje i zadania preview. Lista plików łączy referencje oryginału/wersji/podglądów, deduplikuje wspólne GPX, sprawdza obecność i rozmiar najwyżej 100 plików. Większe listy są paginowane przez `/files`. Pliki nie są otwierane w całości, a symlinki do plików nie są śledzone. Stan filesystemu może zmienić się niezależnie od transakcji SQL.

Dry-run nie blokuje domeny do czasu przyszłego zatwierdzenia, nie tworzy zadań usuwania i zawsze zwraca `executable=false`. Nie ma endpointu DELETE ani konfiguracji umożliwiającej włączenie wykonania.

## Propozycja przyszłej operacji — do osobnego przeglądu

1. Wymagaj wcześniejszego soft delete, ponownego podania konkretnego ID/Public ID i aktualnego podsumowania zależności. Sprawdź backup oraz wyłączne uprawnienie administratora. Przed zmianą ponownie zablokuj trasę i zweryfikuj status.
2. Dodaj trwały stan operacji, który uniemożliwi restore/nowe wersje i blokuje claim/write workerów preview. Sam istniejący soft delete nie rozwiązuje całego problemu: worker może już mieć leasing albo kończyć generowanie. Potrzebny jest przegląd synchronizacji i restart/recovery workerów.
3. Zapisz manifest **odrębnych** kluczy plików, referencji i identyfikator operacji w trwałej kolejce poza usuwanymi tabelami. Sprawdź, że żaden klucz nie jest współdzielony przez inną trasę. Nie rozpoznawaj plików na podstawie arbitralnych nazw ani ścieżek użytkownika.
4. W transakcji usuń zależności w kolejności zatwierdzonej osobnym testem na PostGIS. Zwykłe cascade nie wystarczy: `route_activity` blokuje usuwanie, a `routes.current_version_id`, `route_versions.based_on_version_id/merged_suggestion_id` i `route_suggestions.base_version_id/merged_into_version_id` tworzą cykle. Istniejące FK są przeważnie natychmiastowe; odraczane triggery nie oznaczają odraczanych FK. Potrzebna będzie osobna migracja strategii FK lub kontrolowana zmiana relacji/constraints. Nie rozluźniaj obecnych niezmienników przy tym MVP.
5. Zatwierdź usunięcie SQL wraz z audytem i manifestem. **Dopiero po commicie** wykonuj idempotentne usuwanie/quarantine plików przez kolejkę, z retry i bez ignorowania błędów I/O. Nigdy nie usuwaj plików przed transakcją, którą można wycofać. Partial failure powinien być jawnie widoczny i możliwy do wznowienia.
6. Zachowaj `admin_audit` bez FK do routes. Sprawdź audyt, brak dangling references, opublikowane URL 404, brak odtworzenia preview, timeouty, rollback, crash przed/po commicie, współbieżne restore/owner edit/worker, współdzielenie kluczy i błąd usuwania pliku.

To dokument projektu, a nie wykonywalny skrypt. Wdrożone MVP nie usuwa trwale żadnych tras ani plików.
