import * as BpmnViewer from 'bpmn-js/dist/bpmn-navigated-viewer.production.min.js';
import svgPanZoom from 'svg-pan-zoom';

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

  /** Parse PNML text and render it as a Petri net with the native SVG renderer. */
  public static displayPNML(container: HTMLElement, pnmlXml: string): void {
    const xmlDoc = new DOMParser().parseFromString(pnmlXml, 'text/xml');
    const petrinet = ModelDisplayer.parsePNML(xmlDoc);
    ModelDisplayer.renderPetriNet(container, petrinet);
  }

  private static parsePNML(PNML: Document) {
    const petrinet: {
      places: { id: string; label: string; x?: number; y?: number }[];
      transitions: { id: string; label: string; x?: number; y?: number }[];
      operators: { id: string; name: string; x?: number; y?: number }[];
      arcs: {
        source: string;
        target: string;
        weight?: string;
        waypoints?: { x: number; y: number }[];
      }[];
    } = { places: [], transitions: [], operators: [], arcs: [] };

    const places = PNML.getElementsByTagName('place');
    for (let x = 0; x < places.length; x++) {
      // A node without a real id can't be referenced by an arc, so skip it
      // rather than inventing a placeholder id that wires up to nothing.
      const id = places[x].getAttribute('id');
      if (!id) continue;
      // Transformer PNML often has label-less nodes (no <text>); fall back to
      // the id so a missing label never aborts rendering.
      const placeText = places[x].getElementsByTagName('text')[0];
      petrinet.places.push({
        id,
        label: (placeText && placeText.textContent) || id,
        ...ModelDisplayer.ownPosition(places[x]),
      });
    }

    // Render every transition at its own backend position -- including WOPED
    // operator members (`<id>_op_<n>`). Collapsing one operator's members into a
    // single averaged node detaches the backend's per-member arc waypoints:
    // members of one operator can sit thousands of px apart (a split and its
    // matching join), so the averaged node is nowhere near the routed waypoints
    // and every operator arc is drawn as a diagonal. The backend owns layout and
    // routing; the client follows it verbatim. Native Petri-net notation is plain
    // transition boxes anyway -- no operator glyph (see renderSvg).
    const transitions = PNML.getElementsByTagName('transition');
    for (let x = 0; x < transitions.length; x++) {
      const t = transitions[x];
      const id = t.getAttribute('id');
      if (!id) continue; // unreferenceable without a real id (see places above)
      const transitionText = t.getElementsByTagName('text')[0];
      petrinet.transitions.push({
        id,
        label: (transitionText && transitionText.textContent) || '',
        ...ModelDisplayer.ownPosition(t),
      });
    }

    // Each arc keeps its own source/target and the backend's bend points. Arc
    // weight comes from `<inscription>`; '1' is the default and is omitted to
    // avoid cluttering every edge. Exact duplicates (same source->target) are
    // dropped defensively.
    const seen = new Set<string>();
    const arcs = PNML.getElementsByTagName('arc');
    for (let x = 0; x < arcs.length; x++) {
      const source = arcs[x].getAttribute('source') || '';
      const target = arcs[x].getAttribute('target') || '';
      const key = source + '->' + target;
      const waypoints = ModelDisplayer.arcWaypoints(arcs[x]);
      if (!source || !target || seen.has(key)) continue;
      seen.add(key);
      const inscription = arcs[x].getElementsByTagName('inscription')[0];
      const weight = inscription
        ?.getElementsByTagName('text')[0]
        ?.textContent?.trim();
      petrinet.arcs.push({
        source,
        target,
        ...(weight && weight !== '1' ? { weight } : {}),
        ...(waypoints.length ? { waypoints } : {}),
      });
    }

    return petrinet;
  }

  /**
   * Read a node's OWN layout coordinate: the `<position>` under its
   * *direct-child* `<graphics>`, NOT the nested `<name>`/`<trigger>` sub-graphics.
   * The backend (t2p-2.0 `assign_pnml_coordinates`) writes the PNML `<position>`
   * as a centre point; `renderSvg` draws the node centred on it.
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

  /**
   * Read an arc's routing bend points from its *direct-child* `<graphics>`:
   * every interior `<position x= y=>` the backend wrote (endpoints excluded,
   * derived from the node centres). Empty when the backend left the arc
   * straight (adjacent-layer forward arcs). Absolute canvas coordinates.
   */
  private static arcWaypoints(el: Element): { x: number; y: number }[] {
    const graphics = Array.from(el.children).find(
      (c) => c.localName === 'graphics'
    );
    if (!graphics) return [];
    const points: { x: number; y: number }[] = [];
    for (const child of Array.from(graphics.children)) {
      if (child.localName !== 'position') continue;
      const x = parseFloat(child.getAttribute('x') || '');
      const y = parseFloat(child.getAttribute('y') || '');
      if (Number.isFinite(x) && Number.isFinite(y)) points.push({ x, y });
    }
    return points;
  }

  /**
   * Render a parsed Petri net into the container with the native SVG renderer:
   * node positions and arc bend points come from the backend layout (places as
   * circles, transitions/operators as rectangles, B&W, fat-client notation).
   *
   * There is no auto-layout fallback: the backend owns the layout and always
   * supplies a coordinate on every node. A node that nonetheless arrives without
   * coordinates is omitted by `renderSvg` (along with any arc touching it) rather
   * than collapsing the whole net into an invented layout — see `renderSvg`.
   */
  private static renderPetriNet(
    container: HTMLElement,
    petrinet: ReturnType<typeof ModelDisplayer.parsePNML>
  ) {
    ModelDisplayer.renderSvg(container, petrinet);
  }

  private static readonly SVG_NS = 'http://www.w3.org/2000/svg';
  private static readonly PLACE_R = 25;
  private static readonly NODE_H = 34;
  // Transitions/operators are fixed-size boxes (like the WoPeD fat client); the
  // name is drawn OUTSIDE, below the box, so it never inflates the node.
  private static readonly TRANSITION_W = 40;

  /** Create an SVG element in the SVG namespace with the given attributes. */
  private static svgNode(
    tag: string,
    attrs: Record<string, string | number>
  ): SVGElement {
    const el = document.createElementNS(ModelDisplayer.SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
    return el;
  }

  /**
   * Native SVG renderer for a fully-laid-out Petri net: places as circles,
   * transitions/operators as rectangles, arcs as polylines that follow the
   * backend's bend points (`arc.waypoints`) — black & white, standard PNML
   * notation, no operator glyphs. Pan/zoom via svg-pan-zoom.
   */
  private static renderSvg(
    container: HTMLElement,
    petrinet: ReturnType<typeof ModelDisplayer.parsePNML>
  ): void {
    type Box = {
      cx: number;
      cy: number;
      shape: 'circle' | 'rect';
      r: number;
      w: number;
      h: number;
    };
    const boxes = new Map<string, Box>();

    // Only nodes the backend actually placed get a box. A node without numeric
    // coordinates is left out entirely (no invented position) -- arcs touching
    // it are skipped below, and the view box only spans real boxes, so a missing
    // coordinate can never produce a NaN geometry.
    for (const p of petrinet.places) {
      if (typeof p.x !== 'number' || typeof p.y !== 'number') continue;
      boxes.set(p.id, {
        cx: p.x,
        cy: p.y,
        shape: 'circle',
        r: ModelDisplayer.PLACE_R,
        w: 0,
        h: 0,
      });
    }
    const addRect = (id: string, cx: number, cy: number, w: number) =>
      boxes.set(id, {
        cx,
        cy,
        shape: 'rect',
        r: 0,
        w,
        h: ModelDisplayer.NODE_H,
      });
    for (const t of petrinet.transitions) {
      if (typeof t.x !== 'number' || typeof t.y !== 'number') continue;
      addRect(t.id, t.x, t.y, ModelDisplayer.TRANSITION_W);
    }
    // Operators render as a plain unlabeled routing box (native notation).
    for (const o of petrinet.operators) {
      if (typeof o.x !== 'number' || typeof o.y !== 'number') continue;
      addRect(o.id, o.x, o.y, ModelDisplayer.TRANSITION_W);
    }

    // View box spanning every node extent and every arc bend point.
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const grow = (x: number, y: number) => {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    };
    for (const b of boxes.values()) {
      const hw = b.shape === 'circle' ? b.r : b.w / 2;
      const hh = b.shape === 'circle' ? b.r : b.h / 2;
      grow(b.cx - hw, b.cy - hh);
      grow(b.cx + hw, b.cy + hh);
    }
    for (const arc of petrinet.arcs) {
      for (const wp of arc.waypoints ?? []) grow(wp.x, wp.y);
    }
    // Transition names sit below their box; widen the view box so a long name
    // (centred under a fixed-width box) is not clipped at the diagram edges.
    for (const t of petrinet.transitions) {
      const b = boxes.get(t.id);
      if (!b) continue;
      const halfW = (ModelDisplayer.cleanLabel(t.label).length * 7) / 2;
      grow(b.cx - halfW, b.cy + b.h / 2 + 20);
      grow(b.cx + halfW, b.cy + b.h / 2 + 20);
    }
    if (!Number.isFinite(minX)) {
      minX = minY = 0;
      maxX = maxY = 100;
    }
    const pad = 40;

    const svg = ModelDisplayer.svgNode('svg', {
      xmlns: ModelDisplayer.SVG_NS,
      width: '100%',
      height: '100%',
      viewBox: `${minX - pad} ${minY - pad} ${maxX - minX + 2 * pad} ${
        maxY - minY + 2 * pad
      }`,
    });

    const defs = ModelDisplayer.svgNode('defs', {});
    const marker = ModelDisplayer.svgNode('marker', {
      id: 'pn-arrow',
      viewBox: '0 0 10 10',
      refX: 9,
      refY: 5,
      markerWidth: 7,
      markerHeight: 7,
      orient: 'auto',
    });
    marker.appendChild(
      ModelDisplayer.svgNode('path', { d: 'M0,0 L10,5 L0,10 z', fill: '#111' })
    );
    defs.appendChild(marker);
    svg.appendChild(defs);

    // Arcs first so the nodes paint over the line ends.
    for (const arc of petrinet.arcs) {
      const s = boxes.get(arc.source);
      const t = boxes.get(arc.target);
      if (!s || !t) continue;
      // The client does NOT invent routing: it draws straight between node
      // centres and only bends where the backend supplied waypoints. Any skew on
      // a waypoint-free arc means the backend should have routed it.
      const mids = arc.waypoints ?? [];
      const afterSource = mids[0] ?? { x: t.cx, y: t.cy };
      const beforeTarget = mids[mids.length - 1] ?? { x: s.cx, y: s.cy };
      const start = ModelDisplayer.clip(s, afterSource.x, afterSource.y);
      const end = ModelDisplayer.clip(t, beforeTarget.x, beforeTarget.y);
      const pts = [start, ...mids, end];
      svg.appendChild(
        ModelDisplayer.svgNode('polyline', {
          points: pts.map((p) => `${p.x},${p.y}`).join(' '),
          fill: 'none',
          stroke: '#111',
          'stroke-width': 1.5,
          'marker-end': 'url(#pn-arrow)',
        })
      );
      if (arc.weight) {
        const mid = pts[Math.floor(pts.length / 2)];
        const lbl = ModelDisplayer.svgNode('text', {
          x: mid.x + 4,
          y: mid.y - 4,
          'font-size': 11,
          fill: '#333',
        });
        lbl.textContent = arc.weight;
        svg.appendChild(lbl);
      }
    }

    for (const p of petrinet.places) {
      const b = boxes.get(p.id);
      if (!b) continue;
      const circle = ModelDisplayer.svgNode('circle', {
        cx: b.cx,
        cy: b.cy,
        r: b.r,
        fill: '#fff',
        stroke: '#111',
        'stroke-width': 1.5,
      });
      const title = ModelDisplayer.svgNode('title', {});
      title.textContent = p.label;
      circle.appendChild(title);
      svg.appendChild(circle);
    }
    const drawRect = (id: string, label: string, hover: string) => {
      const b = boxes.get(id);
      if (!b) return;
      const rect = ModelDisplayer.svgNode('rect', {
        x: b.cx - b.w / 2,
        y: b.cy - b.h / 2,
        width: b.w,
        height: b.h,
        fill: '#fff',
        stroke: '#111',
        'stroke-width': 1.5,
      });
      const title = ModelDisplayer.svgNode('title', {});
      title.textContent = hover;
      rect.appendChild(title);
      svg.appendChild(rect);
      if (!label) return;
      // Name BELOW the box (fat-client convention), not inside it -- so the box
      // stays a fixed size and the text never sits on top of the shape.
      const text = ModelDisplayer.svgNode('text', {
        x: b.cx,
        y: b.cy + b.h / 2 + 6,
        'text-anchor': 'middle',
        'dominant-baseline': 'hanging',
        'font-size': 12,
        fill: '#111',
      });
      text.textContent = label;
      svg.appendChild(text);
    };
    for (const t of petrinet.transitions) {
      drawRect(t.id, ModelDisplayer.cleanLabel(t.label), t.label);
    }
    for (const o of petrinet.operators) {
      drawRect(o.id, '', `${o.name} (${o.id})`);
    }

    container.innerHTML = '';
    container.appendChild(svg);
    const pz = svgPanZoom(svg, {
      zoomEnabled: true,
      controlIconsEnabled: true,
      dblClickZoomEnabled: true,
      mouseWheelZoomEnabled: true,
      fit: true,
      center: true,
      minZoom: 0.1,
      maxZoom: 50,
    });
    // A layered Petri net is long and thin (~2x its BPMN, often 20:1), so the
    // default fit-to-WIDTH shrinks it to an unreadable sliver. Re-zoom to fit the
    // HEIGHT instead and pan to the start, so shapes render full size and the
    // user scrolls along the flow. The controls/wheel still zoom freely, and a
    // net that is not wider than tall keeps the normal fit.
    const sizes = pz.getSizes();
    const widthFit = sizes.width / sizes.viewBox.width;
    const heightFit = sizes.height / sizes.viewBox.height;
    if (widthFit > 0 && heightFit > widthFit) {
      pz.zoomBy(heightFit / widthFit); // width-fit -> height-fit (clamped by maxZoom)
      const z = pz.getSizes();
      const overflow = z.viewBox.width * z.realZoom - z.width;
      if (overflow > 0) pz.panBy({ x: overflow / 2, y: 0 }); // reveal the left edge
    }
  }

  /**
   * Point on node `b`'s border in the direction of (px, py) — where an arc
   * touching that node should start/end so the line meets the shape edge.
   */
  private static clip(
    b: { cx: number; cy: number; shape: 'circle' | 'rect'; r: number; w: number; h: number },
    px: number,
    py: number
  ): { x: number; y: number } {
    const dx = px - b.cx;
    const dy = py - b.cy;
    if (dx === 0 && dy === 0) return { x: b.cx, y: b.cy };
    if (b.shape === 'circle') {
      const d = Math.hypot(dx, dy);
      return { x: b.cx + (dx * b.r) / d, y: b.cy + (dy * b.r) / d };
    }
    const sx = dx !== 0 ? b.w / 2 / Math.abs(dx) : Infinity;
    const sy = dy !== 0 ? b.h / 2 / Math.abs(dy) : Infinity;
    const s = Math.min(sx, sy);
    return { x: b.cx + dx * s, y: b.cy + dy * s };
  }

  /** Strip a leading bracketed type tag, e.g. "[ServiceTask] Ship Item" -> "Ship Item". */
  private static cleanLabel(label: string): string {
    return label.replace(/^\s*\[[^\]]*\]\s*/, '').trim() || label;
  }
}
