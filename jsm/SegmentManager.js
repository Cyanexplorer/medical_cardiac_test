import * as Opt from './Operation.js'
import { Segment, SegState } from './Segment.js'

class MaskImage {

    constructor(canvas, segState) {
        this.exposure = 1
        this.contrast = 1
        this.index = -1
        this.thickness = [1, 1]

        this.domElement = canvas
        this.palatte = null
        this.context = null
        
        this.layers = []
        this.baselayer = null
        this.segState = segState

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

        this.baselayer = document.createElement('canvas')
        this.baselayer.width = width
        this.baselayer.height = height

        this.context = this.baselayer.getContext('2d')
        this.palatte = this.context.getImageData(0, 0, width, height)
    }

    sizeReload() {
        //adjust element size
        let ratio = this.size[1]* this.thickness[1] / this.size[0]/ this.thickness[0]

        let newW = this.domElement.parentElement.clientWidth
        let newH = this.domElement.parentElement.clientHeight
        let nratio = newH / newW

        if (ratio > nratio) {
            newW = newH / ratio
        }
        else{
            newH = newW * ratio
        }

        this.domElement.style.width = `${newW }px`
        this.domElement.style.height = `${newH }px`
        //console.log(this.domElement.style.width, this.domElement.style.height)
        this.compressedSize = [newW, newH]
    }

    setBufferImage(buffer) {
        this.palatte.data.set(buffer)
        this.context.putImageData(this.palatte, 0, 0)
    }

    setLayerImage(index, pixelData, color) {
        //console.log(buffer)
        if (this.layers.length <= index || index < 0) {
            console.error('mask image: index out of range')
            return
        }

        let layer = this.layers[index]
        let palatte = layer.palatte
        let ctx = layer.context

        palatte.data.set(pixelData)
        ctx.putImageData(palatte, 0, 0)
        //console.log(color)
        if (color != null) {
            ctx.save()
            ctx.globalCompositeOperation = 'source-in'
            ctx.fillStyle = color
            ctx.beginPath()
            ctx.rect(0, 0, layer.width, layer.height)
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
                width: this.size[0],
                height: this.size[1],
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
        let fIndex = this.segState.focusedSegIndex

        let ctx = this.domElement.getContext('2d')

        ctx.filter = 'brightness(' + this.exposure + ') contrast(' + this.contrast +')'
        ctx.drawImage(this.baselayer, 0, 0)
        ctx.filter = 'none'
        //ctx.globalCompositeOperation = 'lighter'

        for (let i = 0; i < this.segState.segments.length; i++) {
            if (this.segState.segments[i].visible && i != fIndex)
                ctx.drawImage(this.layers[i].canvas, 0, 0)
        }

        if (fIndex != -1 && this.segState.segments[fIndex].visible)
            ctx.drawImage(this.layers[fIndex].canvas, 0, 0)

        //ctx.globalCompositeOperation = 'source-over'
    }

    setMaskTrack(index, pos, radius, erase = false) {
        let ctx = this.layers[index].context

        ctx.save()
        ctx.globalCompositeOperation = 'source-over'
        if (erase) {
            ctx.globalCompositeOperation = 'destination-out'
        }

        ctx.beginPath()
        ctx.arc(pos[0], pos[1], radius, 0, Math.PI * 2, 1)
        ctx.fill()
        ctx.restore()
    }

    getLayerImage(index) {
        let ctx = this.layers[index].context
        return ctx.getImageData(0, 0, this.size[0], this.size[1])
    }

    getBaseImage() {
        let ctx = this.baselayer.context
        return ctx.getImageData(0, 0, this.size[0], this.size[1])
    }

    toImgURL() {
        return this.baselayer.toDataURL()
    }
}

class SLController {
    constructor(segState) {
        //steps

        this.startStep = 0
        this.endStep = 1
        this.currentStep = 1
        this.length = 10

        this.tmpSegment = new Segment('tmp', [], null, false) 

        this.mode = {
            NONE: -1,
            INITIAL: 0,
            addSeg: 1,
            removeSeg: 2,
            modifySeg: 3,
            changeIndex: 4
        }

        this.stack = new Array(this.length).fill(0).map(() => {
            return {
                action: this.mode.NONE,
                content: null,
                index: -1,
            }
        })

        this.onload = () => { }
        this.segState = segState
    }

    get undoEnable() {
        let limit = (this.startStep + 1) % this.length
        return limit != this.currentStep
    }

    get redoEnable() {
        return this.currentStep != this.endStep
    }

    setStackSeg(segment) {
        if (segment == null) {
            //do nothing
        }
        else if (this.stack[this.currentStep].content == null) {
            this.stack[this.currentStep].content = segment.clone()
        }
        else {
            this.stack[this.currentStep].content.copyfrom(segment)
        }
    }

    // 保存受影響的Segment
    // action:操作類型
    // index:操作目標
    // segemnt:目標內容
    save(action) {

        this.currentStep = (this.currentStep + 1) % this.length
        this.endStep = this.currentStep

        if (this.endStep == this.startStep) {
            this.startStep = (this.startStep + 1) % this.length
        }

        this.stack[this.currentStep].action = action
        this.stack[this.currentStep].index = this.segState.focusedSegIndex

        this.setStackSeg(this.segState.focusedSegment)

        this.onload(this.undoEnable, this.redoEnable)
    }

    undo() {
        if (!this.undoEnable) {
            return
        }

        let stk = this.stack[this.currentStep]

        switch (stk.action) {
            case this.mode.addSeg:
                this.setStackSeg(this.segState.segments[stk.index + 1])

                this.segState.segments.splice(stk.index + 1, 1)
                this.segState.focusedSegIndex = stk.index
                
                break
            case this.mode.removeSeg:

                this.segState.segments.splice(stk.index, 0, stk.content.clone())
                this.segState.focusedSegIndex = stk.index
                break
            case this.mode.modifySeg:
                
                this.segState.focusedSegIndex = stk.index
                this.tmpSegment.copyfrom(this.segState.focusedSegment)
                
                this.segState.focusedSegment.copyfrom(stk.content)
                this.setStackSeg(this.tmpSegment)
                break
        }

        this.currentStep = (this.currentStep + this.length - 1) % this.length
        this.onload(this.undoEnable, this.redoEnable)
    }

    redo() {
        if (!this.redoEnable) {
            return
        }

        this.currentStep = (this.currentStep + 1) % this.length

        let stk = this.stack[this.currentStep]

        switch (stk.action) {
            case this.mode.addSeg:
                this.segState.segments.splice(stk.index + 1, 0, stk.content.clone())
                this.segState.focusedSegIndex = stk.index + 1
                break
            case this.mode.removeSeg:
                this.segState.segments.splice(stk.index, 1)
                this.segState.focusedSegIndex = stk.index - 1
                break
            case this.mode.modifySeg:
                this.segState.focusedSegIndex = stk.index
                this.tmpSegment.copyfrom(this.segState.focusedSegment)
                this.segState.focusedSegment.copyfrom(stk.content)
                this.setStackSeg(this.tmpSegment)
                break
        }

        this.onload(this.undoEnable, this.redoEnable)
    }
}


class SegmentManager {

    constructor(maskImages) {
        this.maskImages = maskImages

        this.mode = {
            NONE: 0,
            BRUSH: 1,
            THRESHOLD: 2,
            MORPH: 3,
            LOGIC:4,
            REGIONGROW: 5,
            SCISSOR: 6,
            ML: 7,
            SIZEBASED: 8
        }

        this.state = this.mode.NONE
        this.segState = new SegState()

        for (let i = 0; i < this.maskImages.length; i++) {
            this.maskImages[i].segState = this.segState
        }

        this.slc = new SLController(this.segState)

        this.cropTools = new Opt.CropTools(this.segState)
        this.cropTools.enable = true
        this.cropTools.onload = () => {
            this.notify()
        }

        this.listControlTools = new Opt.ListControlTools(this.segState, this.maskImages)
        this.listControlTools.enable = true
        this.listControlTools.onstart = (result) => {
            if (result == true) {
                this.slc.save(this.slc.mode.addSeg)
            }
            else if (result == false) {
                this.slc.save(this.slc.mode.removeSeg)
            }
            
        }
        this.listControlTools.onload = () => {
            this.notify()
        }

        this.logicTools = new Opt.LogicTools(this.segState)
        this.logicTools.onstart = () => {
            this.slc.save(this.slc.mode.modifySeg)
        }
        this.logicTools.onload = () => {
            this.notify()
        }

        this.brushTools = new Opt.BrushTools(this.segState, this.maskImages)
        this.brushTools.onstart = () => {
            this.slc.save(this.slc.mode.modifySeg)
        }
        this.brushTools.onload = () => {
            this.notify()
        }

        this.morphologyTools = new Opt.MorphologyTools(this.segState)
        this.morphologyTools.onstart = () => {
            this.slc.save(this.slc.mode.modifySeg)
        }
        this.morphologyTools.onload = () => {
            this.notify()
        }

        this.regionGrowing = new Opt.RegionGrowTools(this.segState, this.maskImages)
        this.regionGrowing.onstart = () => {
            this.slc.save(this.slc.mode.modifySeg)
        }
        this.regionGrowing.onload = () => {
            this.notify()
        }

        this.thresholdTools = new Opt.ThresholdTools(this.segState)
        this.thresholdTools.onstart = () => {
            this.slc.save(this.slc.mode.modifySeg)
        }
        this.thresholdTools.onload = () => {
            this.notify()
        }

        this.scissorTools = new Opt.ScissorTools(this.segState)
        this.scissorTools.onstart = () => {
            this.slc.save(this.slc.mode.modifySeg)
        }
        this.scissorTools.onload = () => {
            this.notify()
        }

    }

    disableAll() {
        this.logicTools.enable = false
        this.brushTools.enable = false
        this.morphologyTools.enable = false
        this.regionGrowing.enable = false
        this.thresholdTools.enable = false
        this.scissorTools.enable = false
    }

    setBaseSegment(dataBuffer, uvdDims) {
        this.segState.base = new Segment('base', uvdDims, null, true)
        this.segState.base.data.set(dataBuffer)
        //this.slc.save(this.slc.mode.INITIAL, null, this.segState.base)
    }

    setManagerTools(option) {
        this.disableAll()

        switch (option) {
            case this.mode.BRUSH:
                this.brushTools.enable = true
                break
            case this.mode.THRESHOLD:
                this.thresholdTools.enable = true
                break
            case this.mode.MORPH:
                this.morphologyTools.enable = true
                break
            case this.mode.REGIONGROW:
                this.regionGrowing.enable = true
                break
            case this.mode.LOGIC:
                this.logicTools.enable = true
                break
            case this.mode.NONE:
                break
            case this.mode.SCISSOR:
                this.scissorTools.enable = true
                break
            case this.mode.ML:
                this.scissorTools.enable = true
                break
            case this.mode.SIZEBASED:
                this.scissorTools.enable = true
                break
        }
    }
   
    getFocusedLayer(axis) {
        let seg = this.segState.focusedSegment
        let index = this.maskImages[axis].index

        if (seg == null || index == -1) {
            return null
        }

        return seg.getBuffer(axis, index)
    }

    setFocusedLayer(axis, index = this.maskImages[axis].index) {

        if (this.segState.base == null) {
            return
        }

        let image = this.maskImages[axis]
        this.maskImages[axis].index = index

        let img = this.segState.base.getBuffer(axis, index)
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

        for (let i = 0, color, pixelData; i < this.segState.segments.length; i++) {
            color = this.segState.segments[i].color
            pixelData = this.segState.segments[i].getBuffer(axis, index)
            image.setLayerImage(i, pixelData, color)
        }

        image.update()
    }

    notify() {
        this.maskImages.forEach((_, index) => {
            this.setFocusedLayer(index)
        })
    }
}

export { SegmentManager, MaskImage }