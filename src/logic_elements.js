"use strict";

//this holds a reference to all the logic element types
const LOGIC_ELEMENTS = {};

//classes defined inside an annonymous function to not pollute the global namespace
//the logic element classes are instead reachable through the common object declared above
(function() {
	//abstract base class (logic element template), not included in the common object with the child elements
	class LogicElement {
		//data must contain at least the x,y position
		//data can also be another element of the same type whose properties should be copied into this one
		constructor(data) {
			//make sure this class cannot be directly instantiated
			if(new.target === LogicElement) {
				throw "Cannot instantiate abstract class directly!";
			}
			
			//validation
			//if(!data) throw "Cannot create logic element - no data provided!";
			
			//setup initial properties
			this.pos = {x:undefined, y:undefined};
			this.powered = this.poweredByDefault;
			this.beginPowered = this.poweredByDefault;
			this.poweredStateChanged = false; //marked true during a step if the power should change at the end of that step. changing the power during the step itself would cause inconsistent behavior for the whole simulation
			
			this.inputs = new Set();
			this.outputs = new Set();
			
			//if any initialization data was provided
			if(data) {
				//setup additional properties / override existing properties
				//cloning from existing element
				if(data instanceof LogicElement) {
					if(data.constructor!==this.constructor)
						throw "Cannot create logic element clone - type mismatch!";
					
					if(data.pos) this.pos = {x:data.pos.x, y:data.pos.y};
				}
				//using normal config
				else {
					//position validation
					/*if(!(UTILS.IsValidNum(data.x) && UTILS.IsValidNum(data.y)))
						throw "Cannot create logic element - position not specified!";
					*/
					
					this.pos = {x:data.x, y:data.y};
				}
				
				this.id = data.id; //set only when elements are being saved (serialized) or when they are being loaded, otherwise undefined. when a value is present, it cannot be relied on, as it's only valid immediately before saving / after loading
				
				//load the power value from parsed data if present and supported by this element, otherwise uses defaults
				if(this.editablePower && typeof data.beginPowered === "boolean") {
					this.beginPowered = data.beginPowered;
					this.powered = this.beginPowered;
				}
			}
		}
		
		
		//resets the values to what they were before the simulation started (returns to edit mode)
		Reset() {
			this.powered = this.beginPowered;
			this.poweredStateChanged = false;
		}
		
		//ran at most once per simulation step, evaluates if the element should be powered or not, etc.
		//returns a bit flag specifying which elements need to be updated after this operation in the next step
		Update() {return 0;}
		
		//checks if any of the input elements are sending power to this one
		_IsReceivingPower() {
			for(const input of this.inputs) {
				if(input.powered) {
					return true;
				}
			}
			return false;
		}
		
		//post-processing that runs after all the updates for all other elements get processed
		LateUpdate() {
			if(this.poweredStateChanged) {
				this.powered = !this.powered;
				this.poweredStateChanged = false;
			}
		}
		
		//runs when this element is clicked on with an edit tool. returns false if editing failed (or produced no changes), otherwise returns false
		Edit() {
			if(this.editablePower) {
				//toggle the default power value on edit
				const p = !this.beginPowered;
				this.beginPowered = p;
				this.powered = p;
				return true;
			}
			return false;
		}
		
		//runs when element is clicked on while the simulation is running
		//returns a bit flag specifying which elements need to be updated after this operation in the next step
		ClickStart() {return 0;}
		ClickEnd() {return 0;}
		ClickFull() {return 0;}
		
		//configures the canvas with the properties specific to this element
		_PrepareDraw(ctx) {
			ctx.lineWidth = CONFIG.elemOutlineWidth;
			ctx.font = CONFIG.elemLabelSize+"px "+CONFIG.elemLabelFont;
			ctx.textAlign="center";
			ctx.textBaseline="middle";
			const style = this.powered?CONFIG.elemPowered:CONFIG.elemUnpowered;
			ctx.fillStyle = style.fillColor;
			ctx.strokeStyle = style.outlineColor;
			ctx.beginPath();
		}
		
		//template for a rectangular element
		_DrawBody(ctx) {
			const ow = CONFIG.elemOutlineWidth;
			const x = this.left+ow/2;
			const y = this.top+ow/2;
			const w = this.rx*2-ow;
			const h = this.ry*2-ow;
			
			ctx.rect(x, y, w, h);
			ctx.fill();
			ctx.stroke();
		}
		
		//rectangular selection overlay
		DrawSelection(ctx) {
			const ow = CONFIG.selection.outlineWidth;
			
			ctx.lineWidth = ow;
			ctx.strokeStyle = CONFIG.selection.outlineColor;
			ctx.fillStyle = CONFIG.selection.fillColor;
			
			//draw selection overlay
			ctx.beginPath();
			ctx.rect(this.left, this.top, this.rx*2, this.ry*2);
			ctx.fill();
			
			//draw selection outline
			ctx.beginPath();
			ctx.rect(this.left-ow/2, this.top-ow/2, this.rx*2+ow, this.ry*2+ow);
			ctx.stroke();
		}
		
		//draws the element's label
		_DrawLabel(ctx) {
			const style = this.powered?CONFIG.elemPowered:CONFIG.elemUnpowered;
			ctx.fillStyle = style.labelColor;
			ctx.beginPath();
			ctx.fillText(this.GetCurrentLabelText(), this.pos.x, this.pos.y);
		}
		
		//draws debug information about this element under it
		DrawDebug(ctx, index, scheduledForUpdate) {
			ctx.fillStyle = CONFIG.elemDebug.textColor;
			ctx.strokeStyle = CONFIG.elemDebug.outlineColor;
			ctx.lineWidth = CONFIG.elemDebug.outlineSize*2;
			ctx.font = CONFIG.elemDebug.fontSize+"px "+CONFIG.elemDebug.font;
			ctx.textAlign="left";
			ctx.textBaseline="top";
			ctx.beginPath();
			
			//allow drawing multiple lines
			const debugTextLines = this.GetDebugText(index, scheduledForUpdate).split("\n");
			let lineNum = 0;
			for(const line of debugTextLines) {
				if(line.length>0) {
					const posY = this.bottom+5+(CONFIG.elemDebug.fontSize*1.2)*lineNum;
					ctx.strokeText(line, this.left+5, posY);
					ctx.fillText(line, this.left+5, posY);
				}
				lineNum++;
			}
		}
		
		//main draw function that draws this element onto a given canvas
		Draw(ctx, isSelected) {
			this._PrepareDraw(ctx);
			this._DrawBody(ctx);
			this._DrawLabel(ctx);
			//draws an overlay when inside a selection
			if(isSelected) {
				this.DrawSelection(ctx);
			}
		}
		
		//method to be overriden by elements which display different values instead of the default label
		GetCurrentLabelText() {
			return this.labelText;
		}
		
		//returns text that is printed out while debug rendering is enabled
		GetDebugText(index, scheduledForUpdate) {
			return `${this.constructor.name}
tempID: ${this.id}, index: ${index}
pos: (${this.pos.x}, ${this.pos.y})
inputs: ${this.inputs.size}, outputs: ${this.outputs.size}
${scheduledForUpdate?"":"not "}scheduled for update
power: ${this.powered}, beginPowered: ${this.beginPowered}`;
		}
		
		//checks if a given point is within the boundary
		IsPointWithin(point) {
			//template for rectangular element
			return UTILS.IsPointWithinRect(point, this.pos, this.rx, this.ry);
		}
		
		//returns specific portions of the element's bounding box
		get top() {return this.pos.y-this.ry;}
		get bottom() {return this.pos.y+this.ry;}
		get left() {return this.pos.x-this.rx;}
		get right() {return this.pos.x+this.rx;}
		
		//copies all valid properties from a different element over to this one
		CopyPropertiesFrom(otherElem) {
			if(this.constructor===otherElem.constructor) {
				if(this.editablePower) {
					this.beginPowered = otherElem.beginPowered;
					this.powered = otherElem.powered;
				}
				return true;
			}
			return false;
		}
		
		//packages all the necessary values descibing this element into one saveable object
		Serialize() {
			const data = {
				elemType:this.constructor.name,
				id:this.id,
				x:this.pos.x,
				y:this.pos.y
			};
			if(this.editablePower && this.beginPowered!=this.poweredByDefault) data.beginPowered = this.beginPowered;
			if(this.inputs.size>0) data.inputs = Array.from(this.inputs).map(elem => elem.id);
			if(this.outputs.size>0) data.outputs = Array.from(this.outputs).map(elem => elem.id);
			return data;
		}
	}
	//declaring some properties this way was supposed to make them accessible from every instance of the class without actually saving it in every instance (though it seems like it might not actually work as expected)
	LogicElement.prototype.fullName = "";
	LogicElement.prototype.labelText = "";
	LogicElement.prototype.rx = 0;
	LogicElement.prototype.ry = 0;
	LogicElement.prototype.r = 0;
	LogicElement.prototype.poweredByDefault = false; //the default power state of the element upon creation
	LogicElement.prototype.editablePower = false; //if the element can be edited to begin powered or not
	LogicElement.prototype.canInput = false; //if connections going to this element can be made (=if it accepts input)
	LogicElement.prototype.canOutput = false; //if connections going out of this element can be made (=if it's able to output)


	////////////////////////////////////////////


	class Button extends LogicElement {
		_DrawBody(ctx) {
			//draw circle
			ctx.arc(this.pos.x, this.pos.y, this.r-CONFIG.elemOutlineWidth/2, 0, 2*Math.PI, false);
			ctx.fill();
			ctx.stroke();
		}
		
		ClickStart() {
			this.powered = true;
			return 2; //update outputs only
		}
		ClickEnd() {
			this.powered = false;
			return 2; //update outputs only
		}
		
		IsPointWithin(point) {
			return UTILS.IsPointWithinCircle(point, this.pos, this.r);
		}
	}
	Button.prototype.fullName = "Input - Pushable Button";
	Button.prototype.labelText = "Button";
	Button.prototype.r = 30;
	Button.prototype.rx = Button.prototype.r;
	Button.prototype.ry = Button.prototype.r;
	Button.prototype.editablePower = true;
	Button.prototype.canInput = false;
	Button.prototype.canOutput = true;
	LOGIC_ELEMENTS[Button.name] = Button;


	class Switch extends LogicElement {
		_DrawBody(ctx) {
			//draw circle
			ctx.arc(this.pos.x, this.pos.y, this.r-CONFIG.elemOutlineWidth/2, 0, 2*Math.PI, false);
			ctx.fill();
			ctx.stroke();
		}
		
		ClickFull() {
			this.powered = !this.powered;
			return 2; //update outputs only
		}
		
		IsPointWithin(point) {
			return UTILS.IsPointWithinCircle(point, this.pos, this.r);
		}
	}
	Switch.prototype.fullName = "Input - Toggleable Switch";
	Switch.prototype.labelText = "Switch";
	Switch.prototype.r = 30;
	Switch.prototype.rx = Switch.prototype.r;
	Switch.prototype.ry = Switch.prototype.r;
	Switch.prototype.editablePower = true;
	Switch.prototype.canInput = false;
	Switch.prototype.canOutput = true;
	LOGIC_ELEMENTS[Switch.name] = Switch;


	class LightBulb extends LogicElement {
		Update() {
			this.poweredStateChanged = this._IsReceivingPower()!==this.powered;
			return 0; //schedule nothing
		}
		
		_DrawBody(ctx) {
			//draw circle
			ctx.arc(this.pos.x, this.pos.y, this.r-CONFIG.elemOutlineWidth/2, 0, 2*Math.PI, false);
			ctx.fill();
			ctx.stroke();
		}
		
		IsPointWithin(point) {
			return UTILS.IsPointWithinCircle(point, this.pos, this.r);
		}
	}
	LightBulb.prototype.fullName = "Output - Light Bulb";
	LightBulb.prototype.labelText = "💡"; //light bulb emoji
	LightBulb.prototype.r = 20;
	LightBulb.prototype.rx = LightBulb.prototype.r;
	LightBulb.prototype.ry = LightBulb.prototype.r;
	LightBulb.prototype.editablePower = true;
	LightBulb.prototype.canInput = true;
	LightBulb.prototype.canOutput = false;
	LOGIC_ELEMENTS[LightBulb.name] = LightBulb;


	class DisplayTile extends LogicElement {
		Update() {
			this.poweredStateChanged = this._IsReceivingPower()!==this.powered;
			return 0; //schedule nothing
		}
		
		_DrawBody(ctx) {
			const padding = 0.25; //workaround to prevent antialiasing seams
			const x = this.pos.x-this.rx-padding;
			const y = this.pos.y-this.ry-padding;
			const w = (this.rx+padding)*2;
			const h = (this.ry+padding)*2;
			ctx.rect(x, y, w, h);
			ctx.fill();
		}
	}
	DisplayTile.prototype.fullName = "Output - Display Tile";
	DisplayTile.prototype.labelText = "";
	DisplayTile.prototype.rx = 40/2;
	DisplayTile.prototype.ry = 40/2;
	DisplayTile.prototype.r = Math.max(DisplayTile.prototype.rx, DisplayTile.prototype.ry);
	DisplayTile.prototype.editablePower = true;
	DisplayTile.prototype.canInput = true;
	DisplayTile.prototype.canOutput = false;
	LOGIC_ELEMENTS[DisplayTile.name] = DisplayTile;


	class OrGate extends LogicElement {
		Update() {
			if(this._IsReceivingPower()!==this.powered) {
				this.poweredStateChanged = true;
				return 2; //schedule update for outputs
			}
			return 0; //schedule nothing
		}
	}
	OrGate.prototype.fullName = "OR Gate";
	OrGate.prototype.labelText = "OR";
	OrGate.prototype.rx = 60/2;
	OrGate.prototype.ry = 40/2;
	OrGate.prototype.r = Math.max(OrGate.prototype.rx, OrGate.prototype.ry);
	OrGate.prototype.editablePower = true;
	OrGate.prototype.canInput = true;
	OrGate.prototype.canOutput = true;
	LOGIC_ELEMENTS[OrGate.name] = OrGate;


	class NotGate extends LogicElement {
		Update() {
			if(this._IsReceivingPower()===this.powered) {
				this.poweredStateChanged = true;
				return 2; //schedule update for outputs
			}
			return 0; //schedule nothing
		}
		
		_DrawBody(ctx) {
			//draw circle
			ctx.arc(this.pos.x, this.pos.y, this.r-CONFIG.elemOutlineWidth/2, 0, 2*Math.PI, false);
			ctx.fill();
			ctx.stroke();
		}
		
		IsPointWithin(point) {
			return UTILS.IsPointWithinCircle(point, this.pos, this.r);
		}
	}
	NotGate.prototype.fullName = "NOT Gate";
	NotGate.prototype.labelText = "NOT";
	NotGate.prototype.r = 20;
	NotGate.prototype.rx = NotGate.prototype.r;
	NotGate.prototype.ry = NotGate.prototype.r;
	NotGate.prototype.poweredByDefault = true;
	NotGate.prototype.editablePower = true;
	NotGate.prototype.canInput = true;
	NotGate.prototype.canOutput = true;
	LOGIC_ELEMENTS[NotGate.name] = NotGate;


	class AndGate extends LogicElement {
		Update() {
			//check if all the inputs are providing power
			let receivingAllPower = false;
			if(this.inputs.size>0) {
				receivingAllPower = true;
				for(const input of this.inputs) {
					if(!input.powered) {
						receivingAllPower = false;
						break;
					}
				}
			}
			
			if(receivingAllPower!==this.powered) {
				this.poweredStateChanged = true;
				return 2; //schedule update for outputs
			}
			return 0; //schedule nothing
		}
	}
	AndGate.prototype.fullName = "AND Gate";
	AndGate.prototype.labelText = "AND";
	AndGate.prototype.rx = 60/2;
	AndGate.prototype.ry = 40/2;
	AndGate.prototype.r = Math.max(AndGate.prototype.rx, AndGate.prototype.ry);
	AndGate.prototype.editablePower = true;
	AndGate.prototype.canInput = true;
	AndGate.prototype.canOutput = true;
	LOGIC_ELEMENTS[AndGate.name] = AndGate;


	class NandGate extends LogicElement {
		Update() {
			//check if all the inputs are providing power
			let receivingAllPower = false;
			if(this.inputs.size>0) {
				receivingAllPower = true;
				for(const input of this.inputs) {
					if(!input.powered) {
						receivingAllPower = false;
						break;
					}
				}
			}
			
			if(receivingAllPower===this.powered) {
				this.poweredStateChanged = true;
				return 2; //schedule update for outputs
			}
			return 0; //schedule nothing
		}
	}
	NandGate.prototype.fullName = "NAND Gate";
	NandGate.prototype.labelText = "NAND";
	NandGate.prototype.rx = 60/2;
	NandGate.prototype.ry = 40/2;
	NandGate.prototype.r = Math.max(NandGate.prototype.rx, NandGate.prototype.ry);
	NandGate.prototype.poweredByDefault = true;
	NandGate.prototype.editablePower = true;
	NandGate.prototype.canInput = true;
	NandGate.prototype.canOutput = true;
	LOGIC_ELEMENTS[NandGate.name] = NandGate;


	class XorGate extends LogicElement {
		Update() {
			//checks if the amount of inputs powering this element is odd
			let shouldBePowered = false;
			for(const input of this.inputs) {
				if(input.powered) {
					shouldBePowered = !shouldBePowered;
				}
			}
			if(shouldBePowered!==this.powered) {
				this.poweredStateChanged = true;
				return 2; //schedule update for outputs
			}
			return 0; //schedule nothing
		}
	}
	XorGate.prototype.fullName = "XOR Gate";
	XorGate.prototype.labelText = "XOR";
	XorGate.prototype.rx = 60/2;
	XorGate.prototype.ry = 40/2;
	XorGate.prototype.r = Math.max(XorGate.prototype.rx, XorGate.prototype.ry);
	XorGate.prototype.editablePower = true;
	XorGate.prototype.canInput = true;
	XorGate.prototype.canOutput = true;
	LOGIC_ELEMENTS[XorGate.name] = XorGate;


	class XnorGate extends LogicElement {
		Update() {
			//checks if the amount of inputs powering this element is even
			let shouldBePowered = true;
			for(const input of this.inputs) {
				if(input.powered) {
					shouldBePowered = !shouldBePowered;
				}
			}
			if(shouldBePowered!==this.powered) {
				this.poweredStateChanged = true;
				return 2; //schedule update for outputs
			}
			return 0; //schedule nothing
		}
	}
	XnorGate.prototype.fullName = "XNOR Gate";
	XnorGate.prototype.labelText = "XNOR";
	XnorGate.prototype.rx = 60/2;
	XnorGate.prototype.ry = 40/2;
	XnorGate.prototype.r = Math.max(XnorGate.prototype.rx, XnorGate.prototype.ry);
	XnorGate.prototype.poweredByDefault = true;
	XnorGate.prototype.editablePower = true;
	XnorGate.prototype.canInput = true;
	XnorGate.prototype.canOutput = true;
	LOGIC_ELEMENTS[XnorGate.name] = XnorGate;


	class Monostable extends LogicElement {
		constructor(data) {
			super(data);
			
			//load the value from parsed data if present, otherwise uses defaults
			if(data && typeof data.edge !== "undefined") {
				this.edge = data.edge;
			}
			else this.edge = "rising";
			
			//if the element was receiving power in the last update
			this.receivingPowerBefore = false;
		}
		
		Reset() {
			super.Reset();
			this.receivingPowerBefore = false;
		}
		
		Edit() {
			//cycles between modes
			if(this.edge==="rising") this.edge = "falling";
			else if(this.edge==="falling") this.edge = "dual";
			else this.edge = "rising";
			return true;
		}
		
		Update() {
			const receivingPower = this._IsReceivingPower();
			let shouldBePowered = false;
			if(this.edge === "rising" || this.edge === "dual") {
				if(receivingPower && !this.receivingPowerBefore) shouldBePowered = true;
			}
			if(this.edge === "falling" || this.edge === "dual") {
				if(!receivingPower && this.receivingPowerBefore) shouldBePowered = true;
			}
			this.receivingPowerBefore = receivingPower;
			if(shouldBePowered!==this.powered) {
				this.poweredStateChanged = true;
				if(shouldBePowered) return 3; //schedule update for outputs and self
				else return 2; //schedule update for outputs
			}
			else if(shouldBePowered) return 1; //schedule self
			return 0; //schedule nothing
		}
		
		_DrawBody(ctx) {
			const ow = CONFIG.elemOutlineWidth;
			const x = this.left+ow/2;
			const y = this.top+ow/2;
			const w = this.rx*2-ow;
			const h = this.ry*2-ow;
			
			//draw rectangle body
			ctx.rect(x, y, w, h);
			ctx.fill();
			ctx.stroke();
			
			//draws lines showing what mode the element is in
			ctx.beginPath();
			if(this.edge==="rising" || this.edge==="dual") {
				ctx.moveTo(x, y+h-ow*2);
				ctx.lineTo(x+w, y+h-ow*2);
			}
			if(this.edge==="falling" || this.edge==="dual") {
				ctx.moveTo(x, y+ow*2);
				ctx.lineTo(x+w, y+ow*2);
			}
			ctx.stroke();
		}
		
		GetDebugText(index, scheduledForUpdate) {
			return `${super.GetDebugText(index, scheduledForUpdate)}
receivingPowerBefore: ${this.receivingPowerBefore}
edge: ${this.edge}`;
		}
		
		CopyPropertiesFrom(otherElem) {
			if(super.CopyPropertiesFrom(otherElem)) {
				this.edge = otherElem.edge;
				return true;
			}
			return false;
		}
		
		Serialize() {
			const data = super.Serialize();
			data.edge = this.edge;
			return data;
		}
	}
	Monostable.prototype.fullName = "Monostable circuit";
	Monostable.prototype.labelText = "MONOSTABLE";
	Monostable.prototype.rx = 120/2;
	Monostable.prototype.ry = 40/2;
	Monostable.prototype.r = Math.max(Monostable.prototype.rx, Monostable.prototype.ry);
	Monostable.prototype.canInput = true;
	Monostable.prototype.canOutput = true;
	LOGIC_ELEMENTS[Monostable.name] = Monostable;


	class Delay extends LogicElement {
		static lastDelayOnCreation = 5; //this will be modified by every newly placed element, to be used while creating another one
		
		constructor(data) {
			super(data);
			
			//load the value from parsed data if present, otherwise gives a prompt to enter the value
			if(data && typeof data.delay !== "undefined") {
				this.delay = data.delay;
			}
			else {
				//gives an edit prompt to enter the value. element creation fails if invalid value is entered
				this.delay = this.constructor.lastDelayOnCreation;
				if(this.Edit()===null) throw "Invalid delay set for Delay element!";
				this.constructor.lastDelayOnCreation = this.delay;
			}
			
			//delay is the amount of ticks it takes for power to propagate through this element. minimum = 1, which makes it work like any other element without delay
			//remainingDelay is a countdown from this.delay down to 1
			this.remainingDelay = this.delay;
		}
		
		Update() {
			const receivingPower = this._IsReceivingPower();
			let shouldBePowered = this.powered; //initial value
			
			//no countdown while still powered
			if(receivingPower && this.powered) this.remainingDelay = this.delay;
			//do countdown if losing power or gaining power
			else if((!receivingPower && this.powered) || ((receivingPower || this.remainingDelay<this.delay) && !this.powered)) {
				this.remainingDelay--;
				if(this.remainingDelay<=0) {
					//reached end of the countdown
					this.remainingDelay = this.delay;
					shouldBePowered = !this.powered;
				}
			}
			
			if(shouldBePowered!==this.powered) {
				this.poweredStateChanged = true;
				if(shouldBePowered) return 3; //schedule update for outputs and self
				else return 2; //schedule update for outputs
			}
			else {
				if(this.remainingDelay<this.delay) return 1; //schedule self
				else return 0; //schedule nothing
			}
		}
		
		Reset() {
			super.Reset();
			this.remainingDelay = this.delay;
		}
		
		Edit() {
			//prompt the user for a new delay
			let newDelay = parseInt(prompt("Set delay: (ticks)", this.delay), 10);
			
			//validate the delay
			if(!UTILS.IsValidNum(newDelay)) return null;
			newDelay = UTILS.ClampNum(newDelay, 1, Number.MAX_SAFE_INTEGER);
			if(newDelay===this.delay) return false;
			
			//set the new delay
			this.delay = newDelay;
			this.remainingDelay = this.delay;
			return true;
		}
		
		_DrawBody(ctx) {
			//sketch oval shape
			const ow = CONFIG.elemOutlineWidth;
			const ow2 = ow/2;
			const rx = this.rx-this.ry;
			const ry = this.ry - ow2;
			ctx.moveTo(this.pos.x-rx, this.pos.y-ry);
			ctx.lineTo(this.pos.x+rx, this.pos.y-ry);
			ctx.arc(this.pos.x+rx, this.pos.y, ry, -0.5*Math.PI, 0.5*Math.PI, false);
			ctx.lineTo(this.pos.x-rx, this.pos.y+ry);
			ctx.arc(this.pos.x-rx, this.pos.y, ry, 0.5*Math.PI, -0.5*Math.PI, false);
			ctx.closePath();
			
			ctx.fill();
			
			//draw delay progress bar
			if(UTILS.IsValidNum(this.delay) && this.delay>1 && this.remainingDelay<this.delay) {
				//create a clipping area of the oval
				ctx.save();
				ctx.clip();
				
				//draw progress bar
				ctx.beginPath();
				ctx.fillStyle = (this.powered?CONFIG.elemUnpowered:CONFIG.elemPowered).fillColor;
				ctx.rect(this.left+ow, this.top+ow, (this.rx-ow)*2*((this.delay-this.remainingDelay)/this.delay), (this.ry-ow)*2);
				ctx.fill();
				
				//remove clipping area
				ctx.restore();
				
				//sketch the original oval again
				ctx.beginPath();
				ctx.moveTo(this.pos.x-rx, this.pos.y-ry);
				ctx.lineTo(this.pos.x+rx, this.pos.y-ry);
				ctx.arc(this.pos.x+rx, this.pos.y, ry, -0.5*Math.PI, 0.5*Math.PI, false);
				ctx.lineTo(this.pos.x-rx, this.pos.y+ry);
				ctx.arc(this.pos.x-rx, this.pos.y, ry, 0.5*Math.PI, -0.5*Math.PI, false);
				ctx.closePath();
			}
			
			ctx.stroke();
		}
		
		//method to be overriden by elements which display different values instead of the default label
		GetCurrentLabelText() {
			return this.remainingDelay;
		}
		
		GetDebugText(index, scheduledForUpdate) {
			return `${super.GetDebugText(index, scheduledForUpdate)}
delay: ${this.delay}, remaining: ${this.remainingDelay}`;
		}
		
		IsPointWithin(point) {
			const rectHalfWidth = this.rx-this.ry;
			return UTILS.IsPointWithinCircle(point, {x:this.pos.x-rectHalfWidth, y:this.pos.y}, this.ry) || UTILS.IsPointWithinCircle(point, {x:this.pos.x+rectHalfWidth, y:this.pos.y}, this.ry) || UTILS.IsPointWithinRect(point, this.pos, rectHalfWidth, this.ry);
		}
		
		CopyPropertiesFrom(otherElem) {
			if(super.CopyPropertiesFrom(otherElem)) {
				this.delay = otherElem.delay;
				this.remainingDelay = otherElem.remainingDelay;
				return true;
			}
			return false;
		}
		
		Serialize() {
			const data = super.Serialize();
			data.delay = this.delay;
			return data;
		}
	}
	Delay.prototype.fullName = "Delay";
	Delay.prototype.labelText = "DELAY";
	Delay.prototype.rx = 80/2;
	Delay.prototype.ry = 40/2;
	Delay.prototype.r = Math.max(Delay.prototype.rx, Delay.prototype.ry);
	Delay.prototype.canInput = true;
	Delay.prototype.canOutput = true;
	LOGIC_ELEMENTS[Delay.name] = Delay;


	class TFlipFlop extends LogicElement {
		constructor(data) {
			super(data);
			
			this.fired = false; //tracks whether the element has already been toggled by the current powering, done so it triggers only on the rising edge and not every tick
		}
		
		Reset() {
			super.Reset();
			this.fired = false;
		}
		
		Update() {
			const receivingPower = this._IsReceivingPower();
			//toggle power when new power is received
			if(receivingPower!==this.fired) {
				this.fired = receivingPower;
				this.poweredStateChanged = receivingPower;
				return 2; //schedule update for outputs
			}
			return 0; //schedule nothing
		}
		
		GetDebugText(index, scheduledForUpdate) {
			return `${super.GetDebugText(index, scheduledForUpdate)}
fired: ${this.fired}`;
		}
	}
	TFlipFlop.prototype.fullName = "Toggle Flip-Flop";
	TFlipFlop.prototype.labelText = "TOGGLE";
	TFlipFlop.prototype.rx = 80/2;
	TFlipFlop.prototype.ry = 80/2;
	TFlipFlop.prototype.r = Math.max(TFlipFlop.prototype.rx, TFlipFlop.prototype.ry);
	TFlipFlop.prototype.poweredByDefault = false;
	TFlipFlop.prototype.editablePower = true;
	TFlipFlop.prototype.canInput = true;
	TFlipFlop.prototype.canOutput = true;
	LOGIC_ELEMENTS[TFlipFlop.name] = TFlipFlop;


	class Clock extends LogicElement {
		static lastDelayOnCreation = 5; //this will be modified by every newly placed element, to be used while creating another one
		
		constructor(data) {
			super(data);
			
			//load the value from parsed data if present, otherwise gives a prompt to enter the value
			if(data && typeof data.delay !== "undefined") {
				this.delay = data.delay;
			}
			else {
				//gives an edit prompt to enter the value. element creation fails if invalid value is entered
				this.delay = this.constructor.lastDelayOnCreation;
				if(this.Edit()===null) throw "Invalid delay set for Clock element!";
				this.constructor.lastDelayOnCreation = this.delay;
			}
			
			this.beginPowered = this.delay===0;
			this.powered = this.beginPowered;
			this.remainingDelay = this.delay;
		}
		
		Edit() {
			//prompt the user for a new delay
			let newDelay = parseInt(prompt("Set clock period: (ticks)", this.delay), 10);
			
			//validate the delay
			if(!UTILS.IsValidNum(newDelay)) return null;
			newDelay = UTILS.ClampNum(newDelay, 0, Number.MAX_SAFE_INTEGER);
			if(newDelay===this.delay) return false;
			
			//set the new delay
			this.delay = newDelay;
			this.remainingDelay = this.delay;
			this.beginPowered = this.delay===0;
			this.powered = this.beginPowered;
			return true;
		}
		
		Reset() {
			super.Reset();
			this.remainingDelay = this.delay;
		}
		
		Update() {
			const receivingPower = this._IsReceivingPower();
			let shouldBePowered = this.powered;
			
			//immediately reset the countdown
			if(receivingPower) {
				shouldBePowered = false;
				this.remainingDelay = this.delay;
			}
			else { //otherwise perform the countdown
				this.remainingDelay--;
				if(this.remainingDelay<0) this.remainingDelay = this.delay;
				shouldBePowered = this.remainingDelay===0;
			}
			
			if(shouldBePowered!==this.powered) {
				this.poweredStateChanged = true;
				if(shouldBePowered) {
					if(this.delay===0) return 2; //schedule update for outputs
					else return 3; //schedule update for outputs and self
				}
				else {
					if(receivingPower) return 2; //schedule update for outputs
					else return 3; //schedule update for outputs and self
				}
			}
			else {
				if(!shouldBePowered && !receivingPower) return 1; //schedule self
				else return 0; //schedule nothing
			}
		}
		
		_DrawBody(ctx) {
			//draw circle
			ctx.arc(this.pos.x, this.pos.y, this.r-CONFIG.elemOutlineWidth/2, 0, 2*Math.PI, false);
			ctx.fill();
			
			//draw clock countdown
			if(!this.powered && UTILS.IsValidNum(this.delay) && this.delay>0 && this.remainingDelay<this.delay) {
				ctx.fillStyle = CONFIG.elemPowered.fillColor;
				ctx.beginPath();
				ctx.arc(this.pos.x, this.pos.y, this.r-CONFIG.elemOutlineWidth/2, -0.5*Math.PI, ((this.delay-this.remainingDelay)/this.delay)*(2*Math.PI)-0.5*Math.PI, false);
				ctx.lineTo(this.pos.x, this.pos.y);
				ctx.closePath();
				ctx.fill();
				
				//sketch the full circle again for the outline drawn later
				ctx.beginPath();
				ctx.arc(this.pos.x, this.pos.y, this.r-CONFIG.elemOutlineWidth/2, 0, 2*Math.PI, false);
			}
			
			ctx.stroke();
		}
		
		GetCurrentLabelText() {
			return this.remainingDelay;
		}
		
		GetDebugText(index, scheduledForUpdate) {
			return `${super.GetDebugText(index, scheduledForUpdate)}
delay: ${this.delay}, remaining: ${this.remainingDelay}`;
		}
		
		IsPointWithin(point) {
			return UTILS.IsPointWithinCircle(point, this.pos, this.r);
		}
		
		CopyPropertiesFrom(otherElem) {
			if(super.CopyPropertiesFrom(otherElem)) {
				this.delay = otherElem.delay;
				this.remainingDelay = otherElem.remainingDelay;
				return true;
			}
			return false;
		}
		
		Serialize() {
			const data = super.Serialize();
			data.delay = this.delay;
			return data;
		}
	}
	Clock.prototype.fullName = "Clock Pulser";
	Clock.prototype.labelText = "CLOCK";
	Clock.prototype.r = 40;
	Clock.prototype.rx = Clock.prototype.r;
	Clock.prototype.ry = Clock.prototype.r;
	Clock.prototype.canInput = true;
	Clock.prototype.canOutput = true;
	LOGIC_ELEMENTS[Clock.name] = Clock;


	class Randomizer extends LogicElement {
		constructor(data) {
			super(data);
			this.fired = false; //if the lement has already been triggered by the power being received
		}
		
		Reset() {
			super.Reset();
			this.fired = false;
		}
		
		Update() {
			const receivingPower = this._IsReceivingPower();
			let shouldBePowered = this.powered;
			if(receivingPower && !this.fired) {
				this.fired = true;
				//50/50 chance to trigger or not trigger
				shouldBePowered = Math.random()>=0.5;
			}
			else if(!receivingPower) {
				this.fired = false;
				shouldBePowered = false;
			}
			if(shouldBePowered!==this.powered) {
				this.poweredStateChanged = true;
				return 2; //schedule update for outputs
			}
			return 0; //schedule nothing
		}
		
		_DrawBody(ctx) {
			//draw axis aligned rhombus
			const ow2 = CONFIG.elemOutlineWidth/2;
			const rx = this.rx-ow2;
			const ry = this.ry-ow2;
			ctx.moveTo(this.pos.x-rx, this.pos.y);
			ctx.lineTo(this.pos.x, this.pos.y-ry);
			ctx.lineTo(this.pos.x+rx, this.pos.y);
			ctx.lineTo(this.pos.x, this.pos.y+ry);
			ctx.closePath();
			ctx.fill();
			ctx.stroke();
		}
		
		GetDebugText(index, scheduledForUpdate) {
			return `${super.GetDebugText(index, scheduledForUpdate)}
fired: ${this.fired}`;
		}
		
		IsPointWithin(point) {
			//point inside axis aligned rhombus
			const x = Math.abs(point.x-this.pos.x)/this.rx;
			const y = Math.abs(point.y-this.pos.y)/this.ry;
			return x+y <= 1;
		}
	}
	Randomizer.prototype.fullName = "Randomizer";
	Randomizer.prototype.labelText = "RANDOM";
	Randomizer.prototype.rx = 120/2;
	Randomizer.prototype.ry = 80/2;
	Randomizer.prototype.r = Math.max(Randomizer.prototype.rx, Randomizer.prototype.ry);
	Randomizer.prototype.canInput = true;
	Randomizer.prototype.canOutput = true;
	LOGIC_ELEMENTS[Randomizer.name] = Randomizer;


	class Label extends LogicElement {
		constructor(data) {
			super(data);
			
			//load the value from parsed data if present, otherwise gives a prompt to enter the value
			if(data && typeof data.text !== "undefined") {
				if(data instanceof LogicElement) this.text = data.text;
				else this.text = decodeURIComponent(data.text);
			}
			else {
				//gives an edit prompt to enter the value. element creation fails if invalid value is entered
				this.text = "Label";
				if(this.Edit()===null) throw "Invalid label text!";
			}
			
			//measures the text width and saves it
			this._PrepareDraw(document.createElement("canvas").getContext("2d")); 
		}
		
		Edit() {
			//prompt the user for a new label text
			const newText = prompt("Enter label text:", this.text);
			
			//validate the text
			if(!newText) return null;
			if(newText===this.text) return false;
			
			//set the new text
			this.text = newText;
			return true;
		}
		
		_PrepareDraw(ctx) {
			ctx.font = ((this.ry-this.padding)*2)+"px "+CONFIG.elemLabelFont;
			ctx.textAlign="center";
			ctx.textBaseline="middle";
			ctx.fillStyle = CONFIG.elemUnpowered.fillColor;
			ctx.beginPath();
			this.rx = ctx.measureText(this.GetCurrentLabelText()).width/2 + this.padding;
		}
		
		_DrawLabel(ctx) {
			//draw the label text
			ctx.fillStyle = "rgba(0, 0, 0, 1)";
			ctx.beginPath();
			ctx.fillText(this.GetCurrentLabelText(), this.pos.x, this.pos.y);
		}
		
		_DrawBody(ctx) {
			//draw the transparent background
			ctx.rect(this.left, this.top, this.rx*2, this.ry*2);
			const ga = ctx.globalAlpha;
			ctx.globalAlpha = 0.5;
			ctx.fill();
			ctx.globalAlpha = ga;
		}
		
		GetCurrentLabelText() {
			return this.text;
		}
		
		GetDebugText(index, scheduledForUpdate) {
			return `${super.GetDebugText(index, scheduledForUpdate)}
textLength: ${this.text.length}`;
		}
		
		CopyPropertiesFrom(otherElem) {
			if(super.CopyPropertiesFrom(otherElem)) {
				this.text = otherElem.text;
				return true;
			}
			return false;
		}
		
		Serialize() {
			const data = super.Serialize();
			data.text = encodeURIComponent(this.text);
			return data;
		}
		
		get r() {
			return Math.max(this.ry, this.ry);
		}
	}
	Label.prototype.fullName = "Label";
	Label.prototype.labelText = "Label";
	Label.prototype.ry = 40/2; //label font size = ry-padding
	Label.prototype.padding = 5; //included in ry
	Label.prototype.canInput = false;
	Label.prototype.canOutput = false;
	LOGIC_ELEMENTS[Label.name] = Label;
})();