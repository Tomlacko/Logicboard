"use strict";

//constant properties / definitions / settings
const CONFIG = {
	elemOutlineWidth:2,
	elemLabelSize:16,
	elemLabelFont:"Arial",
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
	
	elemDebug: {
		textColor:"rgba(0, 0, 0, 1)",
		outlineColor:"rgba(255, 255, 255, 1)",
		outlineSize:0.2,
		font:"Arial",
		fontSize:6
	},
	
	connectionLineHalfWidth:{
		start:3,
		end:1.5
	},
	connectionLineBidirectionalOffset:3,
	connectionClickTolerance:1, //additional radius from a line where a click is still registered
	connectionUnpowered: {
		start:"rgba(0, 0, 0, 1)",
		end:"rgba(170, 170, 170, 1)"
	},
	connectionPowered: {
		start:"rgba(255, 0, 0, 1)",
		end:"rgba(255, 170, 170, 1)"
	},
	
	selection: {
		fillColor:"rgba(100, 180, 255, 0.5)",
		outlineColor:"rgba(50, 150, 255, 0.8)",
		outlineWidth:2
	},
	
	backgroundColor:"rgba(255, 255, 255, 1)",
	
	gridSize:40,
	gridColor:"rgba(220, 220, 220, 1)",
	gridThickness:2,
	
	scrollWheelStepSize:100, //what counts as one scroll step
	zoomStep:0.25, //how much to zoom per scroll step
	zoomTouchMultiplier:3, //how much does 1 canvas height worth of touch movement change the zoom
	zoomMax:4, //how far in can the canvas be zoomed
	zoomMin:-5, //how far out can the canvas be zoomed
	
	edgeScrollDetectionRange:60, //how far from the edge can edge scrolling be triggered
	edgeScrollFrequency:60, //how many times per second should the scrolling be triggered
	edgeScrollRawAmountPerSecond:800, //by how much should the canvas be moved every second
	
	keyboardArrowsPanRawAmount:80, //distance moved when panning using arrow keys
	
	mouseMoveToleranceOnClick:5, //how far can the mouse move during a click before it's counted as a move instead of a click
	
	undoLimit:100, //how many editor events can be recorded before having to forget older ones
	
	defaultFileName:"new_logic_circuit.json",
	fileFormatVersion:2, //manually incremented when the save file format changes, so files from different application versions can be distinguished
	
	initialTool:"add_element",
	initialElement:null,
	defaultTPS:10
};