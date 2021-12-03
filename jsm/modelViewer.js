import init, { MarchingCubes } from "../pkg/marching_cubes.js";
import * as THREE from "./../../build/three.module.js";
import { OrbitControls } from "./threejs/controls/OrbitControls.js";
import { SlicerControl } from "./views/marker.js";
import { VolumeRenderShader1 } from './threejs/shaders/VolumeShader.js';
import { WEBGL } from "./WebGL.js";
import { mergeVertices } from "./threejs/utils/BufferGeometryUtils.js";

class ModelViewer {

	sceneObject = {
		scene: null,
		camera: null,
		clippingControl: null,
		windowControl: null,
		light: {
			distance: 0,
			intensity:0
        }
	}

	cardiacObject = {
		colorMap: null,
		volDims: [0, 0, 0],
		thickness: [1, 1, 1],
		quality: -1,
		geometry: null,
	}

	constructor(domElement) {
		if (WEBGL.isWebGL2Available() === false) {
			document.body.appendChild(WEBGL.getWebGL2ErrorMessage());
		}

		this.full = false
		this.domElement = domElement
		this.renderer = null
		this.marchingCubes = null
		this.viewContructor()
		init("pkg/marching_cubes_bg.wasm").then(() => {
			this.marchingCubes = MarchingCubes.new()
		});
	}

	viewContructor() {

		// Camera
		//new THREE.PerspectiveCamera(45, WIDTH / HEIGHT, 0.01, 10000);
		let width = this.domElement.clientWidth;
		let height = this.domElement.clientHeight;

		let camera = new THREE.OrthographicCamera(-width / 2, width / 2, height / 2, - height / 2, 0.01, 2000);
		camera.position.set(800, 800, 800);
		camera.up.set(0, 1, 0);

		let scene = new THREE.Scene();
		scene.background = new THREE.Color(0.9, 0.9, 0.9)
		//scene.fog = new THREE.Fog(0x72645b, 600, 2000);
		
		// Light
		
		let directionalLight = new THREE.DirectionalLight(0xffffff, 1);
		//directionalLight.position.set(1, 1, 1)
		//scene.add(directionalLight);
		//scene.add(new THREE.HemisphereLight(0x443333, 0x111122));
		

		
		//let ambientLight = new THREE.AmbientLight(0xffffff, 0.2)
		//scene.add(ambientLight)

		//let pointLight = new THREE.PointLight(0xffffff, this.sceneObject.intensity, this.sceneObject.distance)
		camera.add(directionalLight)
		scene.add(camera)

		// Renderer
		this.renderer = new THREE.WebGLRenderer({ antialias: true });
		this.renderer.setSize(width, height, true);
		//this.renderer.domElement.style.width = `${width}px`
		//this.renderer.domElement.style.height = `${height} px`
		//renderer.setrenderSceneLoop(renderScene);
		this.renderer.localClippingEnabled = true
		this.domElement.appendChild(this.renderer.domElement);

		//axis landmark
		let axesHelper = new THREE.AxesHelper(800)
		scene.add(axesHelper)

		// Controller
		let windowControl = new OrbitControls(camera, this.renderer.domElement);
		windowControl.target.set(0, 0, 0)

		windowControl.addEventListener('change', () => {
			this.renderScene()
		})
		windowControl.enableRotate = true;
		//windowControl.minZoom = 0;
		//windowControl.maxZoom = 4;
		windowControl.update();

		this.sceneObject.scene = scene
		this.sceneObject.camera = camera
		this.sceneObject.clippingControl = new SlicerControl(scene)
		this.sceneObject.windowControl = windowControl

		this.renderScene()

		window.addEventListener('resize', () => {
			this.onWindowResize()
		});
	}

	onWindowResize() {
		let width = this.domElement.clientWidth
		let height = this.domElement.clientHeight
		this.renderer.setSize(width, height, true);
		this.sceneObject.camera.left = -width / 2
		this.sceneObject.camera.right = width / 2
		this.sceneObject.camera.updateProjectionMatrix();
		this.renderScene()
		
	}

	setModelData(uvdDims, dataBuffer) {
		//console.log(dataBuffer)
		//console.log(uvdDims)
		
		let xyzDims = [uvdDims[0] + 1, uvdDims[2] + 1, uvdDims[1] + 1]//exceed 1 unit for capping holes
		this.setClippingDim(xyzDims)
		this.setClippingRatio(axisXY, 0)
		this.setClippingRatio(axisXZ, 0)
		this.setClippingRatio(axisYZ, 0)

		this.cardiacObject.volDims = uvdDims
		this.marchingCubes.set_volume(dataBuffer, uvdDims[0], uvdDims[1], uvdDims[2], 5);
		//marchingCubes.set_volume(dataBuffer['mask'], volDims[0], volDims[1], volDims[2]);
	}

	modelUpdate(evt, callback) {
		if (this.lock) {
			return
		}

		if (this.modified() == false) {
			evt = 99
		}

		if (evt == 0) {
			this.lock = true
			//console.log('t')
			let uvdDims = this.cardiacObject.volDims
			let xyzDims = [uvdDims[0], uvdDims[2], uvdDims[1]]
			let scene = this.sceneObject.scene
			//output two render result

			this.renderMeshAsync(xyzDims, 2, "cardiac_mesh", scene).then(() => {
				let mesh = scene.getObjectByName("cardiac_mesh").children[0]
				let line = scene.getObjectByName("cardiac_mesh").children[1]

				this.cardiacObject.geometry = mesh.geometry
				this.sceneObject.clippingControl.addObject(mesh)
				this.sceneObject.clippingControl.addObject(line)
				//reset clipping planes position
				//sceneObject.clippingControl.updateAll()
				this.renderScene()

				if (callback != null && callback instanceof Function) {
					callback()
				}
				this.lock = false
			});

		}

		else if (evt == 9) {
			let dataBuffer = this.cardiacObject.maskBuffer
			let volDims = this.cardiacObject.volDims
			let isovalue = this.cardiacObject.isovalue
			let colorMap = this.cardiacObject.colorMap
			let scene = this.sceneObject.scene

			renderVolumeAsync(dataBuffer, volDims, isovalue, colorMap, "cardiac_volume", scene).then(() => {
				this.renderScene()
			})
		}
		else if (evt == 99) {
			let isovalue = this.cardiacObject.isovalue
			let scene = this.sceneObject.scene
			let model = this.generatedModel['model']
			let dataBuffer = this.cardiacObject.maskBuffer
			let volDims = this.cardiacObject.volDims
			let colorMap = this.cardiacObject.colorMap

			quickViewAsync(model, isovalue, "cardiac_mesh", scene).then(() => {
				this.renderScene()
			})

			renderVolumeAsync(dataBuffer, volDims, isovalue, colorMap, "cardiac_volume", scene).then(() => {
				this.renderScene()
			})
		}


		//update download link
		//
	}

	generatedModel = null
	generateAllModel(callback) {
		this.generatedModel = {
			'prepared': false,
			'model': {},
			'volume': {},
			'parameter': {
				'quality': this.cardiacObject.quality,
				'maskValue': this.cardiacObject.maskValue
			}
		}
		this.generateModel(0, 255, callback)
	}

	generateModel(counter, limit, callback) {
		setTimeout(() => {
			this.setIsoValue(counter)
			this.modelUpdate(0, () => {

				this.generatedModel['model'][counter] = this.cardiacObject.geometry
				callback(counter, limit)
				if (counter == limit) {
					this.generatedModel['prepared'] = true
				}
				else {
					counter++
					this.generateModel(counter, limit, callback)
				}
			})
		}, 10)
	}

	modified() {
		if (this.generatedModel == null || this.generatedModel['prepared'] == false) {
			return true
		}
		let gMaskValue = this.generatedModel['parameter']['maskValue']
		let gQuality = this.generatedModel['parameter']['quality']
		let maskValue = this.cardiacObject.maskValue
		let quality = this.cardiacObject.quality
		if (gMaskValue == maskValue && gQuality == quality) {
			return false
		}
		//disable quick view 
		this.generatedModel = null
		return true
	}

	getDownloadLink() {
		mDlLinkControl.prepare()
	}

	setIsoValue(isovalue) {
		//console.log(isovalue)
		this.cardiacObject.isovalue = isovalue

		//sceneObject.clippingControl.resize(dims, 1, true)
		//sceneObject.clippingControl.reset()
	}

	//deprecated
	setMaskValue(maskValue) {
		let currentMaskValue = Number(maskValue)
		let volDims = this.cardiacObject.volDims
		let dataBuffer = this.cardiacObject.dataBuffer

		let buffer = Array.from(dataBuffer)

		this.cardiacObject.maskRatio = currentMaskValue

		//let mask = maskUpSphere(volDims, currentMaskValue)
		let mask = maskUpBox(volDims, 0.5, 0.5, 0.5)
		maskUp2(buffer, volDims, mask)


		//maskUp(buffer, volDims, currentMaskValue)
		//let sb = sizeBased(dims, buffer)
		//whd -> xyz
		volDims["mask"] = volDims
		dataBuffer["mask"] = buffer

		marchingCubes.set_volume(buffer, volDims[0], volDims[1], volDims[2], 5);
		//this.update(dims, buffer)
	}

	mask = {
		'boxMask': [1, 1, 1],
		'sphereMask': 1
	}

	setDistance(distance) {
		this.cardiacObject.distance = distance
	}

	setBoxMaskValue(width, height, depth) {
		this.mask.boxMask = [Number(width), Number(height), Number(depth)]
	}

	setSphereMaskValue(ratio) {
		this.mask.sphereMask = Number(ratio)
	}

	generateMask() {
		let volDims = this.cardiacObject.volDims
		let dataBuffer = this.cardiacObject.dataBuffer
		let mask = this.cardiacObject.mask
		let buffer = Array.from(dataBuffer)

		let boxMask = maskUpBox(volDims, this.mask.boxMask[0], this.mask.boxMask[1], this.mask.boxMask[2])
		let sphereMask = maskUpSphere(volDims, this.mask.sphereMask)
		mask = [boxMask, sphereMask]

		//console.log(mask.length)
		maskUp2(buffer, volDims, mask)
		//maskUp(buffer, volDims, currentMaskValue)
		//let sb = sizeBased(dims, buffer)
		//whd -> xyz
		this.cardiacObject.maskBuffer = buffer

		this.setDcmViewerDims(volDims, buffer)

		//this.update(dims, buffer)

		//pixelEnhense(buffer)
	}

	getLightProfit() {
		return this.sceneObject.light
	}

	updateLight() {
		let profit = this.sceneObject.light
		let light = this.sceneObject.camera.children[0]
		//light.distance = profit.distance
		light.intensity = profit.intensity
		//console.log(light)
		this.renderScene()
	}

	setLightProfit(profit, update = true) {
		this.sceneObject.light = profit
		if (update) {
			this.updateLight()
        }
    }

	setQuality(value) {
		this.cardiacObject.quality = Number(value)
		uthis.pdateLight()
	}

	//display
	setVolumeVisible(option) {
		let mesh = this.sceneObject.scene.getObjectByName("cardiac_volume")
		mesh.visible = option
		this.renderScene()
	}

	setMeshVisible(option) {
		let mesh = this.sceneObject.scene.getObjectByName("cardiac_mesh")
		mesh.visible = option
		this.renderScene()
	}

	setRenderMode(option, enabled) {
		let mesh = this.sceneObject.scene.getObjectByName("cardiac_mesh").children[0]
		let line = this.sceneObject.scene.getObjectByName("cardiac_mesh").children[1]
		if (option == 'wireline') {
			line.visible = enabled
		}
		else if (option == 'polygen') {
			mesh.visible = enabled
		}
		this.renderScene()
    }

	//clipping
	setClippingMesh(mesh) {
		this.sceneObject.clippingControl.addObject(mesh)
		this.renderScene();
	}

	setClippingDim(xyzDims) {
		this.sceneObject.clippingControl.thickness = this.cardiacObject.thickness
		this.sceneObject.clippingControl.resize(xyzDims, 1, true)
		this.sceneObject.clippingControl.reset()
		this.renderScene();
	}

	setClippingRatio(type, ratio) {
		this.sceneObject.clippingControl.setIndexRatio(type, ratio)
		this.renderScene();
	}

	setClippingEnable(axis, option) {
		this.sceneObject.clippingControl.setClipping(axis, option)
		this.renderScene()
	}

	setVolumeColor(colorMap) {
		this.cardiacObject.colorMap = colorMap
	}

	getClippingPlaneIndex() {
		return this.sceneObject.clippingControl.getClippingPlaneIndex() * 10
	}

	getMesh() {
		return this.sceneObject.scene.getObjectByName('cardiac_mesh')
    }

	getVertices() {
		return this.sceneObject.scene.getObjectByName('cardiac_mesh').geometry.vertices
	}

	renderScene() {
		this.renderer.render(this.sceneObject.scene, this.sceneObject.camera);
	}

	renderVolumeAsync = (dataBuffer, volDims, isovalue, colorMap, id, scene) => {
		let _this = this
		return new Promise(
			function (resolve, reject) {
				_this.renderVolume(dataBuffer, volDims, isovalue, colorMap, id, scene)
				resolve()
			}
		)
	}

	renderMeshAsync = (xyzDims, ratio, id, scene) => {
		let _this = this
		return new Promise(
			function (resolve, reject) {
				_this.renderMesh(xyzDims, 2, id, scene)
				resolve()
			}
		)
	}

	quickViewAsync = (model, id, scene) => {
		return new Promise(
			function (resolve, reject) {
				this.quickView(model, id, scene)
				resolve()
			}
		)
	}

	renderVolume = function (volDims, isovalue, colorMap, id, scene) {

		let mesh = scene.getObjectByName(id)
		if (mesh == null) {
			// THREE.Mesh
			const geometry = new THREE.BoxGeometry(volDims[0], volDims[1], volDims[2]);

			//geometry.translate(volDims[0] / 2 - 0.5, volDims[1] / 2 - 0.5, volDims[2] / 2 - 0.5);
			let dataBufferFloat = new Float32Array(dataBuffer);

			for (let i = 0; i < dataBufferFloat.length; i++) {
				dataBufferFloat[i] /= 255
			}

			const texture = new THREE.DataTexture3D(dataBufferFloat, volDims[0], volDims[1], volDims[2]);
			texture.format = THREE.RedFormat;
			texture.type = THREE.FloatType;
			texture.minFilter = texture.magFilter = THREE.LinearFilter;
			texture.unpackAlignment = 1;

			// Material
			const shader = VolumeRenderShader1;

			const uniforms = THREE.UniformsUtils.clone(shader.uniforms);
			const cmtextures = colorMap;

			uniforms["u_data"].value = texture;
			uniforms["u_size"].value.set(volDims[0], volDims[1], volDims[2]);
			uniforms["u_clim"].value.set(0, 1);
			uniforms["u_renderstyle"].value = 1; // 0: MIP, 1: ISO
			uniforms["u_renderthreshold"].value = isovalue / 255; // For ISO renderstyle
			uniforms["u_cmdata"].value = cmtextures;

			const material = new THREE.ShaderMaterial({
				uniforms: uniforms,
				vertexShader: shader.vertexShader,
				fragmentShader: shader.fragmentShader,
				clipping: true,
				clipShadows: true,
				side: THREE.DoubleSide // The volume shader uses the backface as its "reference point"
			});

			mesh = new THREE.Mesh(geometry, material);
			mesh.name = id
			mesh.rotation.x = -Math.PI / 2
			mesh.rotation.y = Math.PI
			mesh.applyMatrix4(new THREE.Matrix4().makeScale(-1, 1, 1))
			scene.add(mesh)
		}
		else {
			mesh.material.uniforms["u_cmdata"].value = colorMap;
			mesh.material.uniforms["u_renderthreshold"].value = isovalue / 255; // For ISO renderstyle
			mesh.material.clippingPlanes = mesh.material.clippingPlanes
		}

		//subrenderer.setClippingMesh(mesh)
	}

	renderMesh = function (xyzDims, ratio, id, scene) {
		let vertice = this.marchingCubes.marching_cubes(ratio);
		let diff = [-xyzDims[0] / 2 - 5, -xyzDims[1] / 2 - 5, -xyzDims[2] / 2 - 5]
		let geometry = new THREE.BufferGeometry();
		
		// itemSize = 3 because there are 3 values (components) per vertex
		geometry.setAttribute('position', new THREE.BufferAttribute(vertice, 3));
		geometry = mergeVertices(geometry, 0.1)
		geometry.translate(diff[0], diff[1], diff[2])
		geometry.computeVertexNormals()

		const material = new THREE.MeshPhongMaterial({ color: 0xff2222, side: THREE.DoubleSide });
		const wireframe = new THREE.WireframeGeometry(geometry);

		// group[0]: mesh
		// group[1]: line
		let thickness = this.cardiacObject.thickness
		let group = scene.getObjectByName(id)
		if (group == null) {
			group = new THREE.Group()
			group.name = id
			
			let mesh = new THREE.Mesh(geometry, material);
			mesh.name = 'polygen'
			mesh.scale.set(...thickness)
			group.add(mesh)

			let line = new THREE.LineSegments(wireframe);
			//line.material.depthTest = false;
			line.material.opacity = 0.5;
			line.material.transparent = true;
			line.name = 'wireframe'
			line.scale.set(...thickness)
			group.add(line)

			scene.add(group)
		}
		else {
			group.children[0].geometry = geometry
			group.children[0].scale.set(...thickness)
			group.children[1].geometry = wireframe
			group.children[1].scale.set(...thickness)
		}
		console.log(thickness)
	}

	quickView = function (model, isovalue, id, scene) {

		let mesh = scene.getObjectByName(id)
		mesh.geometry = model[isovalue]
		//console.log(mesh)
	}
}



export { ModelViewer }