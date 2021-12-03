import { ModelViewer } from "./modelViewer.js";
import { SubRenderer } from "./SubRenderer.js";
import { SegmentManager, MaskImage } from "./SegmentManager.js"
import { dcmViewer } from "./views/dcmViewer.js"
import { VolumeRenderShader1 } from "./threejs/shaders/VolumeShader.js";
import { Vector3 } from "../build/three.module.js";

let maskUpCylinder = function (volDims, ratio) {

	let mask = buildMask()
	let r = parseInt(volDims[0] * ratio / 2)

	for (let j = parseInt(volDims[1] / 2 - r); j < parseInt(volDims[1] / 2 + r); j++) {
		let limit = Math.pow(r, 2) - Math.pow(j - volDims[1] / 2, 2)
		limit = Math.sqrt(limit) + volDims[0] / 2
		limit = parseInt(limit)
		for (let k = volDims[0] - limit; k < limit; k++) {
			mask[j][k] = 1
		}
	}

	return mask
}

let maskUpBox = function (volDims, width, height, depth) {
	let mask = buildMask(volDims)
	let i, j, k
	let limit_i = volDims[2] * depth / 2
	let limit_j = volDims[1] * height / 2
	let limit_k = volDims[0] * width / 2
	
	for (i = volDims[2] / 2 - limit_i; i < volDims[2] / 2 + limit_i; i++) {
		for (j = volDims[1] / 2 - limit_j; j < volDims[1] / 2 + limit_j; j++) {
			for (k = volDims[0] / 2 - limit_k; k < volDims[0] / 2 + limit_k ; k++) {
				mask[parseInt(i)][parseInt(j)][parseInt(k)] = 1
			}
		}
	}

	return mask
}

let maskUpSphere = function (volDims, ratio) {
	//console.log(ratio)
	let mask = buildMask(volDims)
	let r = parseInt(volDims[0] / 2 * ratio)
	let limit_i, limit_j
	let i, j, k, iStep, jStep
	for (i = volDims[2] / 2 - r; i < volDims[2] / 2 + r; i++) {
		if (i < 0 || i > volDims[2]) {
			continue
		}
		limit_i = Math.pow(r, 2) - Math.pow(i - volDims[2] / 2, 2)
		limit_i = Math.sqrt(limit_i)
		limit_i = parseInt(limit_i)

		for (j = volDims[1] / 2 - limit_i, iStep = parseInt(i) * volDims[1] * volDims[0]; j < volDims[1] / 2 + limit_i; j++) {
			if (j < 0 || j > volDims[1]) {
				continue
			}
			limit_j = Math.pow(limit_i, 2) - Math.pow(j - volDims[1] / 2, 2)
			limit_j = Math.sqrt(limit_j)
			limit_j = parseInt(limit_j)

			for (k = volDims[0] / 2 - limit_j, jStep = parseInt(j) * volDims[0]; k < volDims[0] / 2 + limit_j; k++) {
				if (k < 0 || k > volDims[0]) {
					continue
				}
				//console.log(j)
				mask[iStep + jStep + parseInt(k)] = 1
			}
		}
	}

	return mask
}

let buildMask = function (volDims) {
	return new Uint8Array(volDims[0] * volDims[1] * volDims[2]).fill(0)
}

let maskUp2 = function (dataBuffer, maskList) {
	maskList.forEach((mask) => {
		dataBuffer.forEach((dataPixel, index) => {
			dataBuffer[index] = mask[index] * dataPixel
        })
    })
}

let maskUpShape = function (dims, pDims, cameraPos, pixelData) {

}

let sampling = function(volDims, dataBuffer, ratio) {
	let index = 0
	let i, j, k
	let buffer = []
	let dims = []

	for (i = 0; i < volDims[2]; i += ratio)
		for (j = 0; j < volDims[1]; j += ratio)
			for (k = 0; k < volDims[0]; k += ratio) {
				index = Math.ceil(i) * volDims[1] * volDims[0] + Math.ceil(j) * volDims[0] + Math.ceil(k)
				buffer.push(dataBuffer[index]);
			}

	dims.push(k / ratio, j / ratio, i / ratio)

	return { dims, buffer }
}

let hex2rgb = function (hex) {
	let r = ((hex >> 16) & 255)
	let g = ((hex >> 8) & 255)
	let b = ((hex) & 255)
	return [r,g,b]
}

//lower call back frequency
let throttle = function (func, threshhold) {
	let last, timer;
	if (threshhold == null) threshhold = 250;
	return function () {
		let context = this
		let args = arguments
		let now = +new Date()
		if (last && now < last + threshhold) {
			clearTimeout(timer)
			timer = setTimeout(function () {
				last = now
				func.apply(context, args)
			}, threshhold)
		} else {
			last = now
			func.apply(context, args)
		}
	}
}

let func = (e) => {
	e.preventDefault()
}

let stopWindowScroll = function (option) {


	let passiveSupport = checkPassiveSupported(false)

	if (option) {
		window.addEventListener('DOMMouseScroll', func, false)
		window.addEventListener('wheel', func, passiveSupport)
		window.addEventListener('touchmove', func, passiveSupport)
	}
	else {
		window.removeEventListener('DOMMouseScroll', func, false)
		window.removeEventListener('wheel', func, passiveSupport)
		window.removeEventListener('touchmove', func, passiveSupport)
    }
}

class DcmController {

	constructor(domElement) {
		this.subrenderer = null
		this.uvdDims = [1, 1, 1]
		this.index = [0, 0, 0]
		this.domElement = domElement
		this.managers = []
		this.modelViewer = null

		new dcmViewer(domElement)
		this.viewConstructor()
	}

	viewConstructor() {
		let viewports = this.domElement.getElementsByClassName("dcmViewer")
		let slider = this.domElement.getElementsByClassName("viewer-slider")
		let functionBars = this.domElement.getElementsByClassName("viewer-bar")
		let viewers = []

		Object.entries(viewports).forEach(([key, viewport])=> {
			let canvas = viewport.querySelector('canvas')
			let image = new MaskImage(canvas)
			viewers.push(image)
			viewport.addEventListener('mouseenter', () => {
				stopWindowScroll(true)
				this.subrenderer.setOnFocus(key, true)
				image.sizeReload()
			})
			viewport.addEventListener('mouseleave', () => {
				stopWindowScroll(false)
				this.subrenderer.setOnFocus(key, false)
				image.sizeReload()
			})
			viewport.addEventListener('wheel', (e) => {
				let distance = e.deltaY * 0.01
				slider[key].value = Number(slider[key].value) + distance
				this.index[key] = Number(slider[key].value)
				this.sliderUpdate(key)
			})
			slider[key].min = 0
			slider[key].max = 0
			slider[key].addEventListener('input', () => {
				this.index[key] = Number(slider[key].value)
				this.sliderUpdate(key)
			})
		})

		Object.entries(functionBars).forEach(([_, functionBar]) => {
			let barFunctions = functionBar.getElementsByClassName('func')
			Object.entries(barFunctions).forEach(([key, func]) => {
				func.addEventListener('hover', () => {
					if (key == 0) {
						//not yet implement
					}
				})
			})
		})
		

		this.managers = new SegmentManager(viewers)

		let dcmVolume = document.getElementById("dcmVolume");
		this.modelViewer = new ModelViewer(dcmVolume)
		let dcmBody = document.getElementById("dcmBody");
		this.subrenderer = new SubRenderer(dcmBody);

		//synchronize
		let lock = false
		this.modelViewer.sceneObject.windowControl.addEventListener('change', () => {
			
			let mPosition = this.modelViewer.sceneObject.camera.position
			let sDistance = this.subrenderer.windowControl.getDistance()
			let mDistance = this.modelViewer.sceneObject.windowControl.getDistance()
			let ratio = sDistance / mDistance
			this.subrenderer.camera.position.set(mPosition.x * ratio, mPosition.y * ratio, mPosition.z * ratio)
			if (!lock) {
				lock = true
				this.subrenderer.windowControl.update()
				lock = false
            }
		})

		this.subrenderer.windowControl.addEventListener('change', () => {
			
			let sPosition = this.subrenderer.camera.position
			let mDistance = this.modelViewer.sceneObject.windowControl.getDistance()
			let sDistance = this.subrenderer.windowControl.getDistance()
			let ratio = mDistance / sDistance
			this.modelViewer.sceneObject.camera.position.set(sPosition.x * ratio, sPosition.y * ratio, sPosition.z * ratio)
			if (!lock) {
				lock = true
				this.modelViewer.sceneObject.windowControl.update()
				lock = false
            }	
        })
	}

	addSegment(name) {
		let color = ['#FF0000', '#00FF00', '#0000FF', '#F0F000', '#F00F00']
		let para = this.managers.segments.length
		this.managers.addSegment(name, color[para], this.uvdDims)
	}

	removeSegment(index) {
		for (let i = 0; i < 3; i++) {
			this.managers.removeSegment(index)
			this.managers.maskImages[i].update()
        }
    }

	sliderUpdate (axis) {

		let counter = this.domElement.getElementsByClassName("counter")
		let index = this.index[axis];
		let length, ratio

		//this.renderScene()

		if (axis == axisUV) {
			ratio = index / this.uvdDims[2]
			length = this.uvdDims[2]
		}
		else if (axis == axisUD) {
			ratio = index / this.uvdDims[1]
			length = this.uvdDims[1]
		}
		else {
			ratio = index / this.uvdDims[0]
			length = this.uvdDims[0]
		}	

		//update sub renderer
		this.subrenderer.setClippingRatio(axis, ratio)
		this.modelViewer.setClippingRatio(axis, ratio)
		counter[axis].textContent = `${index + 1}/${length}`
		this.showDicom(axis, index)
	}

	//axis: Top2button(TB) is 0; Front2Back(FB) is 1; Left2Right(LR) is 2
	//index: current dicom image page
	showDicom(axis, index) {

		index = parseInt(index)
		if (index >= this.uvdDims[axis].length) {
			return
		}

		this.managers.setFocusedLayer(axis, index)
	}

	setManagerTools(option) {
		this.managers.setTools(option)
    }

	setModelData(name, volDims, dataBuffer) {
		this.setDcmViewerDims(volDims, dataBuffer)
		let xyzDims = [volDims[0], volDims[2], volDims[1]]
		this.subrenderer.setClippingDim(xyzDims)
		//marchingCubes.set_volume(dataBuffer['mask'], volDims[0], volDims[1], volDims[2]);
	}

	setDcmViewerDims(uvdDims, dataBuffer) {

		this.uvdDims[0] = uvdDims[0]
		this.uvdDims[1] = uvdDims[1]
		this.uvdDims[2] = uvdDims[2]
		//this.dataBuffer = dataBuffer
		//update canvas size
		this.managers.setBaseSegment(dataBuffer, uvdDims)
		this.managers.maskImages[axisUV].setMaskSize(uvdDims[0], uvdDims[1])
		this.managers.maskImages[axisUD].setMaskSize(uvdDims[0], uvdDims[2])
		this.managers.maskImages[axisVD].setMaskSize(uvdDims[1], uvdDims[2])

		let slider = this.domElement.getElementsByClassName("viewer-slider")
		for (let i = 0; i < 3; i++) {
			slider[i].min = 0
			slider[i].max = uvdDims[2 - i] - 1
			slider[i].value = 0
		}

		this.updateDcmView()
	}

	updateDcmView() {
		this.sliderUpdate(axisUV)
		this.sliderUpdate(axisUD)
		this.sliderUpdate(axisVD)
	}

	generateModel() {
		let segment = this.managers.getFocusedSegment()
		let dims = segment.dims
		let data = segment.data
		this.modelViewer.setModelData(dims, data)
		this.modelViewer.modelUpdate(0)
	}
}



export { DcmController }

