import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

// Operator types supported by the transformer (WorkflowBranchingType enum)
const SUPPORTED_OPERATOR_TYPES = new Set([101, 102, 104, 105, 106, 107, 108, 109]);

/**
 * Strips WoPeD PNML content that the transformer's pydantic-xml parser or
 * transformation logic rejects (verified against the model-transformer
 * sources and all 12 WoPeD fat-client sample nets, 2026-07-18):
 * - Operator elements with unsupported type values (e.g. 103 = OR-split)
 * - Arc inscriptions missing a <graphics> child (pydantic field is required;
 *   affects e.g. the fat client's LoanApplication.pnml sample)
 * - Resource annotations spanning MULTIPLE organizational units — the
 *   transformer only supports single-organization nets and returns
 *   "[10] Resources must belong to the same organization." otherwise
 *   (affects e.g. CapacityPlanning.pnml / LoanApplicationResources.pnml).
 *   In that case all role/resource annotations are removed so the process
 *   structure still converts; only lane assignment is lost.
 */
function normalizePnmlForTransformer(pnml: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(pnml, 'application/xml');

  // If the input isn't well-formed XML, pass it through untouched so the
  // backend reports its own parse error instead of us sending the browser's
  // <parsererror> document.
  if (doc.getElementsByTagName('parsererror').length > 0) {
    return pnml;
  }

  // Remove operators with unsupported type values
  doc.querySelectorAll('transition toolspecific operator').forEach(op => {
    const type = parseInt(op.getAttribute('type') ?? '0', 10);
    if (!SUPPORTED_OPERATOR_TYPES.has(type)) {
      op.parentElement?.removeChild(op);
    }
  });

  // Multi-organization resource annotations are unsupported by the
  // transformer — strip them (single-organization nets keep their roles).
  const transitionResources = Array.from(
    doc.querySelectorAll('transition toolspecific transitionResource')
  );
  const organizationalUnits = new Set(
    transitionResources.map(r => r.getAttribute('organizationalUnitName') ?? '')
  );
  if (organizationalUnits.size > 1) {
    transitionResources.forEach(resource => {
      const toolspecific = resource.parentElement;
      toolspecific?.querySelector('trigger')?.remove();
      resource.remove();
    });
    // Drop the now-orphaned global role/organization definitions as well.
    doc.querySelectorAll('net > toolspecific > resources').forEach(r => r.remove());
  }

  // Arc inscriptions need a <graphics> child or the parser throws
  doc.querySelectorAll('arc inscription').forEach(inscription => {
    if (!inscription.querySelector('graphics')) {
      const graphics = doc.createElement('graphics');
      const offset = doc.createElement('offset');
      offset.setAttribute('x', '0');
      offset.setAttribute('y', '0');
      graphics.appendChild(offset);
      inscription.appendChild(graphics);
    }
  });

  return new XMLSerializer().serializeToString(doc);
}

@Injectable({
  providedIn: 'root',
})
export class TransformerService {
  private baseUrl = 'https://woped.dhbw-karlsruhe.de/pnml-bpmn-transformer';

  constructor(private http: HttpClient) {}

  pnmlToBpmn(pnml: string): Observable<string> {
    const formData = new FormData();
    formData.append('pnml', normalizePnmlForTransformer(pnml));
    return this.http.post<{ bpmn: string }>(
      `${this.baseUrl}/transform?direction=pnmltobpmn`,
      formData
    ).pipe(map(response => response.bpmn));
  }

  bpmnToPnml(bpmn: string): Observable<string> {
    const formData = new FormData();
    formData.append('bpmn', bpmn);
    return this.http.post<{ pnml: string }>(
      `${this.baseUrl}/transform?direction=bpmntopnml`,
      formData
    ).pipe(map(response => response.pnml));
  }
}
