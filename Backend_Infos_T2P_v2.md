# Informationen für die Backend-Gruppe (t2p-2.0 / v2-API)

Stand: 2026-07-05. Alle Punkte wurden vom Frontend aus (Angular, `t2pHttpService.ts`) live gegen `https://woped.dhbw-karlsruhe.de/t2p-2.0/` getestet. Frontend-seitig ist die Anbindung an den v2-Contract (`/v2/generate/bpmn`, `/v2/generate/pnml`, `/v2/models`) korrekt umgesetzt (Bearer-Auth, `{text, provider, model, prompting_strategy}`, Modellwahl richtet sich nach der Registry aus `/v2/models`). Die unten stehenden Punkte liegen nach aktuellem Kenntnisstand serverseitig.

---

## 1. `/v2/generate/pnml` hängt sich bei erfolgreicher Generierung auf (kritisch)

**Symptom:** Bei der Petri-Netz-Generierung über `/v2/generate/pnml` kommt nach Absenden weder ein Fehler noch ein Ergebnis zurück. Manuell getestet: nach 5 Minuten Wartezeit ohne jede Reaktion abgebrochen.

**Eingrenzung:** Direkter Vergleich mit identischem Prompt gegen `/v2/generate/bpmn` (funktioniert normal, Antwort in Sekunden) zeigt, dass der LLM-Aufruf selbst nicht die Ursache ist. Mit ungültigem API-Key antworten beide Endpunkte gleich schnell (~5,5 s) mit `500 upstream_error`:

```bash
curl -s -X POST "https://woped.dhbw-karlsruhe.de/t2p-2.0/v2/generate/pnml" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <INVALID_KEY>" \
  -d '{"text":"Der Prozess beginnt, wenn eine Rechnung eingeht. ...","provider":"openai","model":"gpt-5-mini","prompting_strategy":"zero_shot"}'
# -> HTTP 500, ~5.5s, {"error":{"code":"upstream_error","message":"The LLM provider call failed."}}
```

Das identische Verhalten bei `/v2/generate/bpmn` mit demselben ungültigen Key (ebenfalls ~5,5 s, gleicher Fehler) zeigt: Der Unterschied zwischen beiden Endpunkten liegt nicht im LLM-Aufruf, sondern in dem, was laut API-Doku nur `/v2/generate/pnml` zusätzlich macht — BPMN→PNML-Transformation plus Layout-Koordinaten-Zuweisung nach einer *erfolgreichen* Generierung. Mit gültigem Key und erfolgreicher LLM-Antwort tritt genau dort die Blockade auf.

**Vermutung:** Bug oder Deadlock im serverseitigen Transform-/Layout-Schritt von `/v2/generate/pnml`, der nur bei tatsächlich erfolgreicher LLM-Antwort erreicht wird (deshalb beim Fehlerfall mit ungültigem Key nicht sichtbar).

**Erwartetes Verhalten:** Antwort mit `{result: <PNML>}` in ähnlicher Zeit wie `/v2/generate/bpmn`, oder ein sauberer Timeout/Fehler statt eines unbegrenzten Hängens.

**Priorität:** Hoch — das Feature ist für Nutzer aktuell nicht nutzbar (kein Fehler, kein Ergebnis, UI bleibt im Ladezustand).

---

## 2. Gemini-Provider liefert `500 upstream_error` bei `/v2/generate/bpmn` (offen)

**Symptom:** Identischer Prompt, der mit `provider: "openai", model: "gpt-5-mini"` erfolgreich ein Ergebnis liefert, schlägt mit `provider: "gemini", model: "gemini-2.0-flash"` fehl:

```json
{"error":{"code":"upstream_error","message":"The LLM provider call failed."}}
```

**Kontext:** Gemini-API-Key wurde vorab separat validiert (funktioniert für andere Zwecke im Frontend). Modell/Provider-Kombination ist laut `/v2/models` korrekt registriert (`{"model":"gemini-2.0-flash","provider":"gemini"}`).

**Vermutung:** Problem in der Connector-Anbindung an die Gemini-API selbst (falsches Auth-Format für Gemini, falscher Modell-Endpunkt-Name o. Ä.), da OpenAI mit identischer Anfragestruktur funktioniert.

**Priorität:** Mittel-hoch — Gemini ist für T2P aktuell komplett unbenutzbar.

---

## 3. P2T: PNML→BPMN-Transformation liefert `400`

**Symptom:** Beim Hochladen einer `.pnml`-Datei in P2T kam die Fehlermeldung `PNML→BPMN Transformation fehlgeschlagen: 400` (Transformer-Service, nicht t2p-2.0 selbst).

**Offen:** Die genaue Testdatei liegt uns noch nicht vor — wird nachgereicht, damit ihr das reproduzieren könnt. Für den bekannten, bereits behobenen Fall (fehlende `<graphics>`-Kindelemente bei `arc inscription`, nicht unterstützte Operator-Typen wie `103`/OR-Split) normalisiert das Frontend bereits vorab (`normalizePnmlForTransformer` in `transformerService.ts`). Falls der 400er trotzdem auftritt, ist es vermutlich ein bisher nicht abgedeckter Sonderfall in der PNML-Struktur.

**Priorität:** Mittel — betrifft nur Datei-Uploads mit bestimmten PNML-Strukturen, kein genereller Ausfall.

---

## 4. Rückfragen zur Modell-Registry (`/v2/models`)

Aktuell liefert `/v2/models` nur zwei Einträge:

```json
{"models":[{"model":"gpt-5-mini","provider":"openai"},{"model":"gemini-2.0-flash","provider":"gemini"}]}
```

Fragen ans Backend-Team:
- Ist das der finale/beabsichtigte Umfang, oder ist eine Erweiterung geplant (z. B. weitere OpenAI-Modelle, LM Studio)?
- `lmstudio` ist im Frontend als Provider wählbar, hat aber keinen Eintrag in der v2-Registry — ist das gewollt (LM Studio wird für T2P nicht unterstützt) oder fehlt hier etwas?

Das Frontend zeigt bereits nur die tatsächlich registrierten Modelle im T2P-Dropdown an (bei fehlendem Eintrag: klare Meldung statt Fehler) — betrifft also nur die grundsätzliche Kommunikation, kein technisches Problem.

---

## Zur Einordnung: Deprecation der Legacy-Endpunkte

Laut `api-contract.md`/OpenAPI-Spec sind `/generate_BPMN`, `/generate_PNML`, `/api_call`, `/test_connection` bereits deprecated (`/api_call` liefert schon `410 Gone`, die übrigen laufen nur noch bis 1. Dezember 2026 mit `provider=openai`/`model=gpt-4o` als Legacy-Default). Das Frontend nutzt seit dieser Woche ausschließlich die `/v2/*`-Endpunkte für den produktiven Pfad — nur zur Kenntnisnahme, kein offener Punkt.
