
import { PanelController } from "./controller/PanelController.js";
import { ImageData } from './model/Segment.js'
import { StateManager } from "./controller/StateManager.js"
import { State } from "./model/State.js"

let initUI = function () {

	/*
	let inputs = document.getElementsByTagName('input')
	for(let inputDOM of inputs){
		if(inputDOM.type == 'range'){
			let valueMonitor = document.createElement('label')
			valueMonitor.style.backgroundColor = '#FFFFFF'
			valueMonitor.style.display = 'none'
			valueMonitor.style.position = 'absolute'
			valueMonitor.style.left = '50%'
			inputDOM.parentNode.append(valueMonitor)
			inputDOM.addEventListener('mouseenter',(evt)=>{
				valueMonitor.style.display = ''
				valueMonitor.innerText = inputDOM.value
			})
			inputDOM.addEventListener('mousemove',(evt)=>{
				valueMonitor.innerText = inputDOM.value
			})
			inputDOM.addEventListener('mouseleave',(evt)=>{
				valueMonitor.style.display = 'none'
			})
		}
	}*/

	let adjBtn = document.getElementById('controlPanelAdjBar')
	let panel = document.getElementById('controlPanel')
	let view = document.getElementsByClassName("left-scene")[0]
	let state = 0
	let mousePos = { x: 0, st: 0 }
	let resizeEvent = new Event('resize')

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
	adjBtn.addEventListener('mousedown', (evt) => {
		state = 1
		mousePos.x = evt.clientX
		mousePos.st = panel.clientWidth
	})
	window.addEventListener('mousemove', (evt) => {
		if (state != 1) {
			return
		}

		view.style.width = `${evt.clientX}px`
		window.dispatchEvent(resizeEvent)
	})
	window.addEventListener('mouseup', () => {
		state = 0
	})

}

let initBlob = (managers) => {
	return new Promise((resolve, reject) => {
		let blobURL = window.localStorage.getItem('blob')
		let info = window.localStorage.getItem('info')

		info = JSON.parse(info)

		let request = new XMLHttpRequest()
		request.responseType = 'blob'
		request.open('GET', blobURL)
		request.onerror = () => {
			alert('Data update or missing! Close the tab and make a new instance.')
		}

		request.onload = () => {
			console.log('loading complete')
			if (request.readyState != 4 || request.status != 200) {
				alert('Data update or missing! Close the tab and make a new instance.')
				return
			}

			let blob = request.response

			let reader = new FileReader()
			reader.onerror = () => {
				alert('Data update or missing! Close the tab and make a new instance.')
				reject()
			}
			reader.onload = () => {
				let result = reader.result

				let data = new Uint16Array(new SharedArrayBuffer(result.byteLength))
				data.set(new Uint16Array(result))

				console.log('loading complete')

				resolve({ data: data, info: info })
			}
			reader.readAsArrayBuffer(blob)

		}

		request.send()
	})

}

//網頁關閉前，彈出視窗確認
window.onbeforeunload = () => {
	return 1
}

window.onunload = () => {
	return 1
}

window.onload = function () {
	initUI()
	initBlob().then((values) => {
		let state = new State()
		let info = values.info
		let data = values.data

		state.info = info
		state.volume = new ImageData('base', info.dims, info.bitsStored, data);

		let managers = new StateManager(state)

		new PanelController(managers)
	})
}
