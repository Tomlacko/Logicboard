"use strict";

const GLOBAL_VISUALS = {
	elemOutlineWidth:2,
	elemLabelSize:16,
	elemLabelFont:"Arial",
	connectionLineWidth:4,
	elemUnpowered: {
		fillColor:"rgba(200, 200, 200, 1)",
		outlineColor:"rgba(0, 0, 0, 1)",
		labelColor:"rgba(128, 128, 128, 1)"
	},
	elemPowered: {
		fillColor:"rgba(255, 0, 0, 1)",
		outlineColor:"rgba(0, 0, 0, 1)",
		labelColor:"rgba(128, 128, 128, 1)"
	},
	connectionUnpowered: {
		start:"rgba(0, 0, 0, 1)",
		end:"rgba(180, 180, 180, 1)"
	},
	connectionPowered: {
		start:"rgba(255, 0, 0, 1)",
		end:"rgba(255, 180, 180, 1)"
	}
};


//////////////////////////////////////////////////
//LOGIC ELEMENTS/////////////////////////////////

const LogicElementTypes = {};

//abstract base class template
class LogicElement {
	constructor(data) {
		this.pos = {x:data.x, y:data.y};
		this.id = data.id;
		this.poweredStateChanged = false; //marked true during a step if the power should change at the end of that step. prevents inconsistent power during a step
		this.powered = this.poweredByDefault;
		this.beginPowered = this.poweredByDefault;
		this.inputs = new Set();
		this.outputs = new Set();
	}
	
	//resets the values to what they were before the simulation started (returns to edit mode)
	Reset() {
		this.powered = this.beginPowered;
		this.poweredStateChanged = false;
	}
	
	//ran every step, evaluates if the element should be powered or not and returns a flag saying which elements need to be updated in the next step
	Update() {return 0;}
	
	//checks if any of the input elements are sending power to this one
	_IsReceivingPower() {
		for(let input of this.inputs) {
			if(input.powered) {
				return true;
				break;
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
		return false;
	}
	
	//runs when element is clicked on while the simulation is running
	ClickStart() {return 0;}
	ClickEnd() {return 0;}
	ClickFull() {return 0;}
	
	//configures the canvas with the properties specific to this element
	_PrepareDraw(ctx) {
		ctx.lineWidth = GLOBAL_VISUALS.elemOutlineWidth;
		ctx.font = GLOBAL_VISUALS.elemLabelSize+"px "+GLOBAL_VISUALS.elemLabelFont;
		ctx.textAlign="center";
		ctx.textBaseline="middle";
		const style = this.powered?GLOBAL_VISUALS.elemPowered:GLOBAL_VISUALS.elemUnpowered;
		ctx.fillStyle = style.fillColor;
		ctx.strokeStyle = style.outlineColor;
		ctx.beginPath();
	}
	
	//draws the element's label
	_DrawLabel(ctx, labelText) {
		const style = this.powered?GLOBAL_VISUALS.elemPowered:GLOBAL_VISUALS.elemUnpowered;
		ctx.fillStyle = style.labelColor;
		ctx.beginPath();
		ctx.fillText(labelText, this.pos.x, this.pos.y);
	}
	
	//main draw function that draws this element onto a given canvas
	Draw(ctx) {//template for rectangular element
		this._PrepareDraw(ctx);
		const outlineW = GLOBAL_VISUALS.elemOutlineWidth;
		const x = this.pos.x-(this.rx-outlineW/2);
		const y = this.pos.y-(this.ry-outlineW/2);
		const w = this.rx*2-outlineW;
		const h = this.ry*2-outlineW;
		ctx.rect(x, y, w, h);
		ctx.fill();
		ctx.stroke();
		this._DrawLabel(ctx, this.labelText);
	}
	
	//checks if a given point is within the boundary
	IsPointWithin(point) {
		//template for rectangular element
		return IsPointWithinRect(point, this.pos, this.rx, this.ry);
	}
	
	//returns specific portions of the element's bounding box
	get top() {return this.pos.y-this.ry;}
	get bottom() {return this.pos.y+this.ry;}
	get left() {return this.pos.x-this.rx;}
	get right() {return this.pos.x+this.rx;}
	
	//packages all the necessary values descibing this element into one saveable object
	Serialize() {
		const data = {
			elemType:this.constructor.name,
			id:this.id,
			x:this.pos.x,
			y:this.pos.y
		};
		if(this.inputs.size>0) data.inputs = Array.from(this.inputs).map(elem => elem.id);
		if(this.outputs.size>0) data.outputs = Array.from(this.outputs).map(elem => elem.id);
		return data;
	}
}
//constant static fields
LogicElement.prototype.fullName = "";
LogicElement.prototype.labelText = "";
LogicElement.prototype.rx = 0;
LogicElement.prototype.ry = 0;
LogicElement.prototype.r = 0;
LogicElement.prototype.poweredByDefault = false; //the default power state of the element upon creation
LogicElement.prototype.canInput = false; //if connections going to this element can be made (=if it accepts input)
LogicElement.prototype.canOutput = false; //if connections going out of this element can be made (=if it's able to output)


/////


class ButtonInput extends LogicElement {
	Draw(ctx) {
		this._PrepareDraw(ctx);
		//draw circle
		ctx.arc(this.pos.x, this.pos.y, this.r-GLOBAL_VISUALS.elemOutlineWidth/2, 0, 2*Math.PI, false);
		ctx.fill();
		ctx.stroke();
		this._DrawLabel(ctx, this.labelText);
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
		return IsPointWithinCircle(point, this.pos, this.r);
	}
}
ButtonInput.prototype.fullName = "Input - Pushable Button";
ButtonInput.prototype.labelText = "Button";
ButtonInput.prototype.r = 30;
ButtonInput.prototype.rx = ButtonInput.prototype.r;
ButtonInput.prototype.ry = ButtonInput.prototype.r;
ButtonInput.prototype.canInput = false;
ButtonInput.prototype.canOutput = true;
LogicElementTypes[ButtonInput.name] = ButtonInput;


class SwitchInput extends LogicElement {
	Draw(ctx) {
		this._PrepareDraw(ctx);
		//draw circle
		ctx.arc(this.pos.x, this.pos.y, this.r-GLOBAL_VISUALS.elemOutlineWidth/2, 0, 2*Math.PI, false);
		ctx.fill();
		ctx.stroke();
		this._DrawLabel(ctx, this.labelText);
	}
	
	ClickFull() {
		this.powered = !this.powered;
		return 2; //update outputs only
	}
	
	IsPointWithin(point) {
		return IsPointWithinCircle(point, this.pos, this.r);
	}
}
SwitchInput.prototype.fullName = "Input - Toggleable Switch";
SwitchInput.prototype.labelText = "Switch";
SwitchInput.prototype.r = 30;
SwitchInput.prototype.rx = SwitchInput.prototype.r;
SwitchInput.prototype.ry = SwitchInput.prototype.r;
SwitchInput.prototype.canInput = false;
SwitchInput.prototype.canOutput = true;
LogicElementTypes[SwitchInput.name] = SwitchInput;


class OutputBulb extends LogicElement {
	Update() {
		this.poweredStateChanged = this._IsReceivingPower()!==this.powered;
		return 0; //schedule nothing
	}
	
	Draw(ctx) {
		this._PrepareDraw(ctx);
		//draw circle
		ctx.arc(this.pos.x, this.pos.y, this.r-GLOBAL_VISUALS.elemOutlineWidth/2, 0, 2*Math.PI, false);
		ctx.fill();
		ctx.stroke();
		this._DrawLabel(ctx, this.labelText);
	}
	
	IsPointWithin(point) {
		return IsPointWithinCircle(point, this.pos, this.r);
	}
}
OutputBulb.prototype.fullName = "Output Bulb";
OutputBulb.prototype.labelText = "💡"; //light bulb
OutputBulb.prototype.r = 20;
OutputBulb.prototype.rx = OutputBulb.prototype.r;
OutputBulb.prototype.ry = OutputBulb.prototype.r;
OutputBulb.prototype.canInput = true;
OutputBulb.prototype.canOutput = false;
LogicElementTypes[OutputBulb.name] = OutputBulb;


class OutputTile extends LogicElement {
	Update() {
		this.poweredStateChanged = this._IsReceivingPower()!==this.powered;
		return 0; //schedule nothing
	}
	
	Draw(ctx) {
		this._PrepareDraw(ctx);
		const x = this.pos.x-this.rx-0.5;
		const y = this.pos.y-this.ry-0.5;
		const w = this.rx*2+1;
		const h = this.ry*2+1;
		ctx.rect(x, y, w, h);
		ctx.fill();
		this._DrawLabel(ctx, this.labelText);
	}
}
OutputTile.prototype.fullName = "Output Tile";
OutputTile.prototype.labelText = "";
OutputTile.prototype.rx = 40/2;
OutputTile.prototype.ry = 40/2;
OutputTile.prototype.r = Math.max(OutputTile.prototype.rx, OutputTile.prototype.ry);
OutputTile.prototype.canInput = true;
OutputTile.prototype.canOutput = false;
LogicElementTypes[OutputTile.name] = OutputTile;


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
OrGate.prototype.canInput = true;
OrGate.prototype.canOutput = true;
LogicElementTypes[OrGate.name] = OrGate;


class NotGate extends LogicElement {
	constructor(data) {
		super(data);
		//load the value from parsed data if present, otherwise uses defaults
		if(typeof data.beginPowered === "boolean") {
			this.powered = data.beginPowered;
			this.beginPowered = data.beginPowered;
		}
	}
	
	Update() {
		if(this._IsReceivingPower()===this.powered) {
			this.poweredStateChanged = true;
			return 2; //schedule update for outputs
		}
		return 0; //schedule nothing
	}
	
	Edit() {
		//toggle the default power value on edit
		const p = !this.beginPowered;
		this.beginPowered = p;
		this.powered = p;
		return true;
	}
	
	Draw(ctx) {
		this._PrepareDraw(ctx);
		//draw circle
		ctx.arc(this.pos.x, this.pos.y, this.r-GLOBAL_VISUALS.elemOutlineWidth/2, 0, 2*Math.PI, false);
		ctx.fill();
		ctx.stroke();
		this._DrawLabel(ctx, this.labelText);
	}
	
	IsPointWithin(point) {
		return IsPointWithinCircle(point, this.pos, this.r);
	}
	
	Serialize() {
		const data = super.Serialize();
		data.beginPowered = this.beginPowered;
		return data;
	}
}
NotGate.prototype.fullName = "NOT Gate";
NotGate.prototype.labelText = "NOT";
NotGate.prototype.r = 20;
NotGate.prototype.rx = NotGate.prototype.r;
NotGate.prototype.ry = NotGate.prototype.r;
NotGate.prototype.poweredByDefault = true;
NotGate.prototype.canInput = true;
NotGate.prototype.canOutput = true;
LogicElementTypes[NotGate.name] = NotGate;


class AndGate extends LogicElement {
	Update() {
		//check if all the inputs are providing power
		let receivingAllPower = false;
		if(this.inputs.size>0) {
			receivingAllPower = true;
			for(let input of this.inputs) {
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
AndGate.prototype.canInput = true;
AndGate.prototype.canOutput = true;
LogicElementTypes[AndGate.name] = AndGate;


class NandGate extends LogicElement {
	constructor(data) {
		super(data);
		//load the value from parsed data if present, otherwise uses defaults
		if(typeof data.beginPowered === "boolean") {
			this.powered = data.beginPowered;
			this.beginPowered = data.beginPowered;
		}
	}
	
	Update() {
		//check if all the inputs are providing power
		let receivingAllPower = false;
		if(this.inputs.size>0) {
			receivingAllPower = true;
			for(let input of this.inputs) {
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
	
	Edit() {
		//toggle the default power value on edit
		const p = !this.beginPowered;
		this.beginPowered = p;
		this.powered = p;
		return true;
	}
	
	Serialize() {
		const data = super.Serialize();
		data.beginPowered = this.beginPowered;
		return data;
	}
}
NandGate.prototype.fullName = "NAND Gate";
NandGate.prototype.labelText = "NAND";
NandGate.prototype.rx = 60/2;
NandGate.prototype.ry = 40/2;
NandGate.prototype.r = Math.max(NandGate.prototype.rx, NandGate.prototype.ry);
NandGate.prototype.poweredByDefault = true;
NandGate.prototype.canInput = true;
NandGate.prototype.canOutput = true;
LogicElementTypes[NandGate.name] = NandGate;


class XorGate extends LogicElement {
	Update() {
		//checks if the amount of inputs powering this element is odd
		let shouldBePowered = false;
		for(let input of this.inputs) {
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
XorGate.prototype.canInput = true;
XorGate.prototype.canOutput = true;
LogicElementTypes[XorGate.name] = XorGate;


class XnorGate extends LogicElement {
	constructor(data) {
		super(data);
		//load the value from parsed data if present, otherwise uses defaults
		if(typeof data.beginPowered === "boolean") {
			this.powered = data.beginPowered;
			this.beginPowered = data.beginPowered;
		}
	}
	
	Update() {
		//checks if the amount of inputs powering this element is even
		let shouldBePowered = true;
		for(let input of this.inputs) {
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
	
	Edit() {
		//toggle the default power value on edit
		const p = !this.beginPowered;
		this.beginPowered = p;
		this.powered = p;
		return true;
	}
	
	Serialize() {
		const data = super.Serialize();
		data.beginPowered = this.beginPowered;
		return data;
	}
}
XnorGate.prototype.fullName = "XNOR Gate";
XnorGate.prototype.labelText = "XNOR";
XnorGate.prototype.rx = 60/2;
XnorGate.prototype.ry = 40/2;
XnorGate.prototype.r = Math.max(XnorGate.prototype.rx, XnorGate.prototype.ry);
XnorGate.prototype.poweredByDefault = true;
XnorGate.prototype.canInput = true;
XnorGate.prototype.canOutput = true;
LogicElementTypes[XnorGate.name] = XnorGate;


class Monostable extends LogicElement {
	constructor(data) {
		super(data)
		this.receivingPowerBefore = false;
		//load the value from parsed data if present, otherwise uses defaults
		if(typeof data.edge !== "undefined") {
			this.edge = data.edge;
		}
		else this.edge = "rising";
	}
	
	Reset() {
		super.Reset();
		this.receivingPowerBefore = false;
	}
	
	Edit() {
		//cycles between modes
		if(this.edge==="rising") this.edge = "falling";
		else if(this.edge==="falling") this.edge = "both";
		else this.edge = "rising";
		return true;
	}
	
	Draw(ctx) {
		this._PrepareDraw(ctx);
		const outlineW = GLOBAL_VISUALS.elemOutlineWidth;
		const x = this.pos.x-(this.rx-outlineW/2);
		const y = this.pos.y-(this.ry-outlineW/2);
		const w = this.rx*2-outlineW;
		const h = this.ry*2-outlineW;
		ctx.rect(x, y, w, h);
		ctx.fill();
		ctx.stroke();
		ctx.beginPath();
		//draws lines showing what mode the element is in
		if(this.edge==="rising" || this.edge==="both") {
			ctx.moveTo(x, y+h-outlineW*2);
			ctx.lineTo(x+w, y+h-outlineW*2);
		}
		if(this.edge==="falling" || this.edge==="both") {
			ctx.moveTo(x, y+outlineW*2);
			ctx.lineTo(x+w, y+outlineW*2);
		}
		ctx.stroke();
		this._DrawLabel(ctx, this.labelText);
	}
	
	Update() {
		const receivingPower = this._IsReceivingPower();
		let shouldBePowered = false;
		if(this.edge === "rising" || this.edge === "both") {
			if(receivingPower && !this.receivingPowerBefore) shouldBePowered = true;
		}
		if(this.edge === "falling" || this.edge === "both") {
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
LogicElementTypes[Monostable.name] = Monostable;


class DelayElem extends LogicElement {
	constructor(data) {
		super(data);
		//load the value from parsed data if present, otherwise gives a prompt to enter the value
		if(typeof data.delay !== "undefined") {
			this.delay = data.delay;
		}
		else {
			//gives an edit prompt to enter the value. element creation fails if invalid value is entered
			this.delay = 5;
			if(!this.Edit()) throw "Invalid delay!";
		}
		this.remainingDelay = this.delay;
	}
	
	Update() {
		const receivingPower = this._IsReceivingPower();
		let shouldBePowered = this.powered; //initial value
		
		//reset countdown
		if(receivingPower && this.powered) this.remainingDelay = this.delay;
		//do countdown
		else if((!receivingPower && this.powered) || ((receivingPower || this.remainingDelay<this.delay) && !this.powered)) {
			this.remainingDelay--;
			if(this.remainingDelay<0) {
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
		const newDelay = parseInt(prompt("Edit delay:", this.delay), 10);
		if(!IsValidNum(newDelay)) return false;
		this.delay = ClampNum(newDelay, 0, Number.MAX_SAFE_INTEGER);
		this.remainingDelay = this.delay;
		return true;
	}
	
	Draw(ctx) {
		this._PrepareDraw(ctx);
		const rx = this.rx-this.ry;
		const ry = this.ry - GLOBAL_VISUALS.elemOutlineWidth/2;
		//draw oval shape
		ctx.moveTo(this.pos.x-rx, this.pos.y-ry);
		ctx.lineTo(this.pos.x+rx, this.pos.y-ry);
		ctx.arc(this.pos.x+rx, this.pos.y, ry, -0.5*Math.PI, 0.5*Math.PI);
		ctx.lineTo(this.pos.x-rx, this.pos.y+ry);
		ctx.arc(this.pos.x-rx, this.pos.y, ry, 0.5*Math.PI, -0.5*Math.PI);
		ctx.closePath();
		ctx.fill();
		ctx.stroke();
		this._DrawLabel(ctx, this.remainingDelay);
	}
	
	IsPointWithin(point) {
		const rectHalfWidth = this.rx-this.ry;
		return IsPointWithinCircle(point, {x:this.pos.x-rectHalfWidth, y:this.pos.y}, this.ry) || IsPointWithinCircle(point, {x:this.pos.x+rectHalfWidth, y:this.pos.y}, this.ry) || IsPointWithinRect(point, this.pos, rectHalfWidth, this.ry);
	}
	
	Serialize() {
		const data = super.Serialize();
		data.delay = this.delay;
		return data;
	}
}
DelayElem.prototype.fullName = "Delay";
DelayElem.prototype.labelText = "DELAY";
DelayElem.prototype.rx = 80/2;
DelayElem.prototype.ry = 40/2;
DelayElem.prototype.r = Math.max(DelayElem.prototype.rx, DelayElem.prototype.ry);
DelayElem.prototype.canInput = true;
DelayElem.prototype.canOutput = true;
LogicElementTypes[DelayElem.name] = DelayElem;


class TFlipFlop extends LogicElement {
	constructor(data) {
		super(data);
		//load the value from parsed data if present, otherwise uses defaults
		if(typeof data.beginPowered === "boolean") {
			this.powered = data.beginPowered;
			this.beginPowered = data.beginPowered;
		}
		this.fired = false;
	}
	
	Reset() {
		super.Reset();
		this.fired = false;
	}
	
	Edit() {
		//toggle the default power value on edit
		const p = !this.beginPowered;
		this.beginPowered = p;
		this.powered = p;
		return true;
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
	
	Serialize() {
		const data = super.Serialize();
		data.beginPowered = this.beginPowered;
		return data;
	}
}
TFlipFlop.prototype.fullName = "T Flip-Flop";
TFlipFlop.prototype.labelText = "TOGGLE";
TFlipFlop.prototype.rx = 80/2;
TFlipFlop.prototype.ry = 80/2;
TFlipFlop.prototype.r = Math.max(TFlipFlop.prototype.rx, TFlipFlop.prototype.ry);
TFlipFlop.prototype.poweredByDefault = false;
TFlipFlop.prototype.canInput = true;
TFlipFlop.prototype.canOutput = true;
LogicElementTypes[TFlipFlop.name] = TFlipFlop;


class PulserElem extends LogicElement {
	constructor(data) {
		super(data);
		//load the value from parsed data if present, otherwise gives a prompt to enter the value
		if(typeof data.delay !== "undefined") {
			this.delay = data.delay;
		}
		else {
			//gives an edit prompt to enter the value. element creation fails if invalid value is entered
			this.delay = 5;
			if(!this.Edit()) throw "Invalid delay!";
		}
		this.remainingDelay = this.delay;
	}
	
	Edit() {
		//prompt the user for a new delay
		const newDelay = parseInt(prompt("Edit clock period:", this.delay), 10);
		if(!IsValidNum(newDelay)) return false;
		this.delay = ClampNum(newDelay, 0, Number.MAX_SAFE_INTEGER);
		this.remainingDelay = this.delay;
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
	
	Draw(ctx) {
		this._PrepareDraw(ctx);
		ctx.arc(this.pos.x, this.pos.y, this.r-GLOBAL_VISUALS.elemOutlineWidth/2, 0, 2*Math.PI, false);
		ctx.fill();
		ctx.stroke();
		this._DrawLabel(ctx, this.remainingDelay);
	}
	
	IsPointWithin(point) {
		return IsPointWithinCircle(point, this.pos, this.r);
	}
	
	Serialize() {
		const data = super.Serialize();
		data.delay = this.delay;
		return data;
	}
}
PulserElem.prototype.fullName = "Clock Pulser";
PulserElem.prototype.labelText = "PULSER";
PulserElem.prototype.r = 40;
PulserElem.prototype.rx = PulserElem.prototype.r;
PulserElem.prototype.ry = PulserElem.prototype.r;
PulserElem.prototype.canInput = true;
PulserElem.prototype.canOutput = true;
LogicElementTypes[PulserElem.name] = PulserElem;


class Randomizer extends LogicElement {
	constructor(data) {
		super(data)
		this.fired = false;
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
	
	Draw(ctx) {//template for rectangular element
		this._PrepareDraw(ctx);
		const outlineW2 = GLOBAL_VISUALS.elemOutlineWidth/2;
		const rx = this.rx-outlineW2;
		const ry = this.ry-outlineW2;
		//draw rhombus
		ctx.moveTo(this.pos.x-rx, this.pos.y);
		ctx.lineTo(this.pos.x, this.pos.y-ry);
		ctx.lineTo(this.pos.x+rx, this.pos.y);
		ctx.lineTo(this.pos.x, this.pos.y+ry);
		ctx.closePath();
		ctx.fill();
		ctx.stroke();
		this._DrawLabel(ctx, this.labelText);
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
Randomizer.prototype.rx = 100/2;
Randomizer.prototype.ry = 60/2;
Randomizer.prototype.r = Math.max(Randomizer.prototype.rx, Randomizer.prototype.ry);
Randomizer.prototype.canInput = true;
Randomizer.prototype.canOutput = true;
LogicElementTypes[Randomizer.name] = Randomizer;


class LabelElem extends LogicElement {
	constructor(data) {
		super(data);
		//load the value from parsed data if present, otherwise gives a prompt to enter the value
		if(typeof data.text !== "undefined") {
			this.text = decodeURIComponent(data.text);
		}
		else {
			//gives an edit prompt to enter the value. element creation fails if invalid value is entered
			this.text = "Label";
			if(!this.Edit()) throw "Invalid label text!";
		}
		
		this._PrepareDraw(document.createElement("canvas").getContext("2d")); //get rx
	}
	
	Edit() {
		//prompt the user for a new label text
		const newText = prompt("Enter label text:", this.text);
		if(!newText) return false;
		this.text = newText;
		return true;
	}
	
	_PrepareDraw(ctx) {
		ctx.font = ((this.ry-this.padding)*2)+"px "+GLOBAL_VISUALS.elemLabelFont;
		ctx.textAlign="center";
		ctx.textBaseline="middle";
		ctx.fillStyle = GLOBAL_VISUALS.elemUnpowered.fillColor;
		ctx.beginPath();
		this.rx = ctx.measureText(this.text).width/2 + this.padding;
	}
	
	_DrawLabel(ctx, labelText) {
		//draw the text
		ctx.fillStyle = "rgba(0, 0, 0, 1)";
		ctx.beginPath();
		ctx.fillText(labelText, this.pos.x, this.pos.y);
	}
	
	Draw(ctx) {
		this._PrepareDraw(ctx);
		const x = this.pos.x-this.rx;
		const y = this.pos.y-this.ry;
		const w = this.rx*2;
		const h = this.ry*2;
		//draw the transparent background
		ctx.rect(x, y, w, h);
		const ga = ctx.globalAlpha;
		ctx.globalAlpha = 0.5;
		ctx.fill();
		ctx.globalAlpha = ga;
		this._DrawLabel(ctx, this.text);
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
LabelElem.prototype.fullName = "Label";
LabelElem.prototype.labelText = "Label";
LabelElem.prototype.ry = 40/2; //label font size = ry-padding
LabelElem.prototype.padding = 5; //included in ry
LabelElem.prototype.canInput = false;
LabelElem.prototype.canOutput = false;
LogicElementTypes[LabelElem.name] = LabelElem;


//////////////////////////////////////////////////
//LOGIC CIRCUIT SIMULATOR////////////////////////


class Simulator {
	constructor(rawElemsData) {
		this.elems = new Set();
		this.scheduledUpdates = new Set();
		this.tick = 0;
		this._elemIdCounter = 0;
		
		//create elements from data
		if(rawElemsData) {
			this.AddElementsFromData(rawElemsData);
		}
	}
	
	//creates an element based on the type provided and adds it to the simulator
	CreateAndAddElement(elemType, data) {
		//get element class by name
		const elemClass = LogicElementTypes[elemType];
		if(!elemClass) return null;
		data.id = this._elemIdCounter++;
		
		//try to create the element
		let elem;
		try {
			elem = new elemClass(data);
		}
		catch(e) {
			return null;
		}
		
		//add the element to the simulator if successfull
		this.AddElement(elem);
		return elem;
	}
	
	//add element to the simulator
	AddElement(elem) {
		this.elems.add(elem);
	}
	
	//remove element from the simulator
	RemoveElement(elem) {
		//remove references to this element in other elements
		for(let source of elem.inputs) {
			source.outputs.delete(elem);
		}
		for(let target of elem.outputs) {
			target.inputs.delete(elem);
		}
		
		//remove
		this.elems.delete(elem);
	}
	
	//link the elements together, with power going from elem1 to elem2
	ConnectElements(elem1, elem2) {
		//cannot link element to itself
		if(elem1===elem2) return false;
		
		//check if linking is allowed
		if(!elem1.canOutput || !elem2.canInput) return false;
		
		//check if this link already exists
		if(elem1.outputs.has(elem2) && elem2.inputs.has(elem1)) return false;
		
		//link elements
		elem1.outputs.add(elem2);
		elem2.inputs.add(elem1);
		
		return true;
	}
	
	//unlinks elem1 from powering elem2
	DisconnectElements(elem1, elem2) {
		elem1.outputs.delete(elem2);
		elem2.inputs.delete(elem1);
	}
	
	//moves an element to the end of the set, making it render on top
	MoveElementToTop(elem) {
		this.elems.delete(elem);
		this.elems.add(elem);
	}
	
	//get the top-most element that overlaps the given point
	GetElementAtPos(pos) {
		const elems = Array.from(this.elems);
		for(let i = elems.length-1; i>=0; i--) {
			if(elems[i].IsPointWithin(pos)) return elems[i];
		}
		return null;
	}
	
	//get the top-most connection line that overlaps that point
	GetConnectionAtPos(pos) {
		const elems = Array.from(this.elems);
		for(let i = elems.length-1; i>=0; i--) {
			for(let elemEnd of elems[i].outputs)
			if(IsPointOnLine(pos, elems[i].pos, elemEnd.pos, GLOBAL_VISUALS.connectionLineWidth, 2))
				return {startElem:elems[i], endElem:elemEnd};
		}
		return null;
	}
	
	//step the simulation forward
	Step() {
		//schedule all elements to be updated at the start of the simulation
		if(this.tick===0) this.scheduledUpdates = this.elems;
		
		//update all scheduled updates
		const newScheduledUpdates = new Set();
		for(let elem of this.scheduledUpdates) {
			const result = elem.Update();
			//schedule update (for the next step) for self or linked elements based on the return value
			//00 = no update, 01 = update self, 10 = update outputs, 11 = update both
			if(result & 1) newScheduledUpdates.add(elem);
			if(result & 2) elem.outputs.forEach(output => newScheduledUpdates.add(output));
		}
		//finalize the update
		for(let elem of this.scheduledUpdates) {
			elem.LateUpdate();
		}
		
		this.scheduledUpdates = newScheduledUpdates;
		this.tick++;
	}
	
	//click events during simulation
	ElementClickStart(elem) {
		const result = elem.ClickStart();
		//schedule updates based on flags
		if(result & 1) this.scheduledUpdates.add(elem);
		if(result & 2) elem.outputs.forEach(output => this.scheduledUpdates.add(output));
	}
	ElementClickEnd(elem) {
		const result = elem.ClickEnd();
		//schedule updates based on flags
		if(result & 1) this.scheduledUpdates.add(elem);
		if(result & 2) elem.outputs.forEach(output => this.scheduledUpdates.add(output));
	}
	ElementClickFull(elem) {
		const result = elem.ClickFull();
		//schedule updates based on flags
		if(result & 1) this.scheduledUpdates.add(elem);
		if(result & 2) elem.outputs.forEach(output => this.scheduledUpdates.add(output));
	}
	
	//reset the simulator and its elements to the initial state
	Reset() {
		this.tick = 0;
		for(let elem of this.elems) {
			elem.Reset();
		}
	}
	
	//remove the gaps in IDs caused by elements being deleted
	MinimizeElementIDs(elemsSet, initialID) {//optional arguments, none need to be provided
		if(!elemsSet) elemsSet = this.elems;
		let i = initialID || 0;
		for(let elem of elemsSet) {
			elem.id = i++;
		}
		return i;
	}
	
	//create elements from data and add them to the simulator
	AddElementsFromData(data) {
		const newElems = Simulator.CreateElementsFromData(data);
		this._elemIdCounter = this.MinimizeElementIDs(newElems, this._elemIdCounter);
		if(this.elems.size===0) this.elems = newElems;
		else {
			for(let newElem of newElems) {
				this.elems.add(newElem);
			}
		}
	}
	
	//create elements from data and return them as a set
	static CreateElementsFromData(data) {
		const newElemsArray = [];
		
		//create elements by class name
		for(let elemData of data) {
			const elem = new LogicElementTypes[elemData.elemType](elemData);
			elem.inputs = elemData.inputs; //temporarily assigned
			elem.outputs = elemData.outputs; //temporarily assigned
			newElemsArray[elem.id] = elem;
		}
		
		//connect their inputs and outputs
		const newElemsSet = new Set();
		for(let elem of newElemsArray) {
			if(!elem) continue;
			
			//convert input ids into elements
			const inputs = new Set();
			if(elem.inputs) {
				for(let inputID of elem.inputs) {
					inputs.add(newElemsArray[inputID]);
				}
			}
			elem.inputs = inputs;
			
			//convert output ids into elements
			const outputs = new Set();
			if(elem.outputs) {
				for(let outputID of elem.outputs) {
					outputs.add(newElemsArray[outputID]);
				}
			}
			elem.outputs = outputs;
			
			newElemsSet.add(elem);
		}
		
		return newElemsSet;
	}
	
	//bundle up all the elements and data into an object, make it ready for saving to a file
	Serialize() {
		this.MinimizeElementIDs();
		const data = {elems:[]};
		for(let elem of this.elems) {
			data.elems.push(elem.Serialize());
		}
		return data;
	}
}
