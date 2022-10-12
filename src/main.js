"use strict";

//////////////////////////////////////////////////
//RUN THE PROJECT////////////////////////////////

//instantiates the simulator interface with the page's html elements
var simulatorGUI = new SimulatorGUI(
	new Simulator(),
	{
		canvas: document.getElementById("canvas"),
		
		//controls
		startBtn:document.getElementById("startBtn"),
		stopBtn:document.getElementById("stopBtn"),
		pauseBtn:document.getElementById("pauseBtn"),
		continueBtn:document.getElementById("continueBtn"),
		stepBtn:document.getElementById("stepBtn"),
		
		newProjectBtn:document.getElementById("newProjectBtn"),
		saveToFileBtn:document.getElementById("saveToFileBtn"),
		loadFromFileBtn:document.getElementById("loadFromFileBtn"),
		
		tools:document.getElementById("tools").children,
		
		elemSelector:document.getElementById("elemSelector"),
		
		tpsInput:document.getElementById("tpsInput"),
		alignToGridToggle:document.getElementById("alignToGrid")
	}
);



//prevents icon dragging
document.querySelectorAll(".button").forEach(
	elem => elem.addEventListener("mousedown", function(e) {
		e.preventDefault();
	})
);

//reminder about unsaved changes before exit
window.onbeforeunload = function(){
	return "Are you sure you want to exit?\nAny unsaved changes will be lost!";
}

