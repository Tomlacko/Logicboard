"use strict";

//a static class containing many static utility methods
class UTILS {
	constructor() {
		throw "The UTILS class is not instantiable!";
	}
	
	
	//checks if a value is a valid useable number
	static IsValidNum(num) {
		return (typeof num === "number") && !isNaN(num) && isFinite(num);
	}
	
	
	//forces the number to stay within the given bounds
	static ClampNum(num, min, max) {
		return Math.min(Math.max(num, min), max);
	}
	
	
	//generalized rounding function, allowing for rounding towards other values than just whole numbers
	static RoundTowards(num, roundStep, roundOffset) {
		if(!roundOffset) roundOffset = 0;
		return Math.round((num+roundOffset)/roundStep)*roundStep - roundOffset;
	}
	
	
	//produces a union of 2 sets
	static SetUnion(setA, setB) {
		const union = new Set(setA);
		for(const elem of setB) {
			union.add(elem);
		}
		return union;
	}
	
	//adds multiple items into an existing set
	static SetAddAll(initialSet, itemsToAdd) {
		for(const elem of itemsToAdd) {
			initialSet.add(elem);
		}
		return initialSet;
	}
	
	
	//pythagorean distance without square root applied (for optimization)
	static DistanceSquared(pos1, pos2) {
		return Math.pow(pos2.x-pos1.x, 2) + Math.pow(pos2.y-pos1.y, 2);
	}
	
	//pythagorean distance
	static Distance(pos1, pos2) {
		return Math.sqrt(this.DistanceSquared(pos1, pos2));
	}
	
	
	//perpendicularly projects a point onto a line
	static GetClosestPointOnLine(point, lineStart, lineEnd) {
		const lineLengthSqr = this.DistanceSquared(lineStart, lineEnd);
		
		//zero-length line
		if(lineLengthSqr==0)
			return {x:lineStart.x, y:lineStart.y, d:0.5};
		
		const lengthX = lineEnd.x-lineStart.x;
		const lengthY = lineEnd.y-lineStart.y;
		
		//percentual distance of point from start of the line
		let d = ((point.x-lineStart.x)*lengthX + (point.y-lineStart.y)*lengthY) / lineLengthSqr;
		d = this.ClampNum(d, 0, 1);
		
		return {
			x: lineStart.x + d*lengthX,
			y: lineStart.y + d*lengthY,
			d: d
		};
	}
	
	//gets the perpendicular distance of a point from a line
	static DistanceFromLine(point, lineStart, lineEnd) {
		return this.Distance(point, this.GetClosestPointOnLine(point, lineStart, lineEnd));
	}
	
	//checks if a point lies on a line with constant thickness
	static IsPointOnLine(point, lineStart, lineEnd, thickness, tolerance) {
		return this.DistanceFromLine(point, lineStart, lineEnd) <= (thickness/2)+tolerance;
	}
	//checks if a point lies on a line with varying thickness
	static IsPointOnVaryingLine(point, lineStart, lineEnd, halfThicknessStart, halfThicknessEnd, tolerance) {
		const linePoint = this.GetClosestPointOnLine(point, lineStart, lineEnd);
		return this.Distance(point, linePoint) <= halfThicknessStart+(halfThicknessEnd-halfThicknessStart)*linePoint.d + tolerance;
	}
	
	
	//checks if a point lines in a rectangle, defined by 2 corner points
	static IsPointWithinArea(point, corner1, corner2) {
		const x1 = Math.min(corner1.x, corner2.x);
		const x2 = Math.max(corner1.x, corner2.x);
		const y1 = Math.min(corner1.y, corner2.y);
		const y2 = Math.max(corner1.y, corner2.y);
		return point.x >= x1 && point.y >= y1 && point.x <= x2 && point.y <= y2;
	}
	
	//checks if a point lies in a rectangle, defined by center and radius
	static IsPointWithinRect(point, rectPos, halfWidth, halfHeight) {
		return point.x >= rectPos.x-halfWidth &&
			point.y >= rectPos.y-halfHeight &&
			point.x <= rectPos.x+halfWidth &&
			point.y <= rectPos.y+halfHeight;
	}
	
	//checks if a point lies within a circle
	static IsPointWithinCircle(point, circlePos, radius) {
		return this.DistanceSquared(point, circlePos) <= radius*radius;
	}
	
	
	//creates a vector going from point a to point b
	static VectorFromTo(a, b) {
		return {x:b.x-a.x, y:b.y-a.y};
	}
	
	//returns the length of a vector
	static VectorLength(vec) {
		return Math.sqrt(vec.x*vec.x + vec.y*vec.y);
	}
	
	//normalizes a vector to be of length 1
	static VectorNormalize(vec) {
		const len = this.VectorLength(vec);
		if(len===0) return {x:0, y:0};
		return {x:vec.x/len, y:vec.y/len};
	}
	
	//returns the vector angle in radians
	static VectorAngle(vec) {
		return Math.atan2(vec.y, vec.x);
	}
	
	//add a scalar to a vector
	static VectorScalarAdd(vec, scalar) {
		return {x:vec.x+scalar, y:vec.y+scalar};
	}
	//add 2 vectors together component-wise
	static VectorAdd(vec1, vec2) {
		return {x:vec1.x+vec2.x, y:vec1.y+vec2.y};
	}
	
	//multiply vector by a scalar
	static VectorScalarMultiply(vec, scalar) {
		return {x:vec.x*scalar, y:vec.y*scalar};
	}
	//multiply 2 vectors together component-wise
	static VectorMultiply(vec1, vec2) {
		return {x:vec1.x*vec2.x, y:vec1.y*vec2.y};
	}
	
	//copy of the given vector
	static VectorCopy(vec) {
		return {x:vec.x, y:vec.y};
	}
	//same vector pointing in the opposite direction
	static VectorReverse(vec) {
		return {x:-vec.x, y:-vec.y};
	}
	//turns the vector by 90 degrees anti-clockwise (clockwise in canvas coordinates)
	static VectorPerpendicular(vec) {
		return {x:-vec.y, y:vec.x};
	}
	
	
	//makes the browser download a given string as a text file
	static DownloadTextFile(filename, contents) {//filename includes extension, contents is a string
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
	
	//opens an "open file" dialog and loads the file returned via a callback function
	static OpenFileDialog(acceptedFileTypes, callback) {
		const dlg = document.createElement("input");
		dlg.type = "file";
		dlg.accept = acceptedFileTypes;
		dlg.onchange = () => callback(dlg.files[0]); //file, including file.name & file.size
		dlg.click();
	}
	
	//tries to read text file contents, returns it as string or null depending on success
	static ReadTextFile(file, callback) {
		const reader = new FileReader();
		reader.onload = e => callback(e.target.result);
		try {
			reader.readAsText(file);
		}
		catch(e) {
			callback(null, e);
		}
	}
};