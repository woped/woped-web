import * as vis from 'vis';
import * as BpmnJS from 'bpmn-js/dist/bpmn-modeler.production.min.js';

interface PetriPlace {
  id: string | null;
  label: string | null;
}

interface PetriTransition {
  id: string | null;
  label: string | null;
  isGateway: boolean;
  gatewayType?: string | null;
  gatewayID?: string | null;
}

interface PetriArc {
  id: string | null;
  source: string | null;
  target: string | null;
}

interface PetriNet {
  places: PetriPlace[];
  transitions: PetriTransition[];
  arcs: PetriArc[];
}

interface GatewayLog {
  gatewayID: string | null | undefined;
  transitionIDs: { transitionID: string | null }[];
}

interface GatewayReplacement {
  source: string | null | undefined;
  target: string | null | undefined;
}

interface BpmnCanvas {
  resized(): void;
  zoom(value: string): void;
}

interface BpmnViewer {
  importXML(xml: string): Promise<unknown>;
  get(service: 'canvas'): BpmnCanvas;
  saveXML(options?: { format?: boolean }): Promise<{ xml: string }>;
}

interface BpmnBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface BpmnElementLayout {
  id: string;
  kind: string;
  rank: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface BpmnSequenceFlow {
  id: string;
  sourceRef: string;
  targetRef: string;
}

// Model Display Class
export class ModelDisplayer {
  public static lastPetriNetDataUrl: string | null = null;
  // Reference to the currently displayed BPMN modeler instance (bpmn-js ships
  // the full Modeler bundle, so the diagram is already editable in the
  // canvas — dragging shapes, renaming labels, adding/removing elements).
  // This reference lets callers pull the *edited* XML back out again.
  private static activeBpmnModeler: BpmnViewer | null = null;
  private static readonly bpmnElementNames = new Set([
    'startEvent',
    'endEvent',
    'intermediateCatchEvent',
    'intermediateThrowEvent',
    'boundaryEvent',
    'task',
    'userTask',
    'serviceTask',
    'manualTask',
    'scriptTask',
    'businessRuleTask',
    'sendTask',
    'receiveTask',
    'exclusiveGateway',
    'parallelGateway',
    'inclusiveGateway',
    'eventBasedGateway',
    'subProcess',
    'callActivity',
  ]);

  // Preprocessing of the Petri net model. The model is converted into a format (domparser) that can be displayed by the library.
  public static async generatePetriNet(modelAsPetriNet: string, containerId = 'model-container') {
    try {
      const pnml = ModelDisplayer.extractXml(modelAsPetriNet, 'pnml');
      const domparser = new DOMParser();
      const xmlDoc = domparser.parseFromString(pnml, 'text/xml');

      if (ModelDisplayer.findElementsByName(xmlDoc, 'parsererror').length > 0) {
        ModelDisplayer.showModelError('The Petri net response could not be parsed as PNML.');
        return;
      }

      ModelDisplayer.displayPNMLModel(xmlDoc, containerId);
    } catch (err) {
      console.log(err);
      ModelDisplayer.showModelError('The Petri net could not be displayed.');
    }
  }

  // Displays the BPMN model. Sets the representation in the HTML element "model-container".
  public static displayPNMLModel(petrinet: Document, containerId = 'model-container') {
    const generateWorkFlowNet = Boolean(false); //Determines wether WoPeD specific Elements like XOR Split are created
    const prettyPetriNet = getPetriNet(petrinet);
    let gateways: GatewayLog[] = [];

    if (
      prettyPetriNet.places.length === 0 &&
      prettyPetriNet.transitions.length === 0
    ) {
      ModelDisplayer.showModelError('The PNML response does not contain a Petri net.');
      return;
    }

    generatePetrinetConfig(prettyPetriNet);
    function generatePetrinetConfig(petrinet: PetriNet) {
      const data = getVisElements(petrinet);

      // create a network
      const container = document.getElementById(containerId);
      if (!container) return;
      container.innerHTML = '';

      const options = {
        layout: {
          randomSeed: undefined,
          improvedLayout: true,
          hierarchical: {
            enabled: true,
            levelSeparation: 150,
            nodeSpacing: 100,
            treeSpacing: 200,
            blockShifting: true,
            edgeMinimization: true,
            parentCentralization: true,
            direction: 'LR', // UD, DU, LR, RL
            sortMethod: 'directed', // hubsize, directed
          },
        },
        groups: {
          places: {
            color: { background: '#4DB6AC', border: '#00695C' },
            borderWidth: 3,
            shape: 'dot',
            size: 13,
            font: { vadjust: 8 },
          },
          transitions: {
            color: { background: '#FFB74D', border: '#FB8C00' },
            shape: 'square',
            borderWidth: 3,
            size: 22,
            font: { vadjust: 44 },
          },
          andJoin: {
            color: { background: '#DCE775', border: '#9E9D24' },
            shape: 'square',
            borderWidth: 3,
          },
          andSplit: {
            color: { background: '#DCE775', border: '#9E9D24' },
            shape: 'square',
            borderWidth: 3,
          },
          xorSplit: {
            color: { background: '#9575CD', border: '#512DA8' },
            shape: 'square',
            borderWidth: 3,
            image: '/img/and_split.svg',
          },
          xorJoin: {
            color: { background: '#9575CD', border: '#512DA8' },
            shape: 'square',
            borderWidth: 3,
          },
        },
        interaction: {
          zoomView: true,
          dragView: true,
        },
      };
      // initialize your network!
      ModelDisplayer.lastPetriNetDataUrl = null;
      const network = new vis.Network(container, data, options);
      // afterDrawing fires after the first render and passes the canvas context directly
      const captureCanvas = (ctx: CanvasRenderingContext2D) => {
        network.off('afterDrawing', captureCanvas);
        try {
          ModelDisplayer.lastPetriNetDataUrl = ctx.canvas.toDataURL('image/png');
        } catch (e) {
          console.error('Failed to capture Petri-Net canvas:', e);
        }
      };
      network.on('afterDrawing', captureCanvas);
    }

    function getPetriNet(PNML: Document): PetriNet {
      const places = PNML.getElementsByTagName('place');
      const transitions = PNML.getElementsByTagName('transition');
      const arcs = PNML.getElementsByTagName('arc');

      const petrinet = {
        places: [],
        transitions: [],
        arcs: [],
      };

      for (let x = 0; x < arcs.length; x++) {
        const arc = arcs[x];
        petrinet.arcs.push({
          id: arc.getAttribute('id'),
          source: arc.getAttribute('source'),
          target: arc.getAttribute('target'),
        });
      }

      for (let x = 0; x < places.length; x++) {
        const place = places[x];
        petrinet.places.push({
          id: place.getAttribute('id'),
          label:
            place.getElementsByTagName('text')[0]?.textContent ||
            place.getAttribute('id'),
        });
      }

      for (let x = 0; x < transitions.length; x++) {
        const transition = transitions[x];
        const isGateway =
          transition.getElementsByTagName('operator').length > 0;
        let gatewayType = undefined;
        let gatewayID = undefined;
        if (isGateway) {
          gatewayType = transition
            .getElementsByTagName('operator')[0]
            .getAttribute('type');
          gatewayID = transition
            .getElementsByTagName('operator')[0]
            .getAttribute('id');
        }
        petrinet.transitions.push({
          id: transition.getAttribute('id'),
          label:
            transition.getElementsByTagName('text')[0]?.textContent ||
            transition.getAttribute('id'),
          isGateway: isGateway,
          gatewayType: gatewayType,
          gatewayID: gatewayID,
        });
      }
      return petrinet;
    }

    function resetGatewayLog(): void {
      gateways = [];
    }

    function logContainsGateway(transition: PetriTransition): boolean {
      for (let x = 0; x < gateways.length; x++) {
        if (gateways[x].gatewayID === transition.gatewayID) return true;
      }
      return false;
    }
    // Identifies the Gateways
    function logGatewayTransition(transition: PetriTransition): void {
      if (logContainsGateway(transition) === true) {
        for (let x = 0; x < gateways.length; x++) {
          if (gateways[x].gatewayID === transition.gatewayID)
            gateways[x].transitionIDs.push({ transitionID: transition.id });
        }
      } else {
        gateways.push({
          gatewayID: transition.gatewayID,
          transitionIDs: [{ transitionID: transition.id }],
        });
      }
    }

    function getGatewayIDsforReplacement(arc: PetriArc): GatewayReplacement {
      const replacement = { source: null, target: null };
      for (let x = 0; x < gateways.length; x++) {
        for (let i = 0; i < gateways[x].transitionIDs.length; i++) {
          if (arc.source === gateways[x].transitionIDs[i].transitionID) {
            replacement.source = gateways[x].gatewayID;
          }
          if (arc.target === gateways[x].transitionIDs[i].transitionID) {
            replacement.target = gateways[x].gatewayID;
          }
        }
      }
      return replacement;
    }

    function replaceGatewayArcs(arcs: PetriArc[]): void {
      for (let x = 0; x < arcs.length; x++) {
        const replacement = getGatewayIDsforReplacement(arcs[x]);
        if (replacement.source !== null) {
          arcs[x].source = replacement.source;
        }
        if (replacement.target !== null) {
          arcs[x].target = replacement.target;
        }
      }
    }

    function getVisElements(PetriNet: PetriNet) {
      // provide the data in the vis format
      const edges = new vis.DataSet([]);
      const nodes = new vis.DataSet([]);
      for (let x = 0; x < PetriNet.places.length; x++) {
        nodes.add({
          id: PetriNet.places[x].id,
          group: 'places',
          label: getPlaceLabel(PetriNet.places[x], PetriNet),
          title: PetriNet.places[x].label || PetriNet.places[x].id,
        });
      }

      for (let x = 0; x < PetriNet.transitions.length; x++) {
        if (
          !PetriNet.transitions[x].isGateway ||
          generateWorkFlowNet === false
        ) {
          nodes.add({
            id: PetriNet.transitions[x].id,
            group: 'transitions',
            label: getTransitionLabel(PetriNet.transitions[x]),
            title: PetriNet.transitions[x].label || PetriNet.transitions[x].id,
          });
        } else {
          let gatewayGroup = '';
          const label = '';
          switch (PetriNet.transitions[x].gatewayType) {
            case '101':
              gatewayGroup = 'andSplit';
              break;
            case '102':
              gatewayGroup = 'andJoin';
              break;
            case '104':
              gatewayGroup = 'xorSplit';
              break;
            case '105':
              gatewayGroup = 'xorJoin';
              break;
          }
          if (!logContainsGateway(PetriNet.transitions[x])) {
            nodes.add({
              id: PetriNet.transitions[x].gatewayID,
              group: gatewayGroup,
              label: label,
              title: PetriNet.transitions[x].label,
            });
          }
          logGatewayTransition(PetriNet.transitions[x]);
        }
      }

      if (generateWorkFlowNet === true) {
        replaceGatewayArcs(PetriNet.arcs);
      }

      for (let x = 0; x < PetriNet.arcs.length; x++) {
        edges.add({
          from: PetriNet.arcs[x].source,
          to: PetriNet.arcs[x].target,
          arrows: 'to',
        });
      }
      resetGatewayLog();
      return { nodes: nodes, edges: edges };
    }

    function getPlaceLabel(place: PetriPlace, PetriNet: PetriNet): string {
      const label = (place.label || '').trim();
      if (!label || label === place.id || isTechnicalPlaceLabel(label)) {
        return getDerivedPlaceLabel(place, PetriNet);
      }

      return formatPetriLabel(label);
    }

    function getTransitionLabel(transition: PetriTransition): string {
      const label = (transition.label || '').trim();
      const id = (transition.id || '').trim();

      if (!label || label === id) {
        return '';
      }

      return formatPetriLabel(label);
    }

    function isTechnicalPlaceLabel(label: string): boolean {
      return (
        /^SILENTFROM.+TO.+$/i.test(label) ||
        /^silent/i.test(label) ||
        /^p\d+$/i.test(label)
      );
    }

    function getDerivedPlaceLabel(place: PetriPlace, PetriNet: PetriNet): string {
      const placeId = place.id;
      const incomingTransition = PetriNet.arcs
        .filter((arc) => arc.target === placeId)
        .map((arc) =>
          PetriNet.transitions.find((transition) => transition.id === arc.source)
        )
        .find((transition) => transition !== undefined);

      if (incomingTransition) {
        return toStateLabel(getTransitionLabel(incomingTransition));
      }

      const hasOutgoingArc = PetriNet.arcs.some((arc) => arc.source === placeId);
      if (hasOutgoingArc) {
        return 'Start';
      }

      return 'Ende';
    }

    function formatPetriLabel(label: string): string {
      return wrapPetriLabel(
        label
          .replace(/\[(?:UserTask|Task|ManualTask|ServiceTask|ScriptTask)\]\s*/gi, '')
          .replace(/_/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
      );
    }

    function toStateLabel(label: string): string {
      const plainLabel = label.replace(/\n/g, ' ').trim();
      const words = plainLabel.split(/\s+/);

      if (words.length < 2) {
        return plainLabel;
      }

      const verb = words[words.length - 1].toLowerCase();
      const object = words.slice(0, -1).join(' ');
      const participles: Record<string, string> = {
        anweisen: 'angewiesen',
        abschliessen: 'abgeschlossen',
        abschließen: 'abgeschlossen',
        erfassen: 'erfasst',
        pruefen: 'geprueft',
        prüfen: 'geprueft',
        vornehmen: 'vorgenommen',
        bezahlen: 'bezahlt',
        buchen: 'gebucht',
        versenden: 'versendet',
        senden: 'gesendet',
        erhalten: 'erhalten',
      };

      if (participles[verb]) {
        return wrapPetriLabel(`${object} ${participles[verb]}`);
      }

      return wrapPetriLabel(`${plainLabel} erledigt`);
    }

    function wrapPetriLabel(label: string): string {
      const words = label.split(/\s+/);
      const lines: string[] = [];
      let currentLine = '';

      words.forEach((word) => {
        const nextLine = currentLine ? `${currentLine} ${word}` : word;
        if (nextLine.length > 18 && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = nextLine;
        }
      });

      if (currentLine) {
        lines.push(currentLine);
      }

      return lines.join('\n');
    }
  }

  public static async displayBPMNModel(
    modelAsBPMN: string,
    options: { normalizeLayout?: boolean } = {}
  ): Promise<void> {
    const container = document.getElementById('model-container');
    if (!container) return;

    container.innerHTML = '';
    ModelDisplayer.activeBpmnModeler = null;

    // Create a new Modeler (bundled as bpmn-modeler.production.min.js, so
    // palette/context-pad/direct-editing are all included and interactive
    // out of the box — no extra wiring needed for editing itself).
    const viewer: BpmnViewer = new BpmnJS({
      container: '#model-container',
      keyboard: {
        bindTo: window,
      },
    });

    try {
      // Display the BPMN Model
      const xml = options.normalizeLayout === false
        ? modelAsBPMN
        : ModelDisplayer.normalizeBpmnLayout(modelAsBPMN);

      await viewer.importXML(xml);
      const canvas = viewer.get('canvas');
      canvas.resized();
      canvas.zoom('fit-viewport');
      ModelDisplayer.activeBpmnModeler = viewer;
    } catch (err) {}
  }

  /**
   * Reads back the current (possibly user-edited) XML from the live BPMN
   * canvas, e.g. so downloads reflect manual corrections made in the
   * editor rather than the originally generated diagram.
   * Returns null if no BPMN model is currently displayed.
   */
  public static async getCurrentBpmnXml(): Promise<string | null> {
    if (!ModelDisplayer.activeBpmnModeler) return null;
    try {
      const result = await ModelDisplayer.activeBpmnModeler.saveXML({ format: true });
      return result.xml;
    } catch (err) {
      console.error('Failed to read edited BPMN XML:', err);
      return null;
    }
  }

  private static extractXml(response: string, rootTag: string): string {
    let content = response.trim();

    try {
      const parsedResponse = JSON.parse(content);
      if (typeof parsedResponse === 'string') {
        content = parsedResponse;
      } else if (typeof parsedResponse?.result === 'string') {
        content = parsedResponse.result;
      } else if (typeof parsedResponse?.pnml === 'string') {
        content = parsedResponse.pnml;
      } else if (typeof parsedResponse?.xml === 'string') {
        content = parsedResponse.xml;
      }
    } catch {
      // Response is already plain text/XML.
    }

    content = content
      .replace(/^```(?:xml|pnml)?/i, '')
      .replace(/```$/i, '')
      .trim();

    const start = content.search(new RegExp(`<${rootTag}\\b`, 'i'));
    const end = content.toLowerCase().lastIndexOf(`</${rootTag}>`);

    if (start >= 0 && end >= 0) {
      return content.slice(start, end + rootTag.length + 3);
    }

    return content;
  }

  private static showModelError(message: string): void {
    const container = document.getElementById('model-container');
    if (container) {
      container.innerHTML = '';
    }

    const errorContainer = document.getElementById('error-container-text');
    if (!errorContainer) return;

    errorContainer.textContent = message;
    errorContainer.style.display = 'block';
  }

  private static normalizeBpmnLayout(modelAsBPMN: string): string {
    const doc = new DOMParser().parseFromString(modelAsBPMN, 'text/xml');

    if (ModelDisplayer.findElementsByName(doc, 'parsererror').length > 0) {
      return modelAsBPMN;
    }

    const elements = ModelDisplayer.getBpmnFlowElements(doc);
    const flows = ModelDisplayer.getBpmnSequenceFlows(doc).filter(
      (flow) =>
        elements.some((element) => element.id === flow.sourceRef) &&
        elements.some((element) => element.id === flow.targetRef)
    );

    if (elements.length < 2 || flows.length === 0) {
      return modelAsBPMN;
    }

    const currentBounds = ModelDisplayer.getCurrentBpmnBounds(doc);
    let layout: BpmnElementLayout[];
    if (ModelDisplayer.needsBpmnRelayout(currentBounds, flows)) {
      layout = ModelDisplayer.createBpmnLayout(elements, flows);
      ModelDisplayer.applyBpmnShapeLayout(doc, layout);
      ModelDisplayer.applyBpmnEdgeLayout(doc, layout, flows);
    } else {
      layout = elements
        .map((element) => {
          const bounds = currentBounds.get(element.id);
          if (!bounds) return undefined;

          return {
            ...element,
            rank: 0,
            ...bounds,
          };
        })
        .filter(
          (element): element is BpmnElementLayout => element !== undefined
        );
    }

    ModelDisplayer.applyBpmnContainerLayout(doc, layout);

    return new XMLSerializer().serializeToString(doc);
  }

  private static findElementsByName(doc: Document | Element, name: string): Element[] {
    return Array.from(doc.getElementsByTagName('*')).filter(
      (element) => element.localName === name
    );
  }

  private static getBpmnFlowElements(
    doc: Document
  ): Pick<BpmnElementLayout, 'id' | 'kind'>[] {
    return Array.from(doc.getElementsByTagName('*'))
      .filter((element) =>
        ModelDisplayer.bpmnElementNames.has(element.localName)
      )
      .map((element) => ({
        id: element.getAttribute('id') || '',
        kind: element.localName,
      }))
      .filter((element) => element.id.length > 0);
  }

  private static getBpmnSequenceFlows(doc: Document): BpmnSequenceFlow[] {
    return ModelDisplayer.findElementsByName(doc, 'sequenceFlow')
      .map((flow) => ({
        id: flow.getAttribute('id') || '',
        sourceRef: flow.getAttribute('sourceRef') || '',
        targetRef: flow.getAttribute('targetRef') || '',
      }))
      .filter(
        (flow) =>
          flow.id.length > 0 &&
          flow.sourceRef.length > 0 &&
          flow.targetRef.length > 0
      );
  }

  private static getCurrentBpmnBounds(doc: Document): Map<string, BpmnBounds> {
    const bounds = new Map<string, BpmnBounds>();
    ModelDisplayer.findElementsByName(doc, 'BPMNShape').forEach((shape) => {
      const bpmnElement = shape.getAttribute('bpmnElement');
      const boundsElement = ModelDisplayer.findElementsByName(shape, 'Bounds')[0];
      if (!bpmnElement || !boundsElement) return;

      bounds.set(bpmnElement, {
        x: Number(boundsElement.getAttribute('x')),
        y: Number(boundsElement.getAttribute('y')),
        width: Number(boundsElement.getAttribute('width')),
        height: Number(boundsElement.getAttribute('height')),
      });
    });
    return bounds;
  }

  private static needsBpmnRelayout(
    bounds: Map<string, BpmnBounds>,
    flows: BpmnSequenceFlow[]
  ): boolean {
    if (bounds.size < 2) return false;

    const allBounds = Array.from(bounds.values());
    for (let i = 0; i < allBounds.length; i++) {
      for (let j = i + 1; j < allBounds.length; j++) {
        if (ModelDisplayer.boundsOverlap(allBounds[i], allBounds[j])) {
          return true;
        }
      }
    }

    return flows.some((flow) => {
      const source = bounds.get(flow.sourceRef);
      const target = bounds.get(flow.targetRef);
      if (!source || !target) return false;
      return target.x - (source.x + source.width) < 80;
    });
  }

  private static boundsOverlap(first: BpmnBounds, second: BpmnBounds): boolean {
    const padding = 12;
    return !(
      first.x + first.width + padding < second.x ||
      second.x + second.width + padding < first.x ||
      first.y + first.height + padding < second.y ||
      second.y + second.height + padding < first.y
    );
  }

  private static createBpmnLayout(
    elements: Pick<BpmnElementLayout, 'id' | 'kind'>[],
    flows: BpmnSequenceFlow[]
  ): BpmnElementLayout[] {
    const rankById = new Map(elements.map((element) => [element.id, 0]));

    for (let i = 0; i < elements.length; i++) {
      flows.forEach((flow) => {
        const sourceRank = rankById.get(flow.sourceRef);
        const targetRank = rankById.get(flow.targetRef);
        if (sourceRank === undefined || targetRank === undefined) return;
        if (targetRank <= sourceRank) {
          rankById.set(flow.targetRef, sourceRank + 1);
        }
      });
    }

    const byRank = new Map<number, Pick<BpmnElementLayout, 'id' | 'kind'>[]>();
    elements.forEach((element) => {
      const rank = rankById.get(element.id) || 0;
      byRank.set(rank, [...(byRank.get(rank) || []), element]);
    });

    const layout: BpmnElementLayout[] = [];
    Array.from(byRank.entries()).forEach(([rank, rankedElements]) => {
      const columnHeight = (rankedElements.length - 1) * 140;
      rankedElements.forEach((element, index) => {
        const size = ModelDisplayer.getBpmnElementSize(element.kind);
        layout.push({
          ...element,
          rank,
          x: 90 + rank * 220,
          y: 140 - columnHeight / 2 + index * 140,
          width: size.width,
          height: size.height,
        });
      });
    });

    return layout;
  }

  private static getBpmnElementSize(kind: string): Pick<BpmnBounds, 'width' | 'height'> {
    if (kind.includes('Event')) {
      return { width: 36, height: 36 };
    }

    if (kind.includes('Gateway')) {
      return { width: 50, height: 50 };
    }

    if (kind === 'subProcess' || kind === 'callActivity') {
      return { width: 150, height: 95 };
    }

    return { width: 130, height: 82 };
  }

  private static applyBpmnShapeLayout(
    doc: Document,
    layout: BpmnElementLayout[]
  ): void {
    const shapeByElement = new Map<string, Element>();
    ModelDisplayer.findElementsByName(doc, 'BPMNShape').forEach((shape) => {
      const bpmnElement = shape.getAttribute('bpmnElement');
      if (bpmnElement) shapeByElement.set(bpmnElement, shape);
    });

    layout.forEach((element) => {
      const shape = shapeByElement.get(element.id);
      if (!shape) return;

      let bounds = ModelDisplayer.findElementsByName(shape, 'Bounds')[0];
      if (!bounds) {
        bounds = doc.createElementNS(
          'http://www.omg.org/spec/DD/20100524/DC',
          'dc:Bounds'
        );
        shape.appendChild(bounds);
      }

      bounds.setAttribute('x', String(element.x));
      bounds.setAttribute('y', String(element.y));
      bounds.setAttribute('width', String(element.width));
      bounds.setAttribute('height', String(element.height));
    });
  }

  private static applyBpmnContainerLayout(
    doc: Document,
    layout: BpmnElementLayout[]
  ): void {
    const layoutById = new Map(layout.map((element) => [element.id, element]));
    const shapeByElement = new Map<string, Element>();
    ModelDisplayer.findElementsByName(doc, 'BPMNShape').forEach((shape) => {
      const bpmnElement = shape.getAttribute('bpmnElement');
      if (bpmnElement) shapeByElement.set(bpmnElement, shape);
    });

    ModelDisplayer.findElementsByName(doc, 'participant').forEach(
      (participant) => {
        const participantId = participant.getAttribute('id');
        const processRef = participant.getAttribute('processRef');
        if (!participantId) return;
        if (!processRef) {
          ModelDisplayer.removeEmptyBpmnContainer(
            doc,
            participantId,
            shapeByElement.get(participantId)
          );
          return;
        }

        const process = Array.from(doc.getElementsByTagName('*')).find(
          (element) =>
            element.localName === 'process' &&
            element.getAttribute('id') === processRef
        );
        if (!process) {
          ModelDisplayer.removeEmptyBpmnContainer(
            doc,
            participantId,
            shapeByElement.get(participantId)
          );
          return;
        }

        const memberIds = Array.from(process.getElementsByTagName('*'))
          .filter((element) =>
            ModelDisplayer.bpmnElementNames.has(element.localName)
          )
          .map((element) => element.getAttribute('id') || '');
        const hasVisibleMembers = memberIds.some((id) => layoutById.has(id));
        if (!hasVisibleMembers) {
          ModelDisplayer.removeEmptyBpmnContainer(
            doc,
            participantId,
            shapeByElement.get(participantId)
          );
          return;
        }

        ModelDisplayer.resizeBpmnContainer(
          shapeByElement.get(participantId),
          memberIds,
          layoutById,
          55,
          60
        );
      }
    );

    ModelDisplayer.findElementsByName(doc, 'lane').forEach((lane) => {
      const laneId = lane.getAttribute('id');
      if (!laneId) return;

      const memberIds = ModelDisplayer.findElementsByName(lane, 'flowNodeRef')
        .map((reference) => reference.textContent?.trim() || '')
        .filter((id) => id.length > 0);
      const hasVisibleMembers = memberIds.some((id) => layoutById.has(id));
      if (!hasVisibleMembers) {
        ModelDisplayer.removeEmptyBpmnContainer(
          doc,
          laneId,
          shapeByElement.get(laneId)
        );
        return;
      }

      ModelDisplayer.resizeBpmnContainer(
        shapeByElement.get(laneId),
        memberIds,
        layoutById,
        35,
        40
      );
    });
  }

  private static removeEmptyBpmnContainer(
    doc: Document,
    elementId: string,
    shape: Element | undefined
  ): void {
    shape?.parentNode?.removeChild(shape);

    const connectedFlowIds = Array.from(doc.getElementsByTagName('*'))
      .filter(
        (element) =>
          element.localName === 'messageFlow' &&
          (element.getAttribute('sourceRef') === elementId ||
            element.getAttribute('targetRef') === elementId)
      )
      .map((element) => element.getAttribute('id'))
      .filter((id): id is string => Boolean(id));

    ModelDisplayer.findElementsByName(doc, 'BPMNEdge').forEach((edge) => {
      if (connectedFlowIds.includes(edge.getAttribute('bpmnElement') || '')) {
        edge.parentNode?.removeChild(edge);
      }
    });
  }

  private static resizeBpmnContainer(
    shape: Element | undefined,
    memberIds: string[],
    layoutById: Map<string, BpmnElementLayout>,
    horizontalPadding: number,
    verticalPadding: number
  ): void {
    if (!shape) return;

    const members = memberIds
      .map((id) => layoutById.get(id))
      .filter((element): element is BpmnElementLayout => element !== undefined);
    if (members.length === 0) return;

    const left = Math.min(...members.map((element) => element.x));
    const top = Math.min(...members.map((element) => element.y));
    const right = Math.max(
      ...members.map((element) => element.x + element.width)
    );
    const bottom = Math.max(
      ...members.map((element) => element.y + element.height)
    );
    const bounds = ModelDisplayer.findElementsByName(shape, 'Bounds')[0];
    if (!bounds) return;

    shape.setAttribute('isHorizontal', 'true');
    bounds.setAttribute('x', String(left - horizontalPadding));
    bounds.setAttribute('y', String(top - verticalPadding));
    bounds.setAttribute(
      'width',
      String(right - left + horizontalPadding * 2)
    );
    bounds.setAttribute(
      'height',
      String(bottom - top + verticalPadding * 2)
    );
  }

  private static applyBpmnEdgeLayout(
    doc: Document,
    layout: BpmnElementLayout[],
    flows: BpmnSequenceFlow[]
  ): void {
    const layoutById = new Map(layout.map((element) => [element.id, element]));
    const edgeByElement = new Map<string, Element>();
    ModelDisplayer.findElementsByName(doc, 'BPMNEdge').forEach((edge) => {
      const bpmnElement = edge.getAttribute('bpmnElement');
      if (bpmnElement) edgeByElement.set(bpmnElement, edge);
    });

    flows.forEach((flow) => {
      const edge = edgeByElement.get(flow.id);
      const source = layoutById.get(flow.sourceRef);
      const target = layoutById.get(flow.targetRef);
      if (!edge || !source || !target) return;

      ModelDisplayer.findElementsByName(edge, 'waypoint').forEach((waypoint) =>
        edge.removeChild(waypoint)
      );

      const start = {
        x: source.x + source.width,
        y: source.y + source.height / 2,
      };
      const end = {
        x: target.x,
        y: target.y + target.height / 2,
      };
      const middleX = start.x + Math.max(40, (end.x - start.x) / 2);

      [
        start,
        { x: middleX, y: start.y },
        { x: middleX, y: end.y },
        end,
      ].forEach((point) => {
        const waypoint = doc.createElementNS(
          'http://www.omg.org/spec/DD/20100524/DI',
          'di:waypoint'
        );
        waypoint.setAttribute('x', String(point.x));
        waypoint.setAttribute('y', String(point.y));
        edge.appendChild(waypoint);
      });
    });
  }
}
