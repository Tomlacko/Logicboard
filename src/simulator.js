"use strict";

//class that represents the core of the simulator itself, holds all the elements as a graph, and manipulates with them on a lower level
class Simulator {
	//can optionally be initialized with an existing array of serialized elements
	constructor(rawElemsData) {
		this.elements = new Set();
		this.scheduledUpdates = new Set();
		this.tick = 0;
		
		//UNDO history
		this.changes = [/*the initial state will be saved here during initialization*/]; //every change in the editor gets saved here, acts as a sparse array
		this.currentChangeID = 0; //counts up with every change recorded, counts down when undone
		this.maxChangeID = 0; //remembers the newest changeID reached, up to which point can redo be applied
		this.minChangeID = 0; //remembers the oldest changeID reached, up to which point can undo be applied
		
		//create elements from data
		if(rawElemsData) {
			this.LoadElementsFromData(rawElemsData);
		}
		
		//save the initial state
		this.changes[0] = JSON.stringify(this.Serialize());
	}
	
	//replaces the current set of elements with the ones provided in an array of serialized elements
	LoadElementsFromData(rawElemsData) {
		try {
			this.elements = Simulator.CreateElementsFromData(rawElemsData);
			return true;
		}
		catch(e) {
			console.warn("Element loading failed! Error:\n" + e);
			return false;
		}
	}
	
	//creates an element based on the type and data provided
	CreateElement(elemType, data) {
		//get element class by name
		const ElemClass = LOGIC_ELEMENTS[elemType];
		if(!ElemClass) return null;
		
		//try to create the element
		let elem;
		try {
			elem = new ElemClass(data);
		}
		catch(e) {
			return null;
		}
		return elem;
	}
	
	//add element to the simulator
	AddElement(elem) {
		this.elements.add(elem);
	}
	
	//creates an element based on the type and data provided and adds it to the simulator
	CreateAndAddElement(elemType, data) {
		const elem = this.CreateElement(elemType, data);
		if(!elem) return null;
		
		//add the element to the simulator if successfull
		this.AddElement(elem);
		return elem;
	}
	
	//remove element from the simulator
	RemoveElement(elem) {
		//remove references to this element in other elements
		for(const source of elem.inputs) {
			source.outputs.delete(elem);
		}
		for(const target of elem.outputs) {
			target.inputs.delete(elem);
		}
		
		//remove
		this.elements.delete(elem);
	}
	
	//removes a subset of elements
	RemoveElements(subset) {
		for(const elem of subset) {
			this.RemoveElement(elem);
		}
	}
	
	//removes all elements from the simulator
	RemoveAllElements() {
		this.elements.clear();
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
	
	//removes the element, replacing it with a connection line instead, effectively connecting all the inputs directly to the outputs
	DissolveElement(elem) {
		for(const inputElem of elem.inputs) {
			for(const outputElem of elem.outputs) {
				this.ConnectElements(inputElem, outputElem);
			}
		}
		this.RemoveElement(elem);
	}
	
	//replace an existing element with a new one
	ReplaceElement(oldElem, newElemType) {
		const newElem = this.CreateAndAddElement(newElemType, oldElem.pos);
		if(!newElem) return null;
		
		//try to replicate the same connections for the clone as in the old element
		for(const inputElem of oldElem.inputs) {
			this.ConnectElements(inputElem, newElem);
		}
		for(const outputElem of oldElem.outputs) {
			this.ConnectElements(newElem, outputElem);
		}
		
		this.RemoveElement(oldElem);
		return newElem;
	}
	
	//replace all given elements with new ones
	ReplaceElements(elemsToReplace, newElemType) {
		const templateElem = this.CreateElement(newElemType);
		if(!templateElem) return null;
		
		const replacementElems = new Set();
		
		//replace elements in the order they are present in the simulator, to preserve their order
		const newElems = new Set();
		for(const oldElem of this.elements) {
			//all other elements just pass through
			if(!elemsToReplace.has(oldElem)) {
				newElems.add(oldElem);
				continue;
			}
			
			//create a new element just like the template, but at the position of the old element
			const newElem = this.CreateElement(newElemType, templateElem);
			newElem.pos.x = oldElem.pos.x;
			newElem.pos.y = oldElem.pos.y;
			
			//replicate the same connections for the clone as in the old element
			for(const inputElem of oldElem.inputs) {
				this.ConnectElements(inputElem, newElem);
			}
			for(const outputElem of oldElem.outputs) {
				this.ConnectElements(newElem, outputElem);
			}
			
			newElems.add(newElem);
			replacementElems.add(newElem);
		}
		this.elements = newElems;
		
		//remove the old elements' references (in connections)
		this.RemoveElements(elemsToReplace);
		
		return replacementElems;
	}
	
	//moves an element to the end of the set, making it render on top
	MoveElementToTop(elemToMove, checkIfAlreadyOnTop) {
		if(!this.elements.has(elemToMove)) {
			throw "Cannot move element to the top - not found!";
		}
		if(checkIfAlreadyOnTop) {
			let i = 0;
			const last = this.elements.size-1;
			for(const elem of this.elements) {
				if(elem===elemToMove && i<last) break;
				i++;
			}
			if(i===this.elements.size) return false;
		}
		this.elements.delete(elemToMove);
		this.elements.add(elemToMove);
		return true;
	}
	
	//moves a subset of elements to the end of the set, making them render on top
	MoveElementsToTop(elemsToMove) {
		if(elemsToMove.size===0 || elemsToMove.size===this.elements.size) return false;
		if(elemsToMove.size===1) {
			return this.MoveElementToTop(elemsToMove.values().next().value, true);
		}
		
		const newElems = new Set();
		const elemsToAppend = new Set();
		const lastPossibleBeginning = this.elements.size-elemsToMove.size;
		let i = 0;
		let found = 0;
		for(const elem of this.elements) {
			if(elemsToMove.has(elem)) {
				//elements are already at the top, cancel operation
				if(found===0 && i>=lastPossibleBeginning) return false;
				found++;
				elemsToAppend.add(elem);
			}
			else {
				newElems.add(elem);
			}
			i++;
		}
		this.elements = UTILS.SetAddAll(newElems, elemsToAppend);
		
		return true;
	}
	
	
	//get the top-most element that overlaps the given point
	GetElementAtPos(pos) {
		const elems = Array.from(this.elements);
		for(let i = elems.length-1; i>=0; i--) {
			if(elems[i].IsPointWithin(pos)) return elems[i];
		}
		return null;
	}
	
	//get all elements which center is inside a given rectangular area, optionally merged into an existing set
	GetElementsInArea(a, b, existingSet) {
		if(!(existingSet instanceof Set))
			existingSet = new Set();
		
		for(const elem of this.elements) {
			if(UTILS.IsPointWithinArea(elem.pos, a, b)) {
				existingSet.add(elem);
			}
		}
		return existingSet;
	}
	
	//get the top-most connection line that overlaps that point
	GetConnectionAtPos(pos) {
		const elems = Array.from(this.elements);
		for(let i = elems.length-1; i>=0; i--) {
			const elemStart = elems[i];
			for(const elemEnd of elemStart.outputs) {
				const startPos = {x:elemStart.pos.x, y:elemStart.pos.y};
				const endPos = {x:elemEnd.pos.x, y:elemEnd.pos.y};
				//offset for bidirectional lines
				if(elemStart.inputs.has(elemEnd)) {
					const lineLength = UTILS.Distance(elemStart.pos, elemEnd.pos);
					const offsetX = -(endPos.y - startPos.y)/lineLength * CONFIG.connectionLineBidirectionalOffset;
					const offsetY = (endPos.x - startPos.x)/lineLength * CONFIG.connectionLineBidirectionalOffset;
					startPos.x += offsetX;
					startPos.y += offsetY;
					endPos.x += offsetX;
					endPos.y += offsetY;
				}
				if(UTILS.IsPointOnVaryingLine(pos, startPos, endPos, CONFIG.connectionLineHalfWidth.start, CONFIG.connectionLineHalfWidth.end, CONFIG.connectionClickTolerance))
					return {startElem:elemStart, endElem:elemEnd};
			}
		}
		return null;
	}
	
	
	//step the simulation forward
	Step() {
		//schedule all elements to be updated at the start of the simulation
		if(this.tick===0) this.scheduledUpdates = this.elements;
		
		//update all scheduled updates
		const newScheduledUpdates = new Set();
		for(const elem of this.scheduledUpdates) {
			const bitflag = elem.Update();
			//schedule update (for the next step) for self and/or linked elements based on the returned flags
			//00 = no update, 01 = update self, 10 = update outputs, 11 = update both
			if(bitflag & 1) newScheduledUpdates.add(elem);
			if(bitflag & 2) elem.outputs.forEach(output => newScheduledUpdates.add(output));
		}
		//finalize the update
		for(const elem of this.scheduledUpdates) {
			elem.LateUpdate();
		}
		
		this.scheduledUpdates = newScheduledUpdates;
		this.tick++;
	}
	
	//click events during simulation
	ElementClickStart(elem) {
		const bitflag = elem.ClickStart();
		//schedule updates based on flags
		if(bitflag & 1) this.scheduledUpdates.add(elem);
		if(bitflag & 2) elem.outputs.forEach(output => this.scheduledUpdates.add(output));
	}
	ElementClickEnd(elem) {
		const bitflag = elem.ClickEnd();
		//schedule updates based on flags
		if(bitflag & 1) this.scheduledUpdates.add(elem);
		if(bitflag & 2) elem.outputs.forEach(output => this.scheduledUpdates.add(output));
	}
	ElementClickFull(elem) {
		const bitflag = elem.ClickFull();
		//schedule updates based on flags
		if(bitflag & 1) this.scheduledUpdates.add(elem);
		if(bitflag & 2) elem.outputs.forEach(output => this.scheduledUpdates.add(output));
	}
	
	//reset the simulator and its elements to the initial state
	Reset() {
		this.tick = 0;
		this.scheduledUpdates.clear();
		for(const elem of this.elements) {
			elem.Reset();
		}
	}
	
	
	//saves the current state into the undo history
	RecordChange() {
		if(this.tick>0) return false;
		
		this.currentChangeID++;
		
		//save the current state into the history
		this.changes[this.currentChangeID] = JSON.stringify(this.Serialize());
		
		//delete redo history
		for(let i = this.currentChangeID+1; i<=this.maxChangeID; i++) {
			delete this.changes[i];
		}
		//delete undo history over the limit
		for(let i = this.minChangeID; i<this.currentChangeID-CONFIG.undoLimit; i++) {
			delete this.changes[i];
		}
		
		//move pointers
		this.maxChangeID = this.currentChangeID;
		this.minChangeID = Math.max(this.minChangeID, this.currentChangeID-CONFIG.undoLimit);
		
		return this.currentChangeID;
	}
	
	//loads elements from a different point in history
	RestoreChange(changeID) {
		if(changeID < this.minChangeID || changeID > this.maxChangeID || changeID===this.currentChangeID || !this.changes[changeID]) {
			return false;
		}
		this.LoadElementsFromData(JSON.parse(this.changes[changeID]).elements);
		this.currentChangeID = changeID;
		return true;
	}
	
	//goes back in the edit history
	Undo() {
		if(!this.CanUndo()) return false;
		return this.RestoreChange(this.currentChangeID-1);
	}
	
	//goes forwards in the edit history
	Redo() {
		if(!this.CanRedo()) return false;
		return this.RestoreChange(this.currentChangeID+1);
	}
	
	//checks if undo is currently possible
	CanUndo() {
		return this.tick===0 && this.currentChangeID>this.minChangeID;
	}
	
	//checks if redo is currently possible
	CanRedo() {
		return this.tick===0 && this.currentChangeID<this.maxChangeID;
	}
	
	//check how many undos are available
	AvailableUndos() {
		return this.currentChangeID-this.minChangeID;
	}
	
	//check how many redos are available
	AvailableRedos() {
		return this.maxChangeID-this.currentChangeID;
	}
	
	
	//assign consecutive IDs to elements such that they can be saved (serialized) and keep referring to each other
	AssignElementIDs(initialID, elemsSet) {//optional arguments, none need to be provided
		if(!elemsSet) elemsSet = this.elements;
		let i = initialID || 0;
		for(const elem of elemsSet) {
			elem.id = i++;
		}
		return i; //returns the amount of elements that got processed + the initialID
	}
	
	//bundle up all the elements and data into an object, make it ready for saving to a file
	//optionally an existing object can be provided into which the data will be saved
	//additionally, an optional subset of elements can be provided as a filter, and only these elements will be saved
	Serialize(data, subset) {
		this.AssignElementIDs();
		if(!data) data = {};
		data.elements = [];
		for(const elem of this.elements) {
			//if a subset was provided, use it to match elements
			if(!subset || subset.has(elem)) {
				data.elements.push(elem.Serialize());
			}
		}
		return data;
	}
	
	//create elements from data and add them to the simulator
	CreateAndAddElementsFromData(data) { //data is an array of objects
		const newElems = Simulator.CreateElementsFromData(data);
		if(this.elements.size===0) this.elements = newElems;
		else UTILS.SetAddAll(this.elements, newElems);
		return newElems;
	}
	
	//create elements from data and return them as a set
	static CreateElementsFromData(data) { //data is an array of serialized elements
		//validation / trivial cases
		if(!data) throw "No data provided to create elements from!";
		if(data.length===0) return new Set();
		
		//create elements by class name
		const newElemsArray = [];
		for(const elemData of data) {
			const elem = new LOGIC_ELEMENTS[elemData.elemType](elemData);
			elem.inputs = elemData.inputs; //temporarily assigned just IDs
			elem.outputs = elemData.outputs; //temporarily assigned just IDs
			newElemsArray[elem.id] = elem; //arrays in JS are sparse, meaning assigning to arbitrary indexes doesn't waste memory
		}
		
		//connect their inputs and outputs
		const newElemsSet = new Set();
		for(const elem of newElemsArray) {
			//skip empty spots in the array
			if(!elem) continue;
			
			//convert input ids into elements
			const inputs = new Set();
			if(elem.inputs) {
				for(const inputID of elem.inputs) {
					const inputElem = newElemsArray[inputID];
					if(inputElem) inputs.add(inputElem);
				}
			}
			elem.inputs = inputs;
			
			//convert output ids into elements
			const outputs = new Set();
			if(elem.outputs) {
				for(const outputID of elem.outputs) {
					const outputElem = newElemsArray[outputID];
					if(outputElem) outputs.add(outputElem);
				}
			}
			elem.outputs = outputs;
			
			newElemsSet.add(elem);
		}
		
		return newElemsSet;
	}
}
