import * as THREE from "./../../build/three.module.js";
import { DcmController } from "./dcmController.js";
import { dualSlider } from "./views/dualSlider.js";
import { STLExporter } from "./threejs/exporters/STLExporter.js";
import { PLYExporter } from "./threejs/exporters/PlyExporter.js";
import { NRRDLoader } from "./threejs/loaders/NRRDLoader.js";

let fileRegex = /(\w+)_(\d+)x(\d+)x(\d+)_(\w+)\.*/;

let downloadLink = null
let dcmController = null

const colormaps = {
	"Cool Warm": new THREE.TextureLoader().load("../colormaps/cool-warm-paraview.png"),
	"Matplotlib Plasma": new THREE.TextureLoader().load("../colormaps/matplotlib-plasma.png"),
	"Matplotlib Virdis": new THREE.TextureLoader().load("../colormaps/matplotlib-virdis.png"),
	"Rainbow": new THREE.TextureLoader().load("../colormaps/rainbow.png"),
	"Samsel Linear Green": new THREE.TextureLoader().load("../colormaps/samsel-linear-green.png"),
	"Samsel Linear YGB 1211G": new THREE.TextureLoader().load("../colormaps/samsel-linear-ygb-1211g.png"),
};

let showProgress = function (option, title, cancellable) {
	requestAnimationFrame(() => {
		let loadingText = document.getElementById('loadingText')
		let progressCancelBtn = document.getElementById('progressCancelBtn')
		let exampleModal = bootstrap.Modal.getOrCreateInstance(document.getElementById('exampleModal'))
		
		if (option) {
			loadingText.innerHTML = title
			exampleModal.show()
		}
		else {console.log(exampleModal)
			exampleModal.hide()
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

let initUI = function () {
	let speedValueInput = document.getElementById('input-speedvalue');
	let maskValueInput = document.getElementById('input-maskvalue');
	let boxMaskValueInput = document.getElementById('box-maskvalue');
	let isovalueSlider = document.getElementById("dual_slider");
	let isoValueInput = document.getElementById('input-isovalue');
	let distanceInput = document.getElementById('input-distance')
	let horizontalClipping = document.getElementById("HzClpFc")
	let coronalClipping = document.getElementById("CrClpFc")
	let saggitalClipping = document.getElementById("SgClpFc")
	let showVolume = document.getElementById("showVolume");
	let showMesh = document.getElementById("showMesh");
	let useWebASM = document.getElementById("useWebASM");
	let showWireLine = document.getElementById('showWirLine')
	let showPolygen = document.getElementById('showPolygen')
	let modelTypeSelector = document.getElementById('model-type');
	let genModelBtn = document.getElementById('model-gen');
	let genAllModelBtn = document.getElementById('model-gen-all')
	let maskValueBtn = document.getElementById('maskBtn')
	let segmentList = document.getElementById('segment_list')
	let addSegmentBtn = document.getElementById('add_segment_btn')
	let removeSegmentBtn = document.getElementById('remove_segment_btn')
	let inputIsovalueApply = document.getElementById('input-isovalue-apply')
	let lightIntensitySlider = document.getElementById('light-intensity-slider')
	//lightDistanceSlider = document.getElementById('light-distance-slider')
	let uploadFileInput = document.getElementById('dcm-upload-input')
	let generateModelBtn = document.getElementById('generate-model-btn')
	let dcmMultiUploadInput = document.getElementById('dcm-multi-upload-input')
	let rawUploadInput = document.getElementById('dcm-raw-upload-input')
	let nrrdUploadInput = document.getElementById('dcm-nrrd-upload-input')
	let regionGrowingBias = document.getElementById('region-growing-bias')

	let domElement = document.getElementById('dcmViewer')
	dcmController = new DcmController(domElement)

	let ds = new dualSlider(isovalueSlider, 0, 255)
	ds.setLowerValue(65)
	ds.setHigherValue(80)
	ds.event((lv, hv) => {
		isoValueInput.value = lv
		distanceInput.value = hv
	})

	isoValueInput.value = ds.getLowerValue()
	isoValueInput.addEventListener('change', function (evt) {
		ds.setLowerValue(evt.target.value)
	})

	distanceInput.value = ds.getHigherValue()
	distanceInput.addEventListener('change', (evt) => {
		ds.setHigherValue(evt.target.value)
	})

	inputIsovalueApply.addEventListener('click', () => {
		dcmController.managers.filter(ds.getLowerValue(), ds.getHigherValue())
	})

	speedValueInput.value = 2
	speedValueInput.addEventListener('keypress', function (evt) {
		if (evt.which != 13)
			return
		//check value
		if (evt.target.value < 1) {
			evt.target.value = 1
		}
		else if (evt.target.value > 5) {
			evt.target.value = 5
		}
		dcmController.setQuality(evt.target.value)
	})

	//dcmViewer.setQuality(speedValueInput.value)

	maskValueInput.value = 0.7
	maskValueBtn.addEventListener('click', () => {
		dcmController.managers.clip(0, { ratio: maskValueInput.value })
	})

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

	segmentList.addEventListener('change', () => {
		let segIndex = segmentList.selectedIndex
		dcmController.managers.setFocusedSegment(segIndex)
	})

	addSegmentBtn.addEventListener('click', () => {
		
		var opt = document.createElement('option')
		opt.text = `Segment ${segmentList.length}`
		segmentList.add(opt)
		segmentList.selectedIndex = segmentList.length - 1
		dcmController.addSegment(opt.text)
	})

	generateModelBtn.addEventListener('click', () => {
		dcmController.generateModel()
	})

	regionGrowingBias.min = 0
	regionGrowingBias.max = 10
	regionGrowingBias.step = 1
	regionGrowingBias.value = 5
	regionGrowingBias.addEventListener('change', (evt) => {
		let evtValue = parseInt(evt.target.value)
		dcmController.managers.setBias(evtValue)
	})
	dcmController.managers.setBias(parseInt(regionGrowingBias.value))

	removeSegmentBtn.addEventListener('click', () => {
		let index = segmentList.selectedIndex
		dcmController.removeSegment(index)
		segmentList.remove(index)
		segmentList.selectedIndex = segmentList.length - 1
	})

	horizontalClipping.addEventListener('change', function () {
		dcmController.modelViewer.setClippingEnable(axisXZ, horizontalClipping.checked)
	})
	horizontalClipping.checked = false;

	coronalClipping.addEventListener('change', function () {
		dcmController.modelViewer.setClippingEnable(axisXY, coronalClipping.checked)
	})
	coronalClipping.checked = false;

	saggitalClipping.addEventListener('change', function () {
		dcmController.modelViewer.setClippingEnable(axisYZ, saggitalClipping.checked)
	})
	saggitalClipping.checked = false;
	dcmController.modelViewer.setClippingEnable(axisXZ, horizontalClipping.checked)
	dcmController.modelViewer.setClippingEnable(axisXY, coronalClipping.checked)
	dcmController.modelViewer.setClippingEnable(axisYZ, saggitalClipping.checked)

	useWebASM.checked = true;

	genAllModelBtn.addEventListener('click', () => {
		showProgress(true, "model generating", true)
		setProgress(0)
		setTimeout(() => {
			dcmController.generateAllModel((currentValue, totalValue) => {
				//console.log(currentValue)
				setProgress(currentValue / totalValue * 100)
				download(modelTypeSelector.value)
				if (currentValue == totalValue) {
					showProgress(false)
				}
			})
		}, 10)
	})

	genModelBtn.addEventListener('click', () => {
		download(modelTypeSelector.value)
	})

	lightIntensitySlider.min = 1
	lightIntensitySlider.max = 5
	lightIntensitySlider.value = 2
	lightIntensitySlider.addEventListener('input', (evt) => {
		let profit = dcmController.modelViewer.getLightProfit()
		profit.intensity = parseInt(evt.target.value)
		dcmController.modelViewer.setLightProfit(profit)
	})

	/** 
	lightDistanceSlider.min = 500
	lightDistanceSlider.max = 1000
	lightDistanceSlider.value = 500
	lightDistanceSlider.step = 100
	lightDistanceSlider.addEventListener('input', (evt) => {
		let profit = dcmViewer.modelViewer.getLightProfit()
		profit.distance = parseInt(evt.target.value)
		dcmViewer.modelViewer.setLightProfit(profit)
	})*/

	let profit = dcmController.modelViewer.getLightProfit()
	profit.intensity = parseInt(lightIntensitySlider.value)
	//profit.distance = parseInt(100)
	dcmController.modelViewer.setLightProfit(profit, false)

	let loadFile = (files) => {
		let series = new daikon.Series()
		daikon.Series.useExplicitOrdering = true;

		if (files.length == 0) {
			return
		}

		Array.prototype.forEach.call(files, (file, index) => {
			setProgress(index / files.length)
			let fr = new FileReader();
			fr.onload = function () {
				var image = daikon.Series.parseImage(new DataView(fr.result));

				if (image === null || !image.hasPixelData()) {
					console.error(daikon.Series.parserError)
				}

				else if (series.images.length === 0 || image.getSeriesId() === series.images[0].getSeriesId()) {
					series.addImage(image)
				}

				if (series.images.length === files.length) {
					series.buildSeries()
					let images = series.images
					let bit = images[0].getBitsAllocated()
					let volDims = [images[0].getRows(), images[0].getCols(), images.length]
					series.concatenateImageData(null, (dataBuffer) => {
						if (bit == 16) {
							dataBuffer = new Uint16Array(dataBuffer).map(x => x / 16)
							dataBuffer = Uint8ClampedArray.from(dataBuffer)
						}

						dcmController.setModelData("", volDims, dataBuffer)
						showProgress(false)
					})

				}
			}
			showProgress(true, "load images", false)
			fr.readAsArrayBuffer(file);
		})
	}

	dcmMultiUploadInput.addEventListener('change', (evt) => {
		loadFile(evt.target.files)
	})

	uploadFileInput.addEventListener('change', (evt) => {
		loadFile(evt.target.files)
	})

	nrrdUploadInput.addEventListener('change', (evt) => {
		const loader = new NRRDLoader();
		loader.load(evt.target.files[0], function (volume) {
			dcmController.setModelData("", [volume.xLength, volume.yLength, volume.zLength], new Uint8Array(volume.arrayBuffer))
		})
	})

	rawUploadInput.addEventListener('change', (evt) => {
		let fr = new FileReader();
		let file = evt.target.files[0]
		let filename = file.name

		let m = filename.match(fileRegex);
		let volDims = [parseInt(m[2]), parseInt(m[3]), parseInt(m[4])];
		let bit = m[5]

		fr.onload = function () {
			if (bit == 'uint32') {
				let dataBuffer = new Uint32Array(fr, result).map(x => x / 65535)
				dataBuffer = new Uint8ClampedArray(dataBuffer)
			}
			else if (bit == 'uint16') {
				let dataBuffer = new Uint16Array(fr, result).map(x => x / 8)
				dataBuffer = new Uint8ClampedArray(dataBuffer)
			}
			else if (bit == 'uint8') {
				let dataBuffer = new Uint8ClampedArray(dataBuffer)
			}
			else {
				console.log('Format not support.')
				return
            }
			dcmController.setModelData(filename, volDims, dataBuffer)
		}
		fr.readAsArrayBuffer(file);
	})

	//setBtnState(dlLinkControl.NONE)
	initPageSelector()
	initToolSelector()

	downloadLink = document.createElement('a');
	downloadLink.style.display = 'none';
	document.body.appendChild(downloadLink);
}

function initToolSelector() {
	let toolSelector = document.getElementById('tools-group')
	let toolBtns = toolSelector.getElementsByTagName('button')
	let toolPanel = document.getElementById('segment-control-panel')
	let tools = toolPanel.getElementsByClassName('tool')
	let prev = 0

	for (let i = 0; i < toolBtns.length; i++) {
		toolBtns[i].addEventListener('click', () => {
			if (prev != -1) {
				toolBtns[prev].classList.remove('active')
				tools[prev].classList.remove('d-flex')
				tools[prev].classList.add('d-none')
			}
			toolBtns[i].classList.add('active')
			tools[i].classList.remove('d-none')
			tools[i].classList.add('d-flex')
			prev = i
			if (i == 0) {
				dcmController.setManagerTools(0)
			}
			else if (i == 1) {
				dcmController.setManagerTools(1)
			}
			else if (i == 2) {
				dcmController.setManagerTools(2)
			}
			else if (i == 3) {
				dcmController.setManagerTools(3)
			}
			else if (i == 4) {
				dcmController.setManagerTools(4)
			}
			else if (i == 5) {

			}
			else if (i == 6) {
				dcmController.managers.sizeBased()
			}
			else if (i == 7) {
				
			}
			else if (i == 8) {

			}
			else {
				dcmController.setManagerTools(0)
            }
		})
	}
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

function fillModelTypeSelector() {
	let selector = document.getElementById('model-type');
	for (let i of modelType) {
		let opt = document.createElement('option');
		opt.value = i;
		opt.innerHTML = i;
		selector.appendChild(opt);
	}
}

function fillcolormapSelector() {
	let selector = document.getElementById("colormapList")
	for (let p in colormaps) {
		let opt = document.createElement("option");
		opt.value = p;
		opt.innerHTML = p;
		selector.appendChild(opt);
	}

	selector.addEventListener("change", () => {
		volumeColorMapUpdate()
	});

	//dcmViewer.setVolumeColor(colormaps[selector.value])
}

let volumeColorMapUpdate = function () {
	//dcmViewer.setVolumeColor(colormaps[colormapIndex.value])
	//dcmViewer.modelUpdate(9)
}

let modelType = ['STL', 'PLY', 'RAW']
let download = function (mode) {
	let save = function (blob, filename) {
		downloadLink.href = URL.createObjectURL(blob);
		downloadLink.download = filename;
		downloadLink.click();
	}

	let saveString = function (text, filename) {
		save(new Blob([text], { type: 'text/plain' }), filename);
	}

	let saveArrayBuffer = function (buffer, filename) {
		save(new Blob([buffer], { type: 'application/octet-stream' }), filename);
	}
	
	let exporter
	
	if (mode == modelType[0]) {
		let mesh = dcmController.modelViewer.getMesh()

		if (mesh == null) {
			return
		}

		exporter = new STLExporter()
		//use binary format model type for better performance
		const result = exporter.parse(mesh, { binary: true });
		saveArrayBuffer(result, 'model.stl');
	}
	else if (mode == modelType[1]) {
		let mesh = dcmController.modelViewer.getMesh()

		if (mesh == null) {
			return
		}

		exporter = new PLYExporter()
		const result = exporter.parse(mesh, { binary: true });
		saveString(result, 'model.ply');
	}
	else if (mode == modelType[2]) {
		let dataBuffer = dcmController.managers.getBaseSegment()
		saveArrayBuffer(dataBuffer.buffer, 'model.raw');
	}
}

window.onload = function () {
	initUI()
	//fillDicomSelector();
	fillcolormapSelector();
	fillModelTypeSelector();
}