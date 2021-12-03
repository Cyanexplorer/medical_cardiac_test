import * as THREE from "./build/three.module.js";
import { DcmController } from "./dcmController.js";
import { dualSlider } from "./views/dualSlider.js";
import { STLExporter } from "./example/jsm/exporters/STLExporter.js";
import { PLYExporter } from "./example/jsm/exporters/PLYExporter.js";
import { NRRDLoader } from "./example/jsm/loaders/NRRDLoader.js";

let fileRegex = /(\w+)_(\d+)[x,_](\d+)[x,_](\d+)_(\w+)[_s(\d+)]?\.*/;

let dcmController = null
let changeEvent = new Event('change')
let clickEvent = new Event('click')
let inputEvent = new Event('input')

const colormaps = {
	"Cool Warm": new THREE.TextureLoader().load("colormaps/cool-warm-paraview.png"),
	"Matplotlib Plasma": new THREE.TextureLoader().load("colormaps/matplotlib-plasma.png"),
	"Matplotlib Virdis": new THREE.TextureLoader().load("colormaps/matplotlib-virdis.png"),
	"Rainbow": new THREE.TextureLoader().load("colormaps/rainbow.png"),
	"Samsel Linear Green": new THREE.TextureLoader().load("colormaps/samsel-linear-green.png"),
	"Samsel Linear YGB 1211G": new THREE.TextureLoader().load("colormaps/samsel-linear-ygb-1211g.png"),
};

let showProgress = function (option, title, cancellable) {
	requestAnimationFrame(() => {
		let loadingText = document.getElementById('loadingText')
		let progressCancelBtn = document.getElementById('progressCancelBtn')
		let progressModal = bootstrap.Modal.getOrCreateInstance(document.getElementById('progressModal'))
		
		if (option) {
			loadingText.innerHTML = title
			progressModal.show()
		}
		else {
			progressModal.hide()
		}

		if (cancellable) {
			progressCancelBtn.classList.remove("display", "none")
			progressCancelBtn.classList.add("display", "inline")
		}
		else {
			progressCancelBtn.classList.remove("display", "inline")
			progressCancelBtn.classList.add("display", "none")
		}
	})
}

let setProgress = function (value) {
	let loadingCounter = document.getElementById('loadingCounter')
	let loadingProgressBar = document.getElementById('loadingProgressBar')
	value = Math.round(value * 1000) / 10
	setTimeout(() => {
		loadingCounter.innerHTML = `${value}%`
		loadingProgressBar.style.width = `${ value }%`
    },10)
	
}

class multiOptSelectList {
	constructor(domElement) {
		this.domElement = domElement
		domElement.style['overflow-y'] = 'scroll'
		this.segState = null
	}

	reload = () => {
		if (this.segState == null || this.segState.segments == null)
			return

		let seg = this.segState.segments
		this.domElement.innerHTML = ''
		for (let i = 0; i < seg.length; i++) {
			let focused = false

			if (this.segState.focusedSegIndex == i) {
				focused = true
			}

			this.push(seg[i].name, seg[i].color, seg[i].visible, focused)
		}
    }

	push = (name, color, visible, focused) => {
		let segInfo = document.createElement('div')
		segInfo.classList.add('row', 'seg')

		let colorInfo = document.createElement('input')
		colorInfo.type = 'color'
		colorInfo.style.border = '0px'
		colorInfo.style.padding = '0px'
		colorInfo.classList.add('col-2')
		colorInfo.value = color

		let nameInfo = document.createElement('div')
		nameInfo.classList.add('col-7')
		nameInfo.innerText = name

		let funcEye = document.createElement('button')
		funcEye.type = 'button'
		funcEye.classList.add('col-3', 'btn', 'btn-sm')
		funcEye.dataset.toggle = 'on'

		if (visible) {
			funcEye.innerText = 'visible'
		}
		else {
			funcEye.innerText = 'invis'
		}

		//let divider = document.createElement('div')
		//divider.classList.add('col-1 verticalDiv')

		segInfo.appendChild(colorInfo)
		//segInfo.appendChild(divider)
		segInfo.appendChild(nameInfo)
		//segInfo.appendChild(divider)
		segInfo.appendChild(funcEye)
		this.domElement.appendChild(segInfo)

		let focus = () => {
			let seg = this.domElement.getElementsByClassName('seg')
			this.segState.focusedSegIndex = -1

			for (let i = 0; i < seg.length; i++) {
				seg[i].style.backgroundColor = ''
				if (seg[i] === segInfo) {
					this.selectedIndex = i
                }
			}

			segInfo.style.backgroundColor = 'bisque'
			dcmController.managers.notify()
		}

		let chi = segInfo.children
		segInfo.addEventListener('click', focus)
		for (let i = 0; i < chi.length; i++) {
			chi[i].addEventListener('click', focus)
		}

		colorInfo.addEventListener('change', (evt) => {
			let index = this.segState.focusedSegIndex
			let seg = this.segState.segments[index]
			seg.color = evt.target.value
			dcmController.updateDcmView()
			//console.log(evt.target.value)
		})

		funcEye.addEventListener('click', () => {
			let index = this.segState.focusedSegIndex
			let seg = this.segState.segments[index]

			if (funcEye.dataset.toggle == 'on') {
				funcEye.dataset.toggle = 'off'
				funcEye.innerText = 'invis'
				seg.visible = false
			}
			else if (funcEye.dataset.toggle == 'off') {
				funcEye.dataset.toggle = 'on'
				funcEye.innerText = 'visible'
				seg.visible = true
			}
			dcmController.managers.notify()
		})

		nameInfo.addEventListener('mouseover', (e) => {
			e.preventDefault()
		})

		if (focused) {
			focus()
		}
	}

	remove = (order) => {
		let seg = this.domElement.getElementsByClassName('seg')

		if (seg.length > 0 && seg>=0 && order < seg.length)
			this.domElement.removeChild(seg[order])
	}

	set selectedIndex(x) {
		this.segState.focusedSegIndex = x
	}

	get selectedIndex() {
		return this.segState.focusedSegIndex
	}

	get value() {
		return this.segState.focusedSegIndex
    }

	get length() {
		return this.segState.segments.length
	}

	indexOf(x){
		return this.segState.segments[x]
    }
}

class Page {
	constructor(domElement) {
		this.type = {
			boolean: 0,
			checkbox: 1,
			radioBtn: 2,
			slider: 3,
			dslider: 4,
			group: 5
		}

		let controller = {}
		let content = document.createElement('div')
		content.style = 'width:100%; display:flex; flex:1 1 auto; flex-direction:column'

		if (domElement != null) {
			domElement.appendChild(content)
		}

		this.createGroup = (title) => {
			let label = document.createElement('label')
			label.innerHTML = title

			content.appendChild(label)

			controller[title] = {label:label}
        }

		this.addBoolean = (title, initValue) => {
			let label = document.createElement('label')
			label.innerHTML = title

			let input = document.createElement('input')
			input.type = 'checkbox'
			input.checked = false

			if (initValue == 1) {
				input.checked = true
			}

			label.appendChild(input)
			content.appendChild(label)

			controller[title] = input
		}

		this.addSingleOption = (title, options, initValue) => {
			let label = document.createElement('label')
			label.innerHTML = title

			let form = document.createElement('form')

			for (let i = 0; i < options.length; i++) {
				let option = document.createElement('input')
				option.type = 'radio'
				option.name = title
				option.innerText = options
				option.value = options

				if (initValue == i) {
					option.checked = true
				}

				form.appendChild(option)
			}
			content.appendChild(form)
			
			controller[title] = form
		}

		this.addSelector = (title, options, initValue) => {
			let label = document.createElement('label')
			label.innerHTML = title

			let selector = document.createElement('select')

			for (let i = 0; i < options.length; i++) {
				let option = document.createElement('option')
				option.innerHTML = options
				option.value = i
			}

			if (initValue != null && initValue < options.length) {
				selector.selectedIndex = initValue
			}

			content.appendChild(selector)
			controller[title] = selector
		}
	}
}

class ModelPage extends Page {
	constructor() {
		super()
		// show 3D
		let generateModelBtn = document.getElementById('generate-model-btn')
		generateModelBtn.addEventListener('click', () => {
			dcmController.generateModel()
		})
    }
}

class ToolsPage extends Page {
	constructor() {
		let scissor = document.getElementById('scissorBtn')
		let board = document.getElementById('paintingBoard')
		let canvas = document.createElement('canvas')
		canvas.width = window.innerWidth
		canvas.height = window.innerHeight
		board.appendChild(canvas)

		let ctx = canvas.getContext('2d')

		let getMousePos = (canvas, evt) => {
			let rect = canvas.getBoundingClientRect()
			let scaleX = (evt.clientX - rect.left) * (canvas.width / rect.width)
			let scaleY = (evt.clientY - rect.top) * (canvas.height / rect.height)
			let intX = parseInt(scaleX)
			let intY = parseInt(scaleY)
			return { x: intX, y: intY }
		}

		window.addEventListener('resize', () => {
			canvas.width = window.innerWidth
			canvas.height = window.outerHeight
        })

		board.addEventListener('mousedown', () => {
			ctx.beginPath()
			let pos = getMousePos(evt, canvas)
			ctx.moveTo(pos.x, pos.y)
		})

		board.addEventListener('mousemove', (evt) => {
			let pos = getMousePos(evt, canvas)
			ctx.lineTo(pos.x, pos.y)
		})

		board.addEventListener('mouseup', () => {
			ctx.closePath()
			ctx.fill()
			let mask = ctx.getImageData(0, 0, canvas.width, canvas.height).data
		})

		scissor.addEventListener('change', () => {
			
			let state = board.dataset.toggle
			if (state == 'on') {
				board.style.display = 'none'
				state = 'off'
			}
			else {
				board.style.display = 'static'
				state = 'on'
            }
			
        })
    }
}

/**
 function segmentListReload() {
	let segmentList = document.getElementById('segment_list')
	let selectedIndex = segmentList.selectedIndex
	let segments = dcmController.managers.segState.segments

	// clear list content
	segmentList.innerHTML = ''

	// synchronize segments information
	for (let i = 0; i < segments.length; i++) {
		var opt = document.createElement('option')
		opt.innerHTML = segments[i].name
		opt.value = i
		segmentList.add(opt)
		segmentList.selectedIndex = segmentList.length - 1
	}

	// recover previous selected index
	if (selectedIndex < segments.length) {
		segmentList.selectedIndex = selectedIndex
	}
	else {
		segmentList.selectedIndex = segmentList.length - 1
	}

	segmentList.dispatchEvent(new Event('change'))

}
 
 */

class SegmentsPage extends Page {
	constructor() {
		super()
		this.parameter = {
			iso: 75,
			distance: 10,
			speedUp: 2
		}
		let toolPanel = document.getElementById('segmentPage_controlPanel')	
		let toolSelector = document.getElementById('tools-group')
		let toolBtns = toolSelector.getElementsByTagName('button')
		let tools = toolPanel.getElementsByClassName('tool')

		let initToolSelector = () => {

			
			// tools manager
			let managerMode = dcmController.managers.mode
			for (let i = 0; i < toolBtns.length; i++) {
				toolBtns[i].addEventListener('click', (evt) => {
					
					for (let option = 0; option < toolBtns.length; option++) {
						toolBtns[option].classList.remove('active')
						tools[option].classList.remove('d-flex')
						tools[option].classList.add('d-none')
					}

					toolBtns[i].classList.add('active')
					tools[i].classList.remove('d-none')
					tools[i].classList.add('d-flex')

					dcmController.managers.setManagerTools(managerMode[toolBtns[i].dataset.mode])
				})
			}

			// Brush Size
			let brushSizeForm = document.forms['brushSize']
			let radioBtn = brushSizeForm.querySelector('input')
			radioBtn.checked = true
			brushSizeForm.addEventListener('change', (evt) => {
				dcmController.managers.brushTools.radius = evt.target.value
			})

			let brushState = document.getElementById('segmentPage_controlPanel_brushState')
			let options = brushState.children
			let brushMode = dcmController.managers.brushTools.mode
			for (let i = 0; i < options.length; i++) {

				options[i].addEventListener('click', (evt) => {
					for (let j = 0; j < options.length; j++) {
						options[j].classList.remove('active')
					}
					options[i].classList.add('active')
					dcmController.managers.brushTools.state = brushMode[options[i].dataset.mode]
                })
            }

			// Region Growing
			let regionGrowingBiasForm = document.forms['regionGrowingBias']
			let inputs = regionGrowingBiasForm.getElementsByTagName('input')

			inputs[0].min = 0
			inputs[0].max = 10
			inputs[0].value = 5
			inputs[0].addEventListener('change', (evt) => {
				dcmController.managers.regionGrowing.bias = parseInt(evt.target.value)
			})
			inputs[0].dispatchEvent(changeEvent)

			let regionGrowingModeForm = document.forms['regionGrowingMode']
			let rgmode = dcmController.managers.regionGrowing.mode
			regionGrowingModeForm.addEventListener('change', (evt) => {
				dcmController.managers.regionGrowing.state = rgmode[evt.target.value]
			})

			// Threshold
			let isovalueSlider = document.getElementById("dual_slider");
			let isoValueInput = document.getElementById('input-isovalue');
			let distanceInput = document.getElementById('input-distance')

			let ds = new dualSlider(isovalueSlider, 0, 255)
			ds.setLowerValue(65)
			ds.setHigherValue(80)
			ds.event((lv, hv) => {
				isoValueInput.value = lv
				distanceInput.value = hv
				dcmController.managers.thresholdTools.l_limit = ds.getLowerValue()
				dcmController.managers.thresholdTools.r_limit = ds.getHigherValue()
			})

			isoValueInput.value = ds.getLowerValue()
			isoValueInput.addEventListener('change', function (evt) {
				ds.setLowerValue(evt.target.value)
				dcmController.managers.thresholdTools.l_limit = ds.getLowerValue()
			})

			distanceInput.value = ds.getHigherValue()
			distanceInput.addEventListener('change', (evt) => {
				ds.setHigherValue(evt.target.value)
				dcmController.managers.thresholdTools.r_limit = ds.getHigherValue()
			})

			inputIsovalueApply.addEventListener('click', () => {
				dcmController.managers.thresholdTools.process()
			})

			isoValueInput.dispatchEvent(changeEvent)
			distanceInput.dispatchEvent(changeEvent)

			// Logic Operation
			let logicSegForm = document.forms['logicSeg']
			let sourceSelector = logicSegForm.elements.source

			sourceSelector.addEventListener('click', () => {
				if (sourceSelector.dataset.toggle == 'on') {
					sourceSelector.dataset.toggle = 'off'
				}
				else if (sourceSelector.dataset.toggle == 'off'){
					sourceSelector.dataset.toggle = 'on'

					//preserve the previous selected option
					let index = sourceSelector.selectedIndex
					index = (index >= list.length) ? -1 : index

					sourceSelector.innerHTML = ''
					let option = new Option('------', -1)
					sourceSelector.options.add(option)

					//reload options from the segments information
					for (let i = 0; i < list.length; i++) {
						//if (i == list.selectedIndex)
							//continue

						option = new Option(list.indexOf(i).name, i)
						sourceSelector.options.add(option)
                        
					}

					//restore the previous selected option
					sourceSelector.selectedIndex = index
				}

			})

			let logicFuncElements = document.forms['logicFunc'].elements
			let logicMode = dcmController.managers.logicTools.mode
			logicFuncElements.intersection.addEventListener('click', () => {
				dcmController.managers.logicTools.state = logicMode.INTERSECTION
				dcmController.managers.logicTools.process(sourceSelector.value)
			})

			logicFuncElements.exclusive.addEventListener('click', () => {
				dcmController.managers.logicTools.state = logicMode.EXCLUSIVE
				dcmController.managers.logicTools.process(sourceSelector.value)
			})

			logicFuncElements.union.addEventListener('click', () => {
				dcmController.managers.logicTools.state = logicMode.UNION
				dcmController.managers.logicTools.process(sourceSelector.value)
			})

			logicFuncElements.boolean.addEventListener('click', () => {
				dcmController.managers.logicTools.state = logicMode.BOOLEAN
				dcmController.managers.logicTools.process(sourceSelector.value)
			})

			logicFuncElements.copy.addEventListener('click', () => {
				dcmController.managers.logicTools.state = logicMode.COPY
				dcmController.managers.logicTools.process(sourceSelector.value)
			})

			// Morphology
			let morphologyFuncElements = document.forms['morphologyForm'].elements
			let morphMode = dcmController.managers.morphologyTools.mode

			morphologyFuncElements.erode.addEventListener('click', () => {
				dcmController.managers.morphologyTools.state = morphMode.ERODE
				dcmController.managers.morphologyTools.process()
			})

			morphologyFuncElements.dilate.addEventListener('click', () => {
				dcmController.managers.morphologyTools.state = morphMode.DILATE
				dcmController.managers.morphologyTools.process()
			})

			morphologyFuncElements.medium.addEventListener('click', () => {
				dcmController.managers.morphologyTools.state = morphMode.MEDIUM
				dcmController.managers.morphologyTools.process()
			})

			morphologyFuncElements.gaussian.addEventListener('click', () => {
				dcmController.managers.morphologyTools.state = morphMode.GAUSSIAN
				dcmController.managers.morphologyTools.process()
			})

			morphologyFuncElements.close.addEventListener('click', () => {
				dcmController.managers.morphologyTools.state = morphMode.CLOSE
				dcmController.managers.morphologyTools.process()
			})

			morphologyFuncElements.open.addEventListener('click', () => {
				dcmController.managers.morphologyTools.state = morphMode.OPEN
				dcmController.managers.morphologyTools.process()
			})

		}

		//let segmentList = document.getElementById('segment_list')
		let segmentList_n = document.getElementById('segment_list_n')
		let addSegmentBtn = document.getElementById('add_segment_btn')
		let removeSegmentBtn = document.getElementById('remove_segment_btn')
		let forwardBtn = document.getElementById('previous_step_btn')
		let backwardBtn = document.getElementById('next_step_btn')

		//let visCtlBtn = document.getElementById('vis_ctl_btn')
		let inputIsovalueApply = document.getElementById('input-isovalue-apply')

		let list = new multiOptSelectList(segmentList_n)
		list.segState = dcmController.managers.segState

		let postprocess = () => {
			if (dcmController.managers.segState.segments.length <= 0) {
				for (let i = 0; i < toolBtns.length; i++) {
					toolBtns[i].disabled = true
				}
				toolPanel.classList.add('d-none')
				dcmController.managers.disableAll()
			}
			else {
				let btnGroup = toolSelector.getElementsByTagName('button')
				for (let i = 0; i < btnGroup.length; i++) {
					btnGroup[i].disabled = false
				}
				toolPanel.classList.remove('d-none')
			}

			list.reload()
		}

		addSegmentBtn.addEventListener('click', () => {
			dcmController.managers.listControlTools.state = dcmController.managers.listControlTools.mode.CREATE
			dcmController.managers.listControlTools.process()
			postprocess()
		})

		removeSegmentBtn.addEventListener('click', () => {
			dcmController.managers.listControlTools.state = dcmController.managers.listControlTools.mode.REMOVE
			dcmController.managers.listControlTools.process()
			postprocess()
		})

		forwardBtn.addEventListener('click', () => {
			dcmController.managers.slc.undo()
			postprocess()
		})

		backwardBtn.addEventListener('click', () => {
			dcmController.managers.slc.redo()
			postprocess()
		})

		dcmController.managers.slc.onload = ((previous, next) => {
			forwardBtn.disabled = !previous
			backwardBtn.disabled = !next			
		})

		this.reset = () => {
			while (dcmController.managers.segState.segments.length > 0) {
				dcmController.managers.listControlTools.state = dcmController.managers.listControlTools.mode.CREATE
				dcmController.managers.listControlTools.process()
			}

			postprocess()
		}

		initToolSelector()
		this.reset()
	}
}

class DisplayPage extends Page {
	constructor() {
		super()
		this.parameter = {
			clipping: 0,
			display: 0,
			renderMode: 0,
			light: 10
		}

		let horizontalClipping = document.getElementById("HzClpFc")
		let coronalClipping = document.getElementById("CrClpFc")
		let saggitalClipping = document.getElementById("SgClpFc")
		let showVolume = document.getElementById("showVolume");
		let showMesh = document.getElementById("showMesh");
		let lightIntensitySlider = document.getElementById('light-intensity-slider')
		let showWireLine = document.getElementById('showWirLine')
		let showPolygen = document.getElementById('showPolygen')
		let selector = document.getElementById("colormapList")

		showVolume.checked = false;
		showVolume.addEventListener('change', function () {
			dcmController.modelViewer.setVolumeVisible(showVolume.checked)
		})

		showMesh.checked = true;
		showMesh.addEventListener('change', function () {
			dcmController.modelViewer.setMeshVisible(showMesh.checked)
		})

		showWireLine.checked = true
		showWireLine.addEventListener('change', () => {
			dcmController.modelViewer.setRenderMode('wireline', showWireLine.checked)
		})

		showPolygen.checked = true
		showPolygen.addEventListener('change', () => {
			dcmController.modelViewer.setRenderMode('polygen', showPolygen.checked)
		})

		horizontalClipping.addEventListener('change', function () {
			dcmController.modelViewer.setClippingEnable(axisXZ, horizontalClipping.checked)
		})
		horizontalClipping.checked = false;
		saggitalClipping.dispatchEvent(changeEvent)

		coronalClipping.addEventListener('change', function () {
			dcmController.modelViewer.setClippingEnable(axisXY, coronalClipping.checked)
		})
		coronalClipping.checked = false;
		saggitalClipping.dispatchEvent(changeEvent)

		saggitalClipping.addEventListener('change', function () {
			dcmController.modelViewer.setClippingEnable(axisYZ, saggitalClipping.checked)
		})
		saggitalClipping.checked = false;
		saggitalClipping.dispatchEvent(changeEvent)

		lightIntensitySlider.min = 1
		lightIntensitySlider.max = 5
		lightIntensitySlider.value = 2
		lightIntensitySlider.addEventListener('input', (evt) => {
			let profit = dcmController.modelViewer.getLightProfit()
			profit.intensity = parseInt(evt.target.value)
			dcmController.modelViewer.setLightProfit(profit)
		})
		lightIntensitySlider.dispatchEvent(inputEvent)

		let profit = dcmController.modelViewer.getLightProfit()
		profit.intensity = parseInt(lightIntensitySlider.value)
		//profit.distance = parseInt(100)
		dcmController.modelViewer.setLightProfit(profit, false)

		for (let p in colormaps) {
			let opt = document.createElement("option");
			opt.value = p;
			opt.innerHTML = p;
			selector.appendChild(opt);
		}

		selector.addEventListener("change", () => {
			volumeColorMapUpdate()
		});
    }
}

class FileDownload {
	constructor() {
		this.modelType = ['STL', 'PLY']
		this.segmentType = ['RAW', 'JPG', 'PNG']

		let downloadLink = document.createElement('a')
		let stlExporter = new STLExporter()
		let plyExporter = new PLYExporter()

		let cav = document.createElement('canvas')
		let context = cav.getContext('2d')

		let saveArrayBuffer = function (buffer, filename) {
			let blob = new Blob([buffer], { type: 'application/octet-stream' })
			downloadLink.href = URL.createObjectURL(blob);
			downloadLink.download = filename;
			downloadLink.click();
		}

		let saveBlobBuffer = function (blob, filename) {
			downloadLink.href = URL.createObjectURL(blob);
			downloadLink.download = filename;
			downloadLink.click();
		}

		let saveCanvasImg = function (url, filename) {

			downloadLink.href = url
			downloadLink.download = filename;
			downloadLink.click();
		}

		this.segmentsProcess = function (mode, filename, buffer, width, height) {

			if (buffer == null) {
				return
			}

			let format = ''
			let zip = new JSZip()
			let mine = ''

			let downloadZip = (filename, format, mine, buffer) => {
				let blobs = []
				let imgData = context.getImageData(0, 0, width, height)

				let onload = () => {
					for (let j = 0; j < blobs.length; j++) {
						let name = filename + '_layer' + j + format
						zip.file(name, blobs[j])
					}

					zip.generateAsync({
						type: "blob",
						compression: "DEFLATE",
						compressionOptions: {
							level: 9
						}
					})
						.then(function (content) {
							saveBlobBuffer(content, filename)
						});
				}

				cav.width = width
				cav.height = height

				if (buffer.length == 1) {
					imgData.data.set(buffer[0])
					context.putImageData(imgData, 0, 0)

					cav.toBlob((blob) => {
						saveArrayBuffer(blob, filename + format)
					}, mine)

					return
				}

				for (let i = 0; i < buffer.length; i++) {
					imgData.data.set(buffer[i])
					context.putImageData(imgData, 0, 0)

					cav.toBlob((blob) => {
						blobs.push(blob)
						console.log('zip:' + blobs.length)
						if (blobs.length == buffer.length) {
							onload()
						}
					}, mine)
				}
            }	

			switch (mode) {
				case this.segmentType[0]:
					format = '.raw'
					filename += format
					saveArrayBuffer(buffer, filename)
					break
				case this.segmentType[1]:
					format = '.jpg'
					mine = "image/jpg"
					downloadZip(filename, format, mine, buffer)
					break
				case this.segmentType[2]:
					format = '.png'
					mine = "image/png"
					downloadZip(filename, format, mine, buffer)
					break
				default:
					alert('Format not support!')
					return
					break
			}
        }

		this.rawProcess = function (filename, data) {
			let result = data
			let format = '.raw'
			if (result != null) {
				saveArrayBuffer(result, filename + format);
			}	
        }

		this.modelProcess = function (mode, filename, data) {
			if (data == null) {
				alert('No model data!')
				return
			}

			let result = null
			let format = ''
			switch (mode) {
				case this.modelType[0]:
					result = stlExporter.parse(data, { binary: true });
					format = '.stl';
					break
				case this.modelType[1]:
					result = plyExporter.parse(data, { binary: true });
					format = '.ply';
					break
				default:
					alert('Format not support!')
					return
					break
			}

			if (result != null) {
				saveArrayBuffer(result, filename + format);
			}
		}
    }
}

class DownloadPage extends Page {
	constructor() {
		super()
		let modelTypeSelector = document.getElementById('downloadPage_modelType');
		let segmentTypeSelector = document.getElementById('downloadPage_segmentType');
		let genModelBtn = document.getElementById('downloadPage_modelGen');
		let genRawBtn = document.getElementById('downloadPage_rawGen');
		let genSegBtn = document.getElementById('downloadPage_singleSegGen');
		let genAllModelBtn = document.getElementById('downloadPage_modelGenAll')
		let genAllSegBtn = document.getElementById('downloadPage_multiSegGen')
		let downloader = new FileDownload()
		
		genAllModelBtn.addEventListener('click', () => {
			showProgress(true, "model generating", true)
			setProgress(0)
			setTimeout(() => {
				dcmController.generateAllModel((currentValue, totalValue) => {
					setProgress(currentValue / totalValue * 100)
					let mesh = dcmController.modelViewer.getMesh()
					downloader.modelProcess(modelTypeSelector.value,'model', mesh)
					if (currentValue == totalValue) {
						showProgress(false)
					}
				})
			}, 10)
		})

		genModelBtn.addEventListener('click', () => {
			let mesh = dcmController.modelViewer.getMesh()
			downloader.modelProcess(modelTypeSelector.value, 'model', mesh)
		})

		//RAW
		genRawBtn.addEventListener('click', () => {
			let rawData = dcmController.managers.segState.base.data
			let dims = dcmController.managers.segState.base.dims
			downloader.rawProcess('model_' + dims[0] + '_' + dims[1] + '_' + dims[2] + '_uint8', rawData.buffer)
		})

		genAllSegBtn.addEventListener('click', () => {
			let segs = dcmController.managers.segState.segments
			let layer = segs[0].layer
			let buffer = []
			
			for (let i = 0; i < segs.length; i++) {

				let width = segs[i].dims[0]
				let height = segs[i].dims[1]

				for (let j = 0; j < layer; j++) {
					buffer.push(segs[i].getBuffer(0, j))
				}
				downloader.segmentsProcess(segmentTypeSelector.value, 'segment' + i, buffer, width, height)
			}
			
		})

		genSegBtn.addEventListener('click', () => {
			let index = dcmController.managers.segState.focusedSegIndex
			if (index == -1) {
				alert('No selected segment.')
				return
			}

			//let layer = dcmController.managers.segState.index[0]
			let buffer = []
			buffer.push(dcmController.managers.getFocusedLayer(0))
			let segs = dcmController.managers.segState.segments
			let height = segs[index].dims[0]
			let width = segs[index].dims[1]
			
			downloader.segmentsProcess(segmentTypeSelector.value, 'segment' + index, buffer, width, height)
		})

		for (let i of downloader.modelType) {
			let opt = document.createElement('option');
			opt.value = i;
			opt.innerHTML = i;
			modelTypeSelector.appendChild(opt);
		}

		for (let i of downloader.segmentType) {
			let opt = document.createElement('option');
			opt.value = i;
			opt.innerHTML = i;
			segmentTypeSelector.appendChild(opt);
		}
    }
}

class ImageDataUploader {
	constructor() {
		this.type = {
			DCM: 0,
			NRRD: 1,
			RAW: 2
		}

		let getMinMax = function (dataBuffer) {
			let min = dataBuffer[0]
			let max = dataBuffer[0]
			for (let i = 0; i < dataBuffer.length; i++) {
				if (dataBuffer[i] > max) {
					max = dataBuffer[i]
				}
				if (dataBuffer[i] < min) {
					min = dataBuffer[i]
				}
			}

			return { min: min, max: max }
		}

		let bitConvertor = (buffer, bit) => {
			let dataBuffer = new Uint8Array()
			if (bit == 'uint32') {
				dataBuffer = new Uint32Array(buffer).map(x => x / 256 * 256)
				dataBuffer = new Uint8ClampedArray(dataBuffer)
			}
			else if (bit == 'uint16') {
				dataBuffer = new Uint16Array(buffer)
				let cmpSize = getMinMax(dataBuffer)
				let min = cmpSize.min
				let max = cmpSize.max
				dataBuffer = dataBuffer.map(x => (x - min) / (max - min) * 255)

				dataBuffer = new Uint8ClampedArray(dataBuffer)

			}
			else if (bit == 'uint8') {
				dataBuffer = new Uint8ClampedArray(buffer)
			}
			else {
				console.log('Format not support.')
				return
			} 
			return dataBuffer
		}

		let getDcmInfo = (image) => {
			let acquiredSliceDirection = image.getAcquiredSliceDirection()
			let acquisitionMatrix = image.getAcquisitionMatrix()
			let sliceThickness = image.getSliceThickness()
		}  

		let loadDCMFile = (files, onload) => {
			let info = ''
			let series = new daikon.Series()
			daikon.Series.useExplicitOrdering = true;

			if (files.length == 0) {
				return
			}

			let process = (index) => {
				setProgress(index / files.length)
				let fr = new FileReader();

				fr.onload = function () {
					var image = daikon.Series.parseImage(new DataView(fr.result));
					//console.log(image.getImageNumber())

					if (image === null || !image.hasPixelData()) {
						console.error(daikon.Series.parserError)
					}

					else if (series.images.length === 0 || image.getSeriesId() === series.images[0].getSeriesId()) {
						series.addImage(image)
					}

					if (series.images.length === files.length) {
						index++
						setProgress(index / files.length)
						series.buildSeries()
						
						let images = series.images
						console.log(images[0])
						let bit = 'uint' + images[0].getBitsAllocated()
						let thickness = images[0].getSliceThickness()
						let spacing = images[0].getPixelSpacing()
						
						//alert(images[0].toString())
						let d = images[0].getImageDirections()
						let matrix = new THREE.Matrix4()

						let v0 = new THREE.Vector3()
						let v1 = new THREE.Vector3()
						let v2 = new THREE.Vector3()
						let result = new THREE.Vector3()
						let volDims = new THREE.Vector3()
						let newVolDims = new THREE.Vector3(3)

						let offset = new THREE.Vector3()
						offset.set(2, 2, 2)
						v0.set(d[0], d[1], d[2])
						v1.set(d[3], d[4], d[5])

						v2.add(v0) 
						v2.add(v1) 
						v2.addScalar(1)
						v2.set(v2.x % 2, v2.y % 2, v2.z % 2)

						//console.log(v0, v1, v2)

						matrix = new THREE.Matrix3()
						matrix.set(v0.x, v1.x, v2.x, v0.y, v1.y, v2.y, v0.z, v1.z, v2.z)

						volDims.set(images[0].getCols(), images[0].getRows(), images.length)
						newVolDims = volDims.clone()
						newVolDims.applyMatrix3(matrix)
						newVolDims.set(Math.abs(newVolDims.x), Math.abs(newVolDims.y), Math.abs(newVolDims.z))
						//console.log(volDims, newVolDims)

						//let row = v0.dot(volDims)
						//let column = v1.dot(volDims)
						//let step = v2.dot(volDims)
						//console.log(row, column, step)

						series.concatenateImageData(null, (dataBuffer) => {
							dataBuffer = bitConvertor(dataBuffer, bit)
							let newBuffer = new Uint8ClampedArray(dataBuffer.length)
							let pos = new THREE.Vector3()
							for (let i = 0; i < volDims.z; i++) {
								for (let j = 0; j < volDims.y; j++) {
									for (let k = 0; k < volDims.x; k++) {
										pos.set(k, j, i)
										pos.applyMatrix3(matrix)
										pos.set(Math.abs(pos.x) ,
											Math.abs(pos.y) ,
											Math.abs(pos.z) )
										newBuffer[pos.z * newVolDims.x * newVolDims.y + pos.y * newVolDims.x + pos.x]
											= dataBuffer[i * volDims.x * volDims.y + j * volDims.x + k]
									}
								}
							}
							console.log(thickness)
							pos.set(spacing[0], spacing[1], thickness)
							pos.applyMatrix3(matrix)
							pos.set(Math.abs(pos.x),
								Math.abs(pos.y),
								Math.abs(pos.z))

							let imgInfo = {}
							imgInfo.dims = [newVolDims.x, newVolDims.y, newVolDims.z]
							imgInfo.bit = bit
							imgInfo.thickness = [Math.round(pos.x * 10) / 10, Math.round(pos.y * 10) / 10, Math.round(pos.z * 10) / 10]

							onload(imgInfo, newBuffer)
							showProgress(false)
						})
					}

					else {
						index++
						process(index)
					}
				}

				fr.readAsArrayBuffer(files[index]);
			}

			showProgress(true, "load images", false)
			process(0)
		}

		let loadNRRDFile = (file, onload) => {
			const loader = new NRRDLoader();
			loader.load(file, function (volume) {

				let imgInfo = {}
				imgInfo.dims = [volume.xLength, volume.yLength, volume.zLength]
				imgInfo.bit = volume.data.byte
				imgInfo.thickness = [1, 1, 1]

				onload(imgInfo, volume.data.buffer)
			})
		}

		let loadRAWFile = (file, onload) => {
			let fr = new FileReader();
			let filename = file.name

			let m = filename.match(fileRegex);

			let volDims, bit
			if (m.length == 6) {
				volDims = [parseInt(m[2]), parseInt(m[3]), parseInt(m[4])];
				bit = m[5]
			}
			else if (m.length == 5){
				volDims = [parseInt(m[1]), parseInt(m[2]), parseInt(m[3])];
				bit = m[4]
            }
			
			fr.onload = function () {
				let dataBuffer = new Uint16Array(fr.result).map(x => (x << 8) | (x >> 8))
				dataBuffer = bitConvertor(dataBuffer.buffer, bit)

				let imgInfo = {}
				imgInfo.dims = volDims
				imgInfo.bit = bit
				imgInfo.thickness = [1, 1, 1]

				onload(imgInfo, dataBuffer)
			}
			fr.readAsArrayBuffer(file);
        }

		this.process = (files, type, onload) => {
			switch (type) {
				case this.type.DCM:
					loadDCMFile(files, onload)
					break
				case this.type.NRRD:
					loadNRRDFile(files[0], onload)
					break
				case this.type.RAW:
					loadRAWFile(files[0], onload)
					break
				default:
					alert('Upload file not support!')
					break
            }
		}
	}
}

class HomePage extends Page {
	constructor() {
		super()
		let parameter = {
			filename: '',
			dims: { x: 0, y: 0, z: 0 },
			data: null
		}

		let uploadFileInput = document.getElementById('dcm-upload-input')
		let dcmMultiUploadInput = document.getElementById('dcm-multi-upload-input')
		let rawUploadInput = document.getElementById('dcm-raw-upload-input')
		let nrrdUploadInput = document.getElementById('dcm-nrrd-upload-input')

		let imgInfomation = document.forms['imgInfo'].elements

		let uploader = new ImageDataUploader()

		let loadFile = (evt, type) => {
			let files = evt.target.files

			if (files == null) {
				return
			}

			uploader.process(files, type, (info, data) => {
				evt.srcElement.value = ''
				imgInfomation.rows.value = info.dims[0] + ' pixels'
				imgInfomation.cols.value = info.dims[1] + ' pixels'
				imgInfomation.layer.value = info.dims[2] + ' shots'
				imgInfomation.thickness.value = info.thickness
				imgInfomation.bit.value = info.bit

				dcmController.setModelData("", info.dims, data, info.thickness)
			})
		}

		// Multi DCM DATA
		dcmMultiUploadInput.addEventListener('change', (evt) => {
			loadFile(evt, uploader.type.DCM)
		})

		// DCM DATA
		uploadFileInput.addEventListener('change', (evt) => {
			loadFile(evt, uploader.type.DCM)
		})

		// NRRD DATA
		nrrdUploadInput.addEventListener('change', (evt) => {
			loadFile(evt, uploader.type.NRRD)
		})

		// RAW DATA
		rawUploadInput.addEventListener('change', (evt) => {
			loadFile(evt, uploader.type.RAW)
		})
	}
}

class MaskPage extends Page {
	constructor() {
		super()
		let maskValueInput = document.getElementById('input-maskvalue');
		let boxMaskValueInput = document.getElementById('box-maskvalue');
		let maskValueBtn = document.getElementById('maskBtn')
		let resetBtn = document.getElementById('resetBtn')
		let mode = dcmController.managers.cropTools.mode

		maskValueInput.value = 0.7
		maskValueBtn.addEventListener('click', () => {
			dcmController.managers.cropTools.ratio = maskValueInput.value
			dcmController.managers.cropTools.state = mode.CROP
			dcmController.managers.cropTools.process()
		})

		resetBtn.addEventListener('click', () => {
			dcmController.managers.cropTools.state = mode.RESET
			dcmController.managers.cropTools.process()
        })
    }
}

let initUI = function () {
	
	let domElement = document.getElementById('dcmViewer')
	dcmController = new DcmController(domElement)

	initPageSelector()
	new SegmentsPage()
	new HomePage()
	new DisplayPage()
	new MaskPage()
	new DownloadPage()
	new ModelPage()

}

function initPageSelector() {
	let pageSelector = document.getElementById('page_selector')
	let pageBtns = pageSelector.getElementsByTagName('button')
	let pagePanel = document.getElementById('page_panel')
	let pages = pagePanel.getElementsByClassName('page')
	let prev = 0

	for (let i = 0; i < pageBtns.length; i++) {
		pageBtns[i].addEventListener('click', () => {
			if (prev != -1) {
				pageBtns[prev].classList.remove('active')
				pages[prev].classList.remove('d-flex')
				pages[prev].classList.add('d-none')
			}
			pageBtns[i].classList.add('active')
			pages[i].classList.remove('d-none')
			pages[i].classList.add('d-flex')
			prev = i
        })
	}
}

let volumeColorMapUpdate = function () {
	//dcmViewer.setVolumeColor(colormaps[colormapIndex.value])
	//dcmViewer.modelUpdate(9)
}

window.onload = function () {
	initUI()
}
