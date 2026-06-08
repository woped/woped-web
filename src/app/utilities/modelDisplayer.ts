import * as vis from 'vis';
import * as BpmnViewer from 'bpmn-js/dist/bpmn-navigated-viewer.production.min.js';

/**
 * Renders generated models into a host element.
 *
 * Both renderers take the target container element explicitly (instead of a
 * global `getElementById`) so the T2P and P2T tabs can each own their own
 * canvas without colliding on a shared DOM id.
 */
export class ModelDisplayer {
  /**
   * Render BPMN XML read-only with bpmn-js.
   *
   * Uses the NavigatedViewer (zoom/scroll/drag, but no editing palette or
   * context pad) since the result is for viewing, not editing. `importXML` is
   * asynchronous: the canvas only exists once it resolves, so the viewport is
   * fitted afterwards. (The previous code used the full Modeler and zoomed
   * synchronously while swallowing every error; without the diagram-js
   * stylesheet its palette/canvas rendered as black bars.)
   */
  public static async displayBPMN(
    container: HTMLElement,
    bpmnXml: string
  ): Promise<void> {
    container.innerHTML = '';
    const viewer = new BpmnViewer({ container });
    await viewer.importXML(bpmnXml);
    viewer.get('canvas').zoom('fit-viewport');
  }

  /** Parse PNML text and render it as a Petri net with vis-network. */
  public static displayPNML(container: HTMLElement, pnmlXml: string): void {
    const xmlDoc = new DOMParser().parseFromString(pnmlXml, 'text/xml');
    const petrinet = ModelDisplayer.parsePNML(xmlDoc);
    ModelDisplayer.renderPetriNet(container, petrinet);
  }

  private static parsePNML(PNML: Document) {
    const petrinet: {
      places: { id: string; label: string; x?: number; y?: number }[];
      transitions: { id: string; label: string; x?: number; y?: number }[];
      arcs: { id: string; source: string; target: string }[];
    } = { places: [], transitions: [], arcs: [] };

    const arcs = PNML.getElementsByTagName('arc');
    for (let x = 0; x < arcs.length; x++) {
      petrinet.arcs.push({
        id: arcs[x].getAttribute('id') || 'arc_' + x,
        source: arcs[x].getAttribute('source') || '',
        target: arcs[x].getAttribute('target') || '',
      });
    }

    const places = PNML.getElementsByTagName('place');
    for (let x = 0; x < places.length; x++) {
      // Transformer PNML often has label-less nodes (no <text>); fall back to
      // id, then a placeholder, so a missing label never aborts rendering.
      const placeText = places[x].getElementsByTagName('text')[0];
      petrinet.places.push({
        id: places[x].getAttribute('id') || 'place_' + x,
        label:
          (placeText && placeText.textContent) ||
          places[x].getAttribute('id') ||
          'place_' + x,
        ...ModelDisplayer.ownPosition(places[x]),
      });
    }

    const transitions = PNML.getElementsByTagName('transition');
    for (let x = 0; x < transitions.length; x++) {
      const transitionText = transitions[x].getElementsByTagName('text')[0];
      petrinet.transitions.push({
        id: transitions[x].getAttribute('id') || 'transition_' + x,
        label:
          (transitionText && transitionText.textContent) ||
          transitions[x].getAttribute('id') ||
          'transition_' + x,
        ...ModelDisplayer.ownPosition(transitions[x]),
      });
    }
    return petrinet;
  }

  /**
   * Read a node's OWN layout coordinate: the `<position>` under its
   * *direct-child* `<graphics>`, NOT the nested `<name>`/`<trigger>` sub-graphics.
   * The backend (t2p-2.0 `assign_pnml_coordinates`) writes the PNML `<position>`
   * as a centre point, which is exactly how vis-network interprets a node's
   * x/y — so they map directly.
   */
  private static ownPosition(el: Element): { x?: number; y?: number } {
    const graphics = Array.from(el.children).find(
      (c) => c.localName === 'graphics'
    );
    const position = graphics
      ? Array.from(graphics.children).find((c) => c.localName === 'position')
      : undefined;
    if (!position) return {};
    const x = parseFloat(position.getAttribute('x') || '');
    const y = parseFloat(position.getAttribute('y') || '');
    return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : {};
  }

  private static renderPetriNet(
    container: HTMLElement,
    petrinet: ReturnType<typeof ModelDisplayer.parsePNML>
  ) {
    const nodes = new vis.DataSet([]);
    const edges = new vis.DataSet([]);

    // If the backend supplied coordinates for every node, honour them (render
    // the layout the backend computed). Otherwise fall back to vis-network's
    // own hierarchical auto-layout.
    const allNodes = [...petrinet.places, ...petrinet.transitions];
    const useBackendCoords =
      allNodes.length > 0 &&
      allNodes.every((n) => typeof n.x === 'number' && typeof n.y === 'number');

    for (const place of petrinet.places) {
      // Places are unlabeled dots (a long id as a label would balloon the
      // circle); the id stays available as a hover tooltip.
      nodes.add({
        id: place.id,
        group: 'places',
        label: '',
        title: place.label,
        ...(useBackendCoords ? { x: place.x, y: place.y } : {}),
      });
    }
    for (const transition of petrinet.transitions) {
      const label = ModelDisplayer.cleanLabel(transition.label);
      nodes.add({
        id: transition.id,
        group: 'transitions',
        label,
        title: transition.label,
        ...(useBackendCoords ? { x: transition.x, y: transition.y } : {}),
      });
    }
    for (const arc of petrinet.arcs) {
      edges.add({ from: arc.source, to: arc.target });
    }

    const options = {
      layout: useBackendCoords
        ? // Coordinates come from the backend; don't let vis re-arrange them.
          { improvedLayout: false }
        : {
            improvedLayout: true,
            hierarchical: {
              enabled: true,
              // A petri net is bipartite (place -> transition -> place ...), so a
              // left-to-right "directed" ranking reads as a process flow. Generous
              // separation keeps the (variable-width) transition boxes from
              // colliding with the arcs.
              levelSeparation: 180,
              nodeSpacing: 130,
              treeSpacing: 220,
              blockShifting: true,
              edgeMinimization: true,
              parentCentralization: true,
              direction: 'LR',
              sortMethod: 'directed',
            },
          },
      nodes: {
        font: { size: 13, color: '#1d2939', face: 'Roboto, sans-serif' },
        borderWidth: 2,
      },
      edges: {
        color: { color: '#98a2b3', highlight: '#1976d2' },
        width: 1.5,
        arrows: { to: { enabled: true, scaleFactor: 0.8 } },
        smooth: { enabled: true, type: 'cubicBezier', roundness: 0.5 },
      },
      groups: {
        // Places: open white circles (classic petri-net notation).
        places: {
          shape: 'dot',
          size: 14,
          color: { background: '#ffffff', border: '#00695C' },
        },
        // Transitions: labelled boxes; wrap long names instead of growing wide.
        transitions: {
          shape: 'box',
          color: {
            background: '#FFF3E0',
            border: '#FB8C00',
            highlight: { background: '#FFE0B2', border: '#FB8C00' },
          },
          widthConstraint: { maximum: 140 },
          margin: 10,
          shapeProperties: { borderRadius: 4 },
        },
      },
      interaction: { zoomView: true, dragView: true, hover: true },
      physics: { enabled: false },
    };

    container.innerHTML = '';
    new vis.Network(container, { nodes, edges }, options);
  }

  /** Strip a leading bracketed type tag, e.g. "[ServiceTask] Ship Item" -> "Ship Item". */
  private static cleanLabel(label: string): string {
    return label.replace(/^\s*\[[^\]]*\]\s*/, '').trim() || label;
  }
}
