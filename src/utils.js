"use strict";

//checks if a value is a valid useable number
function IsValidNum(num) {
	return (typeof num === "number") && !isNaN(num) && isFinite(num);
};

//forces the number to stay within the given bounds
function ClampNum(num, min, max) {
	return Math.min(Math.max(num, min), max);
}

//generalized rounding function, allowing for rounding towards other values than just whole numbers
function RoundTowards(num, roundStep, roundOffset) {
	if(!roundOffset) roundOffset = 0;
	return Math.round((num+roundOffset)/roundStep)*roundStep - roundOffset;
}

//pythagorean distance functions
function DistanceSquared(pos1, pos2) {
	return Math.pow(pos2.x-pos1.x, 2) + Math.pow(pos2.y-pos1.y, 2);
}
function Distance(pos1, pos2) {
	return Math.sqrt(DistanceSquared(pos1, pos2));
}

//perpendicularly projects a point onto a line
function GetClosestPointOnLine(point, lineStart, lineEnd) {
	const lineLengthSqr = DistanceSquared(lineStart, lineEnd);
	if(lineLengthSqr==0) return {x:lineStart.x, y:lineStart.y};
	const lx = lineEnd.x-lineStart.x;
	const ly = lineEnd.y-lineStart.y;
	let t = ((point.x-lineStart.x)*lx + (point.y-lineStart.y)*ly) / lineLengthSqr;
	t = ClampNum(t, 0, 1);
	return {
		x: lineStart.x + t*lx,
		y: lineStart.y + t*ly
	};
}
//gets the perpendicular distance of a point from a line
function DistanceFromLine(point, lineStart, lineEnd) {
	return Distance(point, GetClosestPointOnLine(point, lineStart, lineEnd));
}
//checks if a point lies on a line with a given thickness
function IsPointOnLine(point, lineStart, lineEnd, thickness, toleranceMultiplier) {
	return DistanceFromLine(point, lineStart, lineEnd) <= (thickness/2)*toleranceMultiplier;
}

//checks if a point lines in a rectangle, defined by 2 corner points
function IsPointWithinArea(point, areaStart, areaEnd) {
	return point.x >= areaStart.x && point.y >= areaStart.y && point.x <= areaEnd.x && point.y <= areaEnd.y;
}
//checks if a point lies in a rectangle, defined by center and radius
function IsPointWithinRect(point, rectPos, halfWidth, halfHeight) {
	return point.x >= rectPos.x-halfWidth &&
		point.y >= rectPos.y-halfHeight &&
		point.x <= rectPos.x+halfWidth &&
		point.y <= rectPos.y+halfHeight;
}

//checks if a point lies within a circle
function IsPointWithinCircle(point, circlePos, radius) {
	return DistanceSquared(point, circlePos) <= radius*radius;
}

//makes the browser download a given string as a text file
function DownloadTextFile(filename, contents) {//filename includes extension, contents is a string
	if(!window.navigator.msSaveBlob) {
		const element = document.createElement("a");
		element.setAttribute("href", "data:text/plain;charset=utf-8," + encodeURIComponent(contents));
		element.setAttribute("download", filename);
		element.style.display = "none";
		element.click();
	}
	else {
		const blobObject = new Blob([contents]); 
		window.navigator.msSaveBlob(blobObject, filename);
	}
}

//opens an "open file" dialog and loads a file returned via a callback function
function LoadFileDialog(callback) {
	const dlg = document.createElement("input");
	dlg.type = "file";
	dlg.onchange = () => callback(dlg.files[0]); //file, including file.name & file.size
	dlg.click();
}
//tries to read text file contents, returns string or null
function ReadTextFile(file, callback) {
	const reader = new FileReader();
	reader.onload = e => callback(e.target.result);
	try {
		reader.readAsText(file);
	}
	catch(e) {
		callback(null, e);
	}
};
