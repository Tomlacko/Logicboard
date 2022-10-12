"use strict";

//////////////////////////////////////////////////
//RUN THE APPLICATION/////////////////////////////

//instantiates the simulator interface with the page's html elements
const simulatorUI = new SimulatorUI({
	canvas: document.getElementById("canvas"),
	
	//controls
	startBtn: document.getElementById("startBtn"),
	stopBtn: document.getElementById("stopBtn"),
	pauseBtn: document.getElementById("pauseBtn"),
	continueBtn: document.getElementById("continueBtn"),
	stepBtn: document.getElementById("stepBtn"),
	
	//actions
	undoBtn: document.getElementById("undoBtn"),
	redoBtn: document.getElementById("redoBtn"),
	newProjectBtn: document.getElementById("newProjectBtn"),
	saveToFileBtn: document.getElementById("saveToFileBtn"),
	loadFromFileBtn: document.getElementById("loadFromFileBtn"),
	showInfoBtn: document.getElementById("showInfoBtn"),
	
	//panels
	elemSelector: document.getElementById("elemSelector"),
	tools: document.getElementById("tools").children,
	
	
	//settings panel
	tpsInput: document.getElementById("tpsInput"),
	alignToGridToggle: document.getElementById("alignToGrid"),
	showIOonlyToggle: document.getElementById("showIOonly"),
	showDebugToggle: document.getElementById("showDebug"),
	
	//miscellaneous
	stepCounter: document.getElementById("stepCounter"),
	infoOverlay: document.getElementById("infoOverlay"),
	closeInfoBtn: document.getElementById("closeInfoBtn"),
	debugInfo: document.getElementById("debugInfo")
});
