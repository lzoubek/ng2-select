import { Component, Input, Output, EventEmitter, ElementRef, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { SelectItem } from './select-item';
import { stripTags } from './select-pipes';
import { OptionsBehavior } from './select-interfaces';
import { escapeRegexp } from './common';

let styles = `
  .ui-select-toggle {
    position: relative;
  }

  /* Fix caret going into new line in Firefox */
  .ui-select-placeholder {
    float: left;
  }

  /* Fix Bootstrap dropdown position when inside a input-group */
  .input-group > .dropdown {
    /* Instead of relative */
    position: static;
  }

  .ui-select-match > .btn {
    /* Instead of center because of .btn */
    text-align: left !important;
  }

  .ui-select-match > .caret {
    position: absolute;
    top: 45%;
    right: 15px;
  }

  .ui-disabled {
    background-color: #eceeef;
    border-radius: 4px;
    position: absolute;
    width: 100%;
    height: 100%;
    z-index: 5;
    opacity: 0.6;
    top: 0;
    left: 0;
    cursor: not-allowed;
  }

  .ui-select-choices-container {
    width: 100%;
  }

  .ui-select-choices-container > .ui-select-search {
    padding: 3px;
    padding-top: 0px;
    margin-top: -2px;
  }

  .ui-select-choices {
    width: 100%;
    height: auto;
    max-height: 200px;
    overflow-x: hidden;
    margin-top: 0;
    list-style: none;
    padding-left: 0;
  }

  .ui-select-multiple .ui-select-choices {
    margin-top: 1px;
  }
  .ui-select-choices-row>a {
      display: block;
      padding: 3px 20px;
      clear: both;
      font-weight: 400;
      line-height: 1.42857143;
      color: #333;
      white-space: nowrap;
  }

.ui-select-choices-row.selected {
    background-color: grey;
  }

  .ui-select-choices-row.active>a {
      color: #fff;
      text-decoration: none;
      outline: 0;
      background-color: #428bca;
  }

  .ui-select-multiple {
    height: auto;
    padding:3px 3px 0 3px;
  }

  .ui-select-multiple .ui-select-search > input {
    background-color: transparent !important; /* To prevent double background when disabled */
    border: none;
    outline: none;
    box-shadow: none;
    height: 1.6666em;
    padding: 0;
    margin-bottom: 3px;

  }
  .ui-select-match .close {
      font-size: 1.6em;
      line-height: 0.75;
  }

  .ui-select-multiple .ui-select-match-item {
    outline: 0;
    margin: 0 3px 3px 0;
  }
  .ui-select-toggle > .dropdown-caret {
      position: absolute;
      top: 50%;
      right: 7px;
      margin-top: -5px;
      font-size: 80%;
  }
`;

@Component({
  selector: 'ng-select',
  styles: [styles],
  template: `
  <div tabindex="0"
     *ngIf="multiple === false"
     (keyup)="mainClick($event)"
     (click)="scrollToSelected()"
     class="ui-select-container dropdown open">
    <div [ngClass]="{'ui-disabled': disabled}"></div>
    <div class="ui-select-match">
      <span tabindex="-1"
          class="btn btn-default btn-secondary form-control ui-select-toggle"
          (click)="matchClick($event)"
          style="outline: 0;">
        <span *ngIf="active.length <= 0" class="ui-select-placeholder text-muted">{{placeholder}}</span>
        <span *ngIf="active.length > 0" class="ui-select-match-text pull-left"
              [ngClass]="{'ui-select-allow-clear': allowClear && active.length > 0}"
              [innerHTML]="sanitize(active[0].text)"></span>

        <i class="glyphicon dropdown-caret pull-right" [ngClass]="{'glyphicon-menu-down': !optionsOpened, 'glyphicon-menu-up': optionsOpened}"></i>
        <a *ngIf="allowClear && active.length>0" class="btn btn-xs btn-link pull-right" style="margin-right: 10px; padding: 0;" (click)="removeClick(active[0], $event)">
           <i class="glyphicon glyphicon-remove"></i>
        </a>
      </span>
    </div>

     <!-- options template -->
     <div *ngIf="optionsOpened && !firstItemHasChildren" class="ui-select-choices-container dropdown-menu" role="menu">
        <div class="ui-select-search" *ngIf="isSearch">
            <input type="text" autocomplete="false" tabindex="-1"
           (keydown)="inputEvent($event)"
           (keyup)="inputEvent($event, true)"
           [disabled]="disabled"
           class="form-control"
           placeholder="{{active.length <= 0 ? placeholder : ''}}">
        </div>
        <ul class="ui-select-choices" *ngIf="options && options.length > 0">
          <li *ngFor="let o of options" role="menuitem">
            <div class="ui-select-choices-row"
                 [class.active]="isActive(o)"
                 [class.selected]="o.id == active[0]?.id"
                 (mouseenter)="selectActive(o)"
                 (click)="selectMatch(o, $event)">
              <a href="javascript:void(0)" class="dropdown-item">
                <div [innerHtml]="sanitize(o.text)"></div>
              </a>
            </div>
          </li>
        </ul>
      </div>

     <div *ngIf="optionsOpened && firstItemHasChildren" class="ui-select-choices-container dropdown-menu" role="menu">
        <div class="ui-select-search" *ngIf="isSearch">
            <input type="text" autocomplete="false" tabindex="-1"
           (keydown)="inputEvent($event)"
           (keyup)="inputEvent($event, true)"
           [disabled]="disabled"
           class="form-control"
           placeholder="{{active.length <= 0 ? placeholder : ''}}">
        </div>

        <ul *ngIf="options && options.length > 0" class="ui-select-choices" role="menu">
          <li *ngFor="let c of options; let index=index" role="menuitem">
            <div class="divider dropdown-divider" *ngIf="index > 0"></div>
            <div class="dropdown-header">{{c.text}}</div>

            <div *ngFor="let o of c.children"
                 class="ui-select-choices-row"
                 [class.active]="isActive(o)"
                 (mouseenter)="selectActive(o)"
                 (click)="selectMatch(o, $event)"
                 [ngClass]="{'active': isActive(o)}">
              <a href="javascript:void(0)" class="dropdown-item">
                <div [innerHtml]="sanitize(o.text)"></div>
              </a>
            </div>
          </li>
        </ul>
      </div>
  </div>

  <div tabindex="0"
     *ngIf="multiple === true"
     (keyup)="mainClick($event)"
     (focus)="focusToInput('')"
     class="ui-select-container ui-select-multiple dropdown form-control open">
    <div [ngClass]="{'ui-disabled': disabled}"></div>
    <span class="ui-select-match">
        <span *ngFor="let a of active">
            <span class="ui-select-match-item btn btn-default btn-secondary btn-xs"
                  tabindex="-1"
                  type="button"
                  [ngClass]="{'btn-default': true}">
               <a class="close"
                  style="margin-left: 5px; padding: 0;"
                  (click)="removeClick(a, $event)">&times;</a>
               <span>{{a.text}}</span>
           </span>
        </span>
    </span>
    <input type="text"
           (keydown)="inputEvent($event)"
           (keyup)="inputEvent($event, true)"
           (click)="matchClick($event)"
           [disabled]="disabled"
           autocomplete="false"
           autocorrect="off"
           autocapitalize="off"
           spellcheck="false"
           class="form-control ui-select-search"
           placeholder="{{active.length <= 0 ? placeholder : ''}}"
           role="combobox">
     <!-- options template -->

     <ul *ngIf="optionsOpened && options && options.length > 0 && !firstItemHasChildren"
          class="ui-select-choices dropdown-menu" role="menu">
        <li *ngFor="let o of options" role="menuitem">
          <div class="ui-select-choices-row"
               [class.active]="isActive(o)"
               (mouseenter)="selectActive(o)"
               (click)="selectMatch(o, $event)">
            <a href="javascript:void(0)" class="dropdown-item">
              <div [innerHtml]="sanitize(o.text | highlight:inputValue)"></div>
            </a>
          </div>
        </li>
      </ul>

      <ul *ngIf="optionsOpened && options && options.length > 0 && firstItemHasChildren"
          class="ui-select-choices dropdown-menu" role="menu">
        <li *ngFor="let c of options; let index=index" role="menuitem">
          <div class="divider dropdown-divider" *ngIf="index > 0"></div>
          <div class="dropdown-header">{{c.text}}</div>

          <div *ngFor="let o of c.children"
               class="ui-select-choices-row"
               [class.active]="isActive(o)"
               (mouseenter)="selectActive(o)"
               (click)="selectMatch(o, $event)"
               [ngClass]="{'active': isActive(o)}">
            <a href="javascript:void(0)" class="dropdown-item">
              <div [innerHtml]="sanitize(o.text | highlight:inputValue)"></div>
            </a>
          </div>
        </li>
      </ul>
  </div>
  `,
  //changeDetection: ChangeDetectionStrategy.OnPush
})
export class SelectComponent implements OnInit, OnDestroy {
  @Input() public allowClear:boolean = false;
  @Input() public placeholder:string = '';
  @Input() public idField:string = 'id';
  @Input() public textField:string = 'text';
  @Input() public multiple:boolean = false;
  @Input() public isSearch: boolean = true;

  @Input()
  public set items(value:Array<any>) {
    if (!value) {
      this._items = this.itemObjects = [];
    } else {
      this._items = value.filter((item:any) => {
        // if ((typeof item === 'string' && item) || (typeof item === 'object' && item && item.text && item.id)) {
        if ((typeof item === 'string') || (typeof item === 'object' && item.text)) {
          return item;
        }
      });
      // this.itemObjects = this._items.map((item:any) => (typeof item === 'string' ? new SelectItem(item) : new SelectItem({id: item[this.idField], text: item[this.textField]})));
      this.itemObjects = this._items.map((item:any) => new SelectItem(item));
    }
  }

  @Input()
  public set disabled(value:boolean) {
    this._disabled = value;
    if (this._disabled === true) {
      this.hideOptions();
    }
  }

  public get disabled():boolean {
    return this._disabled;
  }

  @Input()
  public set active(selectedItems:Array<any>) {
    if (!selectedItems || selectedItems.length === 0) {
      this._active = [];
    } else {
      let areItemsStrings = typeof selectedItems[0] === 'string';

      this._active = selectedItems.map((item:any) => {
        let data = areItemsStrings
          ? item
          : {id: item[this.idField], text: item[this.textField]};

        return new SelectItem(data);
      });
    }
  }

  @Output() public data:EventEmitter<any> = new EventEmitter();
  @Output() public selected:EventEmitter<any> = new EventEmitter();
  @Output() public removed:EventEmitter<any> = new EventEmitter();
  @Output() public typed:EventEmitter<any> = new EventEmitter();
  @Output() public opened:EventEmitter<any> = new EventEmitter();

  public options:Array<SelectItem> = [];
  public itemObjects:Array<SelectItem> = [];
  public activeOption:SelectItem;
  public element:ElementRef;

  public get active():Array<any> {
    return this._active;
  }

  private set optionsOpened(value:boolean){
    this._optionsOpened = value;
    this.opened.emit(value);
  }

  private get optionsOpened(): boolean{
    return this._optionsOpened;
  }

  private inputMode:boolean = false;
  private _optionsOpened:boolean = false;
  private behavior:OptionsBehavior;
  private inputValue:string = '';
  private _items:Array<any> = [];
  private _disabled:boolean = false;
  private _active:Array<SelectItem> = [];

  public constructor(element:ElementRef, private sanitizer:DomSanitizer, private changeDetector: ChangeDetectorRef) {
    this.element = element;
    this.clickedOutside = this.clickedOutside.bind(this);
  }

  public sanitize(html:string):any {
    // disable sanitizing as it breaks
    // selection event handlers in firefox
    return html;
  }

  public inputEvent(e:any, isUpMode:boolean = false):void {
    // tab
    if (e.keyCode === 9) {
      return;
    }
    if (isUpMode && (e.keyCode === 37 || e.keyCode === 39 || e.keyCode === 38 ||
      e.keyCode === 40 || e.keyCode === 13)) {
      e.preventDefault();
      return;
    }
    // backspace
    if (!isUpMode && e.keyCode === 8) {
      let el:any = this.element.nativeElement
        .querySelector('div.ui-select-search > input');
      if (!el.value || el.value.length <= 0) {
        if (this.active.length > 0) {
          this.remove(this.active[this.active.length - 1]);
        }
        e.preventDefault();
      }
    }
    // esc
    if (!isUpMode && e.keyCode === 27) {
      this.hideOptions();
      this.element.nativeElement.children[0].focus();
      e.preventDefault();
      return;
    }
    // del
    if (!isUpMode && e.keyCode === 46) {
      if (this.active.length > 0) {
        this.remove(this.active[this.active.length - 1]);
      }
      e.preventDefault();
    }
    // left
    if (!isUpMode && e.keyCode === 37 && this._items.length > 0) {
      this.behavior.first();
      e.preventDefault();
      return;
    }
    // right
    if (!isUpMode && e.keyCode === 39 && this._items.length > 0) {
      this.behavior.last();
      e.preventDefault();
      return;
    }
    // up
    if (!isUpMode && e.keyCode === 38) {
      this.behavior.prev();
      e.preventDefault();
      return;
    }
    // down
    if (!isUpMode && e.keyCode === 40) {
      this.behavior.next();
      e.preventDefault();
      return;
    }
    // enter
    if (!isUpMode && e.keyCode === 13) {
      if (this.active.indexOf(this.activeOption) === -1) {
        this.selectActiveMatch();
        this.behavior.next();
      }
      e.preventDefault();
      return;
    }
    let target = e.target || e.srcElement;
    if (target && target.value) {
      this.inputValue = target.value;
      // consider spaces as logical OR

      let filterValue = escapeRegexp(this.inputValue).trim();
      const parts: string[] = filterValue.split(' ').map((p: string) => p ? `(${p}).*` : '');
      this.behavior.filter(new RegExp(parts.join(''), 'ig'));
      this.doEvent('typed', this.inputValue);
    }
  }

  public ngOnInit():any {
    this.behavior = (this.firstItemHasChildren) ?
      new ChildrenBehavior(this) : new GenericBehavior(this);
    setTimeout(() => {document.addEventListener('click', this.clickedOutside);});
  }

  ngOnDestroy() {
    document.removeEventListener('click', this.clickedOutside);
  }

  public remove(item:SelectItem):void {
    if (this._disabled === true) {
      return;
    }
    if (this.multiple === true && this.active) {
      let index = this.active.indexOf(item);
      this.active.splice(index, 1);
      this.data.next(this.active);
      this.doEvent('removed', item);
    }
    if (this.multiple === false) {
      this.active = [];
      this.data.next(this.active);
      this.doEvent('removed', item);
    }
  }

  public doEvent(type:string, value:any):void {
    if ((this as any)[type] && value) {
      (this as any)[type].next(value);
    }
  }

  public clickedOutside($event: MouseEvent):void {
    if (this.optionsOpened) {
      let element: HTMLElement = <HTMLElement>$event.target;
      let isThisEl = false;
      while (element.parentElement && !isThisEl) {
        isThisEl = this.element.nativeElement === element;
        element = element.parentElement;
      }
      if (!isThisEl) {
        this.inputMode = false;
        this.optionsOpened = false;
        this.changeDetector.detectChanges();
      }
    }
  }

  public get firstItemHasChildren():boolean {
    return this.itemObjects[0] && this.itemObjects[0].hasChildren();
  }

  protected matchClick(e:MouseEvent):void {
    if (this._disabled === true) {
      return;
    }

    if (this.inputMode === true) {
      this.inputMode = false;
      this.optionsOpened = false;
      return;
    }
    this.inputMode = !this.inputMode;
    if (this.inputMode === true && ((this.multiple === true && e) || this.multiple === false)) {
      this.focusToInput();
      this.open();
    }
  }

  protected  mainClick(event:any):void {
    if (this.inputMode === true || this._disabled === true) {
      return;
    }
    if (event.keyCode === 46) {
      event.preventDefault();
      this.inputEvent(event);
      return;
    }
    if (event.keyCode === 8) {
      event.preventDefault();
      this.inputEvent(event, true);
      return;
    }
    if (event.keyCode === 9 || event.keyCode === 13 ||
      event.keyCode === 27 || (event.keyCode >= 37 && event.keyCode <= 40)) {
      event.preventDefault();
      return;
    }
    this.inputMode = true;
    let value = String
      .fromCharCode(96 <= event.keyCode && event.keyCode <= 105 ? event.keyCode - 48 : event.keyCode)
      .toLowerCase();
    this.focusToInput(value);
    this.open();
    let target = event.target || event.srcElement;
    target.value = value;
    this.inputEvent(event);
  }

  protected  selectActive(value:SelectItem):void {
    this.activeOption = value;
  }

  private scrollToSelected():void {
    let selectedElement = this.element.nativeElement.querySelector('div.ui-select-choices-row.selected');
    if(selectedElement === null)
      return;
    this.element.nativeElement.querySelector('ul.ui-select-choices').scrollTop = selectedElement.offsetTop - 40;
  }

  protected  isActive(value:SelectItem):boolean {
    return this.activeOption.text === value.text;
  }

  protected removeClick(value: SelectItem, event: any): void {
    event.stopPropagation();
    this.remove(value);
  }

  private focusToInput(value:string = ''):void {
    setTimeout(() => {
      let el = this.element.nativeElement.querySelector('div.ui-select-search > input');
      if (el) {
        el.focus();
        el.value = value;
      }
    }, 0);
  }

  private open():void {
    this.options = this.itemObjects
      .filter((option:SelectItem) => (this.multiple === false ||
      this.multiple === true && !this.active.find((o:SelectItem) => option.text === o.text)));

    if (this.options.length > 0) {
      this.behavior.first();
    }
    this.optionsOpened = true;
  }

  private hideOptions():void {
    this.inputMode = false;
    this.optionsOpened = false;
  }

  private selectActiveMatch():void {
    this.selectMatch(this.activeOption);
  }

  private selectMatch(value:SelectItem, e:Event = void 0):void {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (this.options.length <= 0) {
      return;
    }
    if (this.multiple === true) {
      this.active.push(value);
      this.data.next(this.active);
    }
    if (this.multiple === false) {
      this.active[0] = value;
      this.data.next(this.active[0]);
    }
    this.doEvent('selected', value);
    this.hideOptions();
    if (this.multiple === true) {
      this.focusToInput('');
    } else {
      this.focusToInput(stripTags(value.text));
      this.element.nativeElement.querySelector('.ui-select-container').focus();
    }
  }
}

export class Behavior {
  public optionsMap:Map<string, number> = new Map<string, number>();

  public actor:SelectComponent;

  public constructor(actor:SelectComponent) {
    this.actor = actor;
  }

  public fillOptionsMap():void {
    this.optionsMap.clear();
    let startPos = 0;
    this.actor.itemObjects
      .map((item:SelectItem) => {
        startPos = item.fillChildrenHash(this.optionsMap, startPos);
      });
  }

  public ensureHighlightVisible(optionsMap:Map<string, number> = void 0):void {
    let container = this.actor.element.nativeElement.querySelector('.ui-select-choices');
    if (!container) {
      return;
    }
    let choices = container.querySelectorAll('.ui-select-choices-row');
    if (choices.length < 1) {
      return;
    }
    let activeIndex = this.getActiveIndex(optionsMap);
    if (activeIndex < 0) {
      return;
    }
    let highlighted:any = choices[activeIndex];
    if (!highlighted) {
      return;
    }

    let posY:number = highlighted.offsetTop + highlighted.clientHeight - container.scrollTop;
    let height:number = container.offsetHeight;

    let searchInputHeight = 0;

    const searchInput = this.actor.element.nativeElement.querySelector('.ui-select-search');
    if (searchInput) {
      searchInputHeight = searchInput.clientHeight;
    }
    if (posY > height) {
      container.scrollTop += posY - height - searchInputHeight;
    } else if (posY < highlighted.clientHeight) {
      container.scrollTop -= highlighted.clientHeight - posY + searchInputHeight;
    }
  }

  private getActiveIndex(optionsMap:Map<string, number> = void 0):number {
    let ai = this.actor.options.indexOf(this.actor.activeOption);
    if (ai < 0 && optionsMap !== void 0) {
      ai = optionsMap.get(this.actor.activeOption.id);
    }
    return ai;
  }
}

export class GenericBehavior extends Behavior implements OptionsBehavior {
  public constructor(actor:SelectComponent) {
    super(actor);
  }

  public first():void {
    this.actor.activeOption = this.actor.options[0];
    super.ensureHighlightVisible();
  }

  public last():void {
    this.actor.activeOption = this.actor.options[this.actor.options.length - 1];
    super.ensureHighlightVisible();
  }

  public prev():void {
    let index = this.actor.options.indexOf(this.actor.activeOption);
    this.actor.activeOption = this.actor
      .options[index - 1 < 0 ? this.actor.options.length - 1 : index - 1];
    super.ensureHighlightVisible();
  }

  public next():void {
    let index = this.actor.options.indexOf(this.actor.activeOption);
    this.actor.activeOption = this.actor
      .options[index + 1 > this.actor.options.length - 1 ? 0 : index + 1];
    super.ensureHighlightVisible();
  }

  public filter(query:RegExp):void {
    let options = this.actor.itemObjects
      .filter((option:SelectItem) => {
        return stripTags(option.text).match(query) &&
          (this.actor.multiple === false ||
          (this.actor.multiple === true && this.actor.active.map((item:SelectItem) => item.id).indexOf(option.id) < 0));
      });
    this.actor.options = options;
    if (this.actor.options.length > 0) {
      this.actor.activeOption = this.actor.options[0];
      super.ensureHighlightVisible();
    }
  }
}

export class ChildrenBehavior extends Behavior implements OptionsBehavior {
  public constructor(actor:SelectComponent) {
    super(actor);
  }

  public first():void {
    this.actor.activeOption = this.actor.options[0].children[0];
    this.fillOptionsMap();
    this.ensureHighlightVisible(this.optionsMap);
  }

  public last():void {
    this.actor.activeOption =
      this.actor
        .options[this.actor.options.length - 1]
        .children[this.actor.options[this.actor.options.length - 1].children.length - 1];
    this.fillOptionsMap();
    this.ensureHighlightVisible(this.optionsMap);
  }

  public prev():void {
    let indexParent = this.actor.options
      .findIndex((option:SelectItem) => this.actor.activeOption.parent && this.actor.activeOption.parent.id === option.id);
    let index = this.actor.options[indexParent].children
      .findIndex((option:SelectItem) => this.actor.activeOption && this.actor.activeOption.id === option.id);
    this.actor.activeOption = this.actor.options[indexParent].children[index - 1];
    if (!this.actor.activeOption) {
      if (this.actor.options[indexParent - 1]) {
        this.actor.activeOption = this.actor
          .options[indexParent - 1]
          .children[this.actor.options[indexParent - 1].children.length - 1];
      }
    }
    if (!this.actor.activeOption) {
      this.last();
    }
    this.fillOptionsMap();
    this.ensureHighlightVisible(this.optionsMap);
  }

  public next():void {
    let indexParent = this.actor.options
      .findIndex((option:SelectItem) => this.actor.activeOption.parent && this.actor.activeOption.parent.id === option.id);
    let index = this.actor.options[indexParent].children
      .findIndex((option:SelectItem) => this.actor.activeOption && this.actor.activeOption.id === option.id);
    this.actor.activeOption = this.actor.options[indexParent].children[index + 1];
    if (!this.actor.activeOption) {
      if (this.actor.options[indexParent + 1]) {
        this.actor.activeOption = this.actor.options[indexParent + 1].children[0];
      }
    }
    if (!this.actor.activeOption) {
      this.first();
    }
    this.fillOptionsMap();
    this.ensureHighlightVisible(this.optionsMap);
  }

  public filter(query:RegExp):void {
    let options:Array<SelectItem> = [];
    let optionsMap:Map<string, number> = new Map<string, number>();
    let startPos = 0;
    for (let si of this.actor.itemObjects) {
      let children:Array<SelectItem> = si.children.filter((option:SelectItem) => query.test(option.text));
      startPos = si.fillChildrenHash(optionsMap, startPos);
      if (children.length > 0) {
        let newSi = si.getSimilar();
        newSi.children = children;
        options.push(newSi);
      }
    }
    this.actor.options = options;
    if (this.actor.options.length > 0) {
      this.actor.activeOption = this.actor.options[0].children[0];
      super.ensureHighlightVisible(optionsMap);
    }
  }
}
