import * as THREE from "./../build/three.module.js";

const opacity_focused = 0.6
const opacity_not_focused = 0.3
var createMarker = function (scene, name, axis, dimu, dimv, color, style) {
	var geometry = null
	var material = null
	var mesh = null 
	//console.log(style)
	if (style == 0) {
		geometry = new THREE.PlaneGeometry(dimu, dimv)
		material = new THREE.MeshBasicMaterial(color);
		mesh = new THREE.Mesh(geometry, material);

	}
	else {
		var w = dimu/2
		var h = dimv/2
		var points = [
			new THREE.Vector2(w, h),
			new THREE.Vector2(-w, h),
			new THREE.Vector2(-w, -h),
			new THREE.Vector2(w, -h),
			new THREE.Vector2(w, h)
		]

		color['opacity'] = 1
		geometry = new THREE.BufferGeometry().setFromPoints(points);
		material = new THREE.LineBasicMaterial(color);
		mesh = new THREE.Line(geometry, material);
	}
	//console.log(mesh)
	if (axis == axisXZ) {
		mesh.geometry.rotateX(-Math.PI / 2)
	}
	else if (axis == axisYZ) {
		mesh.geometry.rotateZ(Math.PI / 2)
		mesh.geometry.rotateY(Math.PI / 2)
	}	

	
	//console.log(mesh)
	//check if there are any marker with the same name
	var pre_mesh = scene.getObjectByName(name)
	if (pre_mesh != null) {
		scene.remove(pre_mesh)
	}


	mesh.name = name
	scene.add(mesh)
    
}

var generate = function (axis) {
	var color = null
	var opacity = opacity_not_focused
	var hidden = true

	if (axis == axisXY) {
		color = { color: 0x00FF00, opacity: opacity, transparent: hidden, side: THREE.DoubleSide};		
	}
	else if (axis == axisXZ) {
		color = { color: 0xFF0000, opacity: opacity, transparent: hidden, side: THREE.DoubleSide }
	}
	else if (axis == axisYZ) {
		color = { color: 0x0000FF, opacity: opacity, transparent: hidden, side: THREE.DoubleSide }
	}

	var marker = {
		"object":null,
		"color": color,
		"constant": 0,
		"isClipping": true,
		"isVisable": true,
		"style": 0
	}

	return marker;
}

class SlicerControl {
	constructor(scene, style = 0, clipping) {
		this.scene = scene
		this.objects = []
		this.xyzDims = [1, 1, 1]
		this.thickness = [1, 1, 1]
		this.markers = {}

		this.markers[axisXY] = generate(axisXY)
		this.markers[axisXZ] = generate(axisXZ)
		this.markers[axisYZ] = generate(axisYZ)

		this.initMarker(style)
		this.reset()
	}

	initMarker(style) {
		createMarker(this.scene, clpPlaneXY, axisXY, this.xyzDims[0] * this.thickness[0], this.xyzDims[1] * this.thickness[1], this.markers[axisXY].color, style)
		createMarker(this.scene, clpPlaneXZ, axisXZ, this.xyzDims[0] * this.thickness[0], this.xyzDims[2] * this.thickness[2], this.markers[axisXZ].color, style)
		createMarker(this.scene, clpPlaneYZ, axisYZ, this.xyzDims[1] * this.thickness[1], this.xyzDims[2] * this.thickness[2], this.markers[axisYZ].color, style)

		this.markers[axisXY].object = this.scene.getObjectByName(clpPlaneXY);
		this.markers[axisXZ].object = this.scene.getObjectByName(clpPlaneXZ);
		this.markers[axisYZ].object = this.scene.getObjectByName(clpPlaneYZ);
    }

	updatePlane(marker, axis) {

		for (var i = 0; i < this.objects.length; i++) {
			if (marker.isClipping) {
				this.objects[i].material.clippingPlanes[axis].constant = marker.constant
			}
			else {
				//if the clipping plane is disable, move it to the edge of axis
				this.objects[i].material.clippingPlanes[axis].constant = this.xyzDims[axis]
			}
		}
	}

	//move markers and clipping plane to the definite position which corresponding to the current showing dicom image
	setIndexRatio(axis, ratio) {

		var marker
		var index

		//XY plane
		if (axis == axisXY) {
			index = this.xyzDims[2] / 2 - this.xyzDims[2] * ratio
			index *= this.thickness[2]
			marker = this.markers[axis]
			marker.object.position.set(0, 0, index)
			marker.constant = index;
		}

		//XZ plane
		else if (axis == axisXZ) {
			index = this.xyzDims[1] / 2 - this.xyzDims[1] * ratio
			index *= this.thickness[1]
			marker = this.markers[axis]
			marker.object.position.set(0, index, 0)
			marker.constant = index;
		}

		//YZ plane
		else if (axis == axisYZ) {
			index = this.xyzDims[0] / 2 - this.xyzDims[0] * ratio
			index *= this.thickness[0]
			marker = this.markers[axis]
			marker.object.position.set(index, 0, 0)
			marker.constant = index;
		}

		this.updatePlane(marker, axis)
	}

	onFocus(axis, option) {
		if (option) {
			this.markers[axis].object.material.opacity = opacity_focused
		}
		else {
			this.markers[axis].object.material.opacity = opacity_not_focused
		}
    }

	reset() {
		this.setIndexRatio(axisXY, 0)
		this.setIndexRatio(axisXZ, 0)
		this.setIndexRatio(axisYZ, 0)
	}

	//set the marker's size as same as showing images
	resize(dims, style, clipping) {
		this.xyzDims = dims
		//console.log(dims)

		this.initMarker(style)

		if (clipping == null) {

        }
		else if (clipping.length == 1) {
			this.setClippingeAll(clipping[0])
		}
		else if (clipping.length == 3) {
			this.setClipping(axisXY, clipping[axisXY])
			this.setClipping(axisXZ, clipping[axisXZ])
			this.setClipping(axisYZ, clipping[axisYZ])
        }

	}

	//tell markers the clipping object
	addObject(mesh) {

		for (var i = 0; i < this.objects.length; i++) {
			if (mesh.id == this.objects.id) {
				console.log('SlicerControl: model exist')
				return
            }
		}

		let planes = []

		planes.push(new THREE.Plane(new THREE.Vector3(0, -1, 0), 0))
		planes.push(new THREE.Plane(new THREE.Vector3(0, 0, -1), 0))
		planes.push(new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0))

		planes[axisXY].constant = this.markers[axisXY].constant
		planes[axisXZ].constant = this.markers[axisXZ].constant
		planes[axisYZ].constant = this.markers[axisYZ].constant
		mesh.material.clippingPlanes = planes
		this.objects.push(mesh)
	}

	setVisable(axis, option) {
		//option: true / false
		//axis: slicerXY/XZ/YZ
		this.markers[axis].isVisable = option
	}

	setVisableAll(option) {
		for (var i = 0; i < 3; i++) {
			this.setVisable(i, option)
		}
	}

	setClipping(axis, option) {
		//option: true / false
		//axis: slicerXY/XZ/YZ

		let marker  = this.markers[axis]
		marker.isClipping = option
		this.updatePlane(marker, axis)
	}

	setClippingeAll(option) {
		for (var i = 0; i < 3; i++) {
			this.setClipping(i, option)
		}
	}

	updateAll() {

		this.updatePlane(this.markers[axisYZ], axisYZ)
		this.updatePlane(this.markers[axisXZ], axisXZ)
		this.updatePlane(this.markers[axisXY], axisXY)
	}
}

export { SlicerControl };
