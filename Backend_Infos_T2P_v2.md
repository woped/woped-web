# Offene Probleme, die nur vom Backend behoben werden können

Stand: 2026-07-17. Diese Datei listet ausschließlich Probleme, die wir frontend-seitig geprüft, eingegrenzt und **nicht** durch Änderungen im Web-Client beheben können — entweder weil die Ursache nachweislich serverseitig liegt, oder weil uns für eine abschließende Diagnose Backend-Zugriff (Logs, echte Requests) fehlt. Alles, was wir selbst reparieren konnten, ist nicht mehr aufgeführt (siehe Änderungsverlauf im Frontend-Repo).

Frontend-seitig ist die Anbindung an den t2p-2.0 v2-Contract (`/v2/generate/bpmn`, `/v2/generate/pnml`, `/v2/models`) korrekt umgesetzt (Bearer-Auth, `{text, provider, model, prompting_strategy}`, Modellwahl richtet sich strikt nach der Registry aus `/v2/models`) und wurde von Prof. Freytag am 15.07. unabhängig gegengetestet — die Rückmeldung deckt sich mit Punkt 1 und 2 unten.

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

**Priorität:** Hoch — der Endpunkt ist aktuell nicht nutzbar (kein Fehler, kein Ergebnis).

**Frontend-Workaround (temporär, seit 18.07.):** Wegen der Abgabe-Deadline generiert das Web-Frontend Petri-Netze vorübergehend über `/v2/generate/bpmn` + client-seitige Transformer-Konvertierung (BPMN→PNML). Sobald ihr `/v2/generate/pnml` gefixt habt, bauen wir auf den Endpunkt zurück (im Code als TEMPORARY WORKAROUND markiert, `t2pHttpService.ts`). Der Fix bleibt also weiterhin nötig.

---

## 2. T2P-Gemini: Registry (`/v2/models`) bewirbt ein von Google abgeschaltetes Modell — URSACHE GEFUNDEN (17.07.)

**Root Cause (per Quellcode-Analyse des `t2p-llm-api-connector` identifiziert):** Die Fallback-Registry des Connectors (`_FALLBACK_MODELS` in `app/services/model_registry.py`) enthält für Gemini ausschließlich `gemini-2.0-flash`. **Dieses Modell wurde von Google zum 1. Juni 2026 vollständig abgeschaltet** (siehe [Gemini API Deprecations](https://ai.google.dev/gemini-api/docs/deprecations)). Jeder Generate-Aufruf mit diesem Modell schlägt daher beim Provider fehl → `500 upstream_error`. Das erklärt exakt die Fehlerbilder von uns (03.07.) und Prof. Freytag (15.07.).

**Bitte im Backend beheben:**
- `_FALLBACK_MODELS["gemini"]` auf ein aktuelles Modell aktualisieren (z. B. `gemini-2.5-flash`; Achtung: laut Google-Ankündigung wird auch dieses am 16.10.2026 abgelöst — ggf. direkt Nachfolger einplanen).
- Idealerweise serverseitig einen `GEMINI_API_KEY`/`OPENAI_API_KEY` als Env-Variable setzen, damit die Registry beim Start echte Modell-Discovery macht statt auf die statische Fallback-Liste zurückzufallen — dann kann sie nicht mehr veralten.

**Frontend-Workaround (bereits umgesetzt, 17.07.):** Das Web-Frontend ermittelt die Modell-Liste jetzt zusätzlich live mit dem API-Key des Nutzers direkt beim Provider und bietet nur noch Modelle an, die der Key tatsächlich nutzen kann (tote Registry-Einträge werden ausgeblendet). Da euer Connector Anfragen ohnehin gegen die live mit dem Nutzer-Key abgerufene Modell-Liste validiert (`refresh_model_cache(provider, api_key)` vor `is_valid`), funktioniert T2P-Gemini damit wieder — die Registry-Korrektur bleibt trotzdem nötig, damit `/v2/models` keine toten Modelle mehr bewirbt.

---

## 2b. P2T: fest kodierte `temperature=0.7` macht GPT-5- und o-Serie-Modelle unbenutzbar

**Root Cause (per Quellcode-Analyse des `p2t`-Repos identifiziert):** `OpenAiProvider.java` sendet bei jedem Chat-Completions-Aufruf eine explizite `temperature` (Default 0.7 aus `LlmRequest.java`). Die GPT-5-Familie und die Reasoning-Modelle (o1/o3/o4) akzeptieren aber nur den Provider-Default (`temperature=1`) und antworten auf abweichende Werte mit `400 Unsupported value` — die euer Service als `500 UNKNOWN_ERROR` weiterreicht. Ebenso stehen Nicht-Chat-Modelle (`dall-e-*`, `chatgpt-*-latest`-Aliasse etc.) ungefiltert in eurer `/gptModels`-Antwort. Kombiniert mit einer automatischen Modell-Vorauswahl im Web-Frontend führte das zu scheinbar zufälligen P2T-Ausfällen ("Model is not available"), während der Fat Client — der sich das zuletzt manuell gewählte, funktionierende Modell merkt — lief.

**Bitte im Backend beheben:** `temperature` nur setzen, wenn das Modell sie unterstützt (analog zur Lösung im `t2p-llm-api-connector`, der GPT-5-Varianten erkennt und den Parameter weglässt), und idealerweise `/gptModels` auf Chat-fähige Modelle filtern.

**Frontend-Workaround (bereits umgesetzt, 17.07.):** Das Web-Frontend filtert diese inkompatiblen Modelle jetzt aus dem P2T-Dropdown und wählt standardmäßig ein bekannt funktionierendes Chat-Modell (`gpt-4o`-Familie) vor. P2T-OpenAI funktioniert damit wieder — der Backend-Fix würde die Einschränkung aufheben, dass GPT-5/o-Serie für P2T gar nicht anwählbar sind.

---

## 3. P2T: Modell-Liste/Generierung schlägt fehl — Ursache ohne Backend-Logs nicht abschließend klärbar

**Symptom (gemeldet von Prof. Freytag, 15.07.2026):** Bei P2T mit `LoanApplication.pnml` gab es sowohl mit Gemini als auch mit OpenAI einen Fehler; im Screenshot sichtbar: die Modell-Liste (`GET /p2t/gptModels`) lieferte nur einen einzigen Eintrag statt der vollen Liste, die anschließende Generierung (`POST /p2t/generateTextLLM`) schlug mit einem clientseitigen Verbindungsfehler (Status 0) fehl.

**Was wir bereits ausgeschlossen/behoben haben:** Das Frontend hatte bislang einen eigenen Bug, der bei jedem Fehlschlag von `/p2t/gptModels` (unabhängig von der Ursache) stillschweigend ein hartcodiertes Fallback-Modell (z. B. `gpt-4o`) verwendet hat, statt den echten Fehler anzuzeigen — das haben wir behoben (`fetchModelsForProvider()` in `components.ts` zeigt jetzt die tatsächliche Backend-Fehlermeldung und lässt keine Generierung mit ungeprüftem Modell mehr zu). Dadurch war die für den Prof. sichtbare Meldung teils irreführend.

**Was weiterhin offen ist:** Warum `/p2t/gptModels` bzw. `/p2t/generateTextLLM` beim Test des Professors überhaupt fehlgeschlagen sind, können wir ohne Backend-Zugriff nicht abschließend klären. Unsere eigenen Tests gegen die Endpunkte (mit absichtlich ungültigem Key) liefern saubere, aussagekräftige Fehler (`401 Invalid OpenAI API key`, `500 Gemini API error: API key not valid`) und korrekte CORS-Header für die produktive Origin `https://woped.github.io` — ein grundsätzlicher Ausfall oder eine CORS-Fehlkonfiguration ließ sich zum Testzeitpunkt nicht reproduzieren. Mögliche Ursachen, die nur ihr über Server-Logs/Monitoring für den 15.07. prüfen könnt: Rate-Limiting, ein temporärer Ausfall des `/p2t`-Dienstes, oder ein spezifisches Problem mit der von `LoanApplication.pnml` erzeugten Anfrage (z. B. Payload-Größe, Timeout am Reverse Proxy).

**Priorität:** Hoch — P2T ist laut Rückmeldung aktuell für den Prof. nicht nutzbar; wir können von unserer Seite nur die Fehlertransparenz sicherstellen, nicht die eigentliche Ursache beheben.

---

## 3b. Model-Transformer: PNML→BPMN scheitert an WoPeD-Standarddateien (Ursachen identifiziert, 18.07.)

Wir haben alle 12 PNML-Beispieldateien des Fat Clients (`WoPeD-FileInterface/.../samples/`) gegen den Live-Transformer (`/pnml-bpmn-transformer/transform?direction=pnmltobpmn`) getestet und die Fehler per lokalem Lauf des Transformer-Codes auf die Zeile genau eingegrenzt. Drei Befunde:

**(a) Pflichtfeld `inscription.graphics`:** Das pydantic-Modell `Inscription` (`models/pnml/base.py`) verlangt zwingend ein `<graphics>`-Kind, WoPeD-Exporte schreiben Arc-Inscriptions aber ohne (`<inscription><text>1</text></inscription>`). Betrifft u. a. `LoanApplication.pnml` — exakt die Datei aus Prof. Freytags Test; Fehlerbild `[11] Seems like the input XML content is unsupported.` → *Frontend-Workaround aktiv (wir ergänzen das Element vor dem Senden), aber bitte das Feld im Modell optional machen (`default=None` wie bei `Arc.graphics`), damit auch Fat-Client-/Direktaufrufe funktionieren.*

**(b) Multi-Organisation-Ressourcen:** `annotate_resources()` (`workflow_helper.py`) wirft `[10] Resources must belong to the same organization.`, sobald `transitionResource`-Einträge unterschiedliche `organizationalUnitName` haben. Betrifft `CapacityPlanning.pnml` und `LoanApplicationResources.pnml` — beides offizielle WoPeD-Beispieldateien. → *Frontend-Workaround aktiv (wir entfernen Rollen-Annotationen im Multi-Org-Fall, Lane-Zuordnung geht dabei verloren); sauberer wäre Unterstützung mehrerer Pools/Organisationen im Transformer.*

**(c) Subprozess-Bug:** `Subprocesses.pnml` (offizielle Beispieldatei) läuft in `handle_workflow_subprocesses()` → `page_net.get_element(outer_sink_id)` in eine `InternalTransformationException` ("We encountered an unkown issue"). Reproduzierbar lokal mit `FORCE_STD_XML=false` und der unveränderten Datei. → *Nicht frontend-fixbar; Subprozess-Netze sind aktuell nicht konvertierbar.*

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
