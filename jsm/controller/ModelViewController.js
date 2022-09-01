import init, { MarchingCubes } from "../../pkg/lib.js";
import * as THREE from "../build/three.module.js";
import { OrbitControls } from "../example/jsm/controls/OrbitControls.js";
import { SlicerGroup } from "../parts/marker.js";
import { WEBGL } from "../WebGL.js";
import { mergeVertices } from "../example/jsm/utils/BufferGeometryUtils.js";
import { MMDLoader } from "../example/jsm/loaders/MMDLoader.js";
import { STLLoader } from "../example/jsm/loaders/STLLoader.js";
import { OBJLoader } from "../example/jsm/loaders/OBJLoader.js";
import { MTLLoader } from "../example/jsm/loaders/MTLLoader.js";
import { OutlineEffect } from '../example/jsm/effects/OutlineEffect.js';
import { VolumeRenderShader_iso, VolumeRenderShader_mip } from '../tf/VolumeShader.js';

import { BinaryArray } from "../model/ExtendedArray.js"

class Histogram {

    static getInstance = function () {
        return new Histogram()
    }

    constructor() {
        // set the dimensions and margins of the graph

        let margin = { top: 10, right: 10, bottom: 20, left: 40 }
        let colormap = new Array(256).fill(0).map((value, index) => {
            return index
        })

        let getHistogram = (data, stored) => {
            let colorlevel = 2 ** stored
            let histogram = new Uint32Array(256).fill(0)

            for (let i = 0; i < data.length; i++) {
                histogram[Math.round(data[i] / colorlevel * 255)]++
            }

            return histogram
        }

        this.loadView = function (domElement, data, stored) {
            domElement.innerHTML = ''

            let width = domElement.clientWidth - margin.left - margin.right
            let height = domElement.clientHeight - margin.top - margin.bottom

            // append the svg object to the specified element
            let svg = d3.select(domElement)
                .append('svg')
                .attr('width', width + margin.left + margin.right)
                .attr('height', height + margin.top + margin.bottom)
                .append('g')
                .attr('transform',
                    'translate(' + margin.left + ',' + margin.top + ')');

            // X axis: scale and draw:
            let x = d3.scaleLinear()
                .domain([1, 255])     // except 0 value pixels
                .range([0, width]);

            let ratio = 2 ** stored / 255

            svg.append('g')
                .attr('transform', 'translate(0,' + height + ')')
                .call(
                    d3
                        .axisBottom(x)

                        .tickFormat((d) => {
                            return Math.round(d * ratio)
                        })
                );

            // apply this function to data to get the bins
            let bins = getHistogram(data, stored)

            // Y axis: scale and draw:
            let y = d3.scaleLog()
                .range([height, 0])
                .domain([1, d3.max(bins)]);

            svg.append('g')
                .call(
                    d3.axisLeft(y)
                );

            // append the bar rectangles to the svg element
            svg.selectAll('rect')
                .data(Array.from(bins.keys()))
                .enter()
                .append('rect')
                .attr('transform', function (d) { return 'translate(' + x(d) + ',' + y(bins[d] + 1) + ')'; })
                .attr('width', function (d) { return x(d + 1) - x(d); })
                .attr('height', function (d) { return height - y(bins[d] + 1); })
                .style('fill', function (d) {
                    //console.log(colormap)
                    let index = d
                    let hex = colormap[index]

                    if (hex < 16) {
                        hex = '0' + hex.toString(16)
                    }
                    else {
                        hex = hex.toString(16)
                    }

                    return '#' + hex + hex + hex
                })

        }
    }
}

class Histogram_bak {

    static getInstance = function () {
        return new Histogram()
    }

    constructor() {
        // set the dimensions and margins of the graph

        let margin = { top: 10, right: 10, bottom: 20, left: 40 }
        let colormap = new Array(256).fill(0).map((value, index) => {
            return index
        })

        let getHistogram = (data) => {
            let colorlevel = getDataRange(data)
            let histogram = new Uint32Array(colorlevel).fill(0)

            for (let i = 0; i < data.length; i++) {
                histogram[data[i]]++
            }

            return histogram
        }

        this.loadView = function (domElement, data) {

            let colorlevel = getDataRange(data) + 1

            domElement.innerHTML = ''

            let width = domElement.clientWidth - margin.left - margin.right
            let height = domElement.clientHeight - margin.top - margin.bottom

            // append the svg object to the specified element
            let svg = d3.select('#' + domElement.id)
                .append('svg')
                .attr('width', width + margin.left + margin.right)
                .attr('height', height + margin.top + margin.bottom)
                .append('g')
                .attr('transform',
                    'translate(' + margin.left + ',' + margin.top + ')');

            // X axis: scale and draw:
            let x = d3.scaleLinear()
                .domain([1, colorlevel])     // except 0 value pixels
                .range([0, width]);

            svg.append('g')
                .attr('transform', 'translate(0,' + height + ')')
                .call(
                    d3
                        .axisBottom(x)
                        .ticks(5));

            // apply this function to data to get the bins
            let bins = getHistogram(data)

            // Y axis: scale and draw:
            let y = d3.scaleLog()
                .range([height, 0])
                .domain([1, d3.max(bins)]);

            svg.append('g')
                .call(
                    d3.axisLeft(y)
                        .ticks(5)
                );


            // append the bar rectangles to the svg element
            svg.selectAll('rect')
                .data(Array.from(bins.keys()))
                .enter()
                .append('rect')
                .attr('transform', function (d) { return 'translate(' + x(d) + ',' + y(bins[d] + 1) + ')'; })
                .attr('width', function (d) { return Math.ceil(x(d + 1) - x(d)); })
                .attr('height', function (d) { return height - y(bins[d] + 1); })
            /**
             *                 .style('fill', function (d, i) {
                //console.log(colormap)
                let index = Math.round(i * colormap.length / colorlevel)
                let hex = colormap[index]

                if (hex < 10) {
                    hex = '0' + hex.toString(16)
                }
                else{
                    hex = hex.toString(16)
                }

                
                return '#' + hex + hex + hex
            })
             */
        }
    }
}

class SignalDistribution {

    static getInstance = function () {
        return new SignalDistribution()
    }

    constructor() {
        // set the dimensions and margins of the graph
        let canvas = document.createElement('canvas')
        canvas.width = 256
        canvas.height = 100

        let ctx = canvas.getContext('2d')

        this.loadView = function (domElement) {

            domElement.appendChild(canvas)
        }

        let getPosition = (x, y, width, height) => {
            return (height - 1 - y) * width + x
        }

        this.updateView = (imgData, stored) => {

            let max = 2 ** stored
            let udata = imgData.data
            let histogram = new Uint32Array(max).fill(0)

            let counterMax = 0
            for (let i = 0; i < imgData.length; i++) {
                histogram[udata[i]]++
                if (counterMax < histogram[udata[i]]) {
                    counterMax = histogram[udata[i]]
                }
            }

            let palette = ctx.getImageData(0, 0, 256, 100)
            let data = palette.data

            let ratioX = (256 - 1) / (max - 1)
            let ratioY = (100 - 1) / (counterMax - 1)

            for (let i = 0; i < 256; i++) {
                let y = (histogram[i]) * ratioY
                let x = i * ratioX

                let index = getPosition(x, y, 256, 100)

                for (let j = 0; j < height; j++) {
                    data[4 * index] = 255
                    data[4 * index + 1] = 255
                    data[4 * index + 2] = 255
                    data[4 * index + 3] = 255
                }

            }

            ctx.putImageData(palette, 0, 0)
        }
    }
}

class DimensionView extends THREE.EventDispatcher {
    constructor(manager, domElements) {
        super()

        this.uvdDims = [0, 0, 0]
        this.imgLayerValue = [-1, -1, -1]
        this.contrastValue = [0, 0, 0]
        this.exposureValue = [0, 0, 0]

        let viewports = new Array(3)
        let slider = new Array(3)
        let counterLabel = new Array(3)
        let exposureLabel = new Array(3)
        let contrastLabel = new Array(3)
        let imgGroups = new Array(3)

        let changeEvent = { type: 'change' }

        for (let i = 0;
            i < 3; i++) {
            viewports[i] = domElements[i].querySelector('.viewport')
            slider[i] = domElements[i].querySelector(".viewer-slider")
            counterLabel[i] = domElements[i].querySelector(".counter")
            exposureLabel[i] = domElements[i].querySelector(".exposure")
            contrastLabel[i] = domElements[i].querySelector(".contrast")
        }

        let init = () => {

            for (let i = 0; i < viewports.length; i++) {
                let viewport = viewports[i]
                let imgGroup = document.createElement('div')
                imgGroup.style.width = '100%'
                imgGroup.style.height = '100%'

                viewport.appendChild(imgGroup)
                imgGroups[i] = imgGroup

                let mImgDom = manager.maskImages[i].domElements
                for (let key in mImgDom) {
                    imgGroup.appendChild(mImgDom[key].context.canvas)
                }

                let action = -1
                let mousePos = [0, 0]
                let scaleRatio = [1, 1]
                let translateRatio = [0, 0]
                let diff = [0, 0]
                let screenSize = [Number(screen.width), Number(screen.height)]

                imgGroup.addEventListener('mousedown', (evt) => {
                    mousePos[0] = evt.clientX
                    mousePos[1] = evt.clientY
                    action = 0
                })

                window.addEventListener('mousemove', (evt) => {

                    if (action == -1) {
                        return
                    }


                    diff[0] = (evt.clientX - mousePos[0]) / screenSize[0]
                    diff[1] = (evt.clientY - mousePos[1]) / screenSize[1]

                    //中鍵
                    if (evt.buttons == 2 && evt.button == 0) {
                        let ratio = (diff[0]) + scaleRatio[0]

                        imgGroup.style.width = ratio * 100 + '%'
                        imgGroup.style.height = ratio * 100 + '%'

                        this.sizeReload(i)
                    }

                    else if (evt.buttons == 4 && evt.button == 0) {
                        let ratioX = (diff[0]) + translateRatio[0]
                        let ratioY = (diff[1]) + translateRatio[1]

                        viewport.style.left = ratioX * 100 + '%'
                        viewport.style.top = ratioY * 100 + '%'
                    }
                })

                window.addEventListener('mouseup', (evt) => {
                    if (evt.buttons == 0 && evt.button == 2) {
                        scaleRatio[0] += diff[0]
                        scaleRatio[1] += diff[1]
                    }
                    else if (evt.buttons == 0 && evt.button == 1) {
                        translateRatio[0] += diff[0]
                        translateRatio[1] += diff[1]
                    }
                    action = -1
                })

                window.addEventListener('mouseleave', (evt) => {
                    if (evt.buttons == 0 && evt.button == 2) {
                        scaleRatio[0] += diff[0]
                        scaleRatio[1] += diff[1]
                    }
                    else if (evt.buttons == 0 && evt.button == 1) {
                        translateRatio[0] += diff[0]
                        translateRatio[1] += diff[1]
                    }
                    action = -1
                })

                manager.addNotifyEvent(() => {
                    this.updateDcmView()
                }, 'segmentUpdate')

                manager.addNotifyEvent(() => {
                    this.updateDcmView()
                }, 'imageUpdate')
            }
        }

        this.sliderUpdate = (axis) => {

            let mImgs = manager.maskImages
            let index = this.imgLayerValue[axis];
            let length, ratio

            //this.renderScene()

            if (axis == axisUV) {
                //ratio = index / this.uvdDims[2]
                length = this.uvdDims[2]
            } else if (axis == axisUD) {
                //ratio = index / this.uvdDims[1]
                length = this.uvdDims[1]
            } else {
                //ratio = index / this.uvdDims[0]
                length = this.uvdDims[0]
            }


            counterLabel[axis].textContent = `${parseInt(index) + 1}/${length}`

            exposureLabel[axis].textContent = Math.round(mImgs[axis].exposure * 10 - 10) / 10
            contrastLabel[axis].textContent = Math.round(mImgs[axis].contrast * 10 - 10) / 10

            this.sizeReload(axis)
            this.showDicom(axis, index)

            this.dispatchEvent(changeEvent)
        }

        //axis: Top2button(TB) is 0; Front2Back(FB) is 1; Left2Right(LR) is 2
        //index: current dicom image page
        this.showDicom = (axis, index) => {

            requestAnimationFrame(() => {
                index = parseInt(index)
                if (index >= this.uvdDims[axis].length) {
                    return
                }

                //console.log(axis, index)
                manager.setFocusedLayer(axis, index)
            })

        }


        this.sizeReload = (index) => {
            //adjust element size
            let mImg = manager.maskImages[index]
            let imgGroup = imgGroups[index]
            let ratio = mImg.size[1] * mImg.thickness[1] / mImg.size[0] / mImg.thickness[0]

            // 預留畫布
            let newW = imgGroup.offsetWidth
            let newH = imgGroup.clientHeight
            let nratio = newH / newW

            if (ratio > nratio) {
                newW = newH / ratio
            } else {
                newH = newW * ratio
            }

            mImg.setCanvasStyle(newW, newH)
        }

        window.addEventListener('resize', () => {
            for (let i = 0; i < 3; i++) {
                this.sizeReload(i)
            }
        })

        this.setDcmViewerDims = (uvdDims) => {

            this.uvdDims = uvdDims

            for (let i = 0; i < 3; i++) {
                slider[i].min = 0
                slider[i].max = uvdDims[2 - i] - 1
                slider[i].step = 0.05

                let mid = Math.round(uvdDims[2 - i] / 2)
                slider[i].value = mid
                this.scrollto(i, mid)
            }

        }

        this.updateDcmView = () => {
            this.sliderUpdate(axisUV)
            this.sliderUpdate(axisUD)
            this.sliderUpdate(axisVD)
        }

        this.scrollto = (axis, index) => {
            //console.log(percent * this.uvdDims[2 - axis])
            this.imgLayerValue[axis] = index
            this.sliderUpdate(axis)
        }

        this.Index2Ratio = (axis, index) => {
            if (index < 0) {
                index = 0
            } else if (index >= this.uvdDims[2 - axis]) {
                index = this.uvdDims[2 - axis] - 1
            }
            return index / (this.uvdDims[2 - axis] - 1)
        }

        this.Ratio2Index = (axis, ratio) => {
            if (ratio < 0) {
                ratio = 0
            } else if (ratio > 1) {
                ratio = 1
            }
            return ratio * (this.uvdDims[2 - axis] - 1)
        }

        init()
    }
}

class CADViewer {
    constructor(domElement) {
        this.scene = null
        this.camera = null
        this.clippingGroup = null
        this.renderer = null
        this.controller = null
        this.domElement = domElement
        this.effect = null;
        this.thickness = [1, 1, 1]

        const camera_unit = 1.2
        const model_unit = 1

        let model = null

        let setCameraSize = (width, height) => {
            let aspect = width / height
            this.camera.left = -aspect * camera_unit / 2
            this.camera.right = aspect * camera_unit / 2
            this.camera.top = camera_unit / 2
            this.camera.bottom = -camera_unit / 2
            this.camera.far = 100
            this.camera.near = 0.1
            this.camera.updateProjectionMatrix();
        }

        let onWindowResize = () => {
            let width = this.domElement.clientWidth;
            let height = this.domElement.clientHeight;
            setCameraSize(width, height)
            this.renderer.setSize(width, height)
            this.renderScene()
        }

        let loadModel = () => {
            new MTLLoader().load('model/obj/f-16.mtl', (mtl) => {

                new OBJLoader().setMaterials(mtl).load('model/obj/f-16.obj', (object) => {
                    //console.log(object)
                    let box = new THREE.Box3().setFromObject(object)

                    let min = box.min
                    let max = box.max
                    let scaleX = model_unit / (max.x - min.x)
                    let scaleY = model_unit / (max.y - min.y)
                    let scaleZ = model_unit / (max.z - min.z)
                    //console.log(scaleX, scaleY, scaleZ, box)

                    for (let i = 0; i < object.children.length; i++) {
                        //object.children[i].scale.set(scaleX, scaleY, scaleZ)
                    }


                    this.scene.add(object)

                    // Clipping Control
                    //this.setClippingMesh(model)
                    //console.log(model)
                    this.renderScene()
                })
            })

        }

        this.copyCamera = (c) => {
            if (!(c instanceof THREE.Camera))
                return

            let zoom = this.camera.zoom
            this.camera.copy(c, false)
            this.camera.zoom = zoom
            let width = this.domElement.clientWidth;
            let height = this.domElement.clientHeight;
            setCameraSize(width, height)
        }

        let cameraActions = {
            0: () => {
                this.camera.position.set(0, 16, 0);
                this.camera.up.set(0, 0, 1);
                this.camera.lookAt(0, 0, 0);
                this.clippingGroup.setClipping(0, true)
            },
            1: () => {
                this.camera.position.set(0, 0, 16);
                this.camera.up.set(0, 1, 0);
                this.camera.lookAt(0, 0, 0);
                this.clippingGroup.setClipping(1, true)
            },
            2: () => {
                this.camera.position.set(16, 0, 0);
                this.camera.up.set(0, 1, 0);
                this.camera.lookAt(0, 0, 0);
                this.clippingGroup.setClipping(2, true)
            }
        }

        this.setOrientation = (index) => {
            this.clippingGroup.setClipping(0, false)
            this.clippingGroup.setClipping(1, false)
            this.clippingGroup.setClipping(2, false)

            if (cameraActions[index] instanceof Function) {
                cameraActions[index]()
            }

            this.camera.updateProjectionMatrix()
            this.renderScene()
        }

        let init = () => {
            let width = this.domElement.clientWidth;
            let height = this.domElement.clientHeight;
            // Camera

            this.camera = new THREE.OrthographicCamera();
            setCameraSize(width, height)

            this.camera.position.set(0, 16, 0);
            this.camera.up.set(0, 0, 1);
            this.camera.lookAt(0, 0, 0);

            // Scene
            this.scene = new THREE.Scene();
            this.scene.add(this.camera)

            // Light
            const ambient = new THREE.AmbientLight(0x666666);
            this.scene.add(ambient);

            const directionalLight = new THREE.DirectionalLight(0xffffff, 2.0);
            directionalLight.position.set(- 1, 1, 1).normalize();
            this.camera.add(directionalLight);

            // Renderer
            this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
            //this.renderer.localClippingEnabled = true
            this.renderer.setSize(width, height);
            this.renderer.setClearColor(0xFFFFFF, 0)
            this.domElement.appendChild(this.renderer.domElement);
            //renderer.setrenderSceneLoop(renderScene);

            //this.effect = new OutlineEffect(this.renderer);
            //this.effect.setSize(width, height)

            //let axesHelper = new THREE.AxesHelper(10)
            //this.scene.add(axesHelper)

            // Window Size Event
            window.addEventListener('resize', () => {
                onWindowResize()
            });

            // Render
            loadModel();
        }

        init()
    }

    vmax = 1
    vration = 0.4
    vremain = this.vmax - this.vration
    renderScene() {
        //let x, y, width, height
        /**
         x = 0
         y = 0
         width = this.domElement.clientWidth * this.vration;
         height = this.domElement.clientHeight * this.vration;
         
         this.effect.setViewport(x, y, width, height)
         this.effect.setScissor(x, y, width, height)
         this.effect.setScissorTest(true)
         this.setModel(0)
         this.effect.render(this.scene, this.camera);
         
         
         x = width
         y = height
         width = this.domElement.clientWidth * this.vremain;
         height = this.domElement.clientHeight * this.vremain;
         
         this.effect.render(this.scene, this.camera);
         this.effect.setViewport(x, y, width, height)
         this.effect.setScissor(x, y, width, height)
         this.effect.setScissorTest(true)
         this.setModel(1)
         this.effect.render(this.scene, this.camera);
         */
        //this.setModel(0)
        this.renderer.render(this.scene, this.camera);
    }
}

// 體積投影模型生成
class VolumeViewer {
    constructor(manager, domElement) {

        this.domElement = domElement
        this.camera = null
        this.renderer = null
        this.scene = null
        this.renderType = 0

        const model_unit = 1
        const camera_unit = 2

        let model = new THREE.Group()

        let initGroup = () => {
            let volume = manager.state.volume
            let volDims = volume.thumbnailSize
            let spacing = manager.state.info.spacing

            let max = Math.max(
                volDims[0] * spacing[0],
                volDims[1] * spacing[1],
                volDims[2] * spacing[2])

            model.scale.set(
                -model_unit / max * spacing[0],
                model_unit / max * spacing[1],
                model_unit / max * spacing[2])

            model.position.set(
                volDims[0] * model_unit / max * spacing[0] / 2,
                -volDims[1] * model_unit / max * spacing[1] / 2,
                -volDims[2] * model_unit / max * spacing[2] / 2)

            let m = new THREE.Matrix4().identity()
            m.makeRotationX(-Math.PI / 2)
            model.applyMatrix4(m)
            m.makeRotationZ(Math.PI)
            model.applyMatrix4(m)
        }

        let initVolume = () => {

            let volume = manager.state.volume
            let volDims = volume.thumbnailSize
            let dataBuffer = volume.thumbnail
            let colormap = manager.state.colorSetting.colormap
            let renderType = manager.state.volumeRenderType

            //初始化紋理
            const datatexture = new THREE.DataTexture3D(dataBuffer, volDims[0], volDims[1], volDims[2]);

            datatexture.format = THREE.RedFormat;
            datatexture.type = THREE.UnsignedByteType;
            datatexture.minFilter = THREE.LinearFilter;
            datatexture.magFilter = THREE.LinearFilter;
            datatexture.needsUpdate = true;

            const colormaptexture = new THREE.DataTexture(colormap, 256, 1)
            colormaptexture.format = THREE.RGBAFormat
            colormaptexture.type = THREE.FloatType
            colormaptexture.needsUpdate = true;

            // THREE.Mesh
            const geometry = new THREE.BoxGeometry(volDims[0], volDims[1], volDims[2]);
            geometry.translate(volDims[0] / 2, volDims[1] / 2, volDims[2] / 2)

            // Material
            const shader = VolumeRenderShader_mip;
            const uniforms = THREE.UniformsUtils.clone(shader.uniforms);

            uniforms["u_data"].value = datatexture;
            uniforms["u_size"].value.set(volDims[0], volDims[1], volDims[2]);
            uniforms["u_clim"].value.set(0, 1);
            uniforms["u_renderstyle"].value = 0;
            uniforms["u_cmdata"].value = colormaptexture;

            //設定材質
            const material = new THREE.ShaderMaterial({
                uniforms: uniforms,
                vertexShader: shader.vertexShader,
                fragmentShader: shader.fragmentShader,
                transparent: true,
                side: THREE.BackSide // The volume shader uses the backface as its "reference point"
            });

            model.add(new THREE.Mesh(geometry, material))

        }

        let updateVolume = () => {
            // 當前正在使用的立體影像

            let tfData = manager.state.tfData
            let colormap = manager.state.colorSetting.colormap
            let filter = model.children[0]
            let renderType = manager.state.volumeRenderType


            let colormaptexture = filter.material.uniforms["u_cmdata"].value;
            colormaptexture.image.data = colormap;
            colormaptexture.needsUpdate = true;

        }

        let initMask = () => {

            let volume = manager.state.volume
            let volDims = volume.thumbnailSize
            let dataBuffer = volume.thumbnail
            let colormap = manager.state.colorSetting.colormap
            let renderType = manager.state.volumeRenderType

            //初始化紋理
            const datatexture = new THREE.DataTexture3D(dataBuffer, volDims[0], volDims[1], volDims[2]);
            const sizetextures = new THREE.DataTexture3D(null, volDims[0], volDims[1], volDims[2]);
            const filtertexture = new THREE.DataTexture3D(null, volDims[0], volDims[1], volDims[2]);

            datatexture.format = sizetextures.format = filtertexture.format = THREE.RedFormat;
            datatexture.type = sizetextures.type = filtertexture.type = THREE.UnsignedByteType;
            datatexture.minFilter = sizetextures.minFilter = filtertexture.minFilter = THREE.LinearFilter;
            datatexture.magFilter = sizetextures.magFilter = filtertexture.magFilter = THREE.LinearFilter;
            datatexture.needsUpdate = true;

            const colormaptexture = new THREE.DataTexture(colormap, 256, 1)
            colormaptexture.format = THREE.RGBAFormat
            colormaptexture.type = THREE.FloatType
            colormaptexture.needsUpdate = true;

            // THREE.Mesh
            const geometry = new THREE.BoxGeometry(volDims[0], volDims[1], volDims[2]);
            geometry.translate(volDims[0] / 2, volDims[1] / 2, volDims[2] / 2)

            // Material
            const shader = VolumeRenderShader_iso;
            const uniforms = THREE.UniformsUtils.clone(shader.uniforms);

            uniforms["u_data"].value = datatexture;
            uniforms["u_size"].value.set(volDims[0], volDims[1], volDims[2]);
            uniforms["u_clim"].value.set(0, 1);
            uniforms["u_renderstyle"].value = this.renderType;
            uniforms["u_filter"].value = filtertexture;
            uniforms["u_cmdata"].value = colormaptexture;
            uniforms['u_sizeData'].value = sizetextures

            //設定材質
            const material = new THREE.ShaderMaterial({
                uniforms: uniforms,
                vertexShader: shader.vertexShader,
                fragmentShader: shader.fragmentShader,
                transparent: true,
                side: THREE.BackSide // The volume shader uses the backface as its "reference point"
            });

            model.add(new THREE.Mesh(geometry, material))
        }

        let updateMask = () => {
            // 當前正在使用的樣板
            let segment = manager.state.focusedSegment
            let filterBuffer = null

            if (segment != null) {
                segment.generateThumbnail()
                filterBuffer = segment.thumbnail
            }

            let tfData = manager.state.tfData
            let colormap = manager.state.colorSetting.colormap
            let renderType = manager.state.volumeRenderType

            let filter = model.children[1]

            let sizetextures = filter.material.uniforms["u_sizeData"].value;
            sizetextures.image.data = tfData
            sizetextures.needsUpdate = true;

            let filtertexture = filter.material.uniforms["u_filter"].value;
            filtertexture.image.data = filterBuffer
            filtertexture.needsUpdate = true;

            let colormaptexture = filter.material.uniforms["u_cmdata"].value;
            colormaptexture.image.data = colormap;
            colormaptexture.needsUpdate = true;

            filter.material.uniforms["u_renderstyle"].value = this.renderType;
            filter.material.uniformsNeedUpdate = true
        }

        this.renderVolume = () => {

            updateVolume()
            updateMask()

            this.renderScene()
        }

        this.renderScene = () => {
            this.renderer.render(this.scene, this.camera)
        }

        this.copyCamera = (c) => {
            if (!(c instanceof THREE.Camera))
                return

            let zoom = this.camera.zoom
            this.camera.copy(c, false)
            this.camera.zoom = zoom
            let width = this.domElement.clientWidth;
            let height = this.domElement.clientHeight;
            setCameraSize(width, height)
        }

        let setCameraSize = (width, height) => {
            let aspect = width / height
            this.camera.left = -aspect * camera_unit / 2
            this.camera.right = aspect * camera_unit / 2
            this.camera.top = camera_unit / 2
            this.camera.bottom = -camera_unit / 2
            this.camera.far = 100
            this.camera.near = 0.1
            this.camera.updateProjectionMatrix();
        }

        let init = () => {
            let width = domElement.clientWidth;
            let height = domElement.clientHeight;

            this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
            this.renderer.setSize(width, height, false)
            this.renderer.setClearColor(0xFFFFFF, 0.0)
            this.domElement.appendChild(this.renderer.domElement)

            this.scene = new THREE.Scene()

            this.camera = new THREE.OrthographicCamera();
            setCameraSize(width, height)

            this.camera.position.set(10, 10, 10)
            this.camera.lookAt(0, 0, 0)
            this.scene.add(this.camera)
            this.scene.add(model)

            window.addEventListener('resize', () => {
                width = domElement.clientWidth * 2;
                height = domElement.clientHeight * 2;

                setCameraSize(width, height)

                this.renderer.setSize(width, height, false)
                this.renderScene()
            })

            this.renderScene()
        }

        init()
        initGroup()
        initVolume()
        initMask()
    }
}

// marching cubes 模型生成
class ModelViewer {


    constructor(domElement) {
        if (WEBGL.isWebGL2Available() === false) {
            document.body.appendChild(WEBGL.getWebGL2ErrorMessage());
        }

        this.domElement = domElement
        this.renderer = null
        this.scene = null
        this.camera = null
        this.clippingGroup = null
        this.windowControl = null
        this.lightProfile = {
            distance: 0,
            intensity: 0
        }

        this.color = '0xFF0000'
        this.volDims = [0, 0, 0]
        this.thickness = [1, 1, 1]
        this.renderMode = {
            polygen: true,
            wireline: true,
        }
        this.smooth = 0.1
        this.marchingCubes = null

        this.model = {
            mesh: null,
            line: null
        }

        init("pkg/lib_bg.wasm").then(() => {
            this.marchingCubes = MarchingCubes.new()
        });

        this._data = null

        let initView = () => {
            // Camera
            let width = this.domElement.clientWidth;
            let height = this.domElement.clientHeight;

            this.camera = new THREE.OrthographicCamera(-width / 2, width / 2, height / 2, -height / 2, 0.01, 2000);
            this.camera.position.set(800, 800, 800);
            this.camera.up.set(0, 1, 0);

            this.scene = new THREE.Scene();
            this.scene.background = new THREE.Color(0.9, 0.9, 0.9)

            // Light
            const light = new THREE.DirectionalLight(0xffffff, 1);

            this.camera.add(light)

            this.scene.add(new THREE.HemisphereLight(0x443333, 0x111122))
            this.scene.add(this.camera)

            // Renderer
            this.renderer = new THREE.WebGLRenderer({ antialias: true });
            this.renderer.setSize(width, height, true);

            this.renderer.localClippingEnabled = true
            this.domElement.appendChild(this.renderer.domElement);

            //axis landmark
            //this.scene.add(new THREE.AxesHelper(800))

            // Controller
            let windowControl = new OrbitControls(this.camera, this.renderer.domElement)
            windowControl.target.set(0, 0, 0)

            windowControl.addEventListener('change', () => {
                this.renderScene()
            })

            windowControl.enableRotate = true;
            windowControl.update();

            this.clippingGroup = new SlicerGroup(this.scene, 1)
            this.clippingGroup.addPlane()
            this.clippingGroup.addPlane()
            this.clippingGroup.setVisableAll(true)
            this.scene.add(this.clippingGroup)

            this.windowControl = windowControl

            window.addEventListener('resize', () => {
                let width = this.domElement.clientWidth
                let height = this.domElement.clientHeight
                this.renderer.setSize(width, height, true);
                this.camera.left = -width / 2
                this.camera.right = width / 2
                this.camera.top = height / 2
                this.camera.bottom = -height / 2
                this.camera.updateProjectionMatrix();
                this.renderScene()
            });

            this.renderScene = () => {

                if (this.model.mesh != null) {
                    this.model.mesh.visible = this.renderMode.polygen
                }

                if (this.model.line != null) {
                    this.model.line.visible = this.renderMode.wireline
                }

                light.intensity = this.lightProfile.intensity

                this.renderer.render(this.scene, this.camera);
            }

            this.renderScene()
        }

        let camerActions = {
            'TOP': () => {
                this.camera.position.set(0, 800, 0);
                this.camera.up.set(0, 1, 0);
                this.camera.lookAt(0, 0, 0);
            },
            'FRONT': () => {
                this.camera.position.set(0, 0, 800);
                this.camera.up.set(0, 1, 0);
                this.camera.lookAt(0, 0, 0);

            },
            'RIGHT': () => {
                this.camera.position.set(800, 0, 0);
                this.camera.up.set(0, 1, 0);
                this.camera.lookAt(0, 0, 0);
            },
            'BOTTOM': () => {
                this.camera.position.set(0, -800, 0);
                this.camera.up.set(0, 1, 0);
                this.camera.lookAt(0, 0, 0);
            },
            'BACK': () => {
                this.camera.position.set(0, 0, -800);
                this.camera.up.set(0, 1, 0);
                this.camera.lookAt(0, 0, 0);
            },
            'LEFT': () => {
                this.camera.position.set(-800, 0, 0);
                this.camera.up.set(0, 1, 0);
                this.camera.lookAt(0, 0, 0);
            }
        }

        this.setOrientation = (index) => {

            if (camerActions[index] instanceof Function) {
                camerActions[index]()

                this.camera.updateProjectionMatrix()
                this.windowControl.update()
                this.renderScene()
            }

        }

        this.setModelData = (uvdDims, volume, mask, color, spacing) => {

            this.thickness = spacing;
            this.volDims = uvdDims;
            this.color = color

            let padding = 5

            let p2 = 2 * padding
            let pDims = [uvdDims[0] + p2, uvdDims[1] + p2, uvdDims[2] + p2]
            let pSize = pDims[0] * pDims[1] * pDims[2];

            if (this._data == null || this._data.length != pSize) {
                this._data = new BinaryArray(pSize);
            }

            this._data.clear();

            //padding
            let counter = 0;
            let phSize = [uvdDims[0] + padding, uvdDims[1] + padding, uvdDims[2] + padding]
            for (let i = phSize[2] - 1; i >= padding; i--) {
                let step_i = i * pDims[1] * pDims[0];
                for (let j = padding; j < phSize[1]; j++) {
                    let step_j = step_i + j * pDims[0];
                    for (let k = padding; k < phSize[0]; k++) {
                        let step_k = step_j + k;
                        this._data.setValue(mask.getBit(counter++), step_k);
                    }
                }
            }

            //console.log(counter)
            this.marchingCubes.set_volume(volume.data, mask.data, uvdDims[0], uvdDims[1], uvdDims[2]);

            let xyzDims = [pDims[0], pDims[2], pDims[1]]
            this.setClippingDim(xyzDims)
        }

        this.modelUpdate = (evt, callback) => {
            if (this.lock) {
                return
            }

            this.lock = true
            //output two render result

            this.renderMeshAsync(1, this.color, this.smooth).then(() => {

                this.renderScene()

                if (callback != null && callback instanceof Function) {
                    callback()
                }
                this.lock = false
            });

        }

        initView()
    }

    copyCamera = (c) => {
        if (!(c instanceof THREE.Camera))
            return

        let zoom = this.camera.zoom
        this.camera.copy(c, false)
        this.camera.zoom = zoom
        let width = this.domElement.clientWidth;
        let height = this.domElement.clientHeight;
        setCameraSize(width, height)
    }

    modelUpdateRemote = () => {

        this._data
        let blob = new Blob([this._data, this.volDims], { type: 'octet/stream' })
        let xhr = new XMLHttpRequest()
        xhr.onreadystatechange = () => {

        }

        xhr.type = 'blob'
        xhr.open('GET', window.location.href + 'modifier/function/marchingCubes')
        xhr.send()
    }

    //切片控制器參數設置

    setClippingDim(xyzDims) {
        this.clippingGroup.resize(null, 1, true)
        this.renderScene();
    }

    setClippingRatio(type, ratio, group) {
        this.clippingGroup.setIndexRatio(type, ratio, group)
        this.renderScene();
    }

    setClippingEnable(axis, option) {
        this.clippingGroup.setClipping(axis, option)
        this.renderScene()
    }

    getClippingPlaneIndex() {
        return this.clippingGroup.getClippingPlaneIndex() * 10
    }

    renderMeshAsync = (ratio, color, smooth) => {
        return new Promise(
            (resolve, reject) => {

                let vertice = this.marchingCubes.marching_cubes(ratio);
                let geometry = new THREE.BufferGeometry();

                geometry.setAttribute('position', new THREE.BufferAttribute(vertice, 3));
                geometry = mergeVertices(geometry, smooth)
                geometry.rotateX(Math.PI / 2)
                geometry.computeVertexNormals()
                geometry.center()

                let wireframe = new THREE.WireframeGeometry(geometry);

                if (this.model.mesh == null) {
                    let material = new THREE.MeshPhongMaterial({ color: color, side: THREE.DoubleSide });


                    //生成模型表面
                    this.model.mesh = new THREE.Mesh(geometry, material);
                    this.model.mesh.scale.set(...this.thickness)
                    this.clippingGroup.add(this.model.mesh)

                    //生成模型網格
                    this.model.line = new THREE.LineSegments(wireframe);
                    this.model.line.material.opacity = 0.6;
                    this.model.line.material.transparent = true;
                    this.model.line.scale.set(...this.thickness)
                    this.clippingGroup.add(this.model.line)

                } else {
                    this.model.mesh.geometry = geometry
                    this.model.mesh.scale.set(...this.thickness)
                    this.model.line.geometry = wireframe
                    this.model.line.scale.set(...this.thickness)
                }

                resolve()
            }
        )
    }

    textures = [
        new THREE.MeshPhongMaterial({ side: THREE.DoubleSide, color: 0x0000FF, specular: 0x101010 }),
        new THREE.MeshNormalMaterial({ side: THREE.DoubleSide })
    ]

}

class BodyViewer {

    constructor(manager, domElement) {
        this.scene = null
        this.camera = null
        this.clippingGroup = null
        this.renderer = null
        this.domElement = domElement
        this.effect = null;
        this.thickness = [1, 1, 1]

        const camera_unit = 4.4
        const model_unit = 0.6
        const loader = new MMDLoader()

        let model = {
            cardiac: null,
            body: null
        }

        let setCameraSize = (width, height) => {
            let aspect = width / height
            this.camera.left = -aspect * camera_unit / 2
            this.camera.right = aspect * camera_unit / 2
            this.camera.top = camera_unit / 2
            this.camera.bottom = -camera_unit / 2
            this.camera.far = 100
            this.camera.near = 0.1
            this.camera.updateProjectionMatrix();
        }

        let onWindowResize = () => {
            let width = this.domElement.clientWidth;
            let height = this.domElement.clientHeight;
            setCameraSize(width, height)
            this.renderer.setSize(width, height)
            this.renderScene()
        }

        // 初始模型載入
        let loadModel = () => {

            // 載入心臟模型
            new STLLoader().load('model/stl/heart.stl', (geometry) => {
                geometry.computeVertexNormals();
                geometry.computeBoundingBox();
                geometry.center();

                let min = geometry.boundingBox.min;
                let max = geometry.boundingBox.max;
                let scaleX = model_unit / (max.x - min.x);
                let scaleY = model_unit / (max.y - min.y);
                let scaleZ = model_unit / (max.z - min.z);

                geometry.scale(scaleX, scaleY, scaleZ);
                //geometry.translate(0, 0, -0.1)

                const material = new THREE.MeshToonMaterial({
                    //depthWrite: false,
                    //renderOrder:0,
                    //depthTest:false,
                    side: THREE.DoubleSide,
                });

                const material2 = new THREE.MeshToonMaterial({
                    //depthWrite: false,
                    transparent: true,
                    opacity: 0.1,
                    side: THREE.DoubleSide
                });

                if (model.cardiac != null) {
                    this.scene.remove(model.cardiac);
                }


                model.cardiac = new THREE.Group()
                model.cardiac.add(new THREE.Mesh(geometry, material));
                //model[0].renderOrder = 2
                model.cardiac.add(new THREE.Mesh(geometry, material2));

                // Clipping Control
                this.addClippingMesh(model.cardiac.children[0]);

                this.renderScene();
            });

            // 載入人物模型
            loader.load('model/mmd/kizunaai/kizunaai.pmx', (mesh) => {
                mesh.position.set(0, -2.8, -0.4);
                mesh.scale.set(0.6, 0.6, 0.6)
                mesh.geometry.center();

                let materials = mesh.material;

                //There are some issues make the markers not able to show up properly. Close the depth test to ignore the problem.
                //Materials[4] is kizunaai's cloth.
                //materials[4].depthWrite = false;
                //materials[4].transparent = true;
                //materials[4].opacity = 0.4;


                materials[4] = new THREE.MeshToonMaterial()
                materials[4].side = THREE.FrontSide
                console.log(materials[4].color)
                materials[4].color.set(0, 0, 0);
                materials[4].depthWrite = false;
                materials[4].depthTest = false;
                materials[4].transparent = true;
                materials[4].opacity = 0.2;

                /*此處使用的PMXLoader是客製化的版本
                原版(ThreeJS)採用非同步的方式載入檔案，然而load function在僅有模型文件、貼圖尚在讀取狀態時便貿然執行，
                導致紋理方面的操作不可行，對此需要修改，額外加入判斷的方式處理
                */

                //當process數為0，表示貼圖讀取完成
                let wait = () => {
                    this.renderScene();
                    if (loader.meshBuilder.materialBuilder.process > 0) {
                        setTimeout(wait, 100);
                    } else {
                        console.log('complete');
                    }
                };

                if (model.body != null) {
                    this.scene.remove(model.body);
                }

                let group = new THREE.Group()
                group.add(mesh)
                //group.add(line)

                //console.log(group)

                model.body = group;
                model.body.visible = true;

                this.scene.add(model.body);
                this.renderScene();
                wait();
            });
        }

        this.copyCamera = (c) => {
            if (!(c instanceof THREE.Camera))
                return

            let zoom = this.camera.zoom
            this.camera.copy(c, false)
            this.camera.zoom = zoom
            let width = this.domElement.clientWidth;
            let height = this.domElement.clientHeight;
            setCameraSize(width, height)
        }

        // 設置場景物件的顯示狀態
        this.enableModel = (index, option) => {

            // 切片控制
            if (index == 0) {
                this.setClippingPlaneEnablesd(option)
            }
            // 人物顯示
            else if (index == 1) {
                model.body.visible = option;
            }

            this.renderScene();
        }

        let init = () => {
            let width = this.domElement.clientWidth;
            let height = this.domElement.clientHeight;
            // Camera

            this.camera = new THREE.OrthographicCamera();
            setCameraSize(width, height)

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
            //directionalLight.position.set(- 1, 1, 1).normalize();
            this.camera.add(directionalLight);


            let createBackground = () => {
                let material = new THREE.MeshBasicMaterial()
                //material.depthWrite = false;
                material.transparent = true;
                material.opacity = 0.4;
                material.side = THREE.DoubleSide

                let geometry = new THREE.BoxGeometry(width, height, 2)

                const background = new THREE.Mesh(geometry, material)
                //this.camera.add(background)
            }


            // Renderer
            this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
            this.renderer.localClippingEnabled = true
            this.renderer.setSize(width, height);
            this.renderer.setClearColor(0xFFFFFF, 0.0)
            this.domElement.appendChild(this.renderer.domElement);
            //renderer.setrenderSceneLoop(renderScene);

            this.effect = new OutlineEffect(this.renderer);
            this.effect.setSize(width, height)

            // Window Size Event
            window.addEventListener('resize', () => {
                onWindowResize()
            });

            // Clipping Control
            this.clippingGroup = new SlicerGroup(this.scene, 0);
            this.clippingGroup.addPlane();
            this.clippingGroup.resize([1, 1, 1], 0, [false, false, false])

            this.scene.add(this.clippingGroup)

            // Render
            loadModel();
            createBackground()
            //this.renderScene()
        }

        init()
    }

    // 設置欲顯示的clipping plane
    setOnFocus(axis) {
        for (let i = 0; i < 3; i++) {
            if (i == axis) {
                this.clippingGroup.onFocus(i, true)
            } else {
                this.clippingGroup.onFocus(i, false)
            }
        }

        this.renderScene();
    }

    // 關閉所有顯示的clipping plane
    setNonFocus() {
        for (let i = 0; i < 3; i++) {
            this.clippingGroup.onFocus(i, false)
        }

        this.renderScene();
    }

    // 將需要切片的模型加入切片控制器
    addClippingMesh(mesh) {
        this.clippingGroup.add(mesh)
        this.renderScene();
    }

    // 設置切片控制器需要裁切的尺寸
    setClippingDim(dims) {
        let nDims = [dims[0] / dims[2], dims[1] / dims[2], 1]
        this.clippingGroup.thickness = this.thickness
        this.clippingGroup.resize(nDims, 0, false)
        this.clippingGroup.reset()
        this.renderScene();
    }

    // 設置切片控制器當前裁切的方向與裁切位置(比例)
    setClippingRatio(type, ratio) {
        this.clippingGroup.setIndexRatio(type, ratio)
        this.renderScene();
    }

    // 設置切片控制器是否啟用
    setClippingPlaneEnablesd(option) {
        this.clippingGroup.setClippingeAll(option)
    }

    // 渲染場景中的物件
    renderScene() {
        this.effect.render(this.scene, this.camera);
    }
}

class ModelControl {
    constructor(manager) {
        this.remote = false
        let dcmVolume = document.getElementById("dcmViewer");
        this.modelViewer = new ModelViewer(dcmVolume)

        //let dcmBody = document.getElementById("dcmBody");
        //this.subrenderer = new BodyViewer(dcmBody);

        this.calculate = () => {
            let segment = manager.state.focusedSegment
            let volume = manager.state.volume

            if (segment == null) {
                alert('No segment selected or create.')
                return
            }

            let dims = segment.dims
            let data = segment.data
            let color = segment.color
            let spacing = manager.state.info.spacing

            if (this.remote) {

            }
            else {
                this.modelViewer.setModelData(dims, volume, data, color, [spacing[0], spacing[2], spacing[1]])
                this.modelViewer.modelUpdate()
            }

        }

    }

}

class DcmController {

    constructor(manager) {

        let dimDOM = [
            document.getElementById('horizontalView'),
            document.getElementById('coronalView'),
            document.getElementById('sagittalView')
        ]

        let volumeDOM = document.getElementById('volumeView').querySelector('.viewport')
        let bodyDOM = document.getElementById('idolView').querySelector('.viewport')

        let dimView = new DimensionView(manager, dimDOM)
        let volume = new VolumeViewer(manager, volumeDOM)
        let body = new BodyViewer(manager, bodyDOM)

        this.subControllers = {
            MultiDimensions: dimView,
            VolumeRender: volume,
            BodyPerspective: body
        }

        let cadViews = new Array()
        document.querySelectorAll('.axis-plane3D').forEach((element) => {
            cadViews.push(new CADViewer(element))
        })

        let layouts = document.querySelectorAll(".imgContainer")

        let funcbar = document.querySelectorAll(".imgContainer .viewer-bar")

        this.domElement = document.getElementById('workingScene')

        // 同步3D視窗之間的相機投影方向
        let cameraSync = (views) => {
            for (let i = 0; i < views.length; i++) {
                let controller = new OrbitControls(views[i].camera, views[i].domElement)
                controller.target.set(0, 0, 0)
                controller.update()

                controller.addEventListener('change', () => {

                    for (let j = 0; j < views.length; j++) {
                        if (i != j) {
                            views[j].copyCamera(views[i].camera)
                        }
                        views[j].renderScene()
                    }
                })
            }
        }

        this.scrollto = (axis, index) => {
            dimView.scrollto(axis, index)

            let ratio = dimView.Index2Ratio(axis, index)
            body.setClippingRatio(axis, ratio)
        }

        // axis == null: 更新所有方向的CT影像
        this.repaint = (axis) => {
            if (axis == null) {
                for (let i = 0; i < 3; i++) {
                    dimView.sliderUpdate(i)
                }
            } else {
                dimView.sliderUpdate(axis)
            }
        }

        this.updateVolume = () => {
            volume.renderVolume()
        }

        this.updateData = () => {
            this.repaint()
            this.updateVolume()
        }

        const funcbtns = {
            sizeControl: {
                enable: true,
                imgsrc: 'img/svg/maximun.svg',
                icon: "fa-solid fa-expand",
                process: (e, arg, layout, btn) => {

                    if (arg.level == 0) {
                        layout.classList.add('container_2x2')
                        layout.classList.add('container_lefttop')
                        layout.classList.add('container_topLayer')
                    }
                    else if (arg.level == 1) {
                        layout.classList.remove('container_2x2')
                        layout.classList.add('container_3x3')
                    }
                    else if (arg.level == 2) {
                        layout.classList.remove('container_3x3')
                        layout.classList.remove('container_lefttop')
                        layout.classList.remove('container_topLayer')
                    }

                    arg.level = (arg.level + 1) % 3

                    setTimeout(() => {
                        window.dispatchEvent(resizeEvent)
                    }, 500)
                }
            },
            largerSize: {
                enable: true,
                imgsrc: 'img/svg/maximun.svg',
                icon: "fa-solid fa-expand",
                process: (e, arg, layout, btn) => {

                    if (arg.level == 0) {
                        layout.classList.add('container_2x2')
                        layout.classList.add('container_lefttop')
                        layout.classList.add('container_topLayer')
                        arg.level = 1
                    }
                    else if (arg.level == 1) {
                        layout.classList.add('container_3x3')
                        arg.level = 2
                    }

                    setTimeout(() => {
                        window.dispatchEvent(resizeEvent)
                    }, 500)
                }
            },
            smallerSize: {
                enable: true,
                imgsrc: 'img/svg/maximun.svg',
                icon: "fa-solid fa-compress",
                process: (e, arg, layout, btn) => {
                    if (arg.level == 2) {
                        layout.classList.remove('container_3x3')
                        arg.level = 1
                    }
                    else if (arg.level == 1) {
                        layout.classList.remove('container_2x2')
                        layout.classList.remove('container_lefttop')
                        layout.classList.remove('container_topLayer')
                        arg.level = 0
                    }

                    setTimeout(() => {

                        window.dispatchEvent(resizeEvent)
                    }, 500)
                }
            },
            infoEnable: {
                enable: false,
                imgsrc: 'img/svg/info.svg',
                icon: 'fa-solid fa-info',
                process: (e, arg, layout) => {
                }
            },
            moveTop: {
                enable: true,
                imgsrc: 'img/svg/movetop.svg',
                icon: 'fa-solid fa-angles-up',
                process: (e, arg, layout) => {
                    //let value = (this.uvdDims[2 - index] > 0) ? 0 : -1
                    let slider = layout.querySelector(".viewer-slider")
                    slider.value = slider.min

                    this.scrollto(arg.index, Number(slider.value))
                }
            },
            moveCenter: {
                enable: true,
                imgsrc: 'img/svg/movecenter.svg',
                icon: 'fa-solid fa-arrow-down-up-across-line',
                process: (e, arg, layout) => {
                    //let value = parseInt(Number(this.uvdDims[2 - index] / 2 - 1))
                    let slider = layout.querySelector(".viewer-slider")
                    slider.value = (Number(slider.max) + Number(slider.min)) / 2

                    this.scrollto(arg.index, Number(slider.value))
                }
            },
            moveBottom: {
                enable: true,
                imgsrc: 'img/svg/movedown.svg',
                icon: 'fa-solid fa-angles-down',
                process: (e, arg, layout) => {
                    //let value = this.uvdDims[2 - index] - 1
                    let slider = layout.querySelector(".viewer-slider")
                    slider.value = slider.max

                    this.scrollto(arg.index, Number(slider.value))
                }
            },
            exposureInc: {
                enable: true,
                imgsrc: 'img/svg/exposureInc.svg',
                icon: 'fa-solid fa-info',
                process: (e, arg, layout) => {
                    let mImg = manager.maskImages[index]
                    if (mImg.exposure < 2) {
                        mImg.exposure += 0.1
                        this.sliderUpdate(arg.index)
                    }
                }
            },
            exposureDec: {
                enable: true,
                imgsrc: 'img/svg/exposureDec.svg',
                icon: 'fa-solid fa-info',
                process: (e, arg, layout) => {
                    let mImg = manager.maskImages[index]
                    if (mImg.exposure > 0.1) {
                        mImg.exposure -= 0.1
                        this.repaint(arg.index)
                    }
                }
            },
            contrastInc: {
                enable: true,
                imgsrc: 'img/svg/contrastInc.svg',
                icon: 'fa-solid fa-info',
                process: (e, arg, layout) => {
                    let mImg = manager.maskImages[index]
                    if (mImg.contrast < 2) {
                        mImg.contrast += 0.1
                        this.repaint(arg.index)
                    }
                }
            },
            contrastDec: {
                enable: true,
                imgsrc: 'img/svg/contrastDec.svg',
                icon: 'fa-solid fa-info',
                process: (e, arg, layout) => {
                    let mImg = manager.maskImages[index]
                    if (mImg.contrast > 0.1) {
                        mImg.contrast -= 0.1
                        this.repaint(arg.index)
                    }
                }
            },
            alphamap: {
                enable: true,
                imgsrc: 'img/svg/contrastDec.svg',
                icon: 'fa-solid fa-radiation',
                process: (e, arg, layout) => {
                    //volume.enableColorMap = false
                    manager.notify()
                }
            },
            colormap: {
                enable: true,
                imgsrc: 'img/svg/contrastDec.svg',
                icon: 'fa-solid fa-palette',
                process: (e, arg, layout) => {
                    //volume.enableColorMap = true
                    manager.notify()
                }
            },
            enableCardiac: {
                enable: true,
                imgsrc: 'img/svg/contrastDec.svg',
                icon: 'fa-solid fa-heart',
                process: (e, arg, layout) => {
                    if (layout.dataset.toggle == 'off') {
                        body.enableModel(0, true);
                        layout.dataset.toggle = 'true'
                    }
                    else {
                        body.enableModel(0, false);
                        layout.dataset.toggle = 'off'
                    }

                    manager.notify();
                }
            },
            enableTooth: {
                enable: true,
                imgsrc: 'img/svg/contrastDec.svg',
                icon: 'fa-solid fa-tooth',
                process: (e, arg, layout) => {
                    if (layout.dataset.toggle == 'off') {
                        //body.enableModel(0, true);
                        //layout.dataset.toggle = 'true'
                    }
                    else {
                        //body.enableModel(0, false);
                        //layout.dataset.toggle = 'off'
                    }

                    manager.notify();
                }
            },
            enableBrain: {
                enable: true,
                imgsrc: 'img/svg/contrastDec.svg',
                icon: 'fa-solid fa-brain',
                process: (e, arg, layout) => {
                    if (layout.dataset.toggle == 'off') {
                        //body.enableModel(0, true);
                        //layout.dataset.toggle = 'true'
                    }
                    else {
                        //body.enableModel(0, false);
                        //layout.dataset.toggle = 'off'
                    }

                    manager.notify();
                }
            },
            enableBody: {
                enable: true,
                imgsrc: 'img/svg/contrastDec.svg',
                icon: 'fa-solid fa-person-dress',
                process: (e, arg, layout) => {
                    if (layout.dataset.toggle == 'off') {
                        body.enableModel(1, true);
                        layout.dataset.toggle = 'true'
                    }
                    else {
                        body.enableModel(1, false);
                        layout.dataset.toggle = 'off'
                    }

                    manager.notify();
                }
            },
            hideInfo: {
                enable: true,
                imgsrc: 'img/svg/info2.svg',
                icon: 'fa-solid fa-info',
                process: (e, arg, layer) => {
                    let base = layer.querySelector('.imgLayerInfo')
                    let title = layer.querySelector('.imgLayerTitle')
                    let slider = layer.querySelector('.imgLayerSlider')

                    if (base.dataset.toggle == 'on') {
                        base.classList.add('d-none')
                        title.classList.add('d-none')
                        slider.classList.add('d-none')
                        base.dataset.toggle = 'off'

                    } else {
                        base.classList.remove('d-none')
                        title.classList.remove('d-none')
                        slider.classList.remove('d-none')
                        base.dataset.toggle = 'on'
                    }

                }
            }
        }

        this.showBackground = (option) => {
            if (option) {

            }
            else {

            }
        }

        let init = () => {

            let pushBtn = (index, layout, funcs, arg) => {

                for (let funcname in funcs) {
                    let bfunc = funcs[funcname]

                    if (!bfunc.enable) {
                        continue
                    }

                    let btn = document.createElement('button')
                    let img = document.createElement('i')
                    img.classList = bfunc.icon

                    btn.appendChild(img)
                    btn.onclick = (e) => {
                        bfunc.process(e, arg, layout, btn)
                    }

                    btn.classList.add('barfunc')

                    funcbar[index].appendChild(btn)
                }
            }

            let pushDivider = (index, layout) => {

                let divider = document.createElement('div')
                divider.classList.add('barDivider')

                funcbar[index].appendChild(divider)
            }

            let mark = 0
            layouts.forEach((layout, key) => {

                // these tools inside the function bar used to justify the images information
                if (layout.dataset['layoutType'] == 'image') {

                    let slider = layout.querySelector('.viewer-slider')
                    slider.min = 0
                    slider.max = 1
                    slider.step = 0
                    let index = mark

                    let keyPressEvt = (evt) => {
                        let newValue = dimView.imgLayerValue[index]

                        if (evt.keyCode == 40) {
                            newValue++;
                        } else if (evt.keyCode == 38) {
                            newValue--
                        }

                        //slider.value = dimView.Index2Ratio(index, newValue)
                        this.scrollto(index, Number(slider.value))
                    }

                    layout.addEventListener('mouseenter', () => {
                        //stopWindowScroll.enable = true
                        body.setOnFocus(index)
                        window.addEventListener('keydown', keyPressEvt)
                    })

                    layout.addEventListener('mouseleave', () => {
                        //stopWindowScroll.enable = false
                        body.setNonFocus()
                        window.removeEventListener('keydown', keyPressEvt)
                    })

                    layout.addEventListener('wheel', (e) => {
                        slider.value = Number(slider.value) + e.deltaY / 200

                        this.scrollto(index, parseInt(slider.value))
                    }, checkPassiveSupported(true))

                    slider.addEventListener('input', () => {
                        this.scrollto(index, slider.value)
                    })

                    const btnFuns = {
                        main: [
                            funcbtns.sizeControl
                        ],
                        sub: [
                            funcbtns.hideInfo
                        ]
                    }

                    let arg = {
                        index: mark,
                        level: 0
                    }

                    let topBtn = layout.querySelector('.goTop')
                    topBtn.classList.add("fa-2xl", "fa-solid", "fa-caret-left")
                    topBtn.addEventListener('click', () => {
                        slider.value = slider.min

                        this.scrollto(arg.index, Number(slider.value))
                    })

                    let bottomBtn = layout.querySelector('.goBottom')
                    bottomBtn.classList.add("fa-2xl", "fa-solid", "fa-caret-right")
                    bottomBtn.addEventListener('click', () => {
                        slider.value = slider.max

                        this.scrollto(arg.index, Number(slider.value))
                    })

                    slider.addEventListener('dblclick', () => {
                        slider.value = (Number(slider.max) + Number(slider.min)) / 2

                        this.scrollto(arg.index, Number(slider.value))
                    })

                    pushBtn(key, layout, btnFuns.main, arg)
                    pushDivider(key, layout)
                    pushBtn(key, layout, btnFuns.sub)

                    mark += 1
                } else if (layout.dataset['layoutType'] == 'volume') {
                    const btnFuns = {
                        main: [
                            funcbtns.sizeControl
                        ],
                        sub: [
                        ]
                    }

                    let arg = {
                        index: mark,
                        level: 0
                    }

                    pushBtn(key, layout, btnFuns.main, arg)
                    pushDivider(key, layout)
                    pushBtn(key, layout, btnFuns.sub)
                } else if (layout.dataset['layoutType'] == 'cad') {
                    const btnFuns = {
                        main: [
                            funcbtns.sizeControl
                        ],
                        sub: [

                        ]
                    }

                    let arg = {
                        index: mark,
                        level: 0
                    }

                    pushBtn(key, layout, btnFuns.main, arg)
                    pushDivider(key, layout)
                    pushBtn(key, layout, btnFuns.sub)

                } else if (layout.dataset['layoutType'] == 'idol') {
                    const btnFuns = {
                        main: [
                            funcbtns.enableCardiac,
                            funcbtns.enableTooth,
                            funcbtns.enableBrain,
                            funcbtns.enableBody
                        ],
                        sub: [

                        ]
                    }

                    pushBtn(key, layout, btnFuns.main)

                }
            })

            cameraSync([volume, body, ...cadViews])

            body.setNonFocus()

            manager.addNotifyEvent(() => {
                this.updateVolume();
            }, 'colormap');

            manager.addNotifyEvent(() => {
                this.updateVolume();
            }, 'segmentUpdate');

            let base = manager.state.volume
            if (base == null) {
                return
            }

            dimView.setDcmViewerDims(base.dims)
        }

        init()


    }

}

export { DcmController, ModelControl, SignalDistribution, Histogram }
