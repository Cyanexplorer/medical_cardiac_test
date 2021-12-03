import { RegionGrowing, SizeBased, Logic, Scissor, Morphology } from "./Functions.js"
import * as THREE from "./../../build/three.module.js";

let maskUp2 = function (dataBuffer, maskList) {
    maskList.forEach((mask) => {
        dataBuffer.forEach((dataPixel, index) => {
            dataBuffer[index] = mask[index] * dataPixel
        })
    })
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

let imgWriter = function (axis, uvdDims, dataBuffer, index, result) {

    //pixelEnhense(dataBuffer)
    bufferWriter(axis, uvdDims, dataBuffer, index, convert2data(result))
}

let imgLoader = function (axis, uvdDims, dataBuffer, index) {

    let buffer = bufferLoader(axis, uvdDims, dataBuffer, index)
    return convert2Img(buffer)
}

let bufferWriter = function (axis, uvdDims, dataBuffer, index, result) {

    let i, j, step
    //load top 2 bottom
    //console.log(dataBuffer)
    if (axis == axisUV) {
        step = uvdDims[1] * uvdDims[0]
        dataBuffer.set(result, index * step, step)
    }

    //load left 2 right
    else if (axis == axisUD) {
        step = uvdDims[1] * uvdDims[0]
        for (j = index * uvdDims[0], i = 0; j < dataBuffer.length; j += step, i += uvdDims[0]) {
            dataBuffer.set(result.subarray(i, i + uvdDims[0]), j, uvdDims[0])
        }
    }

    //load front 2 back
    else {
        for (j = uvdDims[0] - index - 1, i = 0; j < dataBuffer.length; j += uvdDims[0], i++) {
            dataBuffer[j] = result[i]
        }
    }
}



let bufferLoader = function (axis, uvdDims, dataBuffer, index) {

    //pixelEnhense(dataBuffer)
    let buffer
    let j, step, startPos
    //load top 2 bottom

    if (axis == axisUV) {
        step = uvdDims[1] * uvdDims[0]
        buffer = new Uint8Array(step)
        startPos = index * step
        buffer.set(dataBuffer.subarray(startPos, (startPos + step)))
    }

    //load left 2 right
    else if (axis == axisUD) {
        buffer = new Uint8Array(uvdDims[0] * uvdDims[2])
        step = uvdDims[1] * uvdDims[0]
        for (startPos = 0, j = index * uvdDims[0]; j < dataBuffer.length; j += step, startPos += uvdDims[0]) {
            buffer.set(dataBuffer.subarray(j, j + uvdDims[0]), startPos)
        }
    }

    //load front 2 back
    else {
        buffer = new Uint8Array(uvdDims[1] * uvdDims[2])

        for (startPos = 0, j = uvdDims[0] - index - 1; j < dataBuffer.length; j += uvdDims[0], startPos++) {
            buffer[startPos] = dataBuffer[j]
        }
    }

    return buffer
}

let convert2Img = function (frameBuffer) {
    let img = new Uint8ClampedArray(frameBuffer.length * 4).fill(0)
    for (let i = 0; i < frameBuffer.length; i++) {
        img[4 * i] = frameBuffer[i]
        img[4 * i + 1] = frameBuffer[i]
        img[4 * i + 2] = frameBuffer[i]
        img[4 * i + 3] = frameBuffer[i] > 0 ? 255 : 0
    }
    return img
}

let convert2data = function (img) {
    let frameBuffer = new Uint8ClampedArray(img.length / 4).fill(0)
    for (let i = 0; i < frameBuffer.length; i++) {
        frameBuffer[i] = (img[4 * i] + img[4 * i + 1] + img[4 * i + 2]) > 0 ? 255 : 0;
    }
    return frameBuffer
}

class MaskImage {

    constructor(canvas, state) {
        this.domElement = canvas
        this.exposure = 1
        this.contrast = 1
        this.layers = []
        this.base = null
        this.state = state
        this.palatte = null
        this.context = null
        this.size = []
        this.compressedSize = []
        this.setMaskSize(canvas.width, canvas.height)

        window.addEventListener('resize', () => {
            let scope = this
            setTimeout(() => {
                scope.sizeReload()
            }, 500)
        })
    }

    setMaskColor(index, color) {
        let ctx = this.layers[index].context
        ctx.fillStyle = color
    }

    setMaskSize(width, height) {

        this.size = [width, height]
        this.domElement.width = width
        this.domElement.height = height
        this.sizeReload()

        this.base = document.createElement('canvas')
        this.base.width = width
        this.base.height = height

        this.context = this.base.getContext('2d')
        this.palatte = this.context.getImageData(0, 0, width, height)
        //console.log(this.compressedSize)
        //console.log(this.size)
    }

    sizeReload() {
        //adjust element size
        let ratio = this.size[1] / this.size[0]

        let newW = this.domElement.parentElement.clientWidth
        let newH = this.domElement.parentElement.clientHeight
        let nratio = newH / newW

        if (ratio > nratio) {
            newW = newH / ratio
        }
        else{
            newH = newW * ratio
        }

        this.domElement.style.width = `${newW}px`
        this.domElement.style.height = `${newH}px`
        console.log(this.domElement.style.width, this.domElement.style.height)
        this.compressedSize = [newW, newH]
    }

    setBufferImage(buffer) {
        this.palatte.data.set(buffer)
        this.context
            .putImageData(this.palatte, 0, 0)
    }

    setLayerImage(index, pixelData, color) {
        //console.log(buffer)
        let layer = this.layers[index]
        let palatte = layer.palatte
        let ctx = layer.context
        //ctx.globalCompositeOperation = 'source-over'
        palatte.data.set(pixelData)
        ctx.putImageData(palatte, 0, 0)
        //console.log(color)
        if (color != null) {
            ctx.save()
            ctx.globalCompositeOperation = 'source-in'
            ctx.fillStyle = color
            ctx.beginPath()
            ctx.rect(0, 0, this.size[0], this.size[1])
            ctx.fill()
            ctx.restore()
        }

    }

    addLayer() {
        let layer = document.createElement('canvas')
        layer.width = this.size[0]
        layer.height = this.size[1]
        let ctx = layer.getContext('2d')
        this.layers.push(
            {
                canvas: layer,
                context: ctx,
                palatte: ctx.getImageData(0, 0, this.size[0], this.size[1])
            }
        )
    }

    removeLayer(index) {
        this.layers.splice(index, 1)
    }

    clear() {
        let ctx = this.domElement.getContext('2d')
        ctx.clearRect(0, 0, this.size[0], this.size[1])
    }

    update() {
        this.clear()
        let fIndex = this.state.focusedSegIndex

        let ctx = this.domElement.getContext('2d')

        ctx.filter = 'brightness(' + this.exposure + ') contrast(' + this.contrast +') blur(1px)'
        ctx.drawImage(this.base, 0, 0)
        ctx.filter = 'none'
        //ctx.globalCompositeOperation = 'lighter'

        for (let i = 0; i < this.state.segments.length; i++) {
            if (this.state.segments[i].visible && i != fIndex)
                ctx.drawImage(this.layers[i].canvas, 0, 0)
        }

        if (fIndex != -1 && this.state.segments[fIndex].visible)
            ctx.drawImage(this.layers[fIndex].canvas, 0, 0)

        //ctx.globalCompositeOperation = 'source-over'
    }

    setMaskTrack(index, pos, radius) {
        let ctx = this.layers[index].context
        ctx.globalCompositeOperation = 'source-over'

        ctx.beginPath()
        ctx.arc(pos[0], pos[1], radius, 0, Math.PI * 2, 1)
        ctx.fill()
    }

    getLayerImage(index) {
        let ctx = this.layers[index].context
        return ctx.getImageData(0, 0, this.size[0], this.size[1])
    }

    getBaseImage() {
        let ctx = this.base.context
        return ctx.getImageData(0, 0, this.size[0], this.size[1])
    }

    toImgURL() {
        return this.base.toDataURL()
    }
}

class segState {
    constructor() {
        this.base = null
        this.index = []
        this.order = -1
        this.segments = []
        this.fIndex = -1
    }

    get focusedSegIndex() {
        return this.fIndex
    }

    set focusedSegIndex(x) {
        this.fIndex = x
    }

    clone() {
        let cl = new segState()
        cl.base = this.base
        cl.order = this.order
        cl.fIndex = this.fIndex

        this.index.forEach((x) => {
            cl.index.push(x)
        })

        this.segments.forEach((segment) => {
            let tmpSeg = new Segment('', [0, 0, 0], '', true)
            tmpSeg.name = segment.name
            tmpSeg.color = segment.color
            tmpSeg.data = new Uint8Array(segment.data)
            tmpSeg.alpha = new Uint8Array(segment.alpha)
            tmpSeg.dims = segment.dims
            tmpSeg.visible = segment.visible
            tmpSeg.used = segment.used

            cl.segments.push(tmpSeg)
        })

        return cl
    }

    copyfrom(state) {
        this.base = state.base
        this.index = state.index
        this.order = state.order
        this.segments = state.segments
        this.fIndex = state.fIndex
    }
}

class BrushTools {
    constructor(segState, maskImages) {
        this.mode = {
            NONE: -1,
            PEN: 0,
            ERASER: 1
        }
        this.state = this.mode.NONE
        this.segState = segState
        this.penPosition = []
        this.maskImages = maskImages
    }

    
    startPaint(evt, option, axis) {

        let color = '#000000'
        if (option == undefined || option) {
            color = this.segState.segments[this.segState.focusedSegIndex].color
        }

        this.penPosition = [evt.clientX, evt.clientY]
        this.maskImages[axis].setMaskColor(this.segState.focusedSegIndex, color)
    }

    getMousePos(canvas, evt) {
        let rect = canvas.getBoundingClientRect()
        let scaleX = (evt.clientX - rect.left) * (canvas.width / rect.width)
        let scaleY = (evt.clientY - rect.top) * (canvas.height / rect.height)
        let intX = parseInt(scaleX)
        let intY = parseInt(scaleY)
        return [intX, intY]
    }

    onPainting(evt, axis) {
        //this.maskImage.clear()

        let pos = this.getMousePos(this.maskImages[axis].domElement, evt)
        this.maskImages[axis].setMaskTrack(this.segState.focusedSegIndex, pos, this.radius)
        this.maskImages[axis].update()
    }

    endPainting(evt, axis) {
        let img = this.maskImages[axis].getLayerImage(this.segState.focusedSegIndex)
        let seg = this.getFocusedSegment()

        if (seg == null) {
            return
        }

        seg.setBuffer(axis, this.segState.index[axis], img.data)
    }
}

class LogicTools {
    constructor(segState) {
        this.mode = {
            INTERSECTION: 0,
            EXCLUSIVE: 1,
            UNION: 2,
            BOOLEAN: 3,
            COPY: 4
        }
        this.state = this.mode.INTERSECTION
        this.segState = segState
    }

    process = (sIndex, dIndex, onload) => {
        this.save()

        if (sIndex >= this.segState.segments.length || sIndex < 0 || dIndex >= this.segState.segments.length || dIndex < 0) {
            return
        }

        switch (this.state) {
            case this.mode.INTERSECTION:
                Logic.intersection(this.getSegment(sIndex).data, this.getSegment(dIndex).data)
                break
            case this.mode.EXCLUSIVE:
                Logic.exclusive(this.getSegment(sIndex).data, this.getSegment(dIndex).data)
                break
            case this.mode.UNION:
                Logic.union(this.getSegment(sIndex).data, this.getSegment(dIndex).data)
                break
            case this.mode.BOOLEAN:
                Logic.boolean(this.getSegment(sIndex).data, this.getSegment(dIndex).data)
                break
            case this.mode.COPY:
                Logic.copy(this.getSegment(sIndex).data, this.getSegment(dIndex).data)
                break
            default:
                break
        }

        onload()
    }
}

class SegmentManager {

    static managerTools = {
        NONE: 0,
        BRUSH: 1,
        THRESHOLD: 2,
        ISLAND: 3,
    }

    static brushMode = {
        NONE: -1,
        PEN: 0,
        ERASER: 1
    }

    static morphMode = {
        ERODE: 0,
        DILATE: 1,
        MEDIUM: 2,
        GAUSSIAN: 3,
        CLOSE: 4,
        OPEN: 5
    }

    static regionMode = {
        NONE: 0,
        PRESERVE: 1,
        REMOVE: 2,
        GROW: 3,
        SHRINK: 4
    }

    constructor(maskImages) {
        this.maskImages = maskImages
        
        //mouse state
        this.hover = false
        this.pressing = false
        this.backup = null
        this.order = -1
        this.state = SegmentManager.managerTools.NONE

        this.segState = new segState()
        this.segState.index = new Array(maskImages.length).fill(0)

        this.logictools = new LogicTools(segState)
        this.brushTools = new BrushTools(segState, maskImages)
        //seg state
        /**
         * 
         *         this.segState = {
            base: null,
            index: new Array(maskImages.length).fill(0),
            order: -1,
            segments: [],
            fIndex: -1,
            get focusedSegIndex() {
                return this.fIndex
            },
            set focusedSegIndex(x) {
                this.fIndex = x
                for (let i = 0; i < maskImages.length; i++) {
                    maskImages[i].update()
                }
            }
        } 
         * 
         * */
        //brush
        this.brushMode = SegmentManager.brushMode.NONE

        //region grow
        this.bias = 0
        this.radius = 5
        this.regionMode = SegmentManager.regionMode.NONE

        //steps
        this.previousStep = []
        this.nextStep = []
        this.currentStep = null
        this.onload = null

        this.penPosition = new THREE.Vector2()

        for (let i = 0; i < this.maskImages.length; i++) {
            this.maskImages[i].state = this.segState
        }

        maskImages.forEach((element, index) => {
            let domElement = element.domElement
            domElement.addEventListener('mouseenter', (evt) => {
                evt.preventDefault()
                this.hover = true
            })

            domElement.addEventListener('mousedown', (evt) => {
                evt.preventDefault()
                this.pressing = true

                if (this.state != SegmentManager.managerTools.BRUSH) {
                    return
                }

                if (this.brushMode != SegmentManager.brushMode.PEN) {
                    this.startPaint(evt, true, index)
                }

                else if (this.brushMode != SegmentManager.brushMode.ERASER) {
                    this.startPaint(evt, false, index)
                }
            })

            domElement.addEventListener('mousemove', (evt) => {
                evt.preventDefault()
                if (!this.pressing || !this.hover) {
                    return
                }
                if (this.state != SegmentManager.managerTools.BRUSH) {
                    return
                }
                if (this.brushMode != SegmentManager.brushMode.PEN) {
                    this.onPainting(evt, index)
                }
                else if (this.brushMode != SegmentManager.brushMode.ERASER) {
                    this.onPainting(evt, index)
                }
            })

            domElement.addEventListener('mouseup', (evt) => {
                evt.preventDefault()
                this.pressing = false

                if (this.state == SegmentManager.managerTools.BRUSH) {
                    if (this.brushMode != SegmentManager.brushMode.PEN) {
                        this.endPainting(evt, index)
                    }
                    else if (this.brushMode != SegmentManager.brushMode.ERASER) {
                        this.endPainting(evt, index)
                    }
                }
                else if (this.state == SegmentManager.managerTools.ISLAND) {
                    evt.preventDefault()
                    let pos = this.getMousePos(this.maskImages[index].domElement, evt)
                    switch (index) {
                        case axisUV:
                            this.island(pos[0], pos[1], this.segState.index[index], this.bias)
                            break
                        case axisUD:
                            this.island(pos[0], this.segState.index[index], pos[1], this.bias)
                            break
                        case axisVD:
                            this.island(this.segState.base.dims[0] - this.segState.index[index] - 1, pos[0], pos[1], this.bias)
                            break
                        default:
                            break
                    }
                    
                }
            })

            domElement.addEventListener('mouseleave', (evt) => {
                evt.preventDefault()
                this.hover = false
            })
        })

    }

    save() {
        while (this.nextStep.length > 0) {
            this.nextStep.pop()
        }

        if (this.previousStep.length >= 30) {
            this.previousStep.shift()
        }

        let state = this.segState.clone()
        
        this.previousStep.push(state)

        if (this.onload != null) {
            this.onload(this.previousStep, this.nextStep)
        }

    }

    forward() {
        if (this.previousStep.length <= 0) {
            return
        }

        if (this.currentStep == null) {
            this.currentStep = this.segState.clone()
        }

        this.nextStep.push(this.currentStep)
        this.currentStep = this.previousStep.pop()

        this.segState.copyfrom(this.currentStep)
        this.notify()
        if (this.onload != null) {
            this.onload(this.previousStep, this.nextStep)
        }

    }

    backward() {
        if (this.nextStep.length <= 0) {
            return
        }

        this.previousStep.push(this.currentStep)
        this.currentStep = this.nextStep.pop()
        
        this.segState.copyfrom(this.currentStep)
        this.notify()
        if (this.onload != null) {
            this.onload(this.previousStep, this.nextStep)
        }
    }

    addStepChange(onload) {
        this.onload = onload
    }

    setBias(bias) {
        this.bias = bias
    }

    getFocusedSegment() {
        if (this.segState.focusedSegIndex == -1) {
            return null
        }
        return this.segState.segments[this.segState.focusedSegIndex]
    }

    getFocusedLayer(axis) {
        let seg = this.getFocusedSegment()
        let index = this.segState.index[axis]

        if (seg == null || index == -1) {
            return null
        }

        return seg.getBuffer(axis, index)
    }

    colorList = ['#FF0000', '#00FF00', '#0000FF', '#F0F000', '#F00F00']
    addSegment() {

        if (this.segState.base == null) {
            alert('image data not load!')
            return
        }

        this.save()

        this.segState.order++

        let name = `Segment ${this.segState.order}`
        let color = this.colorList[this.segState.order % this.colorList.length]
        let dims = this.segState.base.dims
        this.segState.segments.push(new Segment(name, dims, color))

        this.maskImages.forEach(element => element.addLayer())
    }

    removeSegment() {
        this.save()

        this.segState.segments.splice(this.segState.focusedSegIndex, 1)
        this.maskImages.forEach(element => element.removeLayer(this.segState.focusedSegIndex))
        if (this.segState.segments.length <= 0) {
            this.segState.order = -1
            this.setTools(SegmentManager.managerTools.NONE)
        }
        this.segState.focusedSegIndex = this.segState.segments.length - 1
    }

    setTools(index) {
        this.state = index
    }

    setFocusedSegment(index) {
        this.segState.focusedSegIndex = index
    }

    setFocusedLayer(axis, index = this.segState.index[axis]) {

        if (this.segState.base == null) {
            return
        }

        let dims = this.segState.base.dims
        let baseData = this.segState.base.data
        let image = this.maskImages[axis]
        this.segState.index[axis] = index

        let img = imgLoader(axis, dims, baseData, index)
        if (this.segState.base.used) {
            for (let i = 0, j = 0; i < img.length; i += 4, j++) {
                img[i + 3] = this.segState.base.alpha[j]
            }
        }
        image.setBufferImage(img)

        while (image.layers.length > this.segState.segments.length) {
            image.removeLayer()
        }

        while (image.layers.length < this.segState.segments.length) {
            image.addLayer()
        }

        for (let i = 0; i < this.segState.segments.length; i++) {
            let color = this.segState.segments[i].color
            let pixelData = this.segState.segments[i].getBuffer(axis, index)
            image.setLayerImage(i, pixelData, color)
        }

        image.update()
    }

    setBaseSegment(dataBuffer, dims) {
        this.segState.base = new Segment('base', dims, null)
        this.segState.base.data = dataBuffer

        this.backup =  dataBuffer.slice(0)
    }

    resetBaseSegment() {
        this.segState.base.data.set(this.backup)
        this.notify()
    }

    getBaseSegment() {
        return this.segState.base.data
    }

    getSegment(index) {
        return this.segState.segments[index]
    }

    startPaint(evt, option, axis) {
        this.save()

        let color = '#000000'
        if (option == undefined || option) {
            color = this.segState.segments[this.segState.focusedSegIndex].color
        }

        this.penPosition = [evt.clientX, evt.clientY]
        this.maskImages[axis].setMaskColor(this.segState.focusedSegIndex, color)
    }

    getMousePos(canvas, evt) {
        let rect = canvas.getBoundingClientRect()
        let scaleX = (evt.clientX - rect.left) * (canvas.width / rect.width)
        let scaleY = (evt.clientY - rect.top) * (canvas.height / rect.height)
        let intX = parseInt(scaleX)
        let intY = parseInt(scaleY)
        return [intX, intY]
    }

    onPainting(evt, axis) {
        //this.maskImage.clear()

        let pos = this.getMousePos(this.maskImages[axis].domElement, evt)
        this.maskImages[axis].setMaskTrack(this.segState.focusedSegIndex, pos, this.radius)
        this.maskImages[axis].update()
    }

    endPainting(evt, axis) {
        let img = this.maskImages[axis].getLayerImage(this.segState.focusedSegIndex)
        let seg = this.getFocusedSegment()

        if (seg == null) {
            return
        }

        seg.setBuffer(axis, this.segState.index[axis], img.data)
    }

    notify() {
        this.maskImages.forEach((_, index) => {
            this.setFocusedLayer(index)
        })
    }

    filter(l_limit, r_limit) {
        this.save()

        let baseData = this.segState.base.data
        let seg = this.getFocusedSegment()

        if (seg == null) {
            return
        }

        let segData = seg.data

        if (baseData.length != segData.length) {
            console.error('Segment / Image buffer out of range.')
            return
        }

        for (let i = 0; i < baseData.length; i++) {
            segData[i] = 0
            if (baseData[i] >= l_limit && baseData[i] <= r_limit) {
                segData[i] = 255
            }
        }

        this.notify()
    }

    crop(mode, params) {
        this.save()

        if (this.segState.base == null) {
            return
        }

        let dims = this.segState.base.dims
        let segData = this.segState.base.data

        if (mode == 0) {
            let mask = maskUpSphere(dims, params.ratio)
            maskUp2(segData, [mask])
        }

        else if (mode == 1) {
            let mask = maskUpShape(dims, params, pixelData)
            maskUp2(segData, [mask])
        }

        this.notify()
    }

    island = (x, y, layerIndex, bias, margin=0) => {
        this.save()

        let seg = this.getFocusedSegment()

        if (seg == null) {
            return
        }

        let segData = seg.data
        let baseData = this.segState.base.data
        let dims = this.segState.base.dims

        if (this.regionMode == SegmentManager.regionMode.NONE) {
            let mask = RegionGrowing.process(x, y, layerIndex, baseData, dims, bias, margin)
            Logic.union(mask, segData)
        }
        else if (this.regionMode == SegmentManager.regionMode.PRESERVE) {
            let mask = RegionGrowing.process(x, y, layerIndex, segData, dims, bias, margin)
            segData.set(mask)
        }
        else if (this.regionMode == SegmentManager.regionMode.REMOVE) {
            let mask = RegionGrowing.process(x, y, layerIndex, segData, dims, bias, margin)
            Logic.boolean(mask, segData)
        }
        else if (this.regionMode == SegmentManager.regionMode.GROW) {
            let mask = RegionGrowing.process(x, y, layerIndex, segData, dims, bias, margin)
            segData.set(mask)
        }
        else if (this.regionMode == SegmentManager.regionMode.SHRINK) {

        }
        else {
            console.error('Function not supporet.')
        }

        this.notify()
    }


    sizeBased = () => {
        this.save()

        let alphaData = this.segState.base.alpha
        let sb = new SizeBased(this.segState.base.data, this.segState.base.dims)
        alphaData.set(sb.process())

        this.notify()
    }

    scissor = (camera, img) => {
        let dims = this.segState.base.dims
        let ss = new Scissor(dims)
        let mask = ss.process(camera, img)

        let seg = this.getFocusedSegment()

        if (seg == null) {
            return
        }

        let segData = seg.data

        Logic.union(segData, mask)
        this.notify()
    }

    logicOperation = (sIndex, dIndex, option) => {
        this.save()

        if (sIndex >= this.segState.segments.length || sIndex < 0 || dIndex >= this.segState.segments.length || dIndex < 0) {
            return
        }

        switch (option) {
            case SegmentManager.logicMode.INTERSECTION:
                Logic.intersection(this.getSegment(sIndex).data, this.getSegment(dIndex).data)
                break
            case SegmentManager.logicMode.EXCLUSIVE:
                Logic.exclusive(this.getSegment(sIndex).data, this.getSegment(dIndex).data)
                break
            case SegmentManager.logicMode.UNION:
                Logic.union(this.getSegment(sIndex).data, this.getSegment(dIndex).data)
                break
            case SegmentManager.logicMode.BOOLEAN:
                Logic.boolean(this.getSegment(sIndex).data, this.getSegment(dIndex).data)
                break
            case SegmentManager.logicMode.COPY:
                Logic.copy(this.getSegment(sIndex).data, this.getSegment(dIndex).data)
                break
            default:
                break
        }

        this.notify()
    }

    morphologyOperation = (option, ksize = 1) => {
        let operation = new Morphology()
        let segment = this.getFocusedSegment()

        if (segment == null) {
            return
        }

        let data = segment.data
        let dims = segment.dims
        
        switch (option) {
            case SegmentManager.morphMode.ERODE:
                operation.erode(dims, data, ksize)
                break
            case SegmentManager.morphMode.DILATE:
                operation.dilate(dims, data, ksize)
                break
            case SegmentManager.morphMode.MEDIUM:
                operation.medium(dims, data, ksize)
                break
            case SegmentManager.morphMode.GAUSSIAN:
                operation.gaussian(dims, data, ksize)
                break
            case SegmentManager.morphMode.OPEN:
                operation.open(dims, data, ksize)
                break
            case SegmentManager.morphMode.CLOSE:
                operation.close(dims, data, ksize)
                break
        }

        this.notify()
    }

    moveUp(index) {
        if (index > 0 && index < this.segState.segments.length) {
            let tmp = this.segState.segments[index - 1]
            this.segState.segments[index - 1] = this.segState.segments[index]
            this.segState.segments[index] = tmp
        }
    }

    moveDown(index) {
        if (index >= 0 && index < this.segState.segments.length - 1) {
            let tmp = this.segState.segments[index + 1]
            this.segState.segments[index + 1] = this.segState.segments[index]
            this.segState.segments[index] = tmp
        }
    }

    moveTop(index) {
        if (index >= 0 && index < this.segState.segments.length) {
            let tmp = this.segState.segments[index]
            this.segState.segments.splice(index, 1)
            this.segState.segments.splice(0, 0, tmp)
        }
    }

    moveDown(index) {
        let tmp = this.segState.segments[index]
        this.segState.segments.splice(index, 1)
        this.segState.segments.splice(this.segState.segments.length, 0, tmp)
    }

    
}

class Segment {
    /**
     * 
     * @param {any} name used for segment identity
     * @param {any} dims 3 dimentions: x, y, z
     * @param {any} color used for segment identity
     */
    constructor(name, dims, color, visible = true) {
        this.dims = dims
        this.name = name
        this.color = color
        this.data = new Uint8Array(dims[0] * dims[1] * dims[2]).fill(0)
        this.alpha = new Uint8Array(dims[0] * dims[1] * dims[2]).fill(0)
        this.used = false
        this.visible = visible
    }

    setBuffer(axis, index, buffer) {
        imgWriter(axis, this.dims, this.data, index, buffer)
    }

    getBuffer(axis, index) {
        return imgLoader(axis, this.dims, this.data, index)
    }

    getLayer() {
        return this.dims[2]
    }
}

export { Segment, SegmentManager, MaskImage }