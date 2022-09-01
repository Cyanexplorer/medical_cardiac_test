import { dualSlider } from "../parts/dualSlider.js";
import { STLExporter } from "../example/jsm/exporters/STLExporter.js";
import { PLYExporter } from "../example/jsm/exporters/PLYExporter.js";
import { NRRDLoader } from "../example/jsm/loaders/NRRDLoader.js";
import * as THREE from "../build/three.module.js";
import {Page} from "../controller/template.js"

import { Kernel } from "../controller/Algorithm.js"

let fileRegex = /(\w+)_(\d+)[x,_](\d+)[x,_](\d+)_(\w+)[_s(\d+)]?\.*/;

let changeEvent = new Event('change')
let clickEvent = new Event('click')
let inputEvent = new Event('input')

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
		loadingProgressBar.style.width = `${value}%`
	}, 10)

}

class multiOptSelectList {
	constructor(managers, control) {
		let domElement = document.getElementById('segment_list_n')
		domElement.style['overflow-y'] = 'scroll'
		let addSegmentBtn = document.getElementById('add_segment_btn')
		let removeSegmentBtn = document.getElementById('remove_segment_btn')
		let exportSegmentBtn = document.getElementById('export_segment_btn')
		let importSegmentBtn = document.getElementById('import_segment_btn')
		let forwardBtn = document.getElementById('previous_step_btn')
		let backwardBtn = document.getElementById('next_step_btn')

		this.segState = managers.segState
		let segState = managers.segState

		let postprocess = () => {
			/*
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
			 */


			this.reload()
		}

		let init = () => {
			let mode = managers.listControlTools.mode
			let dlLink = document.createElement('a')
			let ulLink = document.createElement('input')

			ulLink.type = 'file'
			//ulLink.multiple = true
			ulLink.accept = '.segData'

			ulLink.addEventListener('change', (evt) => {

				if (evt.target.files.length <= 0) {
					return
				}

				let file = evt.target.files[0]

				let reader = new FileReader()
				reader.onload = () => {
					let result = reader.result
					let dataArray = new Float32Array(result)

					let width = dataArray[0]
					let height = dataArray[1]
					let depth = dataArray[2]

					addSegmentBtn.click()

					managers.segState.focusedSegment.data.set(dataArray.subarray(16))
					managers.notify()
				}

				reader.readAsArrayBuffer(file)
			})

			addSegmentBtn.addEventListener('click', () => {
				managers.listControlTools.state = mode.CREATE
				managers.listControlTools.process()
				postprocess()
			})

			removeSegmentBtn.addEventListener('click', () => {
				managers.listControlTools.state = mode.REMOVE
				managers.listControlTools.process()
				postprocess()
			})

			forwardBtn.addEventListener('click', () => {
				managers.slc.undo()
				postprocess()
			})

			backwardBtn.addEventListener('click', () => {
				managers.slc.redo()
				postprocess()
			})

			importSegmentBtn.addEventListener('click', () => {
				ulLink.click()
			})

			exportSegmentBtn.addEventListener('click', () => {
				let segment = managers.segState.focusedSegment

				if (segment == null) {
					return
				}

				let data = new Float32Array(segment.data.length + 16)
				data.set(segment.data, 16)
				data[0] = segment.dims[0]
				data[1] = segment.dims[1]
				data[2] = segment.dims[2]

				let blob = new Blob([data.buffer], { type: 'application/octet-stream' })

				dlLink.href = URL.createObjectURL(blob)
				dlLink.download = 'segment.segData'
				dlLink.click()
			})

			managers.slc.onload = ((previous, next) => {
				forwardBtn.disabled = !previous
				backwardBtn.disabled = !next
			})
		}

		this.indexOf = (x) => {
			return segState.segments[x]
		}

		this.reload = () => {
			if (segState == null || segState.segments == null)
				return

			let seg = segState.segments
			domElement.innerHTML = ''
			for (let i = 0; i < seg.length; i++) {
				let focused = false

				if (segState.focusedSegIndex == i) {
					focused = true
				}

				this.push(seg[i].name, seg[i].color, seg[i].visible, focused)
			}

			managers.notify()
		}

		this.push = (name, color, visible, focused) => {
			let segInfo = document.createElement('div')
			segInfo.classList.add('row', 'segmentlist-item')

			let colorInfo = document.createElement('input')
			colorInfo.type = 'color'
			colorInfo.value = color

			let nameInfo = document.createElement('div')
			nameInfo.innerText = name

			let funcMask = document.createElement('button')
			funcMask.type = 'button'
			funcMask.classList.add('btn', 'btn-sm')
			funcMask.dataset.toggle = 'off'
			funcMask.innerText = 'mask'

			let funcCrop = document.createElement('button')
			funcCrop.type = 'button'
			funcCrop.classList.add('btn', 'btn-sm')
			funcCrop.innerText = 'crop'

			let funcEye = document.createElement('button')
			funcEye.type = 'button'
			funcEye.classList.add('btn', 'btn-sm')
			funcEye.dataset.toggle = 'on'

			let funcRst = document.createElement('button')
			funcRst.type = 'button'
			funcRst.classList.add('btn', 'btn-sm')
			funcRst.innerText = 'clear'

			if (visible) {
				funcEye.innerText = 'visible'
			}
			else {
				funcEye.innerText = 'invis'
			}

			let pushDiv = (element, value) => {
				let div = document.createElement('div')
				div.classList.add('col-' + value)
				div.appendChild(element)
				segInfo.appendChild(div)
			}

			pushDiv(colorInfo, 1)
			pushDiv(nameInfo, 3)
			pushDiv(funcMask, 2)
			pushDiv(funcCrop, 2)
			pushDiv(funcEye, 2)
			pushDiv(funcRst, 2)

			domElement.appendChild(segInfo)

			let focus = () => {
				let seg = domElement.getElementsByClassName('segmentlist-item')

				for (let i = 0; i < seg.length; i++) {
					if (segInfo == seg[i]) {
						this.selectedIndex = i
						segInfo.classList.add('segmentlist-item-focused')
					}
					else {
						seg[i].classList.remove('segmentlist-item-focused')
					}
				}

				managers.notify()
			}

			let chi = segInfo.children
			segInfo.addEventListener('click', focus)
			for (let i = 0; i < chi.length; i++) {
				chi[i].addEventListener('click', focus)
			}
			

			colorInfo.addEventListener('change', (evt) => {
				let index = segState.focusedSegIndex
				let seg = segState.segments[index]
				seg.color = evt.target.value
				managers.notify()
				//console.log(evt.target.value)
			})

			funcCrop.addEventListener('click', () => {
				let index = segState.focusedSegIndex
				let seg = segState.segments[index]
				let base = segState.baseSegment

				if(base == null){
					console.error('Data empty!')
				}

				if(seg.data.length != base.data.length){
					console.error('Data length is not equal!')
				}

				for(let i = 0;i<seg.data.length;i++){
					if(seg.data[i] == 0){
						base.data[i] = 0
					}
				}

				managers.notify()
			})

			funcEye.addEventListener('click', () => {
				let index = segState.focusedSegIndex
				let seg = segState.segments[index]

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
				managers.notify()
			})

			funcRst.addEventListener('click', () => {
				let index = segState.focusedSegIndex
				let seg = segState.segments[index]
				seg.clear()
				managers.notify()
			})

			nameInfo.addEventListener('mouseover', (e) => {
				e.preventDefault()
			})

			if (focused) {
				focus()
			}
		}

		this.remove = (order) => {
			let seg = domElement.getElementsByClassName('segment-list-item')

			if (seg.length > 0 && seg >= 0 && order < seg.length)
				domElement.removeChild(seg[order])
		}

		init()
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
}

class ModelPage extends Page {
	constructor(managers, control) {
		super()

		// show 3D
		let generateModelBtn = document.getElementById('generate-model-btn')
		generateModelBtn.addEventListener('click', () => {
			control.calculate()
		})

		let downloader = new FileDownload()

		let modelTypeSelector = document.getElementById('downloadPage_modelType');
		let genModelBtn = document.getElementById('downloadPage_modelGen');


		genModelBtn.addEventListener('click', () => {
			console.log(control)
			downloader.modelProcess(modelTypeSelector.value, 'model', control.modelViewer.mesh)
		})

		for (let i of downloader.modelType) {
			let opt = document.createElement('option');
			opt.value = i;
			opt.innerHTML = i;
			modelTypeSelector.appendChild(opt);
		}
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
	constructor(managers, control, list) {
		super()
		this.parameter = {
			iso: 75,
			distance: 10,
			speedUp: 2
		}
		let segState = managers.segState
		let toolPanel = document.getElementById('segmentPage_controlPanel')
		let toolSelector = document.getElementById('tools-group')
		let toolBtns = toolSelector.getElementsByTagName('button')
		let tools = toolPanel.getElementsByClassName('tool')

		this.enable = () => {
			managers.enable()
		}

		this.disable = () => {
			managers.disableAll()
		}

		let initToolSelector = () => {

			// tools manager
			let mode = managers.mode
			for (let i = 0; i < toolBtns.length; i++) {
				toolBtns[i].addEventListener('click', (evt) => {

					for (let option = 0; option < toolBtns.length; option++) {
						toolBtns[option].classList.remove('active')
						tools[option].style['z-index'] = 1
					}

					toolBtns[i].classList.add('active')
					tools[i].style['z-index'] = 9

					managers.setManagerTools(mode[toolBtns[i].dataset.mode])
				})
			}

			toolBtns[0].click()
		}

		// Brush Size
		let initBrushTools = () => {
			let brushSizeForm = document.forms['brushSize']
			let brushSizeRange = brushSizeForm.querySelector('input')
			let brushSizeLabel = brushSizeForm.querySelector('label')

			brushSizeRange.addEventListener('input', (evt) => {
				brushSizeLabel.innerText = 'Brush Size x' + evt.target.value
				managers.brushTools.radius = parseInt(evt.target.value)
			})
			brushSizeRange.dispatchEvent(inputEvent)

			let brushState = document.getElementById('segmentPage_controlPanel_brushState')
			let options = brushState.children
			let mode = managers.brushTools.mode
			for (let i = 0; i < options.length; i++) {

				options[i].addEventListener('click', (evt) => {
					for (let j = 0; j < options.length; j++) {
						options[j].classList.remove('active')
					}
					options[i].classList.add('active')
					managers.brushTools.state = mode[options[i].dataset.mode]
				})
			}
		}

		// Region Growing
		let initGrowingTools = ()=> {
			let regionGrowingBiasForm = document.forms['regionGrowingBias']
			let regionGrowingLabel = document.getElementById('segment_controPanel_regionGrowingBias_label')
			let inputs = regionGrowingBiasForm.getElementsByTagName('input')

			inputs[0].min = 0
			inputs[0].max = 0.5
			inputs[0].step = 0.01
			inputs[0].value = 0.05
			inputs[0].addEventListener('input', (evt) => {
				regionGrowingLabel.textContent = 'Bias +' + evt.target.value
				managers.regionGrowing.bias = Number(evt.target.value)
			})
			inputs[0].dispatchEvent(inputEvent)

			let regionGrowingModeForm = document.forms['regionGrowingMode']
			let mode = managers.regionGrowing.mode

			regionGrowingModeForm.addEventListener('change', (evt) => {
				managers.regionGrowing.state = mode[evt.target.value]
			})

			let growingMethod = document.getElementById('segmentPage_growing_method')
			let methods = growingMethod.children
			for (let i = 0; i < methods.length; i++) {

				methods[i].addEventListener('click', (evt) => {
					for (let j = 0; j < methods.length; j++) {
						methods[j].classList.remove('active')
					}
					methods[i].classList.add('active')
					managers.regionGrowing.type = mode[methods[i].dataset.mode]
				})
			}

		}

		
		// Threshold

		let initThresholdTools = () => {
			let isovalueSlider = document.getElementById("dual_slider");
			let isoValueInput = document.getElementById('input-isovalue');
			let distanceInput = document.getElementById('input-distance')
			let inputIsovalueApply = document.getElementById('input-isovalue-apply')
			let inputIsovalueAuto = document.getElementById('input-isovalue-auto')

			let mode = managers.thresholdTools.mode

			let otsu = (histogram, total) => {
				let sum = 0;
				for (let i = 1; i < 256; ++i)
					sum += i * histogram[i];
				let sumB = 0;
				let wB = 0;
				let wF = 0;
				let mB;
				let mF;
				let max = 0.0;
				let between = 0.0;
				let threshold1 = 0.0;
				let threshold2 = 0.0;
				for (let i = 0; i < 256; ++i) {
					wB += histogram[i];
					if (wB == 0)
						continue;
					wF = total - wB;
					if (wF == 0)
						break;
					sumB += i * histogram[i];
					mB = sumB / wB;
					mF = (sum - sumB) / wF;
					between = wB * wF * (mB - mF) * (mB - mF);
					if ( between >= max ) {
						threshold1 = i;
						if ( between > max ) {
							threshold2 = i;
						}
						max = between;            
					}
					
				}
	
	
				return ( threshold1 + threshold2 ) / 2.0;
			}
	

			let ds = new dualSlider(isovalueSlider, 0, 1, 0.001)
			ds.setLowerValue(0.2)
			ds.setHigherValue(0.4)
			ds.event((lv, hv) => {
				isoValueInput.value = lv
				distanceInput.value = hv
				managers.thresholdTools.l_limit = ds.getLowerValue()
				managers.thresholdTools.r_limit = ds.getHigherValue()
			})

			isoValueInput.value = ds.getLowerValue()
			isoValueInput.addEventListener('change', function (evt) {
				ds.setLowerValue(evt.target.value)
				managers.thresholdTools.l_limit = ds.getLowerValue()
			})

			distanceInput.value = ds.getHigherValue()
			distanceInput.addEventListener('change', (evt) => {
				ds.setHigherValue(evt.target.value)
				managers.thresholdTools.r_limit = ds.getHigherValue()
			})

			inputIsovalueAuto.addEventListener('click', () => {
				let thres = managers.thresholdTools.getAutoValue()
				ds.setLowerValue(thres)
				ds.setHigherValue(1)
				ds.dispatchEvent(inputEvent)
			})

			inputIsovalueApply.addEventListener('click', () => {
				managers.thresholdTools.state = mode.MANUAL
				managers.thresholdTools.process()
			})

			isoValueInput.dispatchEvent(changeEvent)
			distanceInput.dispatchEvent(changeEvent)

		}

		// Logic Operation
		let initLogicTools = () => {
			let sourceSelector = document.getElementById('tool_logic_selector')

			sourceSelector.addEventListener('click', () => {
				if (sourceSelector.dataset.toggle == 'on') {
					sourceSelector.dataset.toggle = 'off'
				}
				else if (sourceSelector.dataset.toggle == 'off') {
					sourceSelector.dataset.toggle = 'on'
					let lsit = segState.segments
					//preserve the previous selected option
					let index = sourceSelector.selectedIndex
					index = (index > lsit.length) ? -1 : index

					sourceSelector.innerHTML = ''
					let option = new Option('------', -1)
					sourceSelector.options.add(option)

					//reload options from the segments information

					for (let i = 0; i < lsit.length; i++) {
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
			let mode = managers.logicTools.mode
			logicFuncElements.intersection.addEventListener('click', () => {
				managers.logicTools.state = mode.INTERSECTION
				managers.logicTools.process(sourceSelector.value)
			})

			logicFuncElements.exclusive.addEventListener('click', () => {
				managers.logicTools.state = mode.EXCLUSIVE
				managers.logicTools.process(sourceSelector.value)
			})

			logicFuncElements.union.addEventListener('click', () => {
				managers.logicTools.state = mode.UNION
				managers.logicTools.process(sourceSelector.value)
			})

			logicFuncElements.boolean.addEventListener('click', () => {
				managers.logicTools.state = mode.BOOLEAN
				managers.logicTools.process(sourceSelector.value)
			})

			logicFuncElements.copy.addEventListener('click', () => {
				managers.logicTools.state = mode.COPY
				managers.logicTools.process(sourceSelector.value)
			})

		}

		// filter
		let initKernelTools = () => {

			let filterFuncElements = document.forms['filterForm'].elements
			let mode = managers.filterTools.mode

			filterFuncElements.erode.addEventListener('click', () => {
				managers.filterTools.state = mode.ERODE
				managers.filterTools.process()
			})

			filterFuncElements.dilate.addEventListener('click', () => {
				managers.filterTools.state = mode.DILATE
				managers.filterTools.process()
			})

			filterFuncElements.medium.addEventListener('click', () => {
				managers.filterTools.state = mode.MEDIUM
				managers.filterTools.process()
			})

			filterFuncElements.gaussian.addEventListener('click', () => {
				managers.filterTools.state = mode.GAUSSIAN
				managers.filterTools.process()
			})

			filterFuncElements.close.addEventListener('click', () => {
				managers.filterTools.state = mode.CLOSE
				managers.filterTools.process()
			})

			filterFuncElements.open.addEventListener('click', () => {
				managers.filterTools.state = mode.OPEN
				managers.filterTools.process()
			})

			filterFuncElements.edge.addEventListener('click', () => {
				managers.filterTools.state = mode.EDGEDETECTION
				managers.filterTools.process()
			})

			let kernelSizeLabel = document.getElementById('segment_filter_kernelSize_label')
			let kernelSizeInput = document.getElementById('segment_filter_kernelSize_input')
			kernelSizeInput.addEventListener('input', (evt) => {
				kernelSizeLabel.textContent = 'Kernel Size x' + kernelSizeInput.value
				managers.filterTools.psize = kernelSizeInput.value * 1
			})
			kernelSizeInput.dispatchEvent(inputEvent)

			let transMode = managers.transferTools.mode
			let transferGenerateBtn = document.getElementById('segment_transfer_generateBtn')
			transferGenerateBtn.addEventListener('click', () => {
				managers.transferTools.state = transMode.HISTOGRAM
				managers.transferTools.process()
			})
			let transferApplyBtn = document.getElementById('segment_transfer_applyBtn')
			transferApplyBtn.addEventListener('click', () => {

				managers.transferTools.state = transMode.APPLY
				managers.transferTools.process()
			})

			let sizebasedProcessBtn = document.getElementById('rool_sizebased_processBtn')
			sizebasedProcessBtn.addEventListener('click', () => {
				managers.sizeBasedTools.process()
			})
		}

		initToolSelector()
		initBrushTools()
		initGrowingTools()
		initThresholdTools()
		initLogicTools()
		initKernelTools()
	}
}

class DisplayPage extends Page {
	constructor(managers, control) {
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
		let lightIntensitySlider = document.getElementById('light-intensity-slider')
		let showWireLine = document.getElementById('showWirLine')
		let showPolygen = document.getElementById('showPolygen')

		let clippingSlider = new Array(3)

		clippingSlider[0] = new dualSlider(horizontalClipping, 0, 1, 0.01)
		clippingSlider[1] = new dualSlider(coronalClipping, 0, 1, 0.01)
		clippingSlider[2] = new dualSlider(saggitalClipping, 0, 1, 0.01)

		clippingSlider[0].event((low, high, group)=>{
			if(group == 0){
				control.modelViewer.setClippingRatio(axisXY, low, group)
			}
			else{
				control.modelViewer.setClippingRatio(axisXY, high, group)
			}
		})
		clippingSlider[0].dispatchEvent(inputEvent)

		clippingSlider[1].event((low, high, group)=>{
			if(group == 0){
				control.modelViewer.setClippingRatio(axisXZ, low, group)
			}
			else{
				control.modelViewer.setClippingRatio(axisXZ, high, group)
			}
		})

		clippingSlider[1].dispatchEvent(inputEvent)

		clippingSlider[2].event((low, high, group)=>{
			if(group == 0){
				control.modelViewer.setClippingRatio(axisYZ, low, group)
			}
			else{
				control.modelViewer.setClippingRatio(axisYZ, high, group)
			}
		})
		clippingSlider[2].dispatchEvent(inputEvent)

		showWireLine.checked = true
		showWireLine.addEventListener('change', () => {
			control.modelViewer.setRenderMode('wireline', showWireLine.checked)
		})

		showPolygen.checked = true
		showPolygen.addEventListener('change', () => {
			control.modelViewer.setRenderMode('polygen', showPolygen.checked)
		})

		lightIntensitySlider.min = 1
		lightIntensitySlider.max = 5
		lightIntensitySlider.value = 2
		lightIntensitySlider.addEventListener('input', (evt) => {
			let profit = control.modelViewer.getLightProfit()
			profit.intensity = Number(evt.target.value)
			control.modelViewer.setLightProfit(profit)
		})
		lightIntensitySlider.dispatchEvent(inputEvent)

		let profit = control.modelViewer.getLightProfit()
		profit.intensity = Number(lightIntensitySlider.value)
		//profit.distance = parseInt(100)
		control.modelViewer.setLightProfit(profit, false)
	}
}

class FileDownload {
	constructor() {
		this.modelType = ['STL', 'PLY']
		this.segmentType = ['JPG', 'PNG']

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

		this.rawProcess = function (filename, data, byte) {
			let result, colorRange
			let format = '.raw'

			if (data == null)
				return

			//由Float轉換回原資料的格式
			switch (byte) {
				case 8:
					result = new Uint8Array(data.length)
					colorRange = 255
					break
				case 16:
					result = new Uint16Array(data.length)
					colorRange = 65535
					break
				case 32:
					result = new Uint32Array(data.length)
					colorRange = Math.pow(2, 32) - 1
					break
				default:
					result = new Uint8Array(data.length)
					colorRange = 255
			}

			//console.log(data)
			for (let i = 0; i < data.length; i++) {
				result[i] = data[i] * colorRange
			}

			saveArrayBuffer(result, filename + format);
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

		let segmentTypeSelector = document.getElementById('downloadPage_segmentType');
		let genSegBtn = document.getElementById('downloadPage_singleSegGen');
		let genAllSegBtn = document.getElementById('downloadPage_multiSegGen')

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

		let algorithm = new Kernel().sharpness

		let bitConvertor = (buffer, bit, dims, type = 4) => {
			let dataBuffer, max

			if (bit == 'uint32') {
				max = 16581376
				dataBuffer = new Uint32Array(buffer)
			}
			else if (bit == 'uint16') {
				max = 65536
				dataBuffer = new Uint16Array(buffer)
			}
			else if (bit == 'uint8') {
				max = 256
				dataBuffer = new Uint8Array(buffer)
			}
			else {
				console.log('Format not support.')
				return
			}

			//console.log(dataBuffer)

			if (type == 0) {
				mapHE(dataBuffer, max)
			}
			else if (type == 1) {
				mapLog(dataBuffer, max)
			}
			else if (type == 2) {
				mapCLHE(dataBuffer, max)
				//mapHE(dataBuffer, max)
			}
			else if (type == 3) {
				mapCLAHE(dataBuffer, max, dims)
			}
			else if (type == 4) {
				mapResize(dataBuffer, max)
			}
			else if (type == 5) {
				mapCLAHE2D(dataBuffer, dims)
			}
			else if (type == 6) {
				mapiCLAHE(dataBuffer, max, dims)
			}

			//for(let i = 0;i<dataBuffer.length;i++){
			//dataBuffer[i] = max - dataBuffer[i] - 1
			//}


			algorithm(dims, dataBuffer, 1)

			let result = new Float32Array(dataBuffer.length)
			for (let i = 0; i < dataBuffer.length; i++) {
				result[i] = dataBuffer[i] / (max - 1)
			}
			//console.log(result)
			return result
		}

		let mapiCLAHE = (dataBuffer, max, dims) => {
			let d1 = dataBuffer
			let d2 = dataBuffer.slice()

			mapCLAHE(d1, max, dims)
			mapHE(d2, max)

			for (let i = 0; i < dataBuffer.length; i++) {
				dataBuffer[i] = d1[i] * 0.5 + d2[i] * 0.5
			}

			//mapHE(dataBuffer, dims)

		}

		let mapCLAHE2D = (dataBuffer, dims) => {
			let src = new cv.Mat()

			switch (dataBuffer.BYTES_PER_ELEMENT) {
				case 1:
					src = new cv.Mat(dims[0], dims[1], cv.CV_8UC1)
					break
				case 2:
					src = new cv.Mat(dims[0], dims[1], cv.CV_16UC1)
					break
				default:
					return
			}

			console.log(src)

			let step = dims[0] * dims[1]
			let claheDst = new cv.Mat()
			let tiltGridSize = new cv.Size(8, 8)
			let clahe = new cv.CLAHE(40, tiltGridSize)

			for (let i = 0; i < dims[2]; i++) {

				for (let j = 0; j < step; j++) {
					src.data[j] = dataBuffer[j + i * step]
				}

				clahe.apply(src, claheDst)

				dataBuffer.set(claheDst.data, i * step)
			}
		}

		let mapResize = (dataBuffer, max) => {
			let mm = getMinMax(dataBuffer)
			let ratio = (max - 1) / (mm.max - mm.min)
			for (let i = 0; i < dataBuffer.length; i++) {
				dataBuffer[i] = (dataBuffer[i] - mm.min) * ratio
			}
		}

		let mapLog = (dataBuffer, max) => {
			for (let i = 0; i < dataBuffer.length; i++) {
				dataBuffer[i] = Math.log10(dataBuffer[i])
			}

			let mm = getMinMax(dataBuffer)
			let ratio = (max - 1) / (mm.max - mm.min)
			for (let i = 0; i < dataBuffer.length; i++) {
				dataBuffer[i] = (dataBuffer[i] - mm.min) * ratio
			}
		}

		let equalization = (histogram) => {
			let minIndex, maxIndex

			for (minIndex = 0; minIndex < histogram.length; minIndex++) {
				if (histogram[minIndex] > 0)
					break
			}

			for (maxIndex = histogram.length - 1; maxIndex > minIndex; maxIndex--) {
				if (histogram[maxIndex] > 0)
					break
			}

			for (let i = minIndex + 1; i < histogram.length; i++) {
				histogram[i] += histogram[i - 1]
			}

			let maxCDF = histogram[maxIndex]
			let minCDF = histogram[minIndex]
			let ratio = (histogram.length - minCDF - 1) / (maxCDF - minCDF)

			for (let i = minIndex; i < histogram.length; i++) {
				histogram[i] = Math.round((histogram[i] - minCDF) * ratio) + minCDF
			}
		}

		let contrastLimit = (histogram, limit) => {

			let counter = 0
			let total = 0
			let remain = histogram.length
			for (let i = 0; i < histogram.length; i++) {
				total += histogram[i]
				if (histogram[i] > limit) {
					counter += (histogram[i] - limit)
					histogram[i] = limit
					remain--
				}
			}

			if (counter / 2 >= total) {
				let value = total / histogram.length
				histogram.fill(value)
				return
			}

			//console.log(counter, upper, limit)
			while (counter > 0) {
				let offset = counter / remain
				let upper = limit - offset
				for (let i = 0; i < histogram.length; i++) {
					if (histogram[i] > upper) {
						counter -= limit - histogram[i]
						histogram[i] = limit
						remain--
					}
					else {
						counter -= offset
						histogram[i] += offset
					}
				}
				//console.log(counter)
			}


			//console.log(histogram)
		}



		let mapCLAHE = (dataBuffer, max, dims) => {
			let blockSize = 64

			let tiles = [
				Math.ceil(dims[0] / blockSize),
				Math.ceil(dims[1] / blockSize),
				Math.ceil(dims[2] / blockSize)]

			let cdfs = new Uint32Array(tiles[2] * tiles[1] * tiles[0] * max).fill(0)

			let dims01 = dims[0] * dims[1]
			let dims0 = dims[0]

			let getPosition = (x, y, z) => {
				return dims01 * z + dims0 * y + x
			}

			let tiles01 = tiles[0] * tiles[1]
			let tiles0 = tiles[0]

			let getTilesPos = (x, y, z) => {
				return tiles01 * z + tiles0 * y + x
			}


			let buildcdf = (x, y, z, kDims) => {
				let histogram = new Array(max).fill(0)

				let i, j, k, index

				for (i = 0; i < kDims[2]; i++) {
					for (j = 0; j < kDims[1]; j++) {
						for (k = 0; k < kDims[0]; k++) {
							index = getPosition(x + k, y + j, z + i)
							histogram[dataBuffer[index]]++
						}
					}
				}

				let climit = kDims[0] * kDims[1] * kDims[2] * 0.2
				contrastLimit(histogram, climit)

				//equalization
				equalization(histogram)

				return histogram
			}

			let i, j, k, p = 0
			let kDims = new Array(3).fill(blockSize)
			let rDims = [dims[0] % blockSize, dims[1] % blockSize, dims[2] % blockSize]
			let limit = [dims[0] - blockSize, dims[1] - blockSize, dims[2] - blockSize]

			for (i = 0; i < dims[2]; i += blockSize) {

				kDims[2] = limit[2] >= i ? blockSize : rDims[2]

				for (j = 0; j < dims[1]; j += blockSize) {

					kDims[1] = limit[1] >= j ? blockSize : rDims[1]

					for (k = 0; k < dims[0]; k += blockSize) {

						kDims[0] = limit[0] >= k ? blockSize : rDims[0]

						cdfs.set(buildcdf(k, j, i, kDims), p)
						p += max

					}
				}
			}

			let pos = 0
			for (i = 0; i < dims[2]; i++) {
				let posz = i / blockSize - 0.5
				let zmin = Math.max(Math.floor(posz), 0)
				let zmax = Math.min(zmin + 1, tiles[2] - 1)
				let fz = posz - zmin
				let ifz = 1 - fz

				for (j = 0; j < dims[1]; j++) {
					let posy = j / blockSize - 0.5
					let ymin = Math.max(Math.floor(posy), 0)
					let ymax = Math.min(ymin + 1, tiles[1] - 1)
					let fy = posy - ymin
					let ify = 1 - fy

					for (k = 0; k < dims[0]; k++) {
						let posx = k / blockSize - 0.5
						let xmin = Math.max(Math.floor(posx), 0)
						let xmax = Math.min(xmin + 1, tiles[0] - 1)
						let fx = posx - xmin
						let ifx = 1 - fx

						let pixel = dataBuffer[pos]

						let cdf0 = cdfs[getTilesPos(xmin, ymin, zmin) * max + pixel]
						let cdf1 = cdfs[getTilesPos(xmax, ymin, zmin) * max + pixel]
						let cdf2 = cdfs[getTilesPos(xmin, ymax, zmin) * max + pixel]
						let cdf3 = cdfs[getTilesPos(xmax, ymax, zmin) * max + pixel]
						let cdf4 = cdfs[getTilesPos(xmin, ymin, zmax) * max + pixel]
						let cdf5 = cdfs[getTilesPos(xmax, ymin, zmax) * max + pixel]
						let cdf6 = cdfs[getTilesPos(xmin, ymax, zmax) * max + pixel]
						let cdf7 = cdfs[getTilesPos(xmax, ymax, zmax) * max + pixel]

						/*let out = ifx * ify * ifz * cdf0
							+ fx * ify * ifz * cdf1
							+ ifx * fy * ifz * cdf2
							+ fx * fy * ifz * cdf3
							+ ifx * ify * fz * cdf4
							+ fx * ify * fz * cdf5
							+ ifx * fy * fz * cdf6
							+ fx * fy * fz * cdf7
						*/

						let out = ((ifx * cdf0 + fx * cdf1) * ify + (ifx * cdf2 + fx * cdf3) * fy) * ifz
							+ ((ifx * cdf4 + fx * cdf5) * ify + (ifx * cdf6 + fx * cdf7) * fy) * fz


						dataBuffer[pos++] = out >= max ? max - 1 : out//* 3 / 4
					}
				}
			}


			//console.log(cdfs)
			//mapHE(dataBuffer, max)

		}

		let mapCLHE = (dataBuffer, max) => {
			let histogram = new Uint32Array(max).fill(0)


			for (let i = 0; i < dataBuffer.length; i++) {
				histogram[dataBuffer[i]]++
			}

			let limit = dataBuffer.length / max

			contrastLimit(histogram, limit)

			equalization(histogram)

			for (let i = 0; i < dataBuffer.length; i++) {
				dataBuffer[i] = chistogramdf[dataBuffer[i]]
			}
		}

		let mapHE = (dataBuffer, max) => {
			let histogram = new Uint32Array(max).fill(0)

			for (let i = 0; i < dataBuffer.length; i++) {
				histogram[dataBuffer[i]]++
			}

			equalization(histogram)

			for (let i = 0; i < dataBuffer.length; i++) {
				dataBuffer[i] = histogram[dataBuffer[i]]
			}
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
						console.log(images[0], images[0].getSliceLocation(), images[0].getImagePosition())
						let bit = 'uint' + images[0].getBitsAllocated()
						let thickness = images.length > 1 ? Math.abs(images[1].getImagePosition()[2] - images[0].getImagePosition()[2]) : images[0].getSliceThickness()
						//console.log(images[0].getImagePosition(),images[0].getPixelSpacing(), images[0].getPixelRepresentation() )
						let spacing = images[0].getPixelSpacing()
						let position = [0, 0, 0]

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

						series.concatenateImageData(null, (data) => {
							
							let newData = data.slice()
							let pos = new THREE.Vector3()
							for (let i = 0; i < volDims.z; i++) {
								for (let j = 0; j < volDims.y; j++) {
									for (let k = 0; k < volDims.x; k++) {
										pos.set(k, j, i)
										pos.applyMatrix3(matrix)
										pos.set(Math.abs(pos.x),
											Math.abs(pos.y),
											Math.abs(pos.z))
											newData[pos.z * newVolDims.x * newVolDims.y + pos.y * newVolDims.x + pos.x]
											= data[i * volDims.x * volDims.y + j * volDims.x + k]
									}
								}
							}

							let cvtData0 = bitConvertor(newData, bit, newVolDims.toArray(), 0)
							let cvtData1 = bitConvertor(newData, bit, newVolDims.toArray(), 4)

							//console.log(thickness)
							pos.set(spacing[0], spacing[1], thickness)
							pos.applyMatrix3(matrix)
							pos.set(Math.abs(pos.x),
								Math.abs(pos.y),
								Math.abs(pos.z))

							let imgInfo = {}
							let date = images[0].getStudyDate()
							

							imgInfo.date = date.getFullYear() + '/' + (date.getMonth() * 1 + 1) + '/' + date.getDate()
							imgInfo.dims = [newVolDims.x, newVolDims.y, newVolDims.z]
							imgInfo.bit = bit
							imgInfo.thickness = [Math.round(pos.x * 10) / 10, Math.round(pos.y * 10) / 10, Math.round(pos.z * 10) / 10]
							imgInfo.position = position

							onload(imgInfo, [cvtData0, cvtData1])
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
				imgInfo.date = 'Not support'
				imgInfo.dims = [volume.xLength, volume.yLength, volume.zLength]
				imgInfo.bit = volume.data.byte
				imgInfo.thickness = [1, 1, 1]
				imgInfo.position = [0, 0, 0]

				onload(imgInfo, [volume.data.buffer, volume.data.buffer])
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
			else if (m.length == 5) {
				volDims = [parseInt(m[1]), parseInt(m[2]), parseInt(m[3])];
				bit = m[4]
			}

			fr.onload = function () {
				let data = new Uint16Array(fr.result).map(x => (x << 8) | (x >> 8))

				let cvtArray0 = bitConvertor(data.buffer, bit, volDims, 0)
				let cvtArray1 = bitConvertor(data.buffer, bit, volDims, 4)
				//console.log(dataBuffer)
				let imgInfo = {}
				imgInfo.date = 'Not support'
				imgInfo.dims = volDims
				imgInfo.bit = bit
				imgInfo.thickness = [1, 1, 1]
				imgInfo.position = [0, 0, 0]

				onload(imgInfo, [cvtArray0, cvtArray1])
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
	constructor(managers, control) {
		super()
		let segState = managers.segState

		let uploadFileInput = document.getElementById('dcm-upload-input')
		let dcmMultiUploadInput = document.getElementById('dcm-multi-upload-input')
		let rawUploadInput = document.getElementById('dcm-raw-upload-input')
		let nrrdUploadInput = document.getElementById('dcm-nrrd-upload-input')
		let genRawBtn = document.getElementById('downloadPage_rawGen');
		let imgInfomation = document.forms['imgInfo'].elements

		let uploader = new ImageDataUploader()
		let downloader = new FileDownload()

		let loadFile = (evt, type) => {
			let files = evt.target.files

			if (files == null) {
				return
			}

			uploader.process(files, type, (info, data) => {
				evt.target.value = ''
				imgInfomation.date.value = info.date
				imgInfomation.imgSize.value = `${info.dims[0]}:${info.dims[1]}:${info.dims[2]}`
				imgInfomation.thickness.value = info.thickness
				imgInfomation.bit.value = info.bit
				imgInfomation.position.value = info.position

				managers.setBaseSegment(data, info.dims, info.thickness, info.bit)
				control.updateData()
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

		// Convert to RAW
		genRawBtn.addEventListener('click', () => {
			let segment = segState.baseSegment
			let rawData = segment.data
			let dims = segment.dims
			let byte = segState.byte
			downloader.rawProcess('model_' + dims[0] + '_' + dims[1] + '_' + dims[2] + '_uint' + byte, rawData, byte)
		})
	}
}

class ImageProcessPage extends Page {
	constructor(managers, control) {
		super()
		let segState = managers.segState

		let maskValueBtn = document.getElementById('maskBtn')
		let resetBtn = document.getElementById('resetBtn')

		let mode = managers.cropTools.mode

		maskValueBtn.addEventListener('click', () => {
			managers.cropTools.process()
		})

		resetBtn.addEventListener('click', () => {
			//managers.cropTools.state = mode.RESET
			managers.cropTools.reset()
		})

		this.enable = () => {
			managers.cropTools.enable = true
		}

		this.disable = () => {
			managers.cropTools.enable = false
		}

		let updateTrack = () =>{
			
		}

		let initSelector = () => {
			let toolBtns = document.querySelectorAll('#cropTools_selector > button')
			let tools = document.querySelectorAll('#cropTools_group > .tool')
			
			for (let i = 0; i < toolBtns.length; i++) {
				toolBtns[i].addEventListener('click', (evt) => {

					for (let option = 0; option < toolBtns.length; option++) {
						toolBtns[option].classList.remove('active')
						tools[option].style['z-index'] = 1
					}

					toolBtns[i].classList.add('active')
					tools[i].style['z-index'] = 9

					managers.cropTools.state = mode[toolBtns[i].dataset['mode']]
				})

			}

			toolBtns[0].dispatchEvent(clickEvent)
			
		}

		//box
		let initBoxCrop = () => {
			let slider = [
				document.getElementById('box_slider_t2b'), 
				document.getElementById('box_slider_f2b'), 
				document.getElementById('box_slider_l2r')
			]

			let parameter = managers.cropTools.getBoxBorder()

			for (let i = 0; i < slider.length; i++) {
				let dslider = new dualSlider(slider[i], 0, 1, 0.01)

				if (i == 0) {
					dslider.event((low, high) => {
						parameter.top = low * 1
						parameter.bottom = high * 1
					})
				}
				else if (i == 1) {
					dslider.event((low, high) => {
						parameter.front = low * 1
						parameter.back = high * 1
					})
				}
				else if (i == 2) {
					dslider.event((low, high) => {
						parameter.left = low * 1
						parameter.right = high * 1
					})
				}

				dslider.dispatchEvent(inputEvent)
			}
		}

		//sphere
		let initSphereCrop = () => {
			let slider = [
				document.getElementById('sphere_slider_radius'), 
				document.getElementById('sphere_slider_x'), 
				document.getElementById('sphere_slider_y'), 
				document.getElementById('sphere_slider_z')
			]

			let parameter = managers.cropTools.getSphereBorder()

			for(let i = 0;i<slider.length;i++){
				slider[i].min = 0
				slider[i].max = 1
				slider[i].value = 0.5
				slider[i].step = 0.01
			}
			
			slider[0].addEventListener('input', ()=>{
				parameter.radius = slider[0].value * 1
			})

			slider[1].addEventListener('input',()=>{
				parameter.x = slider[1].value * 1
			})

			slider[2].addEventListener('input',()=>{
				parameter.y = slider[2].value * 1
			})

			slider[3].addEventListener('input',()=>{
				parameter.z = slider[3].value * 1
			})

			for(let i = 0;i<slider.length;i++){
				slider[i].dispatchEvent(inputEvent)
			}
		}

		//cylinder
		let initCylinderCrop = () => {
			let slider = [
				document.getElementById('cylinder_slider_t2b'),
				document.getElementById('cylinder_slider_radius'),
				document.getElementById('cylinder_slider_x'),
				document.getElementById('cylinder_slider_y')
			]

			let parameter = managers.cropTools.getCylinderBorder()
			let dslider = new dualSlider(slider[0], 0, 1, 0.01)
			dslider.event((low, high) => {
				parameter.top = low * 1
				parameter.bottom = high * 1
			})

			for(let i = 1;i<slider.length;i++){
				slider[i].min = 0
				slider[i].max = 1
				slider[i].value = 0.5
				slider[i].step = 0.01
			}

			slider[1].addEventListener('input', () => {
				parameter.radius = slider[1].value * 1
			})

			slider[2].addEventListener('input', () => {
				parameter.x = slider[2].value * 1
			})

			slider[3].addEventListener('input', () => {
				parameter.y = slider[3].value * 1
			})

			dslider.dispatchEvent(inputEvent)
			for(let i = 1;i<slider.length;i++){
				slider[i].dispatchEvent(inputEvent)
			}
		}

		//balloon
		let initBalloonCrop = () => {
			let slider = [
				document.getElementById('balloon_slider_size'), 
				document.getElementById('balloon_slider_x'), 
				document.getElementById('balloon_slider_y'), 
				document.getElementById('balloon_slider_z')
			]

			let parameter = managers.cropTools.getBalloonBorder()

			for(let i = 0;i<slider.length;i++){
				slider[i].min = 0
				slider[i].max = 1
				slider[i].value = 0.5
				slider[i].step = 0.01
			}
			
			slider[0].addEventListener('input', ()=>{
				parameter.size = slider[0].value * 1
			})

			slider[1].addEventListener('input',()=>{
				parameter.x = slider[1].value * 1
			})

			slider[2].addEventListener('input',()=>{
				parameter.y = slider[2].value * 1
			})

			slider[3].addEventListener('input',()=>{
				parameter.z = slider[3].value * 1
			})

			for(let i = 0;i<slider.length;i++){
				slider[i].dispatchEvent(inputEvent)
			}
		}

		initSelector()
		initBoxCrop()
		initSphereCrop()
		initCylinderCrop()
		initBalloonCrop()
	}
}

class PageControl {
	constructor(managers, controls) {
		let list = new multiOptSelectList(managers, controls[0])
		new DisplayPage(managers, controls[1])

		let pageControllers = {
			FILE: new HomePage(managers, controls[0]),
			IMAGE: new ImageProcessPage(managers, controls[0]),
			SEGMENT: new SegmentsPage(managers, controls[0], list),
			MODEL: new ModelPage(managers, controls[1])
		}

		let initPageSelector = () => {
			let pageBtns = document.querySelectorAll('#page_selector > button')
			let pages = document.querySelectorAll('#page_group > .page')
			let scenes = document.getElementsByClassName('scene')

			// ���m���s�B�������A
			for (let i = 0; i < scenes.length; i++) {
				scenes[i].classList.remove('t-visible')
				scenes[i].classList.add('t-invisible')
			}

			for (let i = 0; i < pages.length; i++) {
				pages[i].classList.remove('r-visible')
				pages[i].classList.add('r-invisible')
			}

			for (let index in pageControllers) {
				pageControllers[index].disable()
			}

			let prev = -1, pageIndex, pageName
			for (let i = 0; i < pageBtns.length; i++) {
				pageBtns[i].addEventListener('click', (evt) => {
					if (prev != -1) {
						pageBtns[prev].classList.remove('active')

						pages[prev].classList.remove('r-visible')
						pages[prev].classList.add('r-invisible')

						pageIndex = pageBtns[prev].dataset['pageIndex']

						scenes[pageIndex].classList.remove('t-visible')
						scenes[pageIndex].classList.add('t-invisible')

						pageName = pageBtns[prev].dataset['pageName']
						pageControllers[pageName].disable()
					}

					evt.target.classList.add('active')

					pages[i].classList.remove('r-invisible')
					pages[i].classList.add('r-visible')

					pageIndex = evt.target.dataset['pageIndex']
					scenes[pageIndex].classList.remove('t-invisible')
					scenes[pageIndex].classList.add('t-visible')

					pageName = evt.target.dataset['pageName']
					//console.log(pageControllers[pageName], pageName)
					pageControllers[pageName].enable()

					prev = i

				})
			}

			pageBtns[0].dispatchEvent(clickEvent)
			
		}
		initPageSelector()



		//new DownloadPage()

	}


}

export { PageControl }