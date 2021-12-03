import { ModelViewer } from "./modelViewer.js";
import { SubRenderer } from "./SubRenderer.js";
import { SegmentManager, MaskImage } from "./SegmentManager.js"

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

class DcmController {

	constructor(domElement) {
		this.subrenderer = null
		this.uvdDims = [0, 0, 0]
		this.index = [-1, -1, -1]
		this.contrast = [0, 0, 0]
		this.exposure = [0, 0, 0]
		this.domElement = domElement
		this.managers = null
		this.modelViewer = null

		this.viewConstructor()
	}

	viewConstructor() {
		let imageViewer = this.domElement.getElementsByClassName("dcmViewer")
		let spacer = this.domElement.getElementsByClassName("tmpViewer")
		let slider = this.domElement.getElementsByClassName("viewer-slider")
		let viewers = []

		//prevent screen from scrolling while dcm viewers scroll 
		let stopWindowScroll = {
			enable: false,
			func: (e) => {
				if (stopWindowScroll.enable)
					e.preventDefault()
			}
        }

		let passiveSupport = checkPassiveSupported(false)
		window.addEventListener('DOMMouseScroll', stopWindowScroll.func, false)
		window.addEventListener('wheel', stopWindowScroll.func, passiveSupport)
		window.addEventListener('touchmove', stopWindowScroll.func, passiveSupport)

		Object.entries(imageViewer).forEach(([key, viewport])=> {
			let canvas = viewport.querySelector('canvas')
			let image = new MaskImage(canvas)
			viewers.push(image)
			viewport.addEventListener('mouseenter', () => {
				stopWindowScroll.enable = true
				this.subrenderer.setOnFocus(key, true)
				//image.sizeReload()
			})
			viewport.addEventListener('mouseleave', () => {
				stopWindowScroll.enable = false
				this.subrenderer.setOnFocus(key, false)
				//image.sizeReload()
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
				console.log(this.index)
			})


			// these tools inside the function bar used to justify the images information
			let functionBar = viewport.querySelector('.viewer-bar')

			let funcbtns = {
				sizeControl: {
					enable:true,
					imgsrc: './../img/svg/maximun.svg',
					value:-1,
					process: (e, axis, btn) => {
						
						let prev = funcbtns.sizeControl.value
						if (prev != -1 && imageViewer[prev] != viewport && imageViewer[prev].dataset.toggle == 'on') {
							imageViewer[prev].classList.remove('centerViewer')
							imageViewer[prev].dataset.toggle = 'off'
							spacer[prev].style.display = 'none'
							prev = -1
						}

						if (viewport.dataset.toggle == 'on') {
							viewport.classList.remove('centerViewer')
							viewport.dataset.toggle = 'off'
							spacer[key].style.display = 'none'
							prev = -1

							e.srcElement.style.transform = `rotate(0deg)`
						}
						else {
							viewport.classList.add('centerViewer')
							viewport.dataset.toggle = 'on'
							spacer[key].style.display = 'flex'
							prev = key

							e.srcElement.style.transform = `rotate(180deg)`
						}

						setTimeout(() => {
							viewers[key].sizeReload()
						}, 500)
						viewers[key].sizeReload()
	
					}
				},
				infoEnable: {
					enable: false,
					imgsrc: './../img/svg/info.svg',
					process: (e, axis, btn) => {}
				},
				moveTop: {
					enable: true,
					imgsrc: './../img/svg/movetop.svg',
					process: (e, axis, btn) => {
						let value = (this.uvdDims[2 - axis] > 0) ? 0 : -1 
						this.index[axis] = value
						slider[axis].value = value
						this.sliderUpdate(axis)
					}
				},
				moveCenter: {
					enable: true,
					imgsrc: './../img/svg/movecenter.svg',
					process: (e, axis, btn) => {
						let value = parseInt(Number(this.uvdDims[2 - axis] / 2 - 1))
						this.index[axis] = value
						slider[axis].value = value
						this.sliderUpdate(axis)
					}
				},
				moveDown: {
					enable: true,
					imgsrc: './../img/svg/movedown.svg',
					process: (e, axis, btn) => {
						let value = this.uvdDims[2 - axis] - 1
						this.index[axis] = value
						slider[axis].value = value
						this.sliderUpdate(axis)
					}
				},
				exposureInc: {
					enable: true,
					imgsrc: './../img/svg/exposureInc.svg',
					process: (e, axis, btn) => {
						let mImg = this.managers.maskImages[axis]
						if (mImg.exposure < 2) {
							mImg.exposure += 0.1
							this.sliderUpdate(axis)
                        }
                    }
				},
				exposureDec: {
					enable: true,
					imgsrc: './../img/svg/exposureDec.svg',
					process: (e, axis, btn) => {
						let mImg = this.managers.maskImages[axis]
						if (mImg.exposure > 0.1) {
							mImg.exposure -= 0.1
							this.sliderUpdate(axis)
						}
					}
				},
				contrastInc: {
					enable: true,
					imgsrc: './../img/svg/contrastInc.svg',
					process: (e, axis, btn) => {
						let mImg = this.managers.maskImages[axis]
						if (mImg.contrast < 2) {
							mImg.contrast += 0.1
							this.sliderUpdate(axis)
						}
					}
				},
				contrastDec: {
					enable: true,
					imgsrc: './../img/svg/contrastDec.svg',
					process: (e, axis, btn) => {
						let mImg = this.managers.maskImages[axis]
						if (mImg.contrast > 0.1) {
							mImg.contrast -= 0.1
							this.sliderUpdate(axis)
						}
					}
				},
			}

			for (let funcname in funcbtns) {
				let bfunc = funcbtns[funcname]

				if (!bfunc.enable) {
					continue
				}

				let btn = document.createElement('button')
				let img = document.createElement('img')
				img.src = bfunc.imgsrc
				img.style.transition = 'transform 0.5s';
				img.style.transform = '0deg';

				btn.appendChild(img)
				btn.onclick = (e) => {
					bfunc.process(e, key, btn)
				}

				btn.classList.add('barfunc')

				functionBar.appendChild(btn)
            }
		})
		
		this.managers = new SegmentManager(viewers)
		
		let dcmVolume = document.getElementById("dcmVolume");
		this.modelViewer = new ModelViewer(dcmVolume)
		let dcmBody = document.getElementById("dcmBody");
		this.subrenderer = new SubRenderer(dcmBody);

		//synchronize

		this.modelViewer.sceneObject.windowControl.addEventListener('change', () => {
			
			let mPosition = this.modelViewer.sceneObject.camera.position
			//let mTarget = this.modelViewer.sceneObject.camera.
			let pos = mPosition.clone().normalize().multiplyScalar(8)
			this.subrenderer.camera.position.set(pos.x, pos.y, pos.z)
			this.subrenderer.camera.lookAt(0, 0, 0)
			this.subrenderer.renderScene()
			//this.subrenderer.camera.rotation.set(mRotation)
		})
	}

	sliderUpdate (axis) {

		let counter = this.domElement.getElementsByClassName("counter")
		let exposure = this.domElement.getElementsByClassName("exposure")
		let contrast = this.domElement.getElementsByClassName("contrast")
		let mImgs = this.managers.maskImages
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

		// value between -1 ~ 1
		exposure[axis].textContent = Math.round(mImgs[axis].exposure * 10 - 10) / 10
		contrast[axis].textContent = Math.round(mImgs[axis].contrast * 10 - 10) / 10
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

	setModelVolume(volume) {

    }

	setModelData(name, volDims, dataBuffer, thickness) {
		this.setDcmViewerDims(volDims, dataBuffer, thickness)
		let xyzDims = [volDims[0], volDims[2], volDims[1]]
		this.modelViewer.cardiacObject.thickness = [thickness[0], thickness[2], thickness[1]]
		this.subrenderer.thickness = [thickness[0], thickness[2], thickness[1]]
		this.subrenderer.setClippingDim(xyzDims)
		//marchingCubes.set_volume(dataBuffer['mask'], volDims[0], volDims[1], volDims[2]);
	}

	setDcmViewerDims(uvdDims, dataBuffer, thickness) {
		
		this.uvdDims[0] = uvdDims[0]
		this.uvdDims[1] = uvdDims[1]
		this.uvdDims[2] = uvdDims[2]

		//this.dataBuffer = dataBuffer
		//update canvas size
		this.managers.setBaseSegment(dataBuffer, uvdDims)

		this.managers.maskImages[axisUV].thickness = [thickness[0], thickness[1]]
		this.managers.maskImages[axisUD].thickness = [thickness[0], thickness[2]]
		this.managers.maskImages[axisVD].thickness = [thickness[1], thickness[2]]

		this.managers.maskImages[axisUV].setMaskSize(uvdDims[0], uvdDims[1])
		this.managers.maskImages[axisUD].setMaskSize(uvdDims[0], uvdDims[2])
		this.managers.maskImages[axisVD].setMaskSize(uvdDims[1], uvdDims[2])

		let slider = this.domElement.getElementsByClassName("viewer-slider")
		for (let i = 0; i < 3; i++) {
			slider[i].min = 0
			slider[i].max = uvdDims[2 - i] - 1
			slider[i].value = (uvdDims[2 - i] > 0) ? 0 : -1
			this.index[i] = (uvdDims[2 - i] > 0) ? 0 : -1
		}

		this.updateDcmView()
	}

	updateDcmView() {
		this.sliderUpdate(axisUV)
		this.sliderUpdate(axisUD)
		this.sliderUpdate(axisVD)
	}

	generateModel() {
		let segment = this.managers.segState.focusedSegment
		let dims = segment.dims
		let data = segment.data
		this.modelViewer.setModelData(dims, data)
		this.modelViewer.modelUpdate(0)
	}
}



export { DcmController }

