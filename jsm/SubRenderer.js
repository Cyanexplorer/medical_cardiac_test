import * as THREE from "./build/three.module.js";
import { MMDLoader } from "./example/jsm/loaders/MMDLoader.js";
import { SlicerControl } from "./views/marker.js";
import { OutlineEffect } from './example/jsm/effects/OutlineEffect.js';

class SubRenderer{

	constructor(domElement) {
		this.scene = null
		this.camera = null
		this.clippingControl = null
		this.renderer = null
		this.domElement = domElement
		this.effect = null;
		this.thickness = [1, 1, 1]

		this.initModelScene()
	}

	initModelScene() {
		let width = this.domElement.clientWidth;
		let height = this.domElement.clientHeight;

		// Camera
		let unit = 1.4
		let ratio = width / height * unit

		this.camera = new THREE.OrthographicCamera(-ratio, ratio, unit, - unit, 0.1, 100);
		this.camera.position.set(8, 8, 8);
		this.camera.up.set(0, 1, 0);
		this.camera.lookAt(0, 0, 0);

		// Scene
		this.scene = new THREE.Scene();
		this.scene.add(this.camera)

		// Light
		const ambient = new THREE.AmbientLight(0x666666);
		this.scene.add(ambient);

		const directionalLight = new THREE.DirectionalLight(0x887766);
		directionalLight.position.set(- 1, 1, 1).normalize();
		this.scene.add(directionalLight);

		// Renderer
		this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
		this.renderer.setSize(width, height);
		this.renderer.setClearColor(0xFFFFFF, 0.0)
		this.domElement.appendChild(this.renderer.domElement);
		//renderer.setrenderSceneLoop(renderScene);

		this.effect = new OutlineEffect(this.renderer);
		this.effect.setSize(width, height)

		let miniBar = document.createElement('div')
		miniBar.style.position = 'absolute'
		miniBar.style.top = '0px'
		miniBar.style.left = '0px'
		this.domElement.appendChild(miniBar)

		/**
		 * 		let icon = document.createElement('img')
		icon.src = 'img/svg/resetCamera.svg'
		icon.title = 'reset camera'
		icon.width = "32"
		resetBtn.appendChild(icon)
		 * */


		let visibleBtn = document.createElement('button')
		visibleBtn.innerText = 'model ON'
		visibleBtn.classList.add('btn')
		visibleBtn.classList.add('btn-sm')
		visibleBtn.classList.add('btn-primary')
		visibleBtn.dataset.toggle = 'on'
		visibleBtn.addEventListener('click', () => {
			let mesh = this.scene.getObjectByName('idol')
			let state = true
			if (visibleBtn.dataset.toggle == 'on') {
				visibleBtn.dataset.toggle = 'off'
				visibleBtn.innerText = 'model Off'
				state = false
			}
			else {
				visibleBtn.dataset.toggle = 'on'
				visibleBtn.innerText = 'model On'
				state = true
			}

			if (mesh != null) {
				mesh.visible = state
				this.renderScene()
			}
		})

		miniBar.appendChild(visibleBtn)

		// Window Size Event
		window.addEventListener('resize', () => {
			this.onWindowResize()
		});

		// Clipping Control
		this.clippingControl = new SlicerControl(this.scene)

		// Render
		this.loadModel();

		//this.renderScene()
	}

	onWindowResize() {
		let width = this.domElement.clientWidth
		let height = this.domElement.clientHeight
		this.renderer.setSize(width, height);
		this.renderScene()
	}

	loadModel () {

		const loader = new MMDLoader()
		loader.load('../model/mmd/kizunaai4.pmx', (mesh) => {
			mesh.name = "idol"
			mesh.position.set(0, -2.8, -0.4)
			mesh.geometry.center()
			let materials = mesh.material

			//There are some issues make the markers not able to show up properly. Close the depth test to ignore the problem.
			//Materials[4] is kizunaai's cloth.
			materials[4].depthWrite = false
			materials[4].transparent = true
			materials[4].opacity = 0.2

			let wait = () => {
				this.renderScene()
				if (loader.meshBuilder.materialBuilder.process > 0) {
					setTimeout(wait, 100)
				}
				else {
					console.log('complete')
                }
            }

			if (this.scene.getObjectByName(mesh.name) == null) {
				this.scene.add(mesh)
				this.renderScene()
				wait()
			}

			
		})	
	}

	setOnFocus(axis, option) {
		this.clippingControl.onFocus(axis, option)
		this.renderScene();
	}

	setClippingMesh (mesh) {
		this.clippingControl.addObject(mesh)
		this.renderScene();
	}

	setClippingDim(dims) {
		let nDims = [dims[0] / dims[2], dims[1] / dims[2], 1]
		this.clippingControl.thickness = this.thickness
		this.clippingControl.resize(nDims, 0, false)
		this.clippingControl.reset()
		this.renderScene();
	}

	setClippingRatio (type, ratio) {
		this.clippingControl.setIndexRatio(type, ratio)
		this.renderScene();
	}

	getClippingPlaneIndex() {
		return this.clippingControl.getClippingPlaneIndex()*10
	}

	renderScene() {
		this.effect.render(this.scene, this.camera);
	}
}

export { SubRenderer };
