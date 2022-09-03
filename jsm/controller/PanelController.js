import { dualSlider } from "../parts/dualSlider.js";

import { DcmController, ModelControl, SignalDistribution, Histogram } from "./ModelViewController.js";
import { Page } from "./template.js"
import { ControlView } from '../tf/controlView.js'
import { HSV, LittleTriangle } from '../tf/hsv.js'
import * as THREE from "../build/three.module.js";
import { RGBType, HSVType } from '../tf/colorSpaceConvertor.js'
import { STLExporter } from "../example/jsm/exporters/STLExporter.js";
import { PLYExporter } from "../example/jsm/exporters/PLYExporter.js";
import { NRRDLoader } from "../example/jsm/loaders/NRRDLoader.js";
import { BinaryArray } from "../model/ExtendedArray.js";

let changeEvent = new Event('change')
let clickEvent = new Event('click')
let inputEvent = new Event('input')

class ProgressRunner {
    constructor(title) {

        // set parameters
        this.progressValue = 0
        let progressBarEnable = false

        let task = null

        // create UI
        let bg = document.createElement("div")
        bg.classList.add("modal")
        bg.classList.add("fade")

        bg.tabIndex = -1
        bg.ariaHidden = true
        bg.ariaLabel = "loadingText"
        bg.dataset.bs.backdrop = "static"
        bg.dataset.bs.keyboard = "static"

        let dialog = document.createElement("div")
        dialog.classList.add("modal-dialog")

        let content = document.createElement("div")
        content.classList.add("modal-content")

        let header = document.createElement("div")
        header.classList.add("modal-header")

        let titleDOM = document.createElement("div")
        titleDOM.classList.add("modal-title")
        titleDOM.innerHTML = title

        let body = document.createElement("div")
        body.classList.add("modal-body")

        let progress = document.createElement("div")
        progress.classList.add("progress")

        let counter = document.createElement("p")

        let bar = document.createElement("div")
        bar.classList.add("rogress-bar")
        bar.classList.add("w-100")

        bar.role = "progressbar"
        bar.ariaValueNow = 0
        bar.ariaValueMin = 0
        bar.ariaValueMax = 180

        domElement.innerHTML += ""

        progress.append(bar)
        body.append(progress)
        body.append(counter)

        header.append(titleDOM)

        content.append(header)
        content.append(body)

        dialog.append(content)

        bg.append(dialog)

        domElement.append(bg)


        this.start = () => {
            task = setInterval(this.task, 100);
        };

        this.stop = () => {
            clearInterval(task);
        };

        this.setProgress = (value) => {

            if (value == -1) {
                bar.classList.add('animationBar')
                counter.classList.add('d-none');
            } else {
                bar.classList.remove('animationBar')
                counter.classList.remove('d-none');
            }


            value = Math.round(value * 1000) / 10
            setTimeout(() => {
                counter.innerHTML = `${value}%`
                bar.style.width = `${value}%`
            }, 10)

        }
    }
}

let showProgress = function (option, title = 'processing', cancellable = false) {

    let loadingText = document.getElementById('loadingText');
    let progressCancelBtn = document.getElementById('progressCancelBtn');
    let progressModal = bootstrap.Modal.getOrCreateInstance(document.getElementById('progressModal'))

    requestAnimationFrame(() => {


        if (option) {
            loadingText.innerHTML = title
            progressModal.show()
        } else {
            setTimeout(()=>{
                progressModal.hide()
            },500)

        }

        if (cancellable) {
            progressCancelBtn.classList.remove("display", "none")
            progressCancelBtn.classList.add("display", "inline")
        } else {
            progressCancelBtn.classList.remove("display", "inline")
            progressCancelBtn.classList.add("display", "none")
        }

    })
}

let setProgress = function (value) {
    let loaderBody = document.getElementById('loaderBody')
    let loaderCounter = document.getElementById('loadingCounter')
    let loaderProgressBar = document.getElementById('loadingProgressBar')

    if (value == -1) {
        loaderProgressBar.classList.add('animationBar')
        loaderCounter.classList.add('d-none');
    } else {
        loaderProgressBar.classList.remove('animationBar')
        loaderCounter.classList.remove('d-none');
    }


    value = Math.round(value * 1000) / 10
    setTimeout(() => {
        loaderCounter.innerHTML = `${value}%`
        loaderProgressBar.style.width = `${value}%`
    }, 10)

}

// ptn二進位標記文件
class multiOptSelectList {
    constructor(managers, control) {
        let domElement = document.getElementById('segment_list_n');
        domElement.style['overflow'] = 'auto';
        let addSegmentBtn = document.getElementById('add_segment_btn');
        let removeSegmentBtn = document.getElementById('remove_segment_btn');
        let exportSegmentBtn = document.getElementById('export_segment_btn');
        let importSegmentBtn = document.getElementById('import_segment_btn');
        let forwardBtn = document.getElementById('previous_step_btn');
        let backwardBtn = document.getElementById('next_step_btn');

        this.state = managers.state
        let state = managers.state


        let postprocess = () => {
            this.reload()
        }

        let preBuildPattern = null;

        let loadPreBuildPattern = () => {
            let xhr = new XMLHttpRequest();
            xhr.onload = () => {
                if (xhr.readyState == 4 && xhr.status == 200) {
                    preBuildPattern = new Uint8Array(xhr.response);
                }
            };

            xhr.responseType = 'arraybuffer';
            xhr.open('GET', './template/prebuild.ptn');
            xhr.send();
        }

        let init = () => {
            let mode = managers.listControlTools.mode
            let dlLink = document.createElement('a')
            let ulLink = document.createElement('input')

            let nrrdLoader = new NRRDLoader()

            ulLink.type = 'file'
            ulLink.accept = '.ptn,.nrrd'

            ulLink.addEventListener('change', (evt) => {

                if (evt.target.files.length <= 0) {
                    return;
                }

                let reader = new FileReader();

                let file = evt.target.files[0];
                let filename = file.name

                let last_dot = filename.lastIndexOf('.')
                let ext = filename.slice(last_dot + 1)


                if (ext == 'ptn') {
                    reader.onload = () => {
                        let result = reader.result;
                        let input = new Uint8Array(result);

                        addSegmentBtn.click();

                        let output = managers.state.focusedSegment.data;

                        output.data.set(input)

                        managers.notify('segmentUpdate')
                    };

                    reader.readAsArrayBuffer(file);
                }
                else if (ext == 'nrrd') {
                    reader.onload = () => {
                        let url = reader.result;
                        nrrdLoader.load(url, (volume) => {
                            let data = volume.data
                            let input = new BinaryArray(data.length);

                            for (let i = 0; i < data.length; i++) {
                                if (data[i] > 0) {
                                    input.setBit(i)
                                }
                            }
                            addSegmentBtn.click();

                            let output = managers.state.focusedSegment.data;

                            output.data.set(input.data)

                            managers.notify('segmentUpdate')
                        })

                    };

                    reader.readAsDataURL(file);


                }


            });

            addSegmentBtn.addEventListener('click', () => {
                managers.listControlTools.selectedMode = mode.CREATE
                managers.listControlTools.process()
                postprocess()

                managers.notify('segmentUpdate')
            })

            removeSegmentBtn.addEventListener('click', () => {
                managers.listControlTools.selectedMode = mode.REMOVE
                managers.listControlTools.process()
                postprocess()

                managers.notify('segmentUpdate')
            })

            forwardBtn.addEventListener('click', () => {
                managers.slc.undo()
                postprocess()

                managers.notify('segmentUpdate')
                managers.notify('imageUpdate')
            })

            backwardBtn.addEventListener('click', () => {
                managers.slc.redo()
                postprocess()

                managers.notify('segmentUpdate')
                managers.notify('imageUpdate')
            })


            document.addEventListener('keydown', (evt) => {

                if (evt.ctrlKey && evt.shiftKey && evt.key === 'Z') {
                    backwardBtn.dispatchEvent(clickEvent)
                }
                else if (evt.ctrlKey && evt.key === 'z') {
                    forwardBtn.dispatchEvent(clickEvent)
                }
            })

            importSegmentBtn.addEventListener('click', () => {
                ulLink.click()
            })

            exportSegmentBtn.addEventListener('click', () => {
                let segment = managers.state.focusedSegment;

                if (segment === null) {
                    return;
                }

                let data = new Uint8Array(segment.data.data);

                let blob = new Blob([data.buffer], { type: 'application/octet-stream' });

                dlLink.href = URL.createObjectURL(blob);
                dlLink.download = 'segment_'
                    + segment.dims[0] + '_'
                    + segment.dims[1] + '_'
                    + segment.dims[2]
                    + '.ptn';
                dlLink.click();
            });

            managers.slc.onload = ((previous, next) => {
                forwardBtn.disabled = !previous;
                backwardBtn.disabled = !next;
            });

            loadPreBuildPattern();

            let webOnFocus = true
            window.addEventListener('onfocus', () => {
                webOnFocus = true
            })

            window.addEventListener('onblur', () => {
                webOnFocus = false
            })

            setInterval(() => {
                if (webOnFocus)
                    exportSegmentBtn.dispatchEvent(clickEvent)
            }, 360000)
        }

        this.indexOf = (x) => {
            return state.segments[x]
        }

        this.reload = () => {
            if (state == null || state.segments == null)
                return

            let seg = state.segments
            domElement.innerHTML = ''
            for (let i = 0; i < seg.length; i++) {
                let focused = false

                if (state.focusedSegIndex == i) {
                    focused = true
                }

                this.push(seg[i].name, seg[i].color, seg[i].visible, focused)
            }
        }

        this.push = (name, color, visible, focused) => {
            let segInfo = document.createElement('div')
            segInfo.classList.add('d-flex', 'segmentlist-item')

            let segHeader = document.createElement('div')
            segHeader.classList.add('d-flex')
            segHeader.style.flex = '1 1 auto'

            let colorInfo = document.createElement('input');
            colorInfo.type = 'color';
            colorInfo.value = color;

            let nameInfo = document.createElement('div');
            nameInfo.innerText = name;

            let pushHeader = (element, value, name) => {
                element.classList.add('segment-header');

                let div = document.createElement('div');
                //div.classList.add('col-' + value);
                div.appendChild(element);

                let title = document.createElement('text')
                title.textContent = name
                div.appendChild(title);

                segHeader.appendChild(div)
            };

            pushHeader(colorInfo, 5);
            pushHeader(nameInfo, 7);
            segInfo.appendChild(segHeader)

            let segFunc = document.createElement('div')
            segFunc.classList.add('d-flex')

            let funcPreBuild = document.createElement('i');
            funcPreBuild.classList.add('bi-balloon-heart-fill');

            let funcCrop = document.createElement('i');
            funcCrop.classList.add('bi-crop');

            let funcInvert = document.createElement('i');
            funcInvert.classList.add('bi-star-half');

            let funcEye = document.createElement('i');
            funcEye.dataset.toggle = 'on'

            let funcRst = document.createElement('i');
            funcRst.classList.add('bi-x-circle-fill');

            let space = document.createElement('div');
            space.innerHTML = '|';
            space.style.color = 'rgba(0,0,0,0.3)';

            if (visible) {
                funcEye.classList.remove('bi-eye-slash-fill');
                funcEye.classList.add('bi-eye-fill');
            } else {
                funcEye.classList.remove('bi-eye-fill');
                funcEye.classList.add('bi-eye-slash-fill');
            }

            let pushFunc = (element, name) => {
                element.classList.add('d-flex', 'justify-content-center');

                let div = document.createElement('div');
                div.classList.add('segment-func');
                div.appendChild(element);

                let title = document.createElement('text')
                title.textContent = name
                div.appendChild(title);

                segFunc.appendChild(div)
            };

            pushFunc(funcCrop, 'crop');
            pushFunc(funcPreBuild, 'balloon');
            pushFunc(funcInvert, 'invert');
            pushFunc(funcEye, 'visible');
            pushFunc(funcRst, 'reset');

            segInfo.appendChild(segFunc)

            domElement.appendChild(segInfo);

            let focus = () => {

                let seg = domElement.getElementsByClassName('segmentlist-item')

                for (let i = 0; i < seg.length; i++) {
                    if (segInfo == seg[i]) {
                        this.selectedIndex = i
                        segInfo.classList.add('segmentlist-item-focused')
                    } else {
                        seg[i].classList.remove('segmentlist-item-focused')
                    }
                }

                managers.notify('segmentUpdate')
            }

            segInfo.addEventListener('click', focus)

            let checkFocused = () => {
                if (!segInfo.classList.contains('segmentlist-item-focused')) {
                    focus();
                }
            }

            colorInfo.addEventListener('input', (evt) => {
                checkFocused()

                let index = state.focusedSegIndex
                let seg = state.segments[index]
                seg.color = evt.target.value

                managers.notify('segmentUpdate')
            })

            funcCrop.addEventListener('click', () => {
                checkFocused()

                let index = state.focusedSegIndex
                let seg = state.segments[index]
                let base = state.volume

                if (base == null) {
                    console.error('Data empty!')
                }

                if (seg.data.length != base.data.length) {
                    console.error('Data length is not equal!')
                }

                for (let i = 0; i < seg.data.length; i++) {
                    if (seg.data.getBit(i) == 0) {
                        base.data[i] = 0;
                    }
                }

                managers.notify('imageUpdate')
            })

            funcInvert.addEventListener('click', () => {
                checkFocused()

                let index = state.focusedSegIndex
                let seg = state.segments[index]
                let base = state.volume

                if (base == null) {
                    console.error('Data empty!')
                }

                if (seg.data.length != base.data.length) {
                    console.error('Data length is not equal!')
                }

                for (let i = 0; i < seg.data.length; i++) {
                    seg.data.invert(i);
                }

                seg.data.invert(0)
                managers.notify('segmentUpdate');
            })

            funcEye.addEventListener('click', () => {
                checkFocused();

                let index = state.focusedSegIndex;
                let seg = state.segments[index];

                if (funcEye.dataset.toggle === 'on') {
                    funcEye.dataset.toggle = 'off';
                    funcEye.classList.remove('bi-eye-fill');
                    funcEye.classList.add('bi-eye-slash-fill');
                    seg.visible = false;
                } else if (funcEye.dataset.toggle === 'off') {
                    funcEye.dataset.toggle = 'on';
                    funcEye.classList.remove('bi-eye-slash-fill');
                    funcEye.classList.add('bi-eye-fill');
                    seg.visible = true;
                }

                managers.notify('segmentUpdate');
            });

            funcPreBuild.addEventListener('click', () => {
                checkFocused();

                let index = state.focusedSegIndex;
                let segData = state.segments[index].data;
                console.log(preBuildPattern)
                pushData(preBuildPattern, segData.data);

                managers.notify('segmentUpdate')
            });

            funcRst.addEventListener('click', () => {
                checkFocused()

                let index = state.focusedSegIndex
                let seg = state.segments[index]
                seg.clear()
                managers.notify('segmentUpdate')
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
        this.state.focusedSegIndex = x
    }

    get selectedIndex() {
        return this.state.focusedSegIndex
    }

    get value() {
        return this.state.focusedSegIndex
    }

    get length() {
        return this.state.segments.length
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

            let selectedMode = board.dataset.toggle
            if (selectedMode == 'on') {
                board.style.display = 'none'
                selectedMode = 'off'
            } else {
                board.style.display = 'static'
                selectedMode = 'on'
            }

        })
    }
}

/**
 function segmentListReload() {
 let segmentList = document.getElementById('segment_list')
 let selectedIndex = segmentList.selectedIndex
 let segments = dcmController.managers.state.segments
 
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

class Node {
    constructor(key = -1, button = null, board = null) {
        this.selectedKey = -1
        this.button = button
        this.board = board
        this.leaves = {}
        this.key = key

        let processes = {
            init: () => { },
            enable: () => { },
            disable: () => { },
            update: () => { }
        }

        this.append = (leaf) => {
            this.leaves[leaf.key] = leaf
            return this
        }

        this.enable = (key = this.selectedKey) => {

            processes.enable(key)

            if (key == -1)
                return

            this.leaves[key].button.classList.add('active')
            this.leaves[key].board.classList.remove('d-none')
            this.leaves[key].enable()
        }

        this.disable = (key = this.selectedKey) => {

            processes.disable(key)

            if (key == -1)
                return

            this.leaves[key].button.classList.remove('active')
            this.leaves[key].board.classList.add('d-none')
            this.leaves[key].disable()
        }

        this.update = (key = this.selectedKey) => {


            processes.update(key)

            if (key == -1)
                return

            this.leaves[key].update()
        }

        this.build = (onload) => {

            if (onload instanceof Function)
                onload(processes)

            return this
        }

        this.create = () => {
            for (let key in this.leaves) {

                if (this.selectedKey == -1)
                    this.selectedKey = key

                let btn = this.leaves[key].button

                if (btn == null)
                    continue

                this.leaves[key].button.addEventListener('click', () => {
                    this.disable()

                    this.selectedKey = key

                    this.enable()
                })

                this.disable(key)
            }

            if (this.selectedKey != -1) {
                this.leaves[this.selectedKey].button.dispatchEvent(clickEvent)
            }

            return this
        }

        return this
    }
}

class SegmentsPanel2 extends Page {
    constructor(managers, control) {
        super()

        let list = new multiOptSelectList(managers, control)

        let state = managers.state
        let toolPanel = document.getElementById('segmentPage_controlPanel')
        let toolSelector = document.getElementById('tools-group')
        let toolBtns = toolSelector.getElementsByTagName('button')
        let toolBoards = toolPanel.getElementsByClassName('tool')

        let initPointer = () => {
            let node = new Node('POINTER', toolBtns[0], toolBoards[0])
                .build((processes => { }))
                .create()

            return node
        }

        let initBrushTool = () => {
            let node = new Node('BRUSH', toolBtns[1], toolBoards[1])
                .build((processes) => {
                    let brushSizeForm = document.forms['brushSize']
                    let brushSizeRange = brushSizeForm.querySelector('input')
                    let brushSizeLabel = brushSizeForm.querySelector('label')


                    // 設置筆刷大小預覽圖
                    let brushView = document.getElementById('segmentPage_controlPanel_brushView')

                    let brushCanvas = document.createElement('canvas')
                    brushCanvas.width = 100
                    brushCanvas.height = 100
                    brushCanvas.style.background = 'white';
                    brushCanvas.style.border = '5px double';
                    let brushctx = brushCanvas.getContext('2d')

                    brushView.appendChild(brushCanvas)

                    brushSizeRange.addEventListener('input', (evt) => {
                        brushSizeLabel.innerText = 'Brush Size x' + evt.target.value
                        managers.brushTools.radius = Math.round(evt.target.value)

                        brushctx.clearRect(0, 0, 100, 100)
                        brushctx.beginPath()
                        brushctx.arc(50, 50, managers.brushTools.radius, 0, 2 * Math.PI)
                        brushctx.fill()
                    })

                    brushSizeRange.dispatchEvent(inputEvent)

                    let brushselectedMode = document.getElementById('segmentPage_controlPanel_brushMode')
                    let options = brushselectedMode.children
                    let mode = managers.brushTools.mode
                    for (let i = 0; i < options.length; i++) {

                        options[i].addEventListener('click', (evt) => {
                            for (let j = 0; j < options.length; j++) {
                                options[j].classList.remove('active')
                            }
                            options[i].classList.add('active')
                            managers.brushTools.selectedMode = mode[options[i].dataset.mode]
                        })
                    }

                    // 關閉右鍵選單
                    document.addEventListener('contextmenu', (evt) => {
                        evt.preventDefault()

                        if (!managers.brushTools.enable) {
                            return
                        }

                        return false
                    })

                })
                .create()

            return node
        }

        let initThreshold = () => {
            let transferBtns = document.getElementById('segmentPage_transfer_method').children
            let transferBoards = [document.getElementById('1D_tf_panel'), document.getElementById('2D_tf_panel')]

            let mImgs = managers.maskImages
            let subController = control.subControllers.MultiDimensions

            // canvas最大色階256(0~255)
            let colorLevels = 255

            let tf_1D = new Node('1D', transferBtns[0], transferBoards[0])
                .build((processes) => {
                    let isovalueSlider = document.getElementById("dual_slider");
                    let isoValueInput = document.getElementById('input-isovalue');
                    let distanceInput = document.getElementById('input-distance')
                    let inputIsovalueApply = document.getElementById('input-isovalue-apply')
                    let inputIsovalueAuto = document.getElementById('input-isovalue-auto')

                    // 清空預覽結果
                    let clearPreviewImage = () => {

                        for (let mImg of mImgs) {
                            let size = mImg.adaptiveSize
                            let preview = mImg.domElements.preview
                            let pctx = preview.context

                            pctx.save()
                            pctx.beginPath()
                            pctx.clearRect(0, 0, size[0], size[1])
                            pctx.restore()
                        }
                    }

                    // 繪製預覽結果
                    let setPreviewImage = () => {

                        let segment = state.focusedSegment

                        if (segment == null) {
                            clearPreviewImage()
                            return
                        }

                        let l_limit = managers.thresholdTools.l_limit * colorLevels
                        let r_limit = managers.thresholdTools.r_limit * colorLevels
                        let color = segment.color

                        for (let mImg of mImgs) {
                            let size = mImg.adaptiveSize

                            let preview = mImg.domElements.preview
                            let image = mImg.domElements.background

                            let pctx = preview.context

                            pctx.save()
                            pctx.fillStyle = color
                            pctx.beginPath()
                            pctx.rect(0, 0, size[0], size[1])
                            pctx.fill()
                            pctx.restore()

                            let pvwdata = preview.getImageData()
                            let imgdata = image.getImageData()

                            for (let i = 3; i < pvwdata.data.length; i += 4) {
                                if (imgdata.data[i] > r_limit || imgdata.data[i] < l_limit)
                                    pvwdata.data[i] = 0
                            }

                            pctx.putImageData(pvwdata, 0, 0)
                        }
                    }

                    // 根據當前的colomap，更新二值化滑桿的背景色彩
                    let tile = document.getElementById('thresholdTile')
                    let tctx = tile.getContext('2d')
                    let tImgData = tctx.getImageData(0, 0, 256, 1)

                    let updateTile = () => {
                        let map = state.colorSetting.colormap
                        let path = state.colorSetting.path

                        let l_limit = managers.thresholdTools.l_limit * 255
                        let r_limit = managers.thresholdTools.r_limit * 255

                        for (let i = 0; i < 256; i++) {
                            tImgData.data[4 * i] = map[4 * i] * 255
                            tImgData.data[4 * i + 1] = map[4 * i + 1] * 255
                            tImgData.data[4 * i + 2] = map[4 * i + 2] * 255
                            tImgData.data[4 * i + 3] = path[i]
                            if (i < l_limit - 5 || i > r_limit + 5) {
                                tImgData.data[4 * i + 3] = 0
                            }
                            else if (i <= l_limit || i >= r_limit) {
                                tImgData.data[4 * i + 3] = 255 - path[i]
                            }
                        }

                        tctx.putImageData(tImgData, 0, 0)
                    }

                    let ds = new dualSlider(isovalueSlider, 0, 1, 0.001)
                    ds.setLowerValue(0.2)
                    ds.setHigherValue(0.4)
                    ds.event((lv, hv) => {
                        isoValueInput.value = lv
                        distanceInput.value = hv
                        managers.thresholdTools.l_limit = ds.getLowerValue()
                        managers.thresholdTools.r_limit = ds.getHigherValue()

                        tf_1D.update()
                    })

                    isoValueInput.value = ds.getLowerValue()
                    isoValueInput.addEventListener('change', function (evt) {
                        ds.setLowerValue(evt.target.value)
                        managers.thresholdTools.l_limit = ds.getLowerValue()

                        tf_1D.update()
                    })

                    distanceInput.value = ds.getHigherValue()
                    distanceInput.addEventListener('change', (evt) => {
                        ds.setHigherValue(evt.target.value)
                        managers.thresholdTools.r_limit = ds.getHigherValue()

                        tf_1D.update()
                    })

                    inputIsovalueAuto.addEventListener('click', () => {
                        let thres = managers.thresholdTools.getAutoValue()

                        ds.setLowerValue(thres)
                        ds.setHigherValue(1)
                        ds.dispatchEvent(inputEvent)

                        tf_1D.update()
                    })

                    inputIsovalueApply.addEventListener('click', () => {
                        managers.thresholdTools.selectedMode = managers.thresholdTools.mode.MANUAL
                        managers.thresholdTools.process()
                    })

                    processes.enable = (key) => {
                        isoValueInput.dispatchEvent(changeEvent)
                        distanceInput.dispatchEvent(changeEvent)
                        updateTile()
                        setPreviewImage()

                        state.volumeRenderType = 0
                        control.updateVolume()


                        managers.addNotifyEvent(setPreviewImage, 'segmentUpdate')
                        subController.addEventListener('change', setPreviewImage)
                    }

                    processes.update = (key) => {
                        updateTile()
                        setPreviewImage()
                    }

                    processes.disable = (key) => {
                        subController.removeEventListener('change', setPreviewImage)
                        managers.removeNotifyEvent(setPreviewImage, 'segmentUpdate')
                        clearPreviewImage()
                    }


                })
                .create()

            let tf_2D = new Node('2D', transferBtns[1], transferBoards[1])
                .build((processes) => {

                    // 清空預覽結果
                    let clearPreviewImage = () => {

                        for (let mImg of mImgs) {
                            let size = mImg.adaptiveSize
                            let preview = mImg.domElements.preview
                            let pctx = preview.context

                            pctx.save()
                            pctx.beginPath()
                            pctx.clearRect(0, 0, size[0], size[1])
                            pctx.restore()
                        }
                    }

                    // 繪製預覽結果
                    let setPreviewImage = () => {

                        let segment = state.focusedSegment

                        if (segment == null) {
                            return
                        }
                    }

                    let selector = document.getElementById('second_data_selector')

                    let appendOption = (dom, name, value) => {
                        let option = document.createElement('option')
                        option.value = value
                        option.innerText = name
                        dom.append(option)
                    }

                    let transMode = managers.transferTools.mode

                    let actions = {
                        'DEFAULT': transMode.DEFAULT,
                        'GRADIENT': transMode.GRADIENT,
                        'SIZEDATA': transMode.SIZEDATA,
                    }

                    for (let key in actions) {
                        appendOption(selector, key, actions[key])
                    }

                    selector.addEventListener('change', () => {

                        showProgress(true)
                        setProgress(-1)
                        managers.transferTools.selectedMode = Number(selector.options[selector.selectedIndex].value)

                        managers.transferTools.process().then(() => {
                            showProgress(false)
                        })

                    })

                    managers.transferTools.enable = true
                    selector.dispatchEvent(changeEvent)
                    managers.transferTools.enable = false

                    let transferApplyBtn = document.getElementById('segment_transfer_applyBtn')
                    transferApplyBtn.addEventListener('click', () => {

                        managers.transferTools.selectedMode = transMode.APPLY
                        managers.transferTools.process()

                    })

                    processes.enable = (key) => {
                        setPreviewImage()
                        state.volumeRenderType = 1
                        control.updateVolume()
                    }

                    processes.update = (key) => {
                        setPreviewImage()
                    }

                    processes.disable = (key) => {
                        clearPreviewImage()
                    }
                })
                .create()

            let node = new Node('THRESHOLD', toolBtns[2], toolBoards[2])
                .append(tf_1D)
                .append(tf_2D)
                .build((processes) => {
                    // 初始化色彩分布圖的控制項
                    let domElement = document.getElementById('colormapView')
                    let colorSetting = state.colorSetting
                    let templates = new Array(2)

                    let view = new ControlView(domElement, colorSetting)

                    let alphamap_btn = document.getElementById('alpha_map')
                    let colormap_btn = document.getElementById('color_map')

                    alphamap_btn.addEventListener('click', () => {
                        let tmp = templates[0]

                        colorSetting.mylist = []

                        for (let i = 0; i < tmp.markers.length; i++) {
                            colorSetting.mylist.push(tmp.markers[i].copy())
                        }

                        pushData(tmp.path, colorSetting.path)
                        colorSetting.fillColorUpdate()

                        colorSetting.clickTriangle = null
                        view.updateMarkers()
                        view.updateRGBA()
                    })

                    colormap_btn.addEventListener('click', () => {
                        let tmp = templates[1]

                        colorSetting.mylist = []
                        for (let i = 0; i < tmp.markers.length; i++) {
                            colorSetting.mylist.push(tmp.markers[i].copy())
                        }

                        pushData(tmp.path, colorSetting.path)
                        colorSetting.fillColorUpdate()

                        colorSetting.clickTriangle = null
                        view.updateMarkers()
                        view.updateRGBA()
                    })

                    view.addEventListener('change', () => {
                        managers.updateColorMap()
                        node.update()
                    })

                    const files = ["./resources/tf/alphamap.tf2", "./resources/tf/colormap.tf2"]
                    let counter = 0

                    let finished = () => {
                        counter++

                        if (counter == files.length) {
                            alphamap_btn.dispatchEvent(clickEvent)
                        }

                    }

                    for (let i = 0; i < files.length; i++) {

                        let request = new XMLHttpRequest()
                        request.open('GET', files[i], true)
                        //request.responseType = 'blob'
                        request.onload = () => {
                            if (request.readyState == 4 && request.status == 200) {

                                let output = request.responseText.replace('\r', ' ').replace('\n', ' ').replace(/\s\s+/g, ' ').split(' ')

                                let colormap = new Array(4)
                                let path = new Array(256).fill(0)
                                let markers = new Array()

                                for (let i = 0; i < 4; i++) {
                                    colormap[i] = new Float32Array(256).fill(1)
                                }

                                for (let i = 0; i < 256; i++) {
                                    path[i] = parseInt(output[i])
                                }

                                for (let i = 256; i < output.length; i += 4) {
                                    let hsv = new HSVType()
                                    hsv.set(parseFloat(output[i + 1]), parseFloat(output[i + 2]), parseFloat(output[i + 3]))
                                    let rgb = hsv.to_RGB()

                                    let t = new LittleTriangle();
                                    t.x = parseInt(output[i])
                                    t.setColor(rgb.R * 255, rgb.G * 255, rgb.B * 255)
                                    markers.push(t);
                                }

                                templates[i] = {
                                    path: path,
                                    colormap: colormap,
                                    markers: markers
                                }

                                finished()
                            }
                        }
                        request.send()
                    }

                })
                .create()

            return node
        }

        let initGrowingTool = () => {
            let growingBtns = document.getElementById('segmentPage_growing_method').children
            let growingBoard = [document.getElementById('growByRegion'), document.getElementById('growByBorder'), document.getElementById('growByRegion2D')]

            let mImgs = managers.maskImages

            let region = new Node('REGION', growingBtns[0], growingBoard[0])
                .build((processes) => {
                    let regionGrowingModeForm = document.forms['regionGrowingMode']
                    let mode = managers.regionGrowing.mode

                    regionGrowingModeForm.addEventListener('change', (evt) => {
                        managers.regionGrowing.selectedMode = mode[evt.target.value]
                    })

                    let regionGrowingLabel = document.getElementById('segment_controPanel_regionGrowingBias_label')
                    let regionGrowingBiasForm = document.forms['regionGrowingBias']
                    let inputs = regionGrowingBiasForm.getElementsByTagName('input')

                    inputs[0].min = 0
                    inputs[0].max = 0.5
                    inputs[0].step = 0.01
                    inputs[0].value = 0.05
                    inputs[0].addEventListener('input', (evt) => {
                        regionGrowingLabel.textContent = 'Bias +' + evt.target.value
                        managers.regionGrowing.bias = Number(evt.target.value)
                    })

                    inputs[0].checked = true

                    // 清空預覽結果
                    let clearPreviewImage = () => {

                        for (let mImg of mImgs) {
                            let size = mImg.adaptiveSize
                            let preview = mImg.domElements.preview
                            let pctx = preview.context

                            pctx.save()
                            pctx.beginPath()
                            pctx.clearRect(0, 0, size[0], size[1])
                            pctx.restore()
                        }
                    }

                    // 繪製預覽結果
                    let setPreviewImage = () => {

                        let segment = state.focusedSegment

                        if (segment == null) {
                            clearPreviewImage()
                            return
                        }

                        let color = segment.color

                        for (let mImg of mImgs) {
                            let size = mImg.adaptiveSize

                            let preview = mImg.domElements.preview
                            let image = mImg.domElements.background

                            let pctx = preview.context

                            pctx.save()
                            pctx.fillStyle = color
                            pctx.beginPath()
                            pctx.rect(0, 0, size[0], size[1])
                            pctx.fill()
                            pctx.restore()

                            let pvwdata = preview.getImageData()
                            let imgdata = image.getImageData()

                            managers.regionGrowing.process()

                            pctx.putImageData(pvwdata, 0, 0)
                        }
                    }

                    processes.enable = (key) => {
                        let value = checkSubmitValue(regionGrowingModeForm)
                        managers.regionGrowing.selectedMode = mode[value]
                        inputs[0].dispatchEvent(inputEvent)
                        //setPreviewImage()
                    }

                    processes.update = (key) => {
                        let value = checkSubmitValue(regionGrowingModeForm)
                        managers.regionGrowing.selectedMode = mode[value]
                        inputs[0].dispatchEvent(inputEvent)
                        //setPreviewImage()
                    }

                })
                .create()


            let border = new Node('BORDER', growingBtns[1], growingBoard[1])
                .build(() => {

                })
                .create()

            let region2D = new Node('REGION2D', growingBtns[2], growingBoard[2])
                .build((processes) => {
                    let regionGrowingModeForm = document.forms['regionGrowing2DMode']
                    let mode = managers.regionGrowing.mode

                    regionGrowingModeForm.addEventListener('change', (evt) => {
                        if (evt.target.type == 'radio')
                            managers.regionGrowing.selectedMode = mode[evt.target.value]
                        else if (evt.target.type == 'checkbox')
                            managers.regionGrowing.serial = evt.target.checked
                    })

                    let regionGrowingBiasForm = document.forms['regionGrowing2DParameter']
                    let bias = regionGrowingBiasForm.elements.bias
                    let applyBtn = regionGrowingBiasForm.elements.applyBtn
                    let biasLabel = regionGrowingBiasForm.elements.biasLabel

                    bias.min = 0
                    bias.max = 0.5
                    bias.step = 0.01
                    bias.value = 0.05
                    bias.addEventListener('input', (evt) => {
                        biasLabel.value = bias.value
                        managers.regionGrowing.bias = Number(bias.value)
                    })

                    applyBtn.addEventListener('change', () => {
                        managers.regionGrowing.serial = applyBtn.checked
                    })

                    processes.enable = (key) => {
                        let value = checkSubmitValue(regionGrowingModeForm)
                        managers.regionGrowing.selectedMode = mode[value]
                        bias.dispatchEvent(inputEvent)
                        applyBtn.checked = managers.regionGrowing.serial
                    }

                    processes.update = (key) => {
                        let value = checkSubmitValue(regionGrowingModeForm)
                        managers.regionGrowing.selectedMode = mode[value]
                        bias.dispatchEvent(inputEvent)
                        applyBtn.checked = managers.regionGrowing.serial
                    }
                })
                .create()

            let node = new Node('REGIONGROW', toolBtns[3], toolBoards[3])
                .append(region)
                .append(border)
                .append(region2D)
                .build((processes) => {
                    processes.enable = (key) => {

                    }
                })
                .create()

            return node
        }

        let initLogicTool = () => {

            let node = new Node('LOGIC', toolBtns[5], toolBoards[5])
                .build(() => {
                    let sourceSelector = document.getElementById('tool_logic_selector')

                    sourceSelector.addEventListener('click', () => {
                        if (sourceSelector.dataset.toggle == 'on') {
                            sourceSelector.dataset.toggle = 'off'
                        } else if (sourceSelector.dataset.toggle == 'off') {
                            sourceSelector.dataset.toggle = 'on'
                            let lsit = state.segments
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
                        managers.logicTools.selectedMode = mode.INTERSECTION
                        managers.logicTools.process(sourceSelector.value)
                    })

                    logicFuncElements.exclusive.addEventListener('click', () => {
                        managers.logicTools.selectedMode = mode.EXCLUSIVE
                        managers.logicTools.process(sourceSelector.value)
                    })

                    logicFuncElements.union.addEventListener('click', () => {
                        managers.logicTools.selectedMode = mode.UNION
                        managers.logicTools.process(sourceSelector.value)
                    })

                    logicFuncElements.boolean.addEventListener('click', () => {
                        managers.logicTools.selectedMode = mode.BOOLEAN
                        managers.logicTools.process(sourceSelector.value)
                    })

                    logicFuncElements.copy.addEventListener('click', () => {
                        managers.logicTools.selectedMode = mode.COPY
                        managers.logicTools.process(sourceSelector.value)
                    })

                })
                .create()

            return node
        }
        let initBlurTool = () => {

            let node = new Node('MORPH', toolBtns[6], toolBoards[6])
                .build(() => {
                    let filterFuncElements = document.forms['filterForm'].elements
                    let mode = managers.filterTools.mode

                    filterFuncElements.erode.addEventListener('click', () => {
                        showProgress(true)
                        setProgress(-1)
                        managers.filterTools.selectedMode = mode.ERODE
                        managers.filterTools.process().then(() => {
                            console.log('ttt')
                            showProgress(false)
                        })
                    })

                    filterFuncElements.dilate.addEventListener('click', () => {
                        showProgress(true)
                        setProgress(-1)
                        managers.filterTools.selectedMode = mode.DILATE
                        managers.filterTools.process().then(() => {
                            showProgress(false)
                        })
                    })

                    filterFuncElements.medium.addEventListener('click', () => {
                        showProgress(true)
                        setProgress(-1)
                        managers.filterTools.selectedMode = mode.MEDIUM
                        managers.filterTools.process().then(() => {
                            showProgress(false)
                        })
                    })

                    filterFuncElements.gaussian.addEventListener('click', () => {
                        showProgress(true)
                        setProgress(-1)
                        managers.filterTools.selectedMode = mode.GAUSSIAN
                        managers.filterTools.process().then(() => {
                            showProgress(false)
                        })
                    })

                    filterFuncElements.close.addEventListener('click', () => {
                        showProgress(true)
                        setProgress(-1)
                        managers.filterTools.selectedMode = mode.CLOSE
                        managers.filterTools.process().then(() => {
                            showProgress(false)
                        })
                    })

                    filterFuncElements.open.addEventListener('click', () => {
                        showProgress(true)
                        setProgress(-1)
                        managers.filterTools.selectedMode = mode.OPEN
                        managers.filterTools.process().then(() => {
                            showProgress(false)
                        })
                    })

                    let kernelSizeLabel = document.getElementById('segment_filter_kernelSize_label')
                    let kernelSizeInput = document.getElementById('segment_filter_kernelSize_input')
                    kernelSizeInput.addEventListener('input', (evt) => {
                        kernelSizeLabel.textContent = 'Kernel Size x' + (2 * kernelSizeInput.value + 1)
                        managers.filterTools.psize = kernelSizeInput.value * 1
                    })
                    kernelSizeInput.dispatchEvent(inputEvent)
                })
                .create()

            return node
        }
        let toolsManager = new Node()
            .append(initPointer())
            .append(initThreshold())
            .append(initBrushTool())
            .append(initGrowingTool())
            .append(initLogicTool())
            .append(initBlurTool())
            .build((processes) => {
                processes.enable = (key) => {
                    managers.setManagerToolsByKey(key)
                }

                processes.disable = (key) => {
                    managers.disableAll()
                }
            })
            .create()

        this.enable = () => {
            toolsManager.enable()
        }

        this.disable = () => {
            toolsManager.disable()
        }

    }
}

class FileDownloader {
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
            let actions = {
                8: () => {
                    result = new Uint8Array(data.length)
                    colorRange = 255
                },
                16: () => {
                    result = new Uint16Array(data.length)
                    colorRange = 65535
                }
            }

            if (actions[byte] instanceof Function) {
                actions[byte]()
            }
            else {
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

class ModelPanel extends Page {
    constructor(managers, control) {
        super()

        let horizontalClipping = document.getElementById("HzClpFc")
        let coronalClipping = document.getElementById("CrClpFc")
        let saggitalClipping = document.getElementById("SgClpFc")
        let lightIntensitySlider = document.getElementById('light-intensity-slider')
        let showWireLine = document.getElementById('showWirLine')
        let showPolygen = document.getElementById('showPolygen')
        let smoothSlider = document.getElementById('model-smooth-slider')

        let initDirectionBox = () => {
            let directionCubes = document.getElementsByClassName('cube')
            let modelViewer = control.modelViewer

            const NONE = 0
            const DOWN = 1
            const UP = 2
            const MOVE = 3

            for (let cube of directionCubes) {
                let enable = false
                let action = NONE
                let oldPos = [0, 0]
                let distance = [0, 0]
                let move = new THREE.Spherical(800)

                let faces = cube.getElementsByTagName('span')

                for (let face of faces) {

                    face.addEventListener('click', () => {
                        if (action == DOWN)
                            modelViewer.setOrientation(face.dataset.order)
                    })
                }

                cube.addEventListener('pointerdown', (evt) => {
                    enable = true

                    action = DOWN

                    oldPos[0] = parseInt(evt.clientX)
                    oldPos[1] = parseInt(evt.clientY)

                    let target = wControl.target
                    let eyePos = wControl.object.position

                    move.setFromVector3(eyePos.sub(target))
                })

                window.addEventListener('pointermove', (evt) => {
                    if (!enable) return

                    if (action == DOWN || action == MOVE) {
                        action = MOVE

                        distance[0] = parseInt(evt.clientX) - oldPos[0]
                        distance[1] = parseInt(evt.clientY) - oldPos[1]

                        move.phi = move.phi - distance[1] / cube.clientHeight * Math.PI * 2

                        if (move.phi > Math.PI) {
                            move.phi = Math.PI
                        }
                        else if (move.phi < 0) {
                            move.phi = 0.001
                        }

                        move.theta = (move.theta - distance[0] / cube.clientWidth * Math.PI * 2) % Math.PI

                        let target = wControl.target

                        wControl.object.position.sub(target)
                        wControl.object.position.setFromSpherical(move)
                        wControl.object.position.add(target)
                        wControl.object.updateProjectionMatrix()
                        wControl.update()
                        oldPos[0] = evt.clientX
                        oldPos[1] = evt.clientY
                    }

                })

                window.addEventListener('pointerup', (evt) => {
                    if (!enable)
                        return

                    enable = false
                })

                let wControl = modelViewer.windowControl

                wControl.addEventListener('change', (evt) => {

                    let target = wControl.target
                    let eyePos = wControl.object.position

                    let m = new THREE.Matrix4().identity()
                    m.lookAt(eyePos, target, new THREE.Vector3(0, 1, 0))

                    let q = new THREE.Quaternion()
                    q.setFromRotationMatrix(m)

                    cube.style.transform = `rotate3d(${q.x}, ${-q.y}, ${q.z}, ${Math.acos(q.w) * 2}rad)`
                })

                wControl.dispatchEvent({ type: 'change' })
            }

        }

        initDirectionBox()

        let clippingSlider = new Array(3)

        clippingSlider[0] = new dualSlider(horizontalClipping, 0, 1, 0.01)
        clippingSlider[1] = new dualSlider(coronalClipping, 0, 1, 0.01)
        clippingSlider[2] = new dualSlider(saggitalClipping, 0, 1, 0.01)

        clippingSlider[0].event((low, high, group) => {
            if (group == 0) {
                control.modelViewer.setClippingRatio(axisXY, low, group)
            } else {
                control.modelViewer.setClippingRatio(axisXY, high, group)
            }
        })
        clippingSlider[0].dispatchEvent(inputEvent)

        clippingSlider[1].event((low, high, group) => {
            if (group == 0) {
                control.modelViewer.setClippingRatio(axisXZ, low, group)
            } else {
                control.modelViewer.setClippingRatio(axisXZ, high, group)
            }
        })

        clippingSlider[1].dispatchEvent(inputEvent)

        clippingSlider[2].event((low, high, group) => {
            if (group == 0) {
                control.modelViewer.setClippingRatio(axisYZ, low, group)
            } else {
                control.modelViewer.setClippingRatio(axisYZ, high, group)
            }
        })
        clippingSlider[2].dispatchEvent(inputEvent)

        showWireLine.checked = true
        showWireLine.addEventListener('change', () => {
            control.modelViewer.renderMode.wireline = showWireLine.checked
            control.modelViewer.renderScene()
        })

        showPolygen.checked = true
        showPolygen.addEventListener('change', () => {
            control.modelViewer.renderMode.polygen = showPolygen.checked
            control.modelViewer.renderScene()
        })

        lightIntensitySlider.min = 1
        lightIntensitySlider.max = 5
        lightIntensitySlider.value = 2
        lightIntensitySlider.addEventListener('input', (evt) => {
            control.modelViewer.lightProfile.intensity = parseInt(evt.target.value)
            control.modelViewer.renderScene()
        })
        lightIntensitySlider.dispatchEvent(inputEvent)

        smoothSlider.min = 0.1
        smoothSlider.max = 1
        smoothSlider.step = 0.1
        smoothSlider.value = 0.1
        smoothSlider.addEventListener('input', (evt) => {
            control.modelViewer.quality = parseFloat(evt.target.value)
        })

        smoothSlider.dispatchEvent(inputEvent)

        let generateModelBtn = document.getElementById('generate-model-btn')
        generateModelBtn.addEventListener('click', () => {
            control.calculate()

            clippingSlider[0].dispatchEvent(inputEvent)
            clippingSlider[1].dispatchEvent(inputEvent)
            clippingSlider[2].dispatchEvent(inputEvent)
        })

        let downloader = new FileDownloader()

        let modelTypeSelector = document.getElementById('downloadPage_modelType');
        let genModelBtn = document.getElementById('downloadPage_modelGen');

        genModelBtn.addEventListener('click', () => {
            console.log(control)
            downloader.modelProcess(modelTypeSelector.value, 'model', control.modelViewer.model.mesh)
        })

        for (let i of downloader.modelType) {
            let opt = document.createElement('option');
            opt.value = i;
            opt.innerHTML = i;
            modelTypeSelector.appendChild(opt);
        }
    }
}

class ImageProcessPanel extends Page {
    constructor(managers, control) {
        super()
        let state = managers.state

        let maskValueBtn = document.getElementById('maskBtn')
        let resetBtn = document.getElementById('resetBtn')

        let mode = managers.cropTools.mode

        maskValueBtn.addEventListener('click', () => {
            managers.cropTools.process()
        })

        resetBtn.addEventListener('click', () => {
            //managers.cropTools.selectedMode = mode.RESET
            managers.cropTools.reset()
        })

        this.enable = () => {
            managers.cropTools.enable = true
        }

        this.disable = () => {
            managers.cropTools.enable = false
        }

        let initSignalDistribution = () => {
            let domElement = document.getElementById('image_histogram_viewer')
            let div = document.createElement('div')
            div.style.width = '100%'
            div.style.height = '200px'
            div.id = 'ttt'
            domElement.appendChild(div)
            let histogram = Histogram.getInstance()

            histogram.loadView(div, state.volume.data, state.info.bitsStored)

            managers.addNotifyEvent(() => {
                histogram.loadView(div, state.volume.data, state.info.bitsStored)
            }, 'imageUpdate')
        }

        let initSelector = () => {
            let toolBtns = document.querySelectorAll('#cropTools_selector > button')
            let tools = document.querySelectorAll('#cropTools_group > .tool')

            for (let i = 0; i < toolBtns.length; i++) {
                toolBtns[i].addEventListener('click', (evt) => {

                    for (let option = 0; option < toolBtns.length; option++) {
                        toolBtns[option].classList.remove('active')
                        tools[option].classList.add('d-none')
                    }

                    toolBtns[i].classList.add('active')
                    tools[i].classList.remove('d-none')

                    managers.cropTools.selectedMode = mode[toolBtns[i].dataset['mode']]
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
                } else if (i == 1) {
                    dslider.event((low, high) => {
                        parameter.front = low * 1
                        parameter.back = high * 1
                    })
                } else if (i == 2) {
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

            for (let i = 0; i < slider.length; i++) {
                slider[i].min = 0
                slider[i].max = 1
                slider[i].value = 0.5
                slider[i].step = 0.01
            }

            slider[0].addEventListener('input', () => {
                parameter.radius = slider[0].value * 1
            })

            slider[1].addEventListener('input', () => {
                parameter.x = slider[1].value * 1
            })

            slider[2].addEventListener('input', () => {
                parameter.y = slider[2].value * 1
            })

            slider[3].addEventListener('input', () => {
                parameter.z = slider[3].value * 1
            })

            for (let i = 0; i < slider.length; i++) {
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

            for (let i = 1; i < slider.length; i++) {
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
            for (let i = 1; i < slider.length; i++) {
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

            for (let i = 0; i < slider.length; i++) {
                slider[i].min = 0
                slider[i].max = 1
                slider[i].value = 0.5
                slider[i].step = 0.01
            }

            slider[0].addEventListener('input', () => {
                parameter.size = slider[0].value * 1
            })

            slider[1].addEventListener('input', () => {
                parameter.x = slider[1].value * 1
            })

            slider[2].addEventListener('input', () => {
                parameter.y = slider[2].value * 1
            })

            slider[3].addEventListener('input', () => {
                parameter.z = slider[3].value * 1
            })

            for (let i = 0; i < slider.length; i++) {
                slider[i].dispatchEvent(inputEvent)
            }
        }

        initSignalDistribution()

        initBoxCrop()
        initSphereCrop()
        initCylinderCrop()
        initBalloonCrop()
        initSelector()

        let initImageRenderStyle = () => {

            let imgRenderSelector = document.getElementById('imgSelector')
            let imgInvertorCheckBox = document.getElementById('imgInvertorCheckBox')

            for (let i = 0; i < 5; i++) {
                let option = document.createElement('option')

                if (i == 0) {
                    option.text = 'Origin'
                    option.value = 100
                } else if (i == 1) {
                    option.text = 'Equalization(3D)'
                    option.value = 0
                } else if (i == 2) {
                    option.text = 'CLAHE(3D)'
                    option.value = 3
                }
                else if (i == 3) {
                    option.text = 'Equalization(2D)'
                    option.value = 9
                } else if (i == 4) {
                    option.text = 'CLAHE(2D)'
                    option.value = 5
                }
                imgRenderSelector.add(option)
            }

            imgRenderSelector.addEventListener('change', () => {

                let index = imgRenderSelector.selectedIndex
                let value = imgRenderSelector.options[index].value

                state.volumeProcessType = value
                let imgData = state.volume

                if (imgData == null) {
                    return
                }

                managers.updatevolume().then(() => {
                    control.updateData()
                })

            })

            imgInvertorCheckBox.addEventListener('change', () => {
                state.isInverted = !state.isInverted;

                imgRenderSelector.dispatchEvent(changeEvent);
            });

            imgRenderSelector.dispatchEvent(changeEvent);
        }

        initImageRenderStyle()
    }
}

class PanelController {
    constructor(managers) {

        let sceneController = {
            IMAGE: new DcmController(managers),
            MODEL: new ModelControl(managers)
        }

        let panelController = {
            IMAGE: new ImageProcessPanel(managers, sceneController.IMAGE),
            SEGMENT: new SegmentsPanel2(managers, sceneController.IMAGE),
            MODEL: new ModelPanel(managers, sceneController.MODEL)
        }

        let initPanelSelector = () => {
            let panelBtns = document.querySelectorAll('#page_selector > button')
            let panels = document.querySelectorAll('#page_group > .page')
            let scenes = document.getElementsByClassName('scene')

            // 初始化控制面板以及相關的視窗
            for (let i = 0; i < scenes.length; i++) {
                scenes[i].classList.remove('t-visible')
                scenes[i].classList.add('t-invisible')
            }

            for (let i = 0; i < panels.length; i++) {
                panels[i].classList.remove('r-visible')
                panels[i].classList.add('r-invisible')
            }

            // 初始化控制面板的啟動狀態
            for (let index in panelController) {
                panelController[index].disable()
            }

            let prev = -1, index, name
            for (let i = 0; i < panelBtns.length; i++) {
                panelBtns[i].addEventListener('click', (evt) => {
                    if (prev != -1) {
                        panelBtns[prev].classList.remove('active')

                        panels[prev].classList.remove('r-visible')
                        panels[prev].classList.add('r-invisible')

                        index = panelBtns[prev].dataset['pageIndex']

                        scenes[index].classList.remove('t-visible')
                        scenes[index].classList.add('t-invisible')

                        name = panelBtns[prev].dataset['pageName']
                        panelController[name].disable()
                    }

                    evt.target.classList.add('active')

                    panels[i].classList.remove('r-invisible')
                    panels[i].classList.add('r-visible')

                    index = evt.target.dataset['pageIndex']
                    scenes[index].classList.remove('t-invisible')
                    scenes[index].classList.add('t-visible')

                    name = evt.target.dataset['pageName']

                    panelController[name].enable()

                    prev = i

                })
            }



            panelBtns[0].dispatchEvent(clickEvent)

        }
        initPanelSelector()


        //new DownloadPage()

    }

}

export { PanelController }