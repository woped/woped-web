import { Component } from '@angular/core';
import { p2tHttpService } from '../p2tHttpService';
import { HttpResponse } from '@angular/common/http';

declare global {
    interface Window {
        fileContent: string;
    }
  }

@Component({
  selector: 'app-p2t',
  templateUrl: './p2t.component.html',
  styleUrls: ['./p2t.component.css'],
  template: `'<p>p2t works!</p>'`
})



export class P2tComponent {
    response: any; 
    test: String; 
    

  constructor(private p2tHttpService: p2tHttpService){

  }

  sendText(){
        const input = document.getElementById('fileInput') as HTMLInputElement;
        if (input.files && input.files.length > 0) {
          const file = input.files[0];
          const reader = new FileReader();
          reader.onload = (e) => {
            
            window.fileContent = reader.result as string;
//            console.log(window.fileContent);
          };
          reader.readAsText(file);
        }
  }


  generateText(){
    let postmanRequest=`<?xml version="1.0" encoding="UTF-8"?><pnml xmlns="pnml.woped.org">
    <net type="http://www.informatik.hu-berlin.de/top/pntd/ptNetb" id="noID"><place id="p2">
            <name><text>start</text>
                <graphics>
                    <offset x="0" y="0"/>
                </graphics>
            </name>
            <graphics>
                <position x="0" y="0"/>
                <dimension x="40" y="40"/>
            </graphics>
            <initialMarking>
                <text>1</text>
            </initialMarking>
        </place>
        <place id="p3">
            <name>
                <text>end</text>
                <graphics>
                    <offset x="0" y="0"/>
                </graphics>
            </name>
            <graphics>
                <position x="0" y="0"/>
                <dimension x="40" y="40"/>
            </graphics>
        </place>
        <transition id="t2">
            <name>
                <text>buy auto</text>
                <graphics>
                    <offset x="0" y="0"/>
                </graphics>
            </name>
            <graphics>
                <position x="0" y="0"/>
                <dimension x="40" y="40"/>
            </graphics>
            <toolspecific tool="WoPeD" version="1.0">
                <trigger id="" type="200">
                    <graphics>
                        <position x="0" y="0"/>
                        <dimension x="24" y="22"/>
                    </graphics>
                </trigger>
                <transitionResource organizationalUnitName="all" roleName="manager">
                    <graphics>
                        <position x="0" y="0"/>
                        <dimension x="60" y="22"/>
                    </graphics>
                </transitionResource>
                <time>0</time>
                <timeUnit>1</timeUnit>
                <orientation>1</orientation>
            </toolspecific>
        </transition>
        <arc id="a4" source="t2" target="p3">
            <inscription>
                <text>1</text>
                <graphics>
                    <offset x="500.0" y="-12.0"/>
                </graphics>
            </inscription>
            <toolspecific tool="WoPeD" version="1.0">
                <probability>1.0</probability>
                <displayProbabilityOn>false</displayProbabilityOn>
                <displayProbabilityPosition x="500.0" y="12.0"/>
            </toolspecific>
        </arc>
        <arc id="a5" source="p2" target="t2">
            <inscription>
                <text>1</text>
                <graphics>
                    <offset x="500.0" y="-12.0"/>
                </graphics>
            </inscription>
            <toolspecific tool="WoPeD" version="1.0">
                <probability>1.0</probability>
                <displayProbabilityOn>false</displayProbabilityOn>
                <displayProbabilityPosition x="500.0" y="12.0"/>
            </toolspecific>
        </arc>
        <toolspecific tool="WoPeD" version="1.0">
            <bounds>
                <position x="2" y="25"/>
                <dimension x="763" y="574"/>
            </bounds>
            <scale>100</scale>
            <treeWidthRight>549</treeWidthRight>
            <overviewPanelVisible>false</overviewPanelVisible>
            <treeHeightOverview>100</treeHeightOverview>
            <treePanelVisible>false</treePanelVisible>
            <verticalLayout>false</verticalLayout>
            <resources>
                <role Name="manager"/>
                <organizationUnit Name="all"/>
            </resources>
        </toolspecific>
    </net>
</pnml>`;

//console.log(window.fileContent.length);

    if (window.fileContent !== undefined){
        console.log("postman Request " + postmanRequest);
        console.log("file Content " + window.fileContent);
        this.p2tHttpService.postP2T(window.fileContent);
    }

    else{
        this.p2tHttpService.displayText("Keine Datei hochgeladen");
    }

    

  }
}