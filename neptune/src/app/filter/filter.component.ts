import { Component, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { combineLatest, forkJoin, Observable } from 'rxjs';
import { map, startWith, tap } from 'rxjs/operators';
import { Entity, EntityName } from 'src/lib/enums/entities';
import { Product } from '../../lib/interfaces/elements';
import { NeptuneService } from '../services/neptune.service';

@Component({
  selector: 'app-filter',
  templateUrl: './filter.component.html',
  styleUrls: ['./filter.component.scss']
})
export class FilterComponent implements OnInit, OnChanges {

  entities: Entity[] = [{
    entity: EntityName.product,
    lines: [{}],
    nextEdge: 'SessionHasProduct',
    nextEdgeOptions: []
  },
  {
    entity: 'session_ontology',
    lines: [{}],
    nextEdge: 'UserHasSession',
    nextEdgeOptions: []
  }]

  nodes: any[] = []
  edges: any[] = []

  isChecked: boolean = false
  isWait: boolean = false

  form = this.fb.group({
    from: null,
    to: null
  })

  /* structure = [
    {
      id: 1,
      entity:EntityName.product,
      next:'ProductHasPurch'
    },
    {
      id: 2,
      entity:EntityName.purchase,
      next:'PurchaseHasUser'
    },
    {
      id:3,
      entity:EntityName.user
    }
    ] */

  constructor(
    private fb: FormBuilder,
    private neptune: NeptuneService
  ) { }

  ngOnInit(): void {
  }

  ngOnChanges(changes: SimpleChanges): void {
    /* if(changes.form){
      if(changes.form.currentValue !== changes.form.previousValue){
        this.structure.forEach((x,index) => {
          if(!(this.entities[index].entity === x.entity)){
            this.entities.push({
              entity: x.entity,
              lines: [{}],
              nextEdge: x.next ? x.next : undefined
            })
          }
        })
      }
      console.log(this.entities);
    } */
  }

  onValues(value: Entity[]) {
    this.entities = value
  }

  IASelectorChange(checked: boolean) {
    console.log(event);
    if (checked) {
      //IA ON
      let i = this.entities.findIndex(e => e.entity === 'session_ontology')
      if (this.entities[i].lines.findIndex(l => l.field === 'isauth') === -1) {
        //condition not exists
        //OK
      } else {
        //condition exists
        //seccare
        let index = this.entities[i].lines.findIndex(l => l.field === 'isauth')
        this.entities[i].lines.splice(index, 1)

      }
    } else {
      //IA OFF
      let i = this.entities.findIndex(e => e.entity === 'session_ontology')
      if (this.entities[i].lines.findIndex(l => l.field === 'isauth') === -1) {
        //condition not exists
        //ADD
        this.entities[i].lines.push({
          field: 'isauth',
          operator: '=',
          value: '1'
        })
      } else {
        //condition exists
        //OK
        let index = this.entities[i].lines.findIndex(l => l.field === 'isauth')
        if (this.entities[i].lines[index].value === '1') {
          //OK
        } else {
          //NOT OK
          this.entities[i].lines[index].value = '1'
        }


      }

    }
  }

  downloadCSV() {
    this.IASelectorChange(this.isChecked)
    this.neptune.postQuery(this.entities).subscribe(res => {
      console.log(res);
      const replacer = (key: any, value: any) => (value === null ? '' : value); // specify how you want to handle null values here
      const header = Object.keys(res[0]);
      const csv = res.map((row: any) =>
        header
          .map((fieldName) => JSON.stringify(row[fieldName], replacer))
          .join(',')
      );
      csv.unshift(header.join(','));
      const csvArray = csv.join('\r\n');

      const a = document.createElement('a');
      const blob = new Blob([csvArray], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);

      a.href = url;
      a.download = 'myFile.csv';
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      this.IASelectorChange(false)
    })
  }

  submit() {
    this.IASelectorChange(this.isChecked)

    this.edges = []
    this.nodes = []
    let query: Entity[] = []
    console.log(this.entities);

    this.entities.forEach((entity, index) => {
      //prebuild nodes
      this.nodes.push({ label: entity.entity })

      //check previous element exists
      if (this.entities[index - 1]) {
        //add nextEdge of previous element
        query[index - 1] = {
          ...query[index - 1],
          nextEdge: this.entities[index - 1].nextEdge
        }
      }

      query.push({
        entity: entity.entity,
        lines: entity.lines,
        nextEdge: undefined
      })

      //create Observable
      this.isWait = true;
      this.neptune.postQuery(query).subscribe(res => {
        this.isWait = false;
        const i = this.nodes.findIndex(node => node.label === entity.entity)
        this.nodes[i] = {
          ...this.nodes[i],
          nodes: res,
        }
        this.nodes = this.nodes.slice()
      }
      )

      //last round
      if (index === this.entities.length - 1 && entity.nextEdge) {
        query.push({
          entity: entity.entity,
          lines: entity.lines,
          nextEdge: entity.nextEdge
        })

        this.neptune.postQuery(query).subscribe(
          res => {
            this.nodes.push({
              label: res[0].label,
              nodes: res
            })
            this.nodes = this.nodes.slice()
          })
      }

      //--------GET EDGES-------->
      if (entity.nextEdge) {
        this.neptune.getEdgeValues(entity.nextEdge).subscribe(res => {
          this.edges.push.apply(this.edges, res)
        })
      }

    })




    this.IASelectorChange(true)

    /* this.neptune.postQuery(this.entities).subscribe(res=>{
      console.log(res);
      this.nodes = res
    }) */
  }
}
