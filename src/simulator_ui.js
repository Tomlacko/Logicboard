"use strict";

//class representing the graphical user interface built on top of the simulator
class SimulatorGUI {
	constructor(simulator, htmlElems) {
		//constant-like properties / definitions
		this.PROPERTIES = {
			gridSize:40,
			gridColor:"rgba(220, 220, 220, 1)",
			gridThickness:2,
			scrollWheelStepSize:100,
			zoomStep:0.25, //zoom levels per scroll
			zoomMax:4,
			zoomMin:-5,
			mouseMoveToleranceOnClick:3,
			defaultFileName:"logic_circuit.json"
		};
		
		this.simulator = simulator;
		this._tps = 10; //steps per second
		this._running = false;
		this._paused = false;
		this._loopID = 0;
		
		this._selectedElement = null; //string representing the element class to be created on element creation
		this._selectedTool = null; //default = add_element, edit, delete, connect, (null = only panning, not actually used but works)
		
		this._alignToGrid = true;
		this._showGrid = true;
		
		this._mousePos = {x:0, y:0}; //raw
		this._lastMousePos = {x:0, y:0}; //raw
		this._mouseDownPos = null; //raw
		this._mouseMovedDuringClick = false;
		this._heldElement = null; //the element on which the mouse was clicked on
		this._heldElementOffsetFromMouse = {x:0, y:0} //not raw
		this._connectionStartElem = null; //the element from which a connection is being created currently
		
		this.canvas = htmlElems.canvas;
		this.ctx = this.canvas.getContext("2d");
		this.offset = {x:0, y:0}; //position of the canvas's top-left corner relative to the origin of the coordinate space
		this.zoom = 1; //bigger = closer
		
		//register canvas-related elements
		this.canvas.addEventListener("mousedown", this._CanvasMouseDown.bind(this));
		/*this.canvas*/window.addEventListener("mouseup", this._CanvasMouseUp.bind(this));
		this.canvas.addEventListener("mousemove", this._CanvasMouseMove.bind(this));
		this.canvas.addEventListener("wheel", this._CanvasScroll.bind(this));
		(new ResizeObserver(this._ContainerResize.bind(this))).observe(this.canvas.parentNode);
		
		//save a reference to the GUI buttons and wrap them in the wrapper class for easier use
		this.htmlElems = {
			//simulation control buttons
			startBtn: new UIButton(htmlElems.startBtn, this.Start.bind(this)),
			stopBtn: new UIButton(htmlElems.stopBtn, this.Stop.bind(this)),
			continueBtn: new UIButton(htmlElems.continueBtn, this.Continue.bind(this)),
			pauseBtn: new UIButton(htmlElems.pauseBtn, this.Pause.bind(this)),
			stepBtn: new UIButton(htmlElems.stepBtn, this.Step.bind(this)),
			
			//action buttons
			newProjectBtn: new UIButton(htmlElems.newProjectBtn, this.ResetProject.bind(this)),
			saveToFileBtn: new UIButton(htmlElems.saveToFileBtn, this.SaveToFile.bind(this)),
			loadFromFileBtn: new UIButton(htmlElems.loadFromFileBtn, this.LoadFromFile.bind(this))
		};
		this.htmlElems.tpsInput = new UINumInput(htmlElems.tpsInput, val => this.tps = val);
		this.htmlElems.tpsInput.value = this._tps;
		this.htmlElems.alignToGridToggle = new UIToggle(htmlElems.alignToGridToggle, activated => this._alignToGrid = activated);
		this.htmlElems.alignToGridToggle.activated = this._alignToGrid;
		
		//save a reference to all tool buttons & make them work
		this.htmlElems.tools = {};
		for(let htmlElem of Object.values(htmlElems.tools)) {
			const toolName = htmlElem.getAttribute("data-toolname");
			this.htmlElems.tools[toolName] = new UIButton(
				htmlElem, e => this.SelectTool(toolName)
			);
		}
		
		//dynamically generate element buttons for the sidebar
		this.htmlElems.elemSelector = {};
		for(let elemClass of Object.values(LogicElementTypes)) {
			//additional attributes work as a hack to get it to render it's name
			const elem = new elemClass({x:0, y:0, text:elemClass.prototype.labelText, delay:elemClass.prototype.labelText});
			
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
			img.alt = elemClass.name;
			img.classList.add("button");
			img.src = tempCanvas.toDataURL();
			img.setAttribute("data-elemtype", elemClass.name);
			htmlElems.elemSelector.appendChild(img);
			
			//bind the element selection function to each element
			this.htmlElems.elemSelector[elemClass.name] = new UIButton(
				img, e => {
					this.SelectElement(elemClass.name);
					this.SelectTool("add_element");
				}
			);
		}
		
		//default tool selection
		this.SelectElement(null);
		this.SelectTool("add_element");
	}
	
	//selects which element will get placed upon creation
	SelectElement(elemType) {
		if(elemType===this._selectedElement) return;
		this.CancelCurrentAction();
		if(this._selectedElement) this.htmlElems.elemSelector[this._selectedElement].selected = false;
		this._selectedElement = elemType;
		if(this._selectedElement) this.htmlElems.elemSelector[this._selectedElement].selected = true;
	}
	
	//selects which tool is supposed to be used
	SelectTool(toolname) {
		if(toolname===this._selectedTool) return;
		this.CancelCurrentAction();
		if(this._selectedTool) this.htmlElems.tools[this._selectedTool].selected = false;
		this._selectedTool = toolname;
		if(this._selectedTool) this.htmlElems.tools[this._selectedTool].selected = true;
	}
	
	//cancels everything before performing something else
	CancelCurrentAction() {
		this._heldElement = null;
		this._connectionStartElem = null;
		this.Redraw();
	}
	
	//internal event fired when the canvas container changes size (usually based on the window being resized)
	_ContainerResize(e) {
		const rect = e[0].contentRect;
		this.ResizeCanvas(rect.width, rect.height);
	}
	
	//internal event of the mouse button being released
	//works as a "successfull full click" handler
	_CanvasMouseUp(e) {
		//left mouse button allowed only
		if(e.button!==0) return;
		
		//event triggered without mousedown being registered beforehand
		if(!this._mouseDownPos) return;
		
		
		const clickPos = this.CoordsToCanvasSpace(this._mousePos);
		let redraw = false;
		
		if(!this._mouseMovedDuringClick) {//only register a click if the mouse didn't move much
			//clicking in a running simulator
			if(this._running) {
				if(this._heldElement) {
					this.simulator.ElementClickFull(this._heldElement);
					redraw = true;
				}
			}
			//clicking in edit-mode
			else {
				//clicked on an element
				if(this._heldElement) {
					switch(this._selectedTool) {
						case "connect":
							//finish a connection if it has been started
							if(this._connectionStartElem) {
								if(this.simulator.ConnectElements(this._connectionStartElem, this._heldElement)) {
									this._connectionStartElem = null;
									redraw = true;
								}
							}
							//start a new connection otherwise
							else {
								if(this._heldElement.canOutput) {
									this._connectionStartElem = this._heldElement;
									redraw = true;
								}
							}
							break;
						case "edit":
							//finish a connection if editing one currently
							if(this._connectionStartElem) {
								if(this.simulator.ConnectElements(this._connectionStartElem, this._heldElement)) {
									this._connectionStartElem = null;
									redraw = true;
								}
							}
							//edit the clicked element
							else {
								this._heldElement.Edit();
								redraw = true;
							}
							break;
						case "delete":
							//delete the clicked element
							this.simulator.RemoveElement(this._heldElement);
							redraw = true;
							break;
					}
				}
				//clicked empty space (or connection line)
				else {
					const clickedConnection = this.simulator.GetConnectionAtPos(clickPos);
					switch(this._selectedTool) {
						case "connect":
							//cancel connection
							this._connectionStartElem = null;
							redraw = true;
							break;
						case "edit":
							//rewire an existing connection
							if(clickedConnection) {
								this.simulator.DisconnectElements(clickedConnection.startElem, clickedConnection.endElem);
								this._connectionStartElem = clickedConnection.startElem;
								redraw = true;
							}
							break;
						case "delete":
							//delete an existing connection
							if(clickedConnection) {
								this.simulator.DisconnectElements(clickedConnection.startElem, clickedConnection.endElem);
								redraw = true;
							}
							break;
						case "add_element":
							//create and place a new element on the canvas
							if(this._selectedElement) {
								if(this.simulator.CreateAndAddElement(this._selectedElement, this._alignToGrid?this.AlignCoordsToGrid(clickPos):clickPos))
									redraw = true;
							}
							break;
					}
				}
			}
		}
		
		//send click end event to a clicked element during simulation
		if(this._running && this._heldElement) {
			this.simulator.ElementClickEnd(this._heldElement);
			redraw = true;
		}
		
		//reset all values since click has ended
		this._heldElement = null;
		this._mouseDownPos = null;
		this._mouseMovedDuringClick = false;
		if(redraw) this.Redraw();
	}
	
	//internal event of the mouse button being pressed down on the canvas
	_CanvasMouseDown(e) {
		//left mouse button allowed only
		if(e.button!==0) return;
		
		this._mouseDownPos = {x:this._mousePos.x, y:this._mousePos.y};
		const mouseRealPos = this.CoordsToCanvasSpace(this._mouseDownPos);
		this._mouseMovedDuringClick = false;
		
		//just in case the last mouseup event didn't register, send a click end event to th eheld element
		if(this._running && this._heldElement) this.simulator.ElementClickEnd(this._heldElement);
		
		//get and remember the clicked element, if any
		this._heldElement = this.simulator.GetElementAtPos(mouseRealPos);
		if(this._heldElement) {
			this._heldElementOffsetFromMouse = {x:this._heldElement.pos.x-mouseRealPos.x, y:this._heldElement.pos.y-mouseRealPos.y};
		}
		
		//send click start event to a clicked element during simulation
		if(this._running && this._heldElement) {
			this.simulator.ElementClickStart(this._heldElement);
			this.Redraw();
		}
	}
	
	//internal event of the mouse being moved around on the canvas
	_CanvasMouseMove(e) {
		//calculate mouse position and stuff
		const canvasBound = this.canvas.getBoundingClientRect();
		this._lastMousePos = this._mousePos;
		this._mousePos = {x:e.clientX-canvasBound.left, y:e.clientY-canvasBound.top};
		
		const rawDist = {x:this._mousePos.x-this._lastMousePos.x, y:this._mousePos.y-this._lastMousePos.y};
		
		//if the mouse is being held down, then recognize when it moves away from its initial spot (this enables panning/dragging and prevents a full mouse click)
		if(this._mouseDownPos && !this._mouseMovedDuringClick && Distance(this._mouseDownPos, this._mousePos) > this.PROPERTIES.mouseMoveToleranceOnClick)
			this._mouseMovedDuringClick = true;
		
		//dragging an element with the mouse
		if(this._heldElement && !this._running) {
			if(this._mouseMovedDuringClick) {
				const realMousePos = this.CoordsToCanvasSpace(this._mousePos);
				let elemPos = {x:realMousePos.x+this._heldElementOffsetFromMouse.x, y:realMousePos.y+this._heldElementOffsetFromMouse.y};
				if(this._alignToGrid) elemPos = this.AlignCoordsToGrid(elemPos);
				this._heldElement.pos.x = elemPos.x;
				this._heldElement.pos.y = elemPos.y;
				this.simulator.MoveElementToTop(this._heldElement);
				this.Redraw();
			}
		}
		//panning the canvas
		else if(this._mouseDownPos) {
			this.MoveCanvasBy({x:-rawDist.x, y:-rawDist.y});
		}
		//creating a connection line
		else if(this._connectionStartElem) {
			this.Redraw();
		}
	}
	
	//internal event for the mouse wheel being scrolled over the canvas
	_CanvasScroll(e) {
		e.preventDefault();
		this.ZoomOn(this._mousePos, (-e.deltaY/this.PROPERTIES.scrollWheelStepSize)*this.PROPERTIES.zoomStep);
	}
	
	//zoom the canvas centered on a specific point (keeping that point in place)
	ZoomOn(pos, zoomAmount) {//pos is raw
		const newZoom = Math.pow(2, ClampNum(Math.log2(this.zoom)+zoomAmount, this.PROPERTIES.zoomMin, this.PROPERTIES.zoomMax));
		if(newZoom!==this.zoom) {
			this.offset.x = pos.x/this.zoom + this.offset.x - pos.x/newZoom;
			this.offset.y = pos.y/this.zoom + this.offset.y - pos.y/newZoom;
			this.zoom = newZoom;
			this.Redraw();
		}
	}
	
	//pan the canvas by a given amount
	MoveCanvasBy(moveAmount) {//moveAmount is raw
		this.offset.x+=moveAmount.x/this.zoom;
		this.offset.y+=moveAmount.y/this.zoom;
		this.Redraw();
	}
	
	//schedules the redraw to happen only when the browser renders a frame
	//also throttles the render function from being fired more often than it makes sense (which caused a slowdown)
	Redraw() {
		requestAnimationFrame(this._Redraw.bind(this));
	}
	
	//main canvas redraw function to render all the content
	_Redraw() {
		//reposition and clear the canvas
		this.ctx.setTransform(this.zoom, 0, 0, this.zoom, -this.offset.x*this.zoom, -this.offset.y*this.zoom);
		this.ctx.clearRect(this.offset.x, this.offset.y, this.canvas.width/this.zoom, this.canvas.height/this.zoom);
		
		//draw the grid (unless too zoomed out)
		if(this._showGrid && this.zoom*this.PROPERTIES.gridSize >= 4) //spacing = less than 4 pixels
			this._DrawGrid();
		
		//calculate the canvas boundaries
		const {x:screenLeft, y:screenTop} = this.offset;
		const {x:screenRight, y:screenBottom} = this.CoordsToCanvasSpace({x:this.canvas.width, y:this.canvas.height});
		const lineWidth = GLOBAL_VISUALS.connectionLineWidth;
		const screenLeftLine = screenLeft-lineWidth;
		const screenRightLine = screenRight+lineWidth;
		const screenTopLine = screenTop-lineWidth;
		const screenBottomLine = screenBottom+lineWidth;
		
		//draw connections between elements
		for(let elemStart of this.simulator.elems) {
			for(let elemEnd of elemStart.outputs) {
				const ax = Math.min(elemStart.pos.x, elemEnd.pos.x);
				const ay = Math.min(elemStart.pos.y, elemEnd.pos.y);
				const bx = Math.max(elemStart.pos.x, elemEnd.pos.x);
				const by = Math.max(elemStart.pos.y, elemEnd.pos.y);
				//don't draw lines that are definitely not on the screen (not completely optimal, some are still drawn, but good enough)
				if(bx>screenLeftLine && ax<screenRightLine && by>screenTopLine && ay<screenBottomLine) {
					this._DrawConnectionLine(elemStart.pos, elemEnd.pos, this._running && elemStart.powered);
				}
			}
		}
		
		//draw all elements
		for(let elem of this.simulator.elems) {
			//don't bother drawing elements that aren't on the screen
			if(elem.right>screenLeft && elem.left<screenRight && elem.bottom>screenTop && elem.top<screenBottom) {
				elem.Draw(this.ctx);
			}
		}
		
		//draw connection line creation
		if(this._connectionStartElem) {
			const mousePos = this.CoordsToCanvasSpace(this._mousePos);
			this._DrawConnectionLine(this._connectionStartElem.pos, mousePos, false);
		}
	}
	
	//draws a power line (connection)
	_DrawConnectionLine(startPos, endPos, powered) {
		this.ctx.lineWidth = GLOBAL_VISUALS.connectionLineWidth;
		const lineStyle = powered?GLOBAL_VISUALS.connectionPowered:GLOBAL_VISUALS.connectionUnpowered;
		const lineGradient = this.ctx.createLinearGradient(startPos.x, startPos.y, endPos.x, endPos.y);
		lineGradient.addColorStop(0, lineStyle.start);
		lineGradient.addColorStop(1, lineStyle.end);
		this.ctx.strokeStyle = lineGradient;
		this.ctx.beginPath();
		this.ctx.moveTo(startPos.x, startPos.y);
		this.ctx.lineTo(endPos.x, endPos.y);
		this.ctx.stroke();
	}
	
	//draws the canvas grid
	_DrawGrid() {
		const gs = this.PROPERTIES.gridSize;
		const corner = this.CoordsToCanvasSpace({x:this.canvas.width, y:this.canvas.height});
		const x1 = Math.floor(this.offset.x/gs - 1)*gs;
		const y1 = Math.floor(this.offset.y/gs - 1)*gs;
		const x2 = Math.ceil(corner.x/gs + 1)*gs;
		const y2 = Math.ceil(corner.y/gs + 1)*gs;
		this.ctx.lineWidth = this.PROPERTIES.gridThickness;
		this.ctx.strokeStyle = this.PROPERTIES.gridColor;
		
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
	
	//changes the canvas size
	ResizeCanvas(width, height) {
		this.canvas.width = width;
		this.canvas.height = height;
		this.Redraw();
	}
	
	//exits edit mode and starts the simulation loop
	Start() {
		this._paused = false;
		if(this._running) return;
		
		this._SetRunning(true);
		this._SetPaused(false);
		
		this._loopID = setInterval(this._Step.bind(this), 1000/this.tps);
	}
	
	//stops the simulation and enters edit mode
	Stop() {
		this._paused = false;
		if(!this._running) return;
		clearInterval(this._loopID);
		
		this._SetRunning(false);
		this.htmlElems.pauseBtn.hidden = true;
		this.htmlElems.continueBtn.hidden = true;
		this.htmlElems.stepBtn.disabled = false;
		
		this.simulator.Reset();
		this.Redraw();
	}
	
	//does a single step of simulation
	Step() {
		if(!this._running) {
			this._SetRunning(true);
			this._paused = true;
			this.htmlElems.continueBtn.hidden = false;
		}
		if(!this._paused) this.Pause();
		this._Step();
	}
	//core step function
	_Step() {
		this.simulator.Step();
		this.Redraw();
	}
	
	//helper function to group multiple state-switching actions together, shows/hides buttons on the interface
	_SetRunning(state) {
		this.CancelCurrentAction();
		this._running = state;
		
		this.htmlElems.startBtn.hidden = state;
		this.htmlElems.stopBtn.hidden = !state;
		
		for(let htmlElem of Object.values(this.htmlElems.elemSelector)) {
			htmlElem.disabled = state;
		}
		for(let htmlElem of Object.values(this.htmlElems.tools)) {
			htmlElem.disabled = state;
		}
	}
	
	//helper function to group multiple pause-state-switching actions together, shows/hides buttons on the interface
	_SetPaused(state) {
		this._paused = state;
		this.htmlElems.pauseBtn.hidden = state;
		this.htmlElems.continueBtn.hidden = !state;
		this.htmlElems.stepBtn.disabled = !state;
	}
	
	//pauses the simulation
	Pause() {
		if(!this._running || this._paused) return;
		clearInterval(this._loopID);
		this._SetPaused(true);
	}
	//continues a paused simulation
	Continue() {
		if(!this._running || !this._paused) return;
		this._SetPaused(false);
		this._loopID = setInterval(this._Step.bind(this), 1000/this.tps);
	}
	
	//resets all data and gets rid of all work, resets the project
	_ResetAll() {
		this.CancelCurrentAction();
		this.Stop();
		this.offset = {x:0, y:0};
		this.zoom = 1;
		this.simulator = new Simulator();
	}
	
	//resets the project after giving a prompt
	ResetProject() {
		if(confirm("Do you really want to start a new project?\nEverything you made will be deleted...")) {
			this._ResetAll();
			this.Redraw();
		}
	}
	
	//saves the currect circuit and simulator data into a downloadable file
	SaveToFile() {
		this.CancelCurrentAction();
		this.Stop();
		const data = this.simulator.Serialize();
		data.zoom = this.zoom;
		data.offset = {x:this.offset.x, y:this.offset.y};
		data.tps = this.tps;
		DownloadTextFile(this.PROPERTIES.defaultFileName, JSON.stringify(data));
	}
	
	//lets the user open a file with a dialog and load it into the simulator
	LoadFromFile() {
		LoadFileDialog(file => {
			ReadTextFile(file, contents => {
				//try load and parse data
				if(!contents) {
					alert("File loading failed!");
					return;
				}
				let data;
				try {
					data = JSON.parse(contents);
				}
				catch(e) {
					alert("File loading failed!\nThe file doesn't have valid data!");
					return;
				}
				
				//apply loaded values
				this.CancelCurrentAction();
				this.Stop();
				this.offset = {x:data.offset.x, y:data.offset.y};
				this.zoom = data.zoom;
				this.tps = data.tps;
				this.simulator = new Simulator(data.elems);
				this.Redraw();
			})
		});
	}
	
	get running() {return this._running;}
	get paused() {return this._paused;}
	get zoomLevel() {return Math.log2(this.zoom);}
	
	get tps() {return this._tps;}
	set tps(value) {
		this._tps = value;
		//updates the simulation speed live if it's running
		if(this._running && !this._paused) {
			clearInterval(this._loopID);
			this._loopID = setInterval(this._Step.bind(this), 1000/this._tps);
		}
	}
	get alignToGrid() {return this._alignToGrid;}
	set alignToGrid(val) {
		this._alignToGrid = val;
		this.htmlElems.alignToGridToggle.activated = val;
	}
	
	//gets the canvas center coordinate (basically half the size of the canvas)
	GetCanvasMiddle() {
		return {x:this.canvas.width/2, y:this.canvas.height/2};
	}
	
	//gets the canvas bottom right coordinate
	GetCanvasBottomRightCorner() {
		return this.CoordsToCanvasSpace({x:this.canvas.width, y:this.canvas.height});
	}
	
	//converts coordinates from screen canvas space to the canvas coordinate system inside the simulation
	CoordsToCanvasSpace(pos) {
		return {x:pos.x/this.zoom+this.offset.x, y:pos.y/this.zoom+this.offset.y};
	}
	
	//aligns a given position such that it lies on the grid
	AlignCoordsToGrid(pos) {
		return {x:RoundTowards(pos.x, this.PROPERTIES.gridSize/2), y:RoundTowards(pos.y, this.PROPERTIES.gridSize/2)};
	}
}
