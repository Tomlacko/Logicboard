"use strict";

//wrapper class for html elements, making them easier to handle
class UIElement {
	constructor(htmlElem) {
		this.elem = htmlElem;
	}
	
	AddEvent(eventType, callback) {
		//adds an event listener and calls the provided callback unless the button is disabled
		this.elem.addEventListener(eventType, () => {
			if(!this.disabled) callback(...arguments);
		});
		return this;
	}
	
	get hidden() {
		return this.elem.classList.contains("hidden");
	}
	set hidden(state) {
		if(state) this.elem.classList.add("hidden");
		else this.elem.classList.remove("hidden");
	}
	
	get disabled() {
		return this.elem.classList.contains("disabled");
	}
	set disabled(state) {
		if(state) this.elem.classList.add("disabled");
		else this.elem.classList.remove("disabled");
	}
	
	get selected() {
		return this.elem.classList.contains("selected");
	}
	set selected(state) {
		if(state) this.elem.classList.add("selected");
		else this.elem.classList.remove("selected");
	}
};

//wrapper class for button html elements
class UIButton extends UIElement {
	constructor(htmlElem, callback) {
		super(htmlElem);
		this.AddEvent("click", callback);
	}
}

//wrapper class for text input html elements
class UITextInput extends UIElement {
	constructor(htmlElem, callback) {
		super(htmlElem);
		this.callback = callback;
		this.AddEvent("input", this._EventTrigger.bind(this));
	}
	
	//overriding the callback, making it send the text input value as a parameter
	_EventTrigger() {
		this.callback(this.value, ...arguments);
	}
	
	get value() {return this.elem.value;}
	set value(val) {this.elem.value = val;}
}

//wrapper class for numerical input html elements
class UINumInput extends UITextInput {
	//automatically converts the value to a number and makes sure it's within the specified bounds
	get value() {
		let val = parseFloat(this.elem.value);
		if(this.elem.min) val = Math.max(val, parseFloat(this.elem.min));
		if(this.elem.max) val = Math.min(val, parseFloat(this.elem.max));
		return val;
	}
	set value(val) {
		if(this.elem.min) val = Math.max(val, parseFloat(this.elem.min));
		if(this.elem.max) val = Math.min(val, parseFloat(this.elem.max));
		this.elem.value = val;
	}
}

//wrapper class for toggleable switches
class UIToggle extends UIElement {
	constructor(htmlElem, callback) {
		super(htmlElem);
		this.callback = callback;
		this.AddEvent("click", this._EventTrigger.bind(this));
	}
	
	//overriding the callback, making it send the activation state as a parameter
	_EventTrigger() {
		this.elem.classList.toggle("activated");
		this.callback(this.activated, ...arguments);
	}
	
	get activated() {
		return this.elem.classList.contains("activated");
	}
	set activated(state) {
		if(state) this.elem.classList.add("activated");
		else this.elem.classList.remove("activated");
	}
}
