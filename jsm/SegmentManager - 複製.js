import { RegionGrowing, SizeBased, Logic, Scissor } from "./Functions.js"
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

    constructor(canvas, segments) {
        this.domElement = canvas
        this.layers = segments
        this.base = null
        this.palatte = null
        this.context = null
        this.size = []
        this.compressedSize = []
        this.setMaskSize(canvas.width, canvas.height)
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
        let width = this.size[0]
        let height = this.size[1]
        let newW = this.domElement.parentElement.clientWidth
        let newH = this.domElement.parentElement.clientHeight

        if (width >= height) {
            let ratio = height / width
            let w = this.domElement.clientWidth
            newH = parseInt(w * ratio)
            this.domElement.style.width = '100%'
            this.domElement.style.height = 'auto'
        }
        else if (height > width) {
            let ratio = width / height
            let h = this.domElement.clientHeight
            newW = parseInt(h * ratio)
            this.domElement.style.width = 'auto'
            this.domElement.style.height = '100%'
        }

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
        let ctx = this.domElement.getContext('2d')
        ctx.drawImage(this.base, 0, 0)
        ctx.globalCompositeOperation = 'lighter'
        this.layers.forEach((layer) => {
            ctx.drawImage(layer.canvas, 0, 0)
        })

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
}

class SegmentManager {

    static managerTools = {
        NONE: 0,
        PEN: 1,
        ERASER: 2,
        THRESHOLD: 3,
        ISLAND: 4,
    }

    static logicMode = {
        INTERSECTION:0,
        EXCLUSIVE:1,
        UNION:2,
        BOOLEAN:3,
        COPY:4
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
        this.base = null
        this.state = SegmentManager.managerTools.NONE
        this.segments = new Array()
        this.focusedSegIndex = 0
        this.dataIndex = [0, 0, 0]
        this.bias = 0
        this.radius = 5
        this.regionMode = SegmentManager.regionMode.NONE
        this.previousStep = []
        this.nextStep = []
        this.onload = null
        this.segOrder = 0

        this.penPosition = new THREE.Vector2()
        maskImages.forEach((element, index) => {
            let domElement = element.domElement
            domElement.addEventListener('mouseenter', (evt) => {
                evt.preventDefault()
                this.hover = true
            })

            domElement.addEventListener('mousedown', (evt) => {
                evt.preventDefault()
                this.pressing = true
                if (this.state == SegmentManager.managerTools.PEN) {
                    this.startPaint(evt, true, index)
                }
                else if (this.state == SegmentManager.managerTools.ERASER) {
                    this.startPaint(evt, false, index)
                }
            })

            domElement.addEventListener('mousemove', (evt) => {
                evt.preventDefault()
                if (!this.pressing || !this.hover) {
                    return
                }
                if (this.state == SegmentManager.managerTools.PEN) {
                    this.onPainting(evt, index)
                }
                else if (this.state == SegmentManager.managerTools.ERASER) {
                    this.onPainting(evt, index)
                }
            })

            domElement.addEventListener('mouseup', (evt) => {
                evt.preventDefault()
                this.pressing = false
                if (this.state == SegmentManager.managerTools.PEN) {
                    this.endPainting(evt, index)
                }
                else if (this.state == SegmentManager.managerTools.ERASER) {
                    this.endPainting(evt, index)
                }
                else if (this.state == SegmentManager.managerTools.ISLAND) {
                    evt.preventDefault()
                    let pos = this.getMousePos(this.maskImages[index].domElement, evt)
                    switch (index) {
                        case axisUV:
                            this.island(pos[0], pos[1], this.dataIndex[index], this.bias)
                            break
                        case axisUD:
                            this.island(pos[0], this.dataIndex[index], pos[1], this.bias)
                            break
                        case axisVD:
                            this.island(this.base.dims[0] - this.dataIndex[index] - 1, pos[0], pos[1], this.bias)
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

        let state = []

        if (this.previousStep.length >= 30) {
            let prevState = this.previousStep.shift()
            for (let i = 0; i < this.state.length; i++) {
                prevState.name = null
                prevState.color = null
                prevState.data = null
                prevState.alpha = null
                prevState.dims = null
                prevState.used = null
            }
            prevState = null
        }

        for (let i = 0; i < this.segments.length; i++) {
            let segment = new Segment('', [0, 0, 0], '')
            segment.name = this.segments[i].name
            segment.color = this.segments[i].color
            segment.data = new Uint8Array(this.segments[i].data)
            segment.alpha = new Uint8Array(this.segments[i].alpha)
            segment.dims = this.segments[i].dims
            segment.used = this.segments[i].used
            state.push(segment)
        }

        this.previousStep.push(state)

        if (this.onload != null) {
            this.onload(this.previousStep, this.nextStep)
        }

    }

    forward() {
        if (this.previousStep.length <= 0) {
            return
        }

        this.nextStep.push(this.segments)
        let state = this.previousStep.pop()
        this.segments = state
        this.notify()

        if (this.onload != null) {
            this.onload(this.previousStep, this.nextStep)
        }

    }

    backward() {
        if (this.nextStep.length <= 0) {
            return
        }

        this.previousStep.push(this.segments)
        let state = this.nextStep.pop()
        this.segments = state
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
        return this.segments[this.focusedSegIndex]
    }

    colorList = ['#FF0000', '#00FF00', '#0000FF', '#F0F000', '#F00F00']
    addSegment() {
        this.save()
        
        let name = `Segment ${this.segOrder}`
        let color = this.colorList[this.segOrder % this.colorList.length]
        let dims = this.base.dims
        this.segOrder++
        this.segments.push(new Segment(name, dims, color))
        this.maskImages.forEach(element => element.addLayer())
    }

    removeSegment() {
        this.save()

        this.segments.splice(this.focusedSegIndex, 1)
        this.maskImages.forEach(element => element.removeLayer(this.focusedSegIndex))
        if (this.segments.length <= 0) {
            this.segOrder = 0
            this.setTools(SegmentManager.managerTools.NONE)
        }
        this.focusedSegIndex = this.segments.length - 1
    }

    setTools(index) {
        this.state = index
    }

    setFocusedSegment(index) {
        this.focusedSegIndex = index
    }

    setFocusedLayer(axis, index = this.dataIndex[axis]) {
        /*
        let dims = this.base.dims
        let baseData = this.base.data
        let image = this.maskImages[axis]
        this.dataIndex[axis] = index

        if (baseData == null) {
            return
        }

        let img = imgLoader(axis, dims, baseData, index)
        if (this.base.used) {
            for (let i = 0, j = 0; i < img.length; i += 4, j++) {
                img[i + 3] = this.base.alpha[j]
            }
        }
        image.setBufferImage(img)

        while (image.layers.length > this.segments.length) {
            image.removeLayer()
        }

        while (image.layers.length < this.segments.length) {
            image.addLayer()
        }

        for (let i = 0; i < this.segments.length; i++) {
            let color = this.segments[i].color
            let pixelData = this.segments[i].getBuffer(axis, index)
            image.setLayerImage(i, pixelData, color)
        }

        image.update()*/
        let image = this.maskImages[axis]
        image.setLayerImage()
        image.update()
    }

    setBaseSegment(dataBuffer, dims) {
        this.base = new Segment('base', dims, null)
        this.base.data = dataBuffer
    }

    getBaseSegment() {
        return this.base.data
    }

    getSegment(index) {
        return this.segments[index]
    }

    startPaint(evt, option, axis) {
        this.save()

        let color = '#000000'
        if (option == undefined || option) {
            color = this.segments[this.focusedSegIndex].color
        }

        this.penPosition = [evt.clientX, evt.clientY]
        this.maskImages[axis].setMaskColor(this.focusedSegIndex, color)
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
        this.maskImages[axis].setMaskTrack(this.focusedSegIndex, pos, this.radius)
        this.maskImages[axis].update()
    }

    endPainting(evt, axis) {
        let img = this.maskImages[axis].getLayerImage(this.focusedSegIndex)
        this.getFocusedSegment().setBuffer(axis, this.dataIndex[axis], img.data)
    }

    notify() {
        this.maskImages.forEach((_, index) => {
            this.setFocusedLayer(index)
        })
    }

    filter(l_limit, r_limit) {
        this.save()

        let baseData = this.base.data
        let segData = this.getFocusedSegment().data

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

    clip(mode, params) {
        this.save()

        let dims = this.base.dims
        let segment = this.getFocusedSegment()

        if (mode == 0) {
            let mask = maskUpSphere(dims, params.ratio)
            maskUp2(segment.data, [mask])
        }

        else if (mode == 1) {
            let mask = maskUpShape(dims, params, pixelData)
            maskUp2(segment.data, [mask])
        }

        this.notify()
    }

    island = (x, y, layerIndex, bias, margin=0) => {
        this.save()

        let segData = this.getFocusedSegment().data
        let baseData = this.base.data
        let dims = this.base.dims

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

        let alphaData = this.base.alpha
        let sb = new SizeBased(this.base.data, this.base.dims)
        alphaData.set(sb.process())

        this.notify()
    }

    scissor = (camera, img) => {
        let dims = this.base.dims
        let ss = new Scissor(dims)
        let mask = ss.process(camera, img)
        Logic.union(this.getFocusedSegment().data, mask)
        this.notify()
    }

    logicOperation = (sIndex, dIndex, option) => {
        this.save()

        if (sIndex >= this.segments.length || sIndex < 0 || dIndex >= this.segments.length || dIndex < 0) {
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
}

export { Segment, SegmentManager, MaskImage }