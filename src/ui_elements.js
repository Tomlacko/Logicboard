"use strict";

//wrapper class for html elements, making them easier to handle
class UIElement {
	constructor(htmlElem) {
		//if(!htmlElem) console.warn("No HTML element provided for this UI element!");
		this.elem = htmlElem;
	}
	
	AddEvent(eventType, callback) {
		if(this.elem) {
			//adds an event listener and calls the provided callback unless the button is disabled
			this.elem.addEventListener(eventType, (function() {
				if(!this.disabled) callback(...arguments);
			}).bind(this));
		}
		return this;
	}
	
	get hidden() {
		return this.elem && this.elem.classList.contains("hidden");
	}
	set hidden(state) {
		if(!this.elem) return;
		if(state) this.elem.classList.add("hidden");
		else this.elem.classList.remove("hidden");
	}
	
	get disabled() {
		return this.elem && this.elem.classList.contains("disabled");
	}
	set disabled(state) {
		if(!this.elem) return;
		if(state) this.elem.classList.add("disabled");
		else this.elem.classList.remove("disabled");
	}
	
	get selected() {
		return this.elem && this.elem.classList.contains("selected");
	}
	set selected(state) {
		if(!this.elem) return;
		if(state) this.elem.classList.add("selected");
		else this.elem.classList.remove("selected");
	}
};

//wrapper class for button html elements
class UIButton extends UIElement {
	constructor(htmlElem, callback) {
		super(htmlElem);
		this.AddEvent("click", callback);
		
		//prevent buttons from being dragged like images
		if(this.elem) this.elem.addEventListener("mousedown", e => e.preventDefault());
	}
}

//wrapper class for html elements used to display text
class UILabel extends UIElement {
	get text() {
		return this.elem && this.elem.innerText;
	}
	
	set text(val) {
		if(!this.elem) return;
		this.elem.innerText = val;
	}
}

//wrapper class for text input html elements
class UITextInput extends UIElement {
	constructor(htmlElem, callback) {
		super(htmlElem);
		this.callback = callback;
		this.AddEvent("input", this._OnValueChange.bind(this));
	}
	
	//overriding the callback, making it send the text input value as a parameter
	_OnValueChange() {
		this.callback(this.elem.value, ...arguments);
	}
	
	get value() {
		return this.elem && this.elem.value;
	}
	set value(val) {
		if(!this.elem) return;
		this.elem.value = val;
	}
}

//wrapper class for numerical input html elements
class UINumInput extends UITextInput {
	constructor(htmlElem, callback) {
		super(htmlElem, callback);
		
		//adding mouse wheel functionality for adjusting the value
		this.AddEvent("wheel", (function(e) {
			e.preventDefault();
			const dir = e.deltaY===0?(e.deltaX>0?-1:1):(e.deltaY>0?-1:1);
			
			const prevValue = this.value;
			
			//change based on the scrollwheel direction
			if(dir===1) this.elem.stepUp();
			else this.elem.stepDown();
			
			//trigger a change event if the value was changed
			if(this.value!==prevValue) this._OnValueChange(...arguments);
		}).bind(this));
	}
	
	//overriding the callback, making it send the number input value as a parameter, with validation
	_OnValueChange() {
		this.callback(parseFloat(this.elem.value), ...arguments);
	}
	
	//automatically converts the value to a number and makes sure it's within the specified bounds
	get value() {
		if(!this.elem) return undefined;
		let val = parseFloat(this.elem.value);
		if(this.elem.min) val = Math.max(val, parseFloat(this.elem.min));
		if(this.elem.max) val = Math.min(val, parseFloat(this.elem.max));
		//can be NaN
		return val;
	}
	set value(val) {
		if(!this.elem) return;
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
		this.AddEvent("click", this._OnClick.bind(this));
	}
	
	//overriding the callback, toggling the toggle and making it send the activation state as a parameter
	_OnClick() {
		if(!this.elem) return;
		this.elem.classList.toggle("activated");
		this.callback(this.activated, ...arguments);
	}
	
	get activated() {
		return this.elem && this.elem.classList.contains("activated");
	}
	set activated(state) {
		if(!this.elem) return;
		if(state) this.elem.classList.add("activated");
		else this.elem.classList.remove("activated");
	}
}
