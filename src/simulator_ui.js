"use strict";

//class representing the graphical user interface built on top of the simulator
class SimulatorUI {
	constructor(htmlElems) {
		if(typeof htmlElems !== "object") htmlElems = {};
		
		//these variables cannot be changed via the interface, but can be useful in cases where the application is enbedded on a different site
		this.supportedTools = [null, "add_element", "connect", "edit", "delete", "replace", "select"];
		this.mouseControlsEnabled = true;
		this.keyboardControlsEnabled = true;
		this.fileDragDropEnabled = true;
		this._showGrid = true; //used through a showGrid setter/getter
		
		
		this.simulator = new Simulator();
		
		this._running = false;
		this._paused = false;
		this._selectedElement = null; //string representing the element class to be created on element creation
		this._selectedTool = null; //set to the default tool later (null = only panning, not actually used but works)
		this.lastSelectedTool = null;
		
		this._tps = CONFIG.defaultTPS; //maximum steps per second
		this._alignToGrid = true;
		this._showIOonly = false; //hides everything except input & output elements during simulation
		this._showDebug = false; //shows extra info on the canvas and next to elements
		
		this._simulationLoopID = null; //ID from setInterval during simulation
		this._edgeScrollingLoopID = null; //ID from the setInterval during edge scrolling
		this._redrawScheduled = false;
		
		
		this.viewOffsetReal = {x:0, y:0}; //position of the canvas's top-left corner within the project's coordinate space
		this.zoom = 1; //bigger = closer (actual raw zoom multiplier, not logarithmic)
		
		this.mousePos = {
			raw: {x:0, y:0},
			real: {x:0, y:0}
		};
		this.lastMousePos = {
			raw: {x:0, y:0},
			real: {x:0, y:0}
		};
		this.mouseDownPos = null; //null when the mouse is not being held down
		this.mouseMovingWhilePressed = false;
		this.clickedElement = null; //the element on which the mouse was clicked on, or which is being held and dragged
		this.clickedElementOffsetFromMouseReal = null;
		this.initialTouchZoom = 1; //acts as a reference to the zoom level before touch zooming started (logarithmic value)
		this.holdingCTRL = false;
		this.unsavedChanges = false;
		
		this.connectionStartElems = new Set(); //the elements from which a connection is being created currently
		this.selectionElems = new Set(); //elements that have been selected using the selection tool
		this.clipboardData = ""; //JSON string of an object containing copied elements
		
		
		//data saved to be displayed in debug info
		this.debugData = {
			renderedElems:0,
			totalLines:0,
			renderedLines:0,
			frameDuration:0,
			stepDuration:0,
			tickDuration:0
		};
		this.lastStepTime = 0; //Date.now() saved every simulation step
		
		
		
		////////////////////////////////////
		//link and intialize html elements//
		////////////////////////////////////
		
		if(htmlElems.canvas) {
			this.canvas = htmlElems.canvas;
			this.ctx = this.canvas.getContext("2d");
		}
		
		//save a reference to the GUI elements and wrap them in a custom wrapper class for easier use
		this.htmlElems = {
			//simulation control buttons
			startBtn: new UIButton(htmlElems.startBtn, this.Start.bind(this)),
			stopBtn: new UIButton(htmlElems.stopBtn, this.Stop.bind(this)),
			continueBtn: new UIButton(htmlElems.continueBtn, this.Continue.bind(this)),
			pauseBtn: new UIButton(htmlElems.pauseBtn, this.Pause.bind(this)),
			stepBtn: new UIButton(htmlElems.stepBtn, this.Step.bind(this)),
			
			//action buttons
			undoBtn: new UIButton(htmlElems.undoBtn, this.Undo.bind(this)),
			redoBtn: new UIButton(htmlElems.redoBtn, this.Redo.bind(this)),
			newProjectBtn: new UIButton(htmlElems.newProjectBtn, this.ResetProject.bind(this)),
			saveToFileBtn: new UIButton(htmlElems.saveToFileBtn, this.SaveToFile.bind(this)),
			loadFromFileBtn: new UIButton(htmlElems.loadFromFileBtn, this.OpenProjectFile.bind(this)),
			showInfoBtn: new UIButton(htmlElems.showInfoBtn, e => this.overlayOpen = true),
			
			//other
			stepCounter: new UILabel(htmlElems.stepCounter),
			closeInfoBtn: new UIButton(htmlElems.closeInfoBtn, e => this.overlayOpen = false),
			infoOverlay: new UIElement(htmlElems.infoOverlay),
			debugInfo: new UILabel(htmlElems.debugInfo)
		};
		
		//save a reference to all tool buttons & make the supported ones work
		this.htmlElems.tools = {};
		if(htmlElems.tools) {
			for(const htmlElem of Object.values(htmlElems.tools)) {
				const toolName = htmlElem.getAttribute("data-toolname");
				
				if(!toolName) continue;
				if(this.htmlElems.tools[toolName])
					throw "Tool button '"+toolName+"' is duplicated!";
				
				//create a button with a click event
				this.htmlElems.tools[toolName] = new UIButton(
					htmlElem, e => this.SelectTool(toolName) //select the tool tied to this button
				);
			}
		}
		
		//dynamically generate element buttons for the sidebar
		this.htmlElems.elemSelector = {};
		for(const ElemClass of Object.values(LOGIC_ELEMENTS)) {
			//additional attributes work as a hack to get it to render its name
			const elem = new ElemClass({x:0, y:0, text:ElemClass.prototype.labelText, delay:ElemClass.prototype.labelText});
			
			//create a temporary canvas onto which the virtual element gets drawn
			const tempCanvas = document.createElement("canvas");
			const tempCtx = tempCanvas.getContext("2d");
			tempCanvas.width = elem.rx*2;
			tempCanvas.height = elem.ry*2;
			tempCtx.setTransform(1, 0, 0, 1, elem.rx, elem.ry);
			elem.Draw(tempCtx);
			
			//convert the canvas into an image element
			const img = document.createElement("img");
			img.width = tempCanvas.width;
			img.height = tempCanvas.height;
			img.title = elem.fullName;
			img.alt = ElemClass.name;
			img.classList.add("button");
			img.src = tempCanvas.toDataURL();
			img.setAttribute("data-elemtype", ElemClass.name);
			
			//add the icon to the interface
			if(htmlElems.elemSelector) htmlElems.elemSelector.appendChild(img);
			
			//bind the element selection function to each element
			this.htmlElems.elemSelector[ElemClass.name] = new UIButton(
				img, e => {
					this.SelectElement(ElemClass.name);
					if(this._selectedTool!=="replace") this.SelectTool("add_element");
				}
			);
		}
		
		//save references to settings and make the elements functional
		//max stemps per second input field
		if(htmlElems.tpsInput) {
			this.htmlElems.tpsInput = new UINumInput(
				htmlElems.tpsInput,
				val => this.tps = val
			);
			this.htmlElems.tpsInput.value = this._tps;
		}
		
		//align to grid toggle
		if(htmlElems.alignToGridToggle) {
			this.htmlElems.alignToGridToggle = new UIToggle(
				htmlElems.alignToGridToggle,
				activated => this.alignToGrid = activated
			);
			this.htmlElems.alignToGridToggle.activated = this._alignToGrid;
		}
		
		//show i/o only toggle
		if(htmlElems.showIOonlyToggle) {
			this.htmlElems.showIOonlyToggle = new UIToggle(
				htmlElems.showIOonlyToggle,
				activated => this.showIOonly = activated
			);
			this.htmlElems.showIOonlyToggle.activated = this._showIOonly;
		}
		
		//show debug info toggle
		if(htmlElems.showDebugToggle) {
			this.htmlElems.showDebugToggle = new UIToggle(
				htmlElems.showDebugToggle,
				activated => this.showDebug = activated
			);
			this.htmlElems.showDebugToggle.activated = this._showDebug;
		}
		
		
		
		//////////////////
		//browser events//
		//////////////////
		
		if(this.canvas) {
			//register mouse events
			this.canvas.addEventListener("mousedown", this._CanvasMouseDown.bind(this));
			/*this.canvas*/window.addEventListener("mouseup", this._CanvasMouseUp.bind(this));
			this.canvas.addEventListener("mousemove", this._CanvasMouseMove.bind(this));
			this.canvas.addEventListener("wheel", this._CanvasMouseWheelScroll.bind(this));
			
			//register touch events
			this.canvas.addEventListener("touchstart", this._CanvasTouchStart.bind(this));
			this.canvas.addEventListener("touchend", this._CanvasTouchEnd.bind(this));
			this.canvas.addEventListener("touchmove", this._CanvasTouchMove.bind(this));
			
			//register resize container event to resize the canvas with it
			this.canvasResizeObserver = new ResizeObserver(this._ContainerResize.bind(this))
			this.canvasResizeObserver.observe(this.canvas.parentNode);
			
			//file drag & drop events
			this.canvas.addEventListener("drop", this._FileDragDrop.bind(this));
			this.canvas.addEventListener("dragover", e => e.preventDefault());
		}
		
		//register keyboard events
		document.addEventListener("keydown", this._KeyDown.bind(this));
		document.addEventListener("keyup", this._KeyUp.bind(this));
		
		//exit event
		window.addEventListener("beforeunload", this._BeforeExit.bind(this));
		
		
		
		//////////////////
		//initialization//
		//////////////////
		
		
		//trigger initial resize
		if(this.canvas) this.ResizeCanvas(this.canvas.parentNode.clientWidth, this.canvas.parentNode.clientHeight);
		
		this.UpdateUndoRedoButtons(); //also updates debug info
		
		//default tool selection
		this.SelectElement(CONFIG.initialElement);
		this.SelectTool(CONFIG.initialTool);
	}
	
	
	
	//from the sidebar, selects which element will get placed upon creation
	SelectElement(elemType) {
		if(elemType===this._selectedElement) return;
		//make sure the element type exists
		if(elemType && !this.htmlElems.elemSelector[elemType]) return;
		
		this.CancelCurrentAction();
		
		if(this._selectedElement) this.htmlElems.elemSelector[this._selectedElement].selected = false;
		this._selectedElement = elemType;
		if(this._selectedElement) this.htmlElems.elemSelector[this._selectedElement].selected = true;
		
		this.UpdateDebugInfo();
	}
	
	//from the toolbar, selects which tool is supposed to be used
	SelectTool(toolName) {
		//don't reselect the same tool
		if(toolName===this._selectedTool) return;
		
		//make sure the tool exists
		if(toolName && !this.supportedTools.includes(toolName)) return;
		
		this.CancelCurrentAction();
		
		//deselect the previous tool
		if(this._selectedTool && this.htmlElems.tools[this._selectedTool]) this.htmlElems.tools[this._selectedTool].selected = false;
		
		this.lastSelectedTool = this._selectedTool?this._selectedTool:toolName;
		this._selectedTool = toolName;
		
		//select the new tool
		if(this._selectedTool && this.htmlElems.tools[this._selectedTool]) this.htmlElems.tools[this._selectedTool].selected = true;
		
		this.UpdateCanvasCursor();
		this.UpdateDebugInfo();
	}
	
	
	//cancels everything before performing something else
	CancelCurrentAction() {
		//only cancel stuff if there is anything to cancel
		if(this.mouseDownPos===null && this.connectionStartElems.size===0) return false;
		
		//send a click end event to the held element
		if(this._running && this.clickedElement) {
			this.simulator.ElementClickEnd(this.clickedElement);
		}
		
		//letting go of dragged element(s)
		if(!this.running && this.mouseMovingWhilePressed && this.clickedElement) {
			this.RecordChange();
		}
		
		//reset all actions
		this.clickedElement = null;
		this.mouseDownPos = null;
		this.mouseMovingWhilePressed = false;
		this.connectionStartElems.clear();
		this.UpdateEdgeScroll();
		this.UpdateCanvasCursor();
		this.UpdateDebugInfo();
		this.ScheduleRedraw();
		
		return true;
	}
	
	//browser event fired when the canvas container changes size (usually because of the window being resized)
	_ContainerResize(e) {
		const rect = e[0].contentRect;
		this.ResizeCanvas(rect.width, rect.height);
	}
	
	//changes the canvas size
	ResizeCanvas(width, height) {
		if(!this.canvas) return false;
		
		this.canvas.width = width;
		this.canvas.height = height;
		this.ScheduleRedraw();
		
		return true
	}
	
	//makes the canvas display a specific mouse cursor
	SetCanvasCursor(action) {
		if(!this.canvas) return;
		
		const possibleActions = ["panning", "grabbing", "selecting"];
		for(const possibleAction of possibleActions) {
			if(possibleAction===action) {
				this.canvas.classList.add("cursor_"+possibleAction);
			}
			else {
				this.canvas.classList.remove("cursor_"+possibleAction);
			}
		}
	}
	
	//make the canvas display the mouse cursor coresponding to the current action being performed
	UpdateCanvasCursor() {
		if(!this.canvas) return;
		
		if(!this._running && this._selectedTool==="select") {
			this.SetCanvasCursor("selecting");
		}
		else if(!this._running && this.clickedElement && this.mouseMovingWhilePressed) {
			this.SetCanvasCursor("grabbing");
		}
		else if(this.mouseMovingWhilePressed) {
			this.SetCanvasCursor("panning");
		}
		else {
			this.SetCanvasCursor(null);
		}
	}
	
	//browser event fired when releasing a tap with a touch screen device on the canvas
	_CanvasTouchEnd(e) {
		if(!this.mouseControlsEnabled) return;
		
		e.preventDefault();
		
		//remember the zoom when back to one finger
		if(e.touches.length===1) this.initialTouchZoom = this.zoomLevel;
		if(e.touches.length>0) return;
		
		e.button = 0; //workaround to make it look like it's a mouse click
		this._CanvasMouseUp(e);
	}
	
	//browser event of the mouse button being released
	//works as a "successfull full click" handler
	_CanvasMouseUp(e) {
		if(!this.mouseControlsEnabled) return;
		
		//left mouse button allowed only
		if(e.button!==0) return;
		
		//prevent this event being triggered without mousedown being registered beforehand
		if(!this.mouseDownPos) return;
		
		//mouse raised after being dragged while pressed
		if(this.mouseMovingWhilePressed) {
			if(!this._running) {
				//create element selection
				if(this._selectedTool==="select") {
					const numSelectedBefore = this.selectionElems.size;
					
					//add to existing selection, which may or may not be empty based on if ctrl was being held down on click
					this.simulator.GetElementsInArea(this.mouseDownPos.real, this.mousePos.real, this.selectionElems);
					
					//if new elements have been selected, change the tool back to the previous one, unless holding ctrl
					if(!this.holdingCTRL && this.selectionElems.size>numSelectedBefore) {
						this.SelectTool(this.lastSelectedTool);
					}
					
					this.ScheduleRedraw();
				}
				//letting go of dragged element(s)
				else if(this.clickedElement) {
					this.RecordChange();
				}
			}
		}
		//only register a full click if the mouse didn't move much
		else {
			if(this._CanvasFullClick()) {
				this.ScheduleRedraw();
			}
		}
		
		//send click end event to the clicked element during simulation
		if(this._running && this.clickedElement) {
			this.simulator.ElementClickEnd(this.clickedElement);
			this.ScheduleRedraw();
		}
		
		//reset all values since click has ended
		this.clickedElement = null;
		this.mouseDownPos = null;
		this.mouseMovingWhilePressed = false;
		this.UpdateEdgeScroll();
		this.UpdateCanvasCursor();
		this.UpdateDebugInfo();
	}
	
	//when a mouse has been pressed and subsequently released on (nearly) the same spot
	_CanvasFullClick() {
		//prevent this event being triggered without mousedown being registered beforehand
		if(!this.mouseDownPos) return false;
		
		let redraw = false; //if the canvas should be redrawn after this click is processed
		
		//clicking in a running simulator
		if(this._running) {
			if(this.clickedElement) {
				this.simulator.ElementClickFull(this.clickedElement);
				redraw = true;
			}
		}
		//clicking in editor mode
		else {
			//clicked on an element
			if(this.clickedElement) {
				//element(s) which have been clicked on
				const targetElems = this.selectionElems.has(this.clickedElement)?this.selectionElems:(new Set()).add(this.clickedElement);
				switch(this._selectedTool) {
					case "add_element": //bring the clicked element(s) to the top
						if(this.selectionElems.has(this.clickedElement)) {
							redraw = this.simulator.MoveElementsToTop(this.selectionElems, true);
						}
						else {
							redraw = this.simulator.MoveElementToTop(this.clickedElement, true);
						}
						if(redraw) {
							this.RecordChange();
							this.ScheduleRedraw();
						}
						break;
					case "connect":
						//finish a connection if it has been started
						if(this.connectionStartElems.size>0) {
							//connect everything selected to everything selected
							for(const elemStart of this.connectionStartElems) {
								for(const elemEnd of targetElems) {
									redraw = this.simulator.ConnectElements(elemStart, elemEnd) || redraw;
								}
							}
							//keep the connection start if holding ctrl, can continue connecting other elements
							if(redraw && !this.holdingCTRL) {
								this.connectionStartElems.clear();
							}
							//if an action was performed, save it in the undo history
							if(redraw) {
								this.RecordChange();
							}
						}
						//start a new connection otherwise
						else {
							for(const elem of targetElems) {
								if(elem.canOutput) {
									this.connectionStartElems.add(elem);
								}
							}
							redraw = this.connectionStartElems.size>0;
						}
						break;
					case "edit":
						//finish a connection if editing one currently
						if(this.connectionStartElems.size>0) {
							//connect everything selected to everything selected
							for(const elemStart of this.connectionStartElems) {
								for(const elemEnd of targetElems) {
									redraw = this.simulator.ConnectElements(elemStart, elemEnd) || redraw;
								}
							}
							//keep the connection start if holding ctrl, can continue connecting other elements
							if(redraw && !this.holdingCTRL) {
								this.connectionStartElems.clear();
							}
							//if an action was performed, save it in the undo history
							if(redraw) {
								this.RecordChange();
							}
						}
						//edit the clicked element(s)
						else {
							if(this.clickedElement.Edit()) {
								for(const elem of targetElems) {
									if(elem.constructor!==this.clickedElement.constructor || elem===this.clickedElement)
										continue;
									
									elem.CopyPropertiesFrom(this.clickedElement);
								}
								redraw = true;
								this.RecordChange();
							}
						}
						break;
					case "delete": //delete the clicked element(s)
						this.simulator.RemoveElements(targetElems);
						if(this.selectionElems.has(this.clickedElement)) {
							this.selectionElems.clear();
						}
						this.clickedElement = null;
						this.RecordChange();
						redraw = true;
						break;
					case "replace":
						//replace the clicked element(s) with the selected element from the toolbar
						if(this._selectedElement && this._selectedElement!==this.clickedElement.constructor.name) {
							//replace all elements in the selection
							if(this.selectionElems.has(this.clickedElement)) {
								const newElems = this.simulator.ReplaceElements(this.selectionElems, this._selectedElement);
								if(newElems) {
									this.clickedElement = null;
									this.selectionElems = newElems;
									redraw = true;
									this.RecordChange();
								}
							}
							//replace an element outside of any selection
							else {
								const newElem = this.simulator.ReplaceElement(this.clickedElement, this._selectedElement);
								if(newElem) {
									this.clickedElement = null;
									redraw = true;
									this.RecordChange();
								}
							}
						}
						//remove the clicked element(s), replacing it with a connection line instead, effectively connecting all the inputs directly to the outputs
						//(only triggered if such a connection can even be made)
						else if(this.selectionElems.has(this.clickedElement) || (this.clickedElement.inputs.size>0 && this.clickedElement.outputs.size>0)) {
							//if(!confirm("You have not selected a different element type to replace the clicked element(s) with.\nThis means that the element(s) will get deleted and replaced with just a connection line, effectively connecting all the inputs directly to all the outputs.\n\nDo you actually want to do this?")) break;
							for(const elem of targetElems) {
								this.simulator.DissolveElement(elem);
								this.selectionElems.delete(elem);
							}
							this.clickedElement = null;
							redraw = true;
							this.RecordChange();
						}
						break;
					case "select": //add the clicked element in the selection
						//alternate between being selected and unselected	
						if(this.selectionElems.has(this.clickedElement)) {
							this.selectionElems.delete(this.clickedElement);
						}
						else {
							this.selectionElems.add(this.clickedElement);
						}
						redraw = true;
						break;
				}
			}
			//clicked empty space (or connection line)
			else {
				const clickedConnection = this.simulator.GetConnectionAtPos(this.mouseDownPos.real);
				switch(this._selectedTool) {
					case "add_element":
						//create and place a new element on the canvas
						if(this._selectedElement) {
							if(this.simulator.CreateAndAddElement(this._selectedElement, this._alignToGrid?this.AlignCoordsToGrid(this.mouseDownPos.real):this.mouseDownPos.real)) {
								redraw = true;
								this.RecordChange();
							}
						}
						break;
					case "connect": //(both tools have the same behavior in this case)
					case "edit":
						//cancel existing connection creation/editing
						if(this.connectionStartElems.size>0 && !this.holdingCTRL) {
							this.connectionStartElems.clear();
							redraw = true;
						}
						//rewire an existing connection
						else if(clickedConnection) {
							this.simulator.DisconnectElements(clickedConnection.startElem, clickedConnection.endElem);
							this.connectionStartElems.add(clickedConnection.startElem);
							redraw = true;
							this.RecordChange();
						}
						break;
					case "delete":
						//delete an existing connection
						if(clickedConnection) {
							this.simulator.DisconnectElements(clickedConnection.startElem, clickedConnection.endElem);
							redraw = true;
							this.RecordChange();
						}
						break;
					case "replace":
						//place an element in the middle of an existing connection, rewiring the inputs and outputs through itself
						if(clickedConnection) {
							const newElem = this.simulator.CreateAndAddElement(this._selectedElement, this._alignToGrid?this.AlignCoordsToGrid(this.mouseDownPos.real):this.mouseDownPos.real);
							if(newElem) {
								this.simulator.DisconnectElements(clickedConnection.startElem, clickedConnection.endElem);
								this.simulator.ConnectElements(clickedConnection.startElem, newElem);
								this.simulator.ConnectElements(newElem, clickedConnection.endElem);
								redraw = true;
								this.RecordChange();
							}
						}
						break;
					case "select": //go back to the previous tool when cancelling a selection
						if(!this.holdingCTRL) {
							this.SelectTool(this.lastSelectedTool);
						}
						break;
				}
			}
		}
		this.UpdateDebugInfo();
		return redraw;
	}
	
	//browser event fired when tapping with a touch screen device on the canvas
	_CanvasTouchStart(e) {
		if(!this.mouseControlsEnabled) return;
		
		e.preventDefault();
		
		//set mouse position only for the first touch
		if(e.touches.length===1 || !this.mouseDownPos) {
			//set mouse position, because mousemove isn't fired
			const canvasBound = this.canvas.getBoundingClientRect();
			this.UpdateMousePosition(e.touches[0].clientX-canvasBound.left, e.touches[0].clientY-canvasBound.top);
			
			//remember the initial zoom when starting to touch-zoom
			this.initialTouchZoom = this.zoomLevel;
		}
		
		//only process the first touch
		if(e.touches.length>1) {
			this.CancelCurrentAction();
			return;
		}
		
		//simulate a mouse click
		e.button = 0; //workaround
		this._CanvasMouseDown(e);
	}
	
	//browser event of the mouse button being pressed down on the canvas
	_CanvasMouseDown(e) {
		if(!this.mouseControlsEnabled) return;
		
		//left mouse button allowed only
		if(e.button!==0) return;
		
		this.mouseDownPos = {
			raw: {x:this.mousePos.raw.x, y:this.mousePos.raw.y},
			real: {x:this.mousePos.real.x, y:this.mousePos.real.y}
		};
		this.mouseMovingWhilePressed = false;
		
		//just in case the last mouseup event didn't register, send a click end event to the last clicked element
		if(this._running && this.clickedElement) {
			this.simulator.ElementClickEnd(this.clickedElement);
		}
		
		//get and remember the clicked element, if any
		this.clickedElement = this.simulator.GetElementAtPos(this.mouseDownPos.real);
		if(this.clickedElement) {
			this.clickedElementOffsetFromMouseReal = {
				x:this.clickedElement.pos.x-this.mouseDownPos.real.x,
				y:this.clickedElement.pos.y-this.mouseDownPos.real.y
			};
		}
		
		//cancel existing selection if one exists and if ctrl is not being held
		if(!this._running && this._selectedTool==="select" && !this.holdingCTRL && this.selectionElems.size>0) {
			this.selectionElems.clear();
			this.ScheduleRedraw();
		}
		
		//send click start event to the clicked element during simulation
		if(this._running && this.clickedElement) {
			this.simulator.ElementClickStart(this.clickedElement);
			this.ScheduleRedraw();
		}
		
		this.UpdateDebugInfo();
	}
	
	//browser event fired when moving a finger on a touch screen device on the canvas
	_CanvasTouchMove(e) {
		if(!this.mouseControlsEnabled) return;
		
		const canvasBound = this.canvas.getBoundingClientRect();
		const newPosRawX = e.touches[0].clientX-canvasBound.left;
		const newPosRawY = e.touches[0].clientY-canvasBound.top;
		
		//move the mouse
		if(e.touches.length===1) {
			this.UpdateMousePosition(newPosRawX, newPosRawY);
		}
		//zoom on the canvas
		else {
			this.SetZoomOn(this.mousePos.raw, this.initialTouchZoom+((this.mousePos.raw.y-newPosRawY)/this.canvas.height)*CONFIG.zoomTouchMultiplier, false);
		}
	}
	
	//browser event of the mouse being moved around on the canvas
	_CanvasMouseMove(e) {
		if(!this.mouseControlsEnabled) return;
		
		const canvasBound = this.canvas.getBoundingClientRect();
		this.UpdateMousePosition(e.clientX-canvasBound.left, e.clientY-canvasBound.top);
	}
	
	//directly sets the mouse position without updating anything else
	_SetMousePosition(rawX, rawY) {
		//last mouse position, copy by value
		this.lastMousePos.raw.x = this.mousePos.raw.x;
		this.lastMousePos.raw.y = this.mousePos.raw.y;
		this.lastMousePos.real.x = this.mousePos.real.x;
		this.lastMousePos.real.y = this.mousePos.real.y;
		
		//new mouse position
		this.mousePos.raw.x = rawX;
		this.mousePos.raw.y = rawY;
		this.mousePos.real = this.RawCoordsToReal(this.mousePos.raw);
	}
	
	//updates the position of the mouse and everything it's holding whether the mouse moves or the canvas itself moves
	UpdateMousePosition(rawX, rawY) {
		//set the new mouse position
		this._SetMousePosition(rawX, rawY);
		
		
		//if the mouse is being held down, then recognize when it moves away from its initial spot (this enables panning/dragging/selecting and prevents a full mouse click)
		//(this code block is triggered only the first time the mouse starts moving)
		if(this.mouseDownPos && !this.mouseMovingWhilePressed && UTILS.Distance(this.mouseDownPos.raw, this.mousePos.raw)*window.devicePixelRatio > CONFIG.mouseMoveToleranceOnClick) {
			this.mouseMovingWhilePressed = true;
			
			//if making a selection, then disregard any clicked elements
			if(!this.running && this._selectedTool==="select") {
				this.clickedElement = null;
			}
			
			//move the canvas back under the mouse, to make up for the distance that has been ignored by the mouseMoveToleranceOnClick
			if(this._running || (!this.clickedElement && this._selectedTool!=="select")) {
				this._MoveCanvasBy({
					x:-(this.lastMousePos.raw.x-this.mouseDownPos.raw.x),
					y:-(this.lastMousePos.raw.y-this.mouseDownPos.raw.y)
				});
				this.ScheduleRedraw();
			}
			
			//move held element(s) above others
			if(!this._running && this.clickedElement) {
				if(this.selectionElems.has(this.clickedElement)) {
					this.simulator.MoveElementsToTop(this.selectionElems);
				}
				else {
					this.simulator.MoveElementToTop(this.clickedElement);
				}
				//redraw is always sheduled in the following code block, no need to do it here too
			}
			
			this.UpdateCanvasCursor();
		}
		
		//mousemove with the mouse being pressed
		if(this.mouseMovingWhilePressed) {
			this.UpdateEdgeScroll();
			
			//redraw on every mousemove when creating a selection
			if(!this._running && this._selectedTool==="select") {
				this.ScheduleRedraw();
			}
			//dragging selected elements with the mouse
			else if(!this._running && this.clickedElement) {
				//calculate new offset
				let baseOffset = {
					x:this.mousePos.real.x+this.clickedElementOffsetFromMouseReal.x,
					y:this.mousePos.real.y+this.clickedElementOffsetFromMouseReal.y
				};
				if(this._alignToGrid) baseOffset = this.AlignCoordsToGrid(baseOffset);
				
				//move the whole selection
				if(this.selectionElems.has(this.clickedElement)) {
					for(const elem of this.selectionElems) {
						//the directly held element has to be moved last, otherwise the other elements can't use it as a reference point when moving along with it
						if(elem===this.clickedElement) continue;
						
						elem.pos.x = (elem.pos.x-this.clickedElement.pos.x)+baseOffset.x;
						elem.pos.y = (elem.pos.y-this.clickedElement.pos.y)+baseOffset.y;
					}
				}
				
				//move the held element
				this.clickedElement.pos.x = baseOffset.x;
				this.clickedElement.pos.y = baseOffset.y;
				
				this.ScheduleRedraw();
			}
			//panning the canvas
			else {
				this._MoveCanvasBy({
					x:-(this.mousePos.raw.x-this.lastMousePos.raw.x),
					y:-(this.mousePos.raw.y-this.lastMousePos.raw.y)
				});
				
				this.ScheduleRedraw();
			}
		}
		
		//redraw on every mousemove when creating a connection line
		if(this.connectionStartElems.size>0) {
			this.ScheduleRedraw();
		}
		
		this.UpdateDebugInfo();
	}
	
	//browser event for the mouse wheel being scrolled over the canvas
	_CanvasMouseWheelScroll(e) {
		if(!this.mouseControlsEnabled) return;
		e.preventDefault();
		this.ZoomOn(this.mousePos.raw, (-e.deltaY/CONFIG.scrollWheelStepSize)*CONFIG.zoomStep);
	}
	
	//zoom the canvas by the given amount centered on a specific point (keeping that point in place)
	//zoomAmount is change in the logarithmic zoom level
	ZoomOn(posRaw, zoomAmount) {
		return this.SetZoomOn(posRaw, Math.log2(this.zoom)+zoomAmount, false);
	}
	
	//set the canvas zoom to the given amount centered on a specific point (keeping that point in place)
	SetZoomOn(posRaw, zoom, isRaw) {
		const newZoom = Math.pow(2, UTILS.ClampNum(isRaw?Math.log2(zoom):zoom, CONFIG.zoomMin, CONFIG.zoomMax));
		if(newZoom!==this.zoom) {
			this.viewOffsetReal.x = posRaw.x/this.zoom + this.viewOffsetReal.x - posRaw.x/newZoom;
			this.viewOffsetReal.y = posRaw.y/this.zoom + this.viewOffsetReal.y - posRaw.y/newZoom;
			this.zoom = newZoom;
			this.UpdateDebugInfo();
			this.ScheduleRedraw();
			return true;
		}
		return false;
	}
	
	//pan the canvas by a given amount
	_MoveCanvasBy(moveAmountRaw) {//moveAmount is a raw vector
		this.viewOffsetReal.x += moveAmountRaw.x/this.zoom;
		this.viewOffsetReal.y += moveAmountRaw.y/this.zoom;
	}
	
	//pan the canvas by a given amount and also update everything with it
	MoveCanvasBy(moveAmountRaw) {
		this._MoveCanvasBy(moveAmountRaw);
		this.UpdateMousePosition(this.mousePos.raw.x, this.mousePos.raw.y);
		this.ScheduleRedraw();
	}
	
	//repeatedly triggered while something is being dragged close to the edge of the canvas
	UpdateEdgeScroll() {
		//cancel the edge scrolling if the mouse is not dragging an element or making a selection
		if(!(this.mouseMovingWhilePressed && !this._running && (this.clickedElement || this._selectedTool==="select")) || !this.canvas) {
			this._StopEdgeScrollLoop();	
			return;
		}
		
		const distFromEdge = Math.min(Math.min(this.mousePos.raw.x, this.canvas.width-this.mousePos.raw.x), Math.min(this.mousePos.raw.y, this.canvas.height-this.mousePos.raw.y));
		//cancel the edge scrolling if the mouse is not near the edges
		if(distFromEdge>=CONFIG.edgeScrollDetectionRange) {
			this._StopEdgeScrollLoop();	
			return;
		}
		//start the scrolling if it isn't started already
		if(!this._edgeScrollingLoopID) {
			this._StartEdgeScrollLoop();
		}
	}
	
	//pans the canvas in the direction of the mouse
	_EdgeScroll() {
		const distFromEdge = Math.min(Math.min(this.mousePos.raw.x, this.canvas.width-this.mousePos.raw.x), Math.min(this.mousePos.raw.y, this.canvas.height-this.mousePos.raw.y));
		
		const moveAmount = Math.pow((CONFIG.edgeScrollDetectionRange-distFromEdge)/CONFIG.edgeScrollDetectionRange, 2)*CONFIG.edgeScrollRawAmountPerSecond*(1/CONFIG.edgeScrollFrequency);
		
		const mid = this.GetCanvasMiddleRaw();
		const moveVector = UTILS.VectorScalarMultiply(
			UTILS.VectorNormalize({
				x:this.mousePos.raw.x-mid.x,
				y:this.mousePos.raw.y-mid.y
			}),
			moveAmount
		);
		
		this.MoveCanvasBy(moveVector);
	}
	
	//starts the interval-based edge scrolling loop
	_StartEdgeScrollLoop() {
		//make sure it's not already running
		clearInterval(this._edgeScrollingLoopID);
		
		this._edgeScrollingLoopID = setInterval(this._EdgeScroll.bind(this), 1000/CONFIG.edgeScrollFrequency);
		return this._edgeScrollingLoopID;
	}
	
	//stops the interval-based edge scrolling loop
	_StopEdgeScrollLoop() {
		clearInterval(this._edgeScrollingLoopID);
		this._edgeScrollingLoopID = null;
	}
	
	//copy the element selection onto the clipboard
	CopySelection() {
		if(this._running || this.selectionElems.size===0) return;
		this.clipboardData = JSON.stringify(this.simulator.Serialize({}, this.selectionElems));
	}
	
	//paste elements from the clipboard into the simulator, centered on the mouse
	PasteSelection() {
		if(this._running || !this.clipboardData) return;
		const pastedElems = this.simulator.CreateAndAddElementsFromData(JSON.parse(this.clipboardData).elements);
		
		//find the middle of the pasted elements
		const minPos = {x:Infinity, y:Infinity};
		const maxPos = {x:-Infinity, y:-Infinity};
		for(const elem of pastedElems) {
			minPos.x = Math.min(minPos.x, elem.pos.x);
			minPos.y = Math.min(minPos.y, elem.pos.y);
			maxPos.x = Math.max(maxPos.x, elem.pos.x);
			maxPos.y = Math.max(maxPos.y, elem.pos.y);
		}
		
		//calculate how each element should be moved, such that alignment can be preserved as-is relative to the grid
		let offset = {
			x:this.mousePos.real.x - (minPos.x+maxPos.x)/2,
			y:this.mousePos.real.y - (minPos.y+maxPos.y)/2
		};
		if(this._alignToGrid) {
			//(despite being a vector and not a position, the calculations still work as needed)
			offset = this.AlignCoordsToGridCoarse(offset);
		}
		
		//move elements to the paste location
		for(const elem of pastedElems) {
			elem.pos.x += offset.x;
			elem.pos.y += offset.y;
		}
		
		//make the pasted elements selected, unless already dragging a selection
		if(!(this.mouseMovingWhilePressed && this.clickedElement && this.selectionElems.has(this.clickedElement))) {
			this.selectionElems = new Set(pastedElems);
		}
		
		this.RecordChange();
		this.ScheduleRedraw();
	}
	
	//copy the element selection onto the clipboard and delete it from the simulator
	CutSelection() {
		if(this._running || this.selectionElems.size===0) return;
		this.CancelCurrentAction();
		this.CopySelection();
		this.simulator.RemoveElements(this.selectionElems);
		this.selectionElems.clear();
		this.RecordChange();
		this.ScheduleRedraw();
	}
	
	//records the current state of the simulator 
	RecordChange() {
		if(this._running) return false;
		const changeID = this.simulator.RecordChange();
		this.UpdateUndoRedoButtons();
		if(this._showDebug) this.ScheduleRedraw(); //draw new elem.id
		this.unsavedChanges = true;
		return changeID;
	}
	
	//return back to the previous state of the simulator
	Undo() {
		if(!this.simulator.CanUndo()) return false;
		this.CancelCurrentAction();
		this.selectionElems.clear();
		if(!this.simulator.Undo()) return false;
		this.UpdateUndoRedoButtons();
		this.ScheduleRedraw();
		return true;
	}
	
	//undo the undo and go back forward
	Redo() {
		if(!this.simulator.CanRedo()) return false;
		this.CancelCurrentAction();
		this.selectionElems.clear();
		if(!this.simulator.Redo()) return false;
		this.UpdateUndoRedoButtons();
		this.ScheduleRedraw();
		return true;
	}
	
	//enables/disables the undo and redo buttons depending on the state
	UpdateUndoRedoButtons() {
		this.htmlElems.undoBtn.disabled = this._running || !this.simulator.CanUndo();
		this.htmlElems.redoBtn.disabled = this._running || !this.simulator.CanRedo();
		this.UpdateDebugInfo();
	}
	
	//browser event fired when a key is pressed
	_KeyDown(e) {
		if(!this.keyboardControlsEnabled) return;
		
		//don't process keyboard shortcuts when typing into an html input field
		if(document.activeElement.tagName === "INPUT") return;
		
		//panning using arrow keys, defined here because repeated triggering is allowed
		switch(e.key) {
			case "ArrowUp":
				this.MoveCanvasBy({x:0, y:-CONFIG.keyboardArrowsPanRawAmount});
				return;
			case "ArrowDown":
				this.MoveCanvasBy({x:0, y:CONFIG.keyboardArrowsPanRawAmount});
				return;
			case "ArrowLeft":
				this.MoveCanvasBy({x:-CONFIG.keyboardArrowsPanRawAmount, y:0});
				return;
			case "ArrowRight":
				this.MoveCanvasBy({x:CONFIG.keyboardArrowsPanRawAmount, y:0});
				return;
		}
		
		//trigger every hotkey only once when pressed
		if(e.repeat) return;
		
		//remember the state of the ctrl key
		if(e.code==="ControlLeft") {
			this.holdingCTRL = true;
			return;
		}
		
		//disable keyboard events when the overlay is open
		if(this.overlayOpen) {
			if(e.code==="Escape") {
				this.overlayOpen = false;
			}
			return;
		}
		
		
		//hotkeys pressed in any mode:
		
		//cancel / stop stuff
		if(e.code==="Escape") {
			//try to cancel highest priority stuff
			if(!this.CancelCurrentAction()) {
				//if nothing of priority got cancelled, cancel secondary stuff
				//stop the simulator from running
				if(this._running) this.Stop();
				else if(this._selectedTool==="select") {
					this.SelectTool(this.lastSelectedTool);
				}
				//clear the selection
				else if(this.selectionElems.size>0) {
					this.selectionElems.clear();
					this.ScheduleRedraw();
					this.UpdateDebugInfo();
				}
			}
			return;
		}
		//toggle between edit and simulation mode
		if(e.code==="Space") {
			this.CancelCurrentAction();
			if(this._running) this.Stop();
			else this.Start();
			return;
		}
		//toggle display debug info
		if(e.code==="Backquote") { 
			this.showDebug = !this._showDebug;
			return;
		}
		//toggle grid 
		if(e.key==="g") {
			this.alignToGrid = !this._alignToGrid;
			return;
		}
		if(e.key===".") {
			this.Step();
			return;
		}
		
		
		//hotkeys pressed while the simulator is running
		if(this._running) {
			switch(e.key) {
				case "p":
					if(this._paused) this.Continue();
					else this.Pause();
					break;
			}
		}
		//hotkeys pressed while in edit mode
		else {
			//hotkeys based on key content
			switch(e.key) {
				case "a": //select all elements
					e.preventDefault();
					this.selectionElems = new Set(this.simulator.elements);
					this.ScheduleRedraw();
					break;
				case "i": //invert selection
					e.preventDefault();
					const newSelection = new Set();
					for(const elem of this.simulator.elements) {
						if(!this.selectionElems.has(elem)) {
							newSelection.add(elem);
						}
					}
					this.selectionElems = newSelection;
					this.ScheduleRedraw();
					break;
				case "c": //copy
					this.CopySelection();
					break;
				case "v": //paste
					this.PasteSelection();
					break;
				case "x": //cut
					this.CutSelection();
					break;
				case "Delete": //delete selected elements
					if(this.selectionElems.size>0) {
						this.simulator.RemoveElements(this.selectionElems);
						this.selectionElems.clear();
						this.RecordChange();
						this.ScheduleRedraw();
					}
					break;
				case "z": //undo
					e.preventDefault();
					this.Undo();
					break;
				case "y": //redo
					e.preventDefault();
					this.Redo();
					break;
				//tool hotkeys
				case "q":
					this.SelectTool("add_element");
					break;
				case "w":
					this.SelectTool("connect");
					break;
				case "e":
					this.SelectTool("edit");
					break;
				case "d":
					this.SelectTool("delete");
					break;
				case "r":
					this.SelectTool("replace");
					break;
				case "s":
					this.SelectTool("select");
					break;
			}
		}
	}
	
	//browser event fired when a key is unpressed
	_KeyUp(e) {
		if(!this.keyboardControlsEnabled) return;
		
		if(e.code==="ControlLeft") {
			this.holdingCTRL = false;
		}
	}
	
	//schedules the redraw to happen only when the browser renders a frame
	//also throttles the render function from being fired more often than it needs to be (which caused a slowdown)
	ScheduleRedraw() {
		if(!this.ctx) return;
		
		if(this._redrawScheduled) return;
		this._redrawScheduled = true;
		window.requestAnimationFrame(this._Redraw.bind(this));
	}
	
	//main canvas redraw function to render all the content
	_Redraw() {
		this._redrawScheduled = false;
		
		if(!this.ctx) return;
		
		//measure data during the render
		const renderStartTime = Date.now();
		this.debugData.renderedElems = 0;
		this.debugData.renderedLines = 0;
		
		//reposition and clear the canvas
		this.ClearAndPrepareCanvas();
		
		//draw the grid, unless too zoomed out (when spacing = less than 4 pixels)
		if(this.showGrid && this.zoom*CONFIG.gridSize >= 4) {
			this._DrawGrid();
		}
		
		//calculate the canvas boundaries
		const {x:screenLeft, y:screenTop} = this.viewOffsetReal;
		const {x:screenRight, y:screenBottom} = this.GetCanvasBottomRightCornerReal();
		const maxLineRadius = Math.max(CONFIG.connectionLineHalfWidth.start, CONFIG.connectionLineHalfWidth.end)+CONFIG.connectionLineBidirectionalOffset;
		const maxElemExtraRadius = CONFIG.selection.outlineWidth;
		
		//optionally skip drawing lines if reduced rendering is enabled
		if(!(this._showIOonly && this._running)) {
			this.debugData.totalLines = 0;
			//draw connections between elements
			for(const elemStart of this.simulator.elements) {
				for(const elemEnd of elemStart.outputs) {
					this.debugData.totalLines++;
					
					//OPTIMIZATION: don't draw lines that are definitely not on the screen (not completely optimal, some are still drawn, but good enough)
					const ax = Math.min(elemStart.pos.x, elemEnd.pos.x);
					const ay = Math.min(elemStart.pos.y, elemEnd.pos.y);
					const bx = Math.max(elemStart.pos.x, elemEnd.pos.x);
					const by = Math.max(elemStart.pos.y, elemEnd.pos.y);
					if(bx>screenLeft-maxLineRadius && ax<screenRight+maxLineRadius && by>screenTop-maxLineRadius && ay<screenBottom+maxLineRadius) {
						this._DrawConnectionLine(elemStart.pos, elemEnd.pos, this._running && elemStart.powered, elemStart.inputs.has(elemEnd));
						this.debugData.renderedLines++;
					}
				}
			}
		}
		
		//draw all visible elements
		let elemIndex = -1;
		for(const elem of this.simulator.elements) {
			elemIndex++;
			//optionally skip elements that aren't inputs/outputs/labels
			if(this._running && this._showIOonly && elem.canInput && elem.canOutput)
				continue;
			
			//OPTIMIZATION: don't bother drawing elements that aren't on the screen
			if(elem.right+maxElemExtraRadius>screenLeft && elem.left-maxElemExtraRadius<screenRight && elem.bottom+maxElemExtraRadius>screenTop && elem.top-maxElemExtraRadius<screenBottom) {
				elem.Draw(this.ctx);
				if(!this._running && this.IsElementVisuallySelected(elem))
					elem.DrawSelection(this.ctx);
				if(this._showDebug)
					elem.DrawDebug(this.ctx, elemIndex, this._running && (this.simulator.tick===0 || this.simulator.scheduledUpdates.has(elem)));
				this.debugData.renderedElems++;
			}
		}
		
		//draw connection line creation
		if(this.connectionStartElems.size>0) {
			for(const connectionStartElem of this.connectionStartElems) {
				this._DrawConnectionLine(connectionStartElem.pos, this.mousePos.real, false);
			}
		}
		
		//draw selection creation
		if(this.IsSelectionBeingCreated()) {
			this._DrawSelection();
		}
		
		//measure how long the frame took to render
		this.debugData.frameDuration = (Date.now()-renderStartTime)/1000;
		
		this.UpdateDebugInfo();
	}
	
	//clears the canvas and sets its zoom and position before drawing a new frame on it
	ClearAndPrepareCanvas() {
		if(!this.canvas || !this.ctx) return;
		
		this.ctx.setTransform(this.zoom, 0, 0, this.zoom, -this.viewOffsetReal.x*this.zoom, -this.viewOffsetReal.y*this.zoom);
		this.ctx.clearRect(this.viewOffsetReal.x, this.viewOffsetReal.y, this.canvas.width/this.zoom, this.canvas.height/this.zoom);
		
		//also draw a background so that there is no unwanted transparency when an image is saved from the canvas
		this.ctx.fillStyle = CONFIG.backgroundColor;
		this.ctx.fillRect(this.viewOffsetReal.x, this.viewOffsetReal.y, this.canvas.width/this.zoom, this.canvas.height/this.zoom);
	}
	
	//draws a power line (connection)
	_DrawConnectionLine(startPosReal, endPosReal, powered, bidirectional) {
		if(startPosReal.x===endPosReal.x && startPosReal.y===endPosReal.y) return;
		
		let ax = startPosReal.x;
		let ay = startPosReal.y;
		let bx = endPosReal.x;
		let by = endPosReal.y;
		
		//line's perpendicular (normal) vector, facing right relative to line direction
		const perp = UTILS.VectorNormalize(UTILS.VectorPerpendicular(UTILS.VectorFromTo(startPosReal, endPosReal)));
		
		//offset lines that are bidirectional, so they aren't drawn over each other
		if(bidirectional) {
			/*const lineLength = UTILS.Distance(startPosReal, endPosReal);
			const offsetX = -(endPosReal.y - startPosReal.y)/lineLength * CONFIG.connectionLineBidirectionalOffset;
			const offsetY = (endPosReal.x - startPosReal.x)/lineLength * CONFIG.connectionLineBidirectionalOffset;
			*/
			const offsetX = perp.x*CONFIG.connectionLineBidirectionalOffset;
			const offsetY = perp.y*CONFIG.connectionLineBidirectionalOffset;
			ax += offsetX;
			ay += offsetY;
			bx += offsetX;
			by += offsetY;
		}
		
		//setup styles
		const lineStyle = powered?CONFIG.connectionPowered:CONFIG.connectionUnpowered;
		const lineGradient = this.ctx.createLinearGradient(ax, ay, bx, by);
		lineGradient.addColorStop(0, lineStyle.start);
		lineGradient.addColorStop(1, lineStyle.end);
		this.ctx.fillStyle = lineGradient;
		const ar = CONFIG.connectionLineHalfWidth.start;
		const br = CONFIG.connectionLineHalfWidth.end;
		/*this.ctx.lineWidth = CONFIG.connectionLineWidth;
		this.ctx.lineCap = "round";
		*/
		
		//draw line with shrinking width and rounded ends
		//draw middle part
		this.ctx.beginPath();
		this.ctx.moveTo(ax+perp.x*ar, ay+perp.y*ar);
		this.ctx.lineTo(ax-perp.x*ar, ay-perp.y*ar);
		this.ctx.lineTo(bx-perp.x*br, by-perp.y*br);
		this.ctx.lineTo(bx+perp.x*br, by+perp.y*br);
		this.ctx.closePath();
		this.ctx.fill();
		
		//draw rounded start
		this.ctx.beginPath();
		this.ctx.arc(ax, ay, ar, 0, 2*Math.PI, false);
		this.ctx.fill();
		
		//draw rounded end
		this.ctx.beginPath();
		this.ctx.arc(bx, by, br, 0, 2*Math.PI, false);
		this.ctx.fill();
		
		/*
		const perpAngle = UTILS.VectorAngle(perp);
		this.ctx.beginPath();
		this.ctx.arc(ax, ay, ar, perpAngle, perpAngle+Math.PI, false);
		this.ctx.arc(bx, by, br, perpAngle+Math.PI, perpAngle, false);
		this.ctx.closePath();
		this.ctx.fill();
		*/
		
		/*this.ctx.beginPath();
		this.ctx.moveTo(ax, ay);
		this.ctx.lineTo(bx, by);
		this.ctx.stroke();
		*/
	}
	
	//draws a rectangular selection
	_DrawSelection() {
		const x = Math.min(this.mouseDownPos.real.x, this.mousePos.real.x);
		const y = Math.min(this.mouseDownPos.real.y, this.mousePos.real.y);
		const w = Math.abs(this.mouseDownPos.real.x-this.mousePos.real.x);
		const h = Math.abs(this.mouseDownPos.real.y-this.mousePos.real.y);
		
		const ow = CONFIG.selection.outlineWidth/this.zoom;
		this.ctx.lineWidth = ow;
		this.ctx.strokeStyle = CONFIG.selection.outlineColor;
		this.ctx.fillStyle = CONFIG.selection.fillColor;
		
		//draw selection overlay
		this.ctx.beginPath();
		this.ctx.rect(x+ow/2, y+ow/2, w-ow, h-ow);
		this.ctx.fill();
		
		//draw selection outline
		this.ctx.beginPath();
		this.ctx.rect(x, y, w, h);
		this.ctx.stroke();
	}
	
	//draws the canvas grid
	_DrawGrid() {
		const gs = CONFIG.gridSize;
		const corner = this.GetCanvasBottomRightCornerReal();
		const x1 = Math.floor(this.viewOffsetReal.x/gs - 1)*gs;
		const y1 = Math.floor(this.viewOffsetReal.y/gs - 1)*gs;
		const x2 = Math.ceil(corner.x/gs + 1)*gs;
		const y2 = Math.ceil(corner.y/gs + 1)*gs;
		this.ctx.lineWidth = CONFIG.gridThickness;
		this.ctx.strokeStyle = CONFIG.gridColor;
		
		//draw vertical lines
		for(let x = x1; x<=x2; x+=gs) {
			this.ctx.beginPath();
			this.ctx.moveTo(x, y1);
			this.ctx.lineTo(x, y2);
			this.ctx.stroke();
		}
		
		//draw horizontal lines
		for(let y = y1; y<=y2; y+=gs) {
			this.ctx.beginPath();
			this.ctx.moveTo(x1, y);
			this.ctx.lineTo(x2, y);
			this.ctx.stroke();
		}
	}
	
	//writes new data to the debug info
	UpdateDebugInfo() {
		if(!this._showDebug || !this.htmlElems.debugInfo.elem) return false;
		
		const mouseClickPos = this.mouseDownPos?`raw=(${this.mouseDownPos.raw.x}, ${this.mouseDownPos.raw.y}), real=(${this.mouseDownPos.real.x.toFixed(5)}, ${this.mouseDownPos.real.y.toFixed(5)})`:this.mouseDownPos;
		
		this.htmlElems.debugInfo.text = `Debug info: (Warning: Having this open causes extra lag!)
state: running=${this._running}, paused=${this._paused}
toolbars: elem=${this._selectedElement}, tool=${this._selectedTool}, lastTool=${this.lastSelectedTool}
mousePos: raw=(${this.mousePos.raw.x}, ${this.mousePos.raw.y}), real=(${this.mousePos.real.x.toFixed(5)}, ${this.mousePos.real.y.toFixed(5)})
mouseClickPos: ${mouseClickPos}
mouseState: clickedElem=${this.clickedElement?this.clickedElement.constructor.name:this.clickedElement}, movingPressed=${this.mouseMovingWhilePressed}
viewOffset: (${this.viewOffsetReal.x.toFixed(5)}, ${this.viewOffsetReal.y.toFixed(5)})
zoom: log=${this.zoomLevel.toFixed(5)}, raw=${this.zoom.toFixed(5)}
undoHistory: undo=${this.simulator.AvailableUndos()}, redo=${this.simulator.AvailableRedos()}, totalChanges=${this.simulator.currentChangeID}
selectionElemCount: ${this.selectionElems.size}, connectionStartCount: ${this.connectionStartElems.size}
render: elems=${this.debugData.renderedElems}/${this.simulator.elements.size}, connections=${this.debugData.renderedLines}/${this.debugData.totalLines}
time: render=${this.debugData.frameDuration.toFixed(3)}s, tick=${this.debugData.tickDuration.toFixed(3)}s, step=${this.debugData.stepDuration.toFixed(3)}s (${this.debugData.stepDuration===0?0:(1/this.debugData.stepDuration).toFixed(3)}/${this.tps} TPS)
simulation: tick=${this.simulator.tick}, scheduledUpdates=${this.simulator.scheduledUpdates.size}
`;
		return true;
	}
	
	//exits edit mode and starts the simulation loop
	Start() {
		this._paused = false;
		if(this._running) return;
		
		this._SetRunning(true);
		this._SetPaused(false);
		
		this._StartSimulationLoop();
		this.UpdateDebugInfo();
	}
	
	//stops the simulation and enters edit mode
	Stop() {
		this._paused = false;
		if(!this._running) return;
		
		this._StopSimulationLoop();
		
		this._SetRunning(false);
		this.htmlElems.pauseBtn.hidden = true;
		this.htmlElems.continueBtn.hidden = true;
		
		this.UpdateDebugInfo();
	}
	
	//does a single step of simulation
	Step() {
		//start the simulation if it's still in edit mode
		if(!this._running) {
			this._SetRunning(true);
			this._paused = true;
			this.htmlElems.continueBtn.hidden = false;
		}
		//pause the simulation if it's actively running
		else if(!this._paused) this.Pause();
		//otherwise do the actual step
		else this._Step();
		this.UpdateDebugInfo();
	}
	
	//core step function
	_Step() {
		//calculate tick duration (how long it took the simulator to make a step)
		const tickTime = Date.now();
		this.simulator.Step();
		this.debugData.tickDuration = (Date.now()-tickTime)/1000;
		
		this.htmlElems.stepCounter.text = this.simulator.tick;
		this.ScheduleRedraw();
		
		//calculate step duration (how long did it take since the last time this function was ran)
		const stepTime = Date.now();
		this.debugData.stepDuration = (stepTime-this.lastStepTime)/1000;
		this.lastStepTime = stepTime;
	}
	
	//helper function to group multiple state-switching actions together, shows/hides buttons on the interface
	_SetRunning(state) {
		this.CancelCurrentAction();
		this._running = state;
		
		if(!state) {
			this.simulator.Reset(); //this must happen after CancelCurrentAction but before UpdateUndoRedoButtons, so it must be here
			this.htmlElems.stepCounter.text = this.simulator.tick;
		}
		this.UpdateUndoRedoButtons();
		
		this.htmlElems.startBtn.hidden = state;
		this.htmlElems.stopBtn.hidden = !state;
		this.htmlElems.stepCounter.hidden = !state;
		
		for(const htmlElem of Object.values(this.htmlElems.elemSelector)) {
			htmlElem.disabled = state;
		}
		for(const htmlElem of Object.values(this.htmlElems.tools)) {
			htmlElem.disabled = state;
		}
		
		//just so there is no weird value at the beginning
		this.lastStepTime = Date.now();
		
		this.UpdateCanvasCursor();
		this.ScheduleRedraw();
	}
	
	//helper function to group multiple pause-state-switching actions together, shows/hides buttons on the interface
	_SetPaused(state) {
		this._paused = state;
		this.htmlElems.pauseBtn.hidden = state;
		this.htmlElems.continueBtn.hidden = !state;
	}
	
	//pauses the simulation
	Pause() {
		if(!this._running || this._paused) return;
		this._StopSimulationLoop();
		this._SetPaused(true);
		this.UpdateDebugInfo();
	}
	
	//continues a paused simulation
	Continue() {
		if(!this._running || !this._paused) return;
		this._SetPaused(false);
		this._StartSimulationLoop();
		this.UpdateDebugInfo();
	}
	
	//starts the interval-based simulation loop
	_StartSimulationLoop() {
		//make sure it's not already running
		clearInterval(this._simulationLoopID);
		
		//start measuring tick time
		this.lastStepTime = Date.now();
		
		//start the interval-based loop, unless a step would take an infinite amount of time
		if(this._tps>0) this._simulationLoopID = setInterval(this._Step.bind(this), 1000/this._tps);
		else this._simulationLoopID = null;
		
		return this._simulationLoopID;
	}
	
	//stops the interval-based simulation loop
	_StopSimulationLoop() {
		clearInterval(this._simulationLoopID);
		this._simulationLoopID = null;
	}
	
	//resets all data and gets rid of all elements, resets the project (clipboard and undo is kept)
	_ResetAll() {
		if(this._running) this.Stop();
		else this.CancelCurrentAction();
		this.selectionElems.clear();
		this.viewOffsetReal = {x:0, y:0};
		this.zoom = 1;
		this.simulator.RemoveAllElements();
		this.tps = CONFIG.defaultTPS;
		this.SelectTool(CONFIG.initialTool);
		this.SelectElement(null);
		this.RecordChange();
		this.UpdateDebugInfo();
	}
	
	//resets the project after giving a prompt
	ResetProject() {
		if(confirm("Do you really want to start a new project?\nEverything you made will be deleted...")) {
			this._ResetAll();
			this.ScheduleRedraw();
		}
	}
	
	//saves the currect circuit and simulator data into a downloadable file
	SaveToFile() {
		if(this._running) this.Stop();
		else this.CancelCurrentAction();
		
		//save properties into an object
		const data = {
			fileFormatVersion: CONFIG.fileFormatVersion,
			viewOffset: {
				x:this.viewOffsetReal.x,
				y:this.viewOffsetReal.y
			},
			zoom: this.zoom,
			tps: this.tps,
			alignToGrid: this._alignToGrid,
			showIOonly: this._showIOonly
		};
		
		//add all the elements into this object as well
		this.simulator.Serialize(data);
		
		//convert the object into a JSON string and download it as a text file
		UTILS.DownloadTextFile(CONFIG.defaultFileName, JSON.stringify(data));
	}
	
	//lets the user open a file with a dialog and load it into the simulator
	OpenProjectFile() {
		UTILS.OpenFileDialog(".json", file => UTILS.ReadTextFile(file, this.LoadProjectFromJSON.bind(this)));
	}
	
	//loads an existing project from saved data
	LoadProjectFromJSON(jsonData) {
		//no data
		if(!jsonData) {
			//alert("File loading failed!");
			return false;
		}
		
		//try load and parse data
		let data;
		try {
			data = JSON.parse(jsonData);
		}
		catch(e) {
			alert("File loading failed!\nThis is not a valid JSON file!");
			return false;
		}
		
		//check file version
		if(data.fileFormatVersion!==CONFIG.fileFormatVersion) {
			alert("File loading failed!\nThe file you are trying to load has been created in a different version of this application.\nFile version: "+(data.fileFormatVersion || "?")+"\nApplication version: "+CONFIG.fileFormatVersion);
			return false;
		}
		
		//cancel current actions
		if(this._running) this.Stop();
		else this.CancelCurrentAction();
		this.selectionElems.clear();
		
		//try loading the elements
		if(!this.simulator.LoadElementsFromData(data.elements)) {
			alert("File loading failed!\nAn error was encountered while trying to load this file, most likely due to invalid data.");
			return false;
		}
		
		//apply loaded values
		this.viewOffsetReal = {x:data.viewOffset.x, y:data.viewOffset.y};
		this.zoom = data.zoom;
		this.tps = data.tps;
		this.alignToGrid = data.alignToGrid;
		this.showIOonly = data.showIOonly;
		
		this.RecordChange();
		this.UpdateDebugInfo();
		this.ScheduleRedraw();
		return true;
	}
	
	//browser event fired when a file is dropped onto the canvas
	_FileDragDrop(e) {
		e.preventDefault();
		if(!this.fileDragDropEnabled) return;
		UTILS.ReadTextFile(e.dataTransfer.files[0], this.LoadProjectFromJSON.bind(this))
	}
	
	//browser event fired when the user tries to exit the page
	_BeforeExit(e) {
		if(this.unsavedChanges) {
			e.preventDefault();
			//(this doesn't actually get shown in most browsers)
			return e.returnValue = "Are you sure you want to exit?\nAny unsaved changes will be lost!";
		}
	}
	
	
	//getters for some properties
	get running() {return this._running;}
	get paused() {return this._paused;}
	get zoomLevel() {return Math.log2(this.zoom);}
	
	//getter and setter for showing and hiding the grid
	get showGrid() {return this._showGrid;}
	set showGrid(val) {
		if(this._showGrid===val) return;
		this._showGrid = val;
		this.ScheduleRedraw();
	}
	
	//getter & setter for the state of the overlay being opened
	get overlayOpen() {
		return this.htmlElems.infoOverlay.elem && !this.htmlElems.infoOverlay.hidden;
	}
	set overlayOpen(val) {
		this.htmlElems.infoOverlay.hidden = !val;
	}
	
	//getter & setter for the TPS input
	get tps() {return this._tps;}
	set tps(val) {
		if(!UTILS.IsValidNum(val)) return;
			
		this._tps = val;
		if(this.htmlElems.tpsInput) this.htmlElems.tpsInput.value = val;
		//updates the simulation speed live if it's running
		if(this._running && !this._paused) {
			this._StopSimulationLoop();
			this._StartSimulationLoop();
		}
	}
	
	//getter & setter for the alignToGrid toggle
	get alignToGrid() {return this._alignToGrid;}
	set alignToGrid(val) {
		this._alignToGrid = val;
		if(this.htmlElems.alignToGridToggle) this.htmlElems.alignToGridToggle.activated = val;
	}
	
	//getter & setter for the showIOonly toggle
	get showIOonly() {return this._alignToGrid;}
	set showIOonly(val) {
		this._showIOonly = val;
		if(this.htmlElems.showIOonlyToggle) this.htmlElems.showIOonlyToggle.activated = val;
		if(this._running) this.ScheduleRedraw();
	}
	
	//getter & setter for the showDebug toggle
	get showDebug() {return this._showDebug;}
	set showDebug(val) {
		this._showDebug = val;
		if(this.htmlElems.showDebugToggle) this.htmlElems.showDebugToggle.activated = val;
		if(val) this.UpdateDebugInfo();
		this.htmlElems.debugInfo.hidden = !val;
		this.ScheduleRedraw();
	}
	
	
	//returns true if a selection is currently being made, otherwise false
	IsSelectionBeingCreated() {
		return !this._running && this._selectedTool==="select" && this.mouseMovingWhilePressed;
	}
	
	//returns true if an element is either already selected, or is within a selection area that's being made
	IsElementVisuallySelected(elem) {
		return this.selectionElems.has(elem) || (this.IsSelectionBeingCreated() && UTILS.IsPointWithinArea(elem.pos, this.mouseDownPos.real, this.mousePos.real));
	}
	
	//gets the canvas center coordinate (basically just half the size of the canvas)
	GetCanvasMiddleRaw() {
		if(this.canvas) return {x:this.canvas.width/2, y:this.canvas.height/2};
		return {x:0, y:0};
	}
	
	//gets the canvas bottom right corner in canvas coordinate space
	GetCanvasBottomRightCornerReal() {
		if(this.canvas) return this.RawCoordsToReal({x:this.canvas.width, y:this.canvas.height});
		return this.RawCoordsToReal({x:0, y:0});
	}
	
	//converts coordinates from screen canvas space to the canvas coordinate system inside the simulation
	RawCoordsToReal(posRaw) {
		return {x:posRaw.x/this.zoom+this.viewOffsetReal.x, y:posRaw.y/this.zoom+this.viewOffsetReal.y};
	}
	
	//aligns a given position such that it lies on the grid or in-between grid steps
	AlignCoordsToGrid(posReal) {
		return {x:UTILS.RoundTowards(posReal.x, CONFIG.gridSize/2), y:UTILS.RoundTowards(posReal.y, CONFIG.gridSize/2)};
	}
	//aligns a given position such that it lies exactly on the grid (no in-between grid steps)
	AlignCoordsToGridCoarse(posReal) {
		return {x:UTILS.RoundTowards(posReal.x, CONFIG.gridSize), y:UTILS.RoundTowards(posReal.y, CONFIG.gridSize)};
	}
}
