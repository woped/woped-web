import { Component, ElementRef, ViewChild } from '@angular/core';
import { p2tHttpService } from '../Services/p2tHttpService';
import { MatStepper } from '@angular/material/stepper';
import * as vis from 'vis';
import { HttpResponse } from '@angular/common/http';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import {
  defer,
  first,
  fromEvent,
  merge,
  mergeMap,
  switchMap,
  takeUntil,
  tap,
  windowWhen,
} from 'rxjs';
import { SpinnerService } from '../utilities/SpinnerService';
import { t2pHttpService } from '../Services/t2pHttpService';
import { ModelDisplayer } from '../utilities/modelDisplayer';

//global variable to store the file content
declare global {
  interface Window {
    fileContent: string;
    dropfileContent: string;
  }
}

@Component({
  selector: 'app-p2t',
  templateUrl: './p2t.component.html',
  styleUrls: ['./p2t.component.css'],
  template: `'
    <p>p2t works!</p>
    '`,
})
export class P2tComponent {
  response: any;
  test: string;
  fileType: string;

  // ViewChild decorator to get a reference to MatStepper
  @ViewChild('stepperRef') stepper!: MatStepper;

  // ViewChild decorator to get a reference to the drop zone element
  @ViewChild('dropZone', { static: true }) dropZone: ElementRef<HTMLDivElement>;

  isFileDropped = false;
  droppedFileName = '';

  // ViewChild decorator to get a reference to the HTML file input element
  @ViewChild('fileInputRef') fileInputRef!: ElementRef<HTMLInputElement>;

  // This method is called when a file is dragged on the drop zone
  onDragOver(event: DragEvent) {
    event.preventDefault();
  }

  constructor(
    private p2tHttpService: p2tHttpService,
    private t2phttpService: t2pHttpService,
    public spinnerService: SpinnerService
  ) {}

  // This method generates the text based on the selected file type and content.Allows only pnml and bpmn files
  generateText() {
    const paragraph = document.createElement('p');
    if (this.fileType == 'bpmn') {
      ModelDisplayer.displayBPMNModel(window.dropfileContent);
    } else if (this.fileType == 'pnml') {
      //P2tComponent.displayPNMLModel(window.dropfileContent);
      ModelDisplayer.generatePetriNet(window.dropfileContent);
    }
    // check if the file content or dropfile is not empty, then calls the postP2T method and the loading spinner is displayed
    if (
      window.fileContent !== undefined ||
      window.dropfileContent !== undefined
    ) {
      this.spinnerService.show();
      this.p2tHttpService.postP2T(window.dropfileContent);
    } else {
      this.p2tHttpService.displayText('No files uploaded');
    }
    event.preventDefault();
    this.stepper.next();
  }

  // This method is called when files are dropped on the drop zone
  onDrop(event: DragEvent) {
    event.preventDefault();
    const files = event.dataTransfer?.files;
    // check if the files are not empty and the file type is allowed
    if (files && files.length > 0) {
      const allowedExtensions = ['pnml', 'bpmn'];
      const hasAllowedFiles = Array.from(files).some((file) => {
        const fileExtension = file.name
          .substring(file.name.lastIndexOf('.') + 1)
          .toLowerCase();
        return allowedExtensions.includes(fileExtension);
      });
      // if the file type is allowed, then process the dropped files
      if (hasAllowedFiles) {
        this.processDroppedFiles(files);
        this.isFileDropped = true;
        this.droppedFileName = files.item(0)?.name || '';
      } else {
        alert('Please upload only files with .pnml or .bpmn format');
      }
    }
  }
  // Process the dropped files and read their contents
  processDroppedFiles(files: FileList) {
    // read the file content
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      reader.onload = (e) => {
        window.dropfileContent = reader.result as string;
      };
      reader.readAsText(file);
    }
  }

  // Download the generated text as a txt file
  downloadText() {
    const text = this.p2tHttpService.getText();
    const filename = 'p2t';
    const element = document.createElement('a');
    element.setAttribute(
      'href',
      'data:text/plain;charset=utf-8,' + encodeURIComponent(text)
    );
    element.setAttribute('download', filename);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  }

  // Trigger the file input to select files
  selectFiles() {
    this.fileInputRef.nativeElement.click();
  }

  // Handle the file selection event
  onFileSelected(event: Event) {
    const fileInput = event.target as HTMLInputElement;
    const files = fileInput.files;
    // check if the files are not empty and the file type is allowed
    if (files && files.length > 0) {
      this.processDroppedFiles(files);
      this.isFileDropped = true;
      this.droppedFileName = files[0].name;
      const allowedExtensions = ['pnml', 'bpmn'];
      const hasAllowedFiles = Array.from(files).some((file) => {
        const fileExtension = file.name
          .substring(file.name.lastIndexOf('.') + 1)
          .toLowerCase();
        //check if the file extension is allowed
        if (fileExtension == 'pnml') this.fileType = 'pnml';
        else if (fileExtension == 'bpmn') this.fileType = 'bpmn';
        return allowedExtensions.includes(fileExtension);
      });
      // if the file type is allowed, then process the dropped files
      if (hasAllowedFiles) {
        this.processDroppedFiles(files);
        this.isFileDropped = true;
        this.droppedFileName = files.item(0)?.name || '';
      } else {
        alert('Please upload only files with .pnml or .bpmn format');
      }
    }
  }
  //method is called, when a pnml file is displayed
  public static displayPNMLModel(petrinet: any) {
    let generateWorkFlowNet = false; //Determines wether WoPeD specific Elements like XOR Split are created
    const prettyPetriNet = getPetriNet(petrinet);
    generatePetrinetConfig(prettyPetriNet);
    function generatePetrinetConfig(petrinet) {
      const data = getVisElements(petrinet);

      // create a network
      const container = document.getElementById('model-container');
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
            shape: 'circle',
          },
          transitions: {
            color: { background: '#FFB74D', border: '#FB8C00' },
            shape: 'square',
            borderWidth: 3,
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
      const network = new vis.Network(container, data, options);
    }
    let gateways = [];
    function getPetriNet(PNML) {
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
          label: place.getElementsByTagName('text')[0].textContent,
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
          label: transition.getElementsByTagName('text')[0].textContent,
          isGateway: isGateway,
          gatewayType: gatewayType,
          gatewayID: gatewayID,
        });
      }
      return petrinet;
    }

    function resetGatewayLog() {
      gateways = [];
    }

    function logContainsGateway(transition) {
      for (let x = 0; x < gateways.length; x++) {
        if (gateways[x].gatewayID === transition.gatewayID) return true;
      }
      return false;
    }
    // Identifies the Gateways
    function logGatewayTransition(transition) {
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

    function getGatewayIDsforReplacement(arc) {
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

    function replaceGatewayArcs(arcs) {
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

    function getVisElements(PetriNet) {
      // provide the data in the vis format
      const edges = new vis.DataSet([]);
      const nodes = new vis.DataSet([]);
      for (let x = 0; x < PetriNet.places.length; x++) {
        nodes.add({
          id: PetriNet.places[x].id,
          group: 'places',
          label: PetriNet.places[x].label,
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
            label: PetriNet.transitions[x].id,
            title: PetriNet.transitions[x].label,
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
  }
}
