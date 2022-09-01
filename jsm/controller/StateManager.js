import * as Opt from './MaskProcessingTools.js'
import { Segment, ImageData } from '../model/Segment.js'
import { MaskImage } from "../model/MaskImage.js"

class SLController {
    constructor(state) {
        //steps

        this.startStep = 0
        this.endStep = 1
        this.currentStep = 1
        this.length = 20

        this.tmpSegment = new Segment('tmp', state.volume.dims, null, false)

        this.mode = {
            NONE: -1,
            INITIAL: 0,
            addSeg: 1,
            removeSeg: 2,
            modifySeg: 3,
            changeIndex: 4,
            cropImg: 5
        }

        this.stack = new Array(this.length).fill(0).map(() => {
            return {
                action: this.mode.NONE,
                content: null,
                cropped: null,
                index: -1,
            }
        })

        this.onload = () => { }
        this.state = state
    }

    get undoEnable() {
        let limit = (this.startStep + 1) % this.length
        return limit != this.currentStep
    }

    get redoEnable() {
        return this.currentStep != this.endStep
    }

    setStackSeg(segment) {
        if (segment === null) {
            //do nothing
        }
        else if (this.stack[this.currentStep].content === null) {
            this.stack[this.currentStep].content = segment.clone();
        }
        else {
            this.stack[this.currentStep].content.copyfrom(segment);
        }
    }

    save(action) {

        this.currentStep = (this.currentStep + 1) % this.length
        this.endStep = this.currentStep

        if (this.endStep == this.startStep) {
            this.startStep = (this.startStep + 1) % this.length
        }

        this.stack[this.currentStep].action = action

        switch (action) {
            case this.mode.addSeg:
            case this.mode.removeSeg:
            case this.mode.modifySeg:
                this.stack[this.currentStep].index = this.state.focusedSegIndex
                this.setStackSeg(this.state.focusedSegment)
                break
            case this.mode.cropImg:
                break
        }

        this.onload(this.undoEnable, this.redoEnable)
    }

    undo() {
        if (!this.undoEnable) {
            return
        }

        let stk = this.stack[this.currentStep]

        switch (stk.action) {
            case this.mode.addSeg:
                this.setStackSeg(this.state.segments[stk.index + 1])

                this.state.segments.splice(stk.index + 1, 1)
                this.state.focusedSegIndex = stk.index

                break
            case this.mode.removeSeg:

                this.state.segments.splice(stk.index, 0, stk.content.clone())
                this.state.focusedSegIndex = stk.index
                break
            case this.mode.modifySeg:

                //設置上一步驟的focused index
                this.state.focusedSegIndex = stk.index

                //暫存當前狀態
                this.tmpSegment.copyfrom(this.state.focusedSegment)

                //設置上一步驟的內容
                this.state.focusedSegment.copyfrom(stk.content)

                //設置上一步驟為暫存內容
                this.setStackSeg(this.tmpSegment)
                break
            case this.mode.cropImg:
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
                this.state.segments.splice(stk.index + 1, 0, stk.content.clone())
                this.state.focusedSegIndex = stk.index + 1
                break
            case this.mode.removeSeg:
                this.state.segments.splice(stk.index, 1)
                this.state.focusedSegIndex = stk.index - 1
                break
            case this.mode.modifySeg:
                //設置回undo前的focused index
                this.state.focusedSegIndex = stk.index

                //暫存當前狀態
                this.tmpSegment.copyfrom(this.state.focusedSegment)

                //設置為undo前的內容
                this.state.focusedSegment.copyfrom(stk.content)

                //使用暫存內容還原stack
                this.setStackSeg(this.tmpSegment)
                break
            case this.mode.cropImg:
                break
        }

        this.onload(this.undoEnable, this.redoEnable)
    }
}

class StateManager {

    constructor(state) {
        let uvdDims = state.volume.dims
        
        this.maskImages = [
            new MaskImage(state, 0, uvdDims[0], uvdDims[1]),
            new MaskImage(state, 1, uvdDims[0], uvdDims[2]),
            new MaskImage(state, 2, uvdDims[1], uvdDims[2])
        ]

        this.events = []

        this.mode = {
            NONE: 0,
            BRUSH: 1,
            THRESHOLD: 2,
            MORPH: 3,
            LOGIC: 4,
            REGIONGROW: 5,
            SCISSOR: 6,
            ML: 7,
            SIZEBASED: 8,
            TRANSFER: 9
        }

        this.selectedMode = this.mode.NONE
        this.state = state

        this.slc = new SLController(this.state)//存檔/讀檔控制

        this.cropTools = new Opt.CropTools(this.state, this.maskImages)
        this.cropTools.enable = true
        this.cropTools.onload = () => {
            this.notify('segmentUpdate')
        }

        this.listControlTools = new Opt.ListControlTools(this.state, this.maskImages)
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
            this.notify('segmentUpdate')
        }

        this.logicTools = new Opt.LogicTools(this.state)
        this.logicTools.onstart = () => {
            this.slc.save(this.slc.mode.modifySeg)
        }
        this.logicTools.onload = () => {
            this.notify('segmentUpdate')
        }

        this.brushTools = new Opt.BrushTools(this.state, this.maskImages)
        this.brushTools.onstart = () => {
            this.slc.save(this.slc.mode.modifySeg)
        }
        this.brushTools.onload = () => {
            this.notify('segmentUpdate')
        }

        this.filterTools = new Opt.FilterTools(this.state)
        this.filterTools.onstart = () => {
            this.slc.save(this.slc.mode.modifySeg)
        }
        this.filterTools.onload = () => {
            this.notify('segmentUpdate')
        }

        this.regionGrowing = new Opt.GrowingTools(this.state, this.maskImages)
        this.regionGrowing.onstart = () => {
            this.slc.save(this.slc.mode.modifySeg)
        }
        this.regionGrowing.onload = () => {
            this.notify('segmentUpdate')
        }

        this.thresholdTools = new Opt.ThresholdTools(this.state)
        this.thresholdTools.onstart = () => {
            this.slc.save(this.slc.mode.modifySeg)
        }
        this.thresholdTools.onload = () => {
            this.notify('segmentUpdate')
        }

        let domElement = document.getElementById('transfer_layout')
        this.transferTools = new Opt.TransferTools2(this.state, domElement)
        this.transferTools.onstart = () => {
            this.slc.save(this.slc.mode.modifySeg)
        }
        this.transferTools.onload = () => {
            this.notify('segmentUpdate')
        }

        domElement = document.getElementById('tool_sizebased_histogram')
        this.sizeBasedTools = new Opt.SizeBasedTools(this.state, domElement)
        this.sizeBasedTools.onstart = () => {
            this.slc.save(this.slc.mode.modifySeg)
        }
        this.sizeBasedTools.onload = () => {
            this.notify('segmentUpdate')
        }

        domElement = document.getElementById('dcmViewer')
        this.scissorTools = new Opt.ScissorTools(this.state, domElement)
        this.scissorTools.onstart = () => {
            this.slc.save(this.slc.mode.modifySeg)
        }
        this.scissorTools.onload = () => {
            this.notify('segmentUpdate')
        }


        this.updatevolume()
    }

    disableAll() {
        this.logicTools.enable = false
        this.brushTools.enable = false
        this.filterTools.enable = false
        this.regionGrowing.enable = false
        this.thresholdTools.enable = false
        this.scissorTools.enable = false
        this.transferTools.enable = false
        this.sizeBasedTools.enable = false
    }

    enable() {
        this.setManagerTools(this.selectedMode)
    }

    // 更新CT影像中的資料
    updatevolume() {

        return new Promise((resolve) => {
            this.state.volumeReset()
            this.state.generate(() => {
                this.notify('imageUpdate')
                resolve()
            })
        })

    }

    updateColorMap() {
        this.notify('colormap')
    }

    setManagerToolsByKey(key, enabled = true){
        let mode = this.mode[key]
        this.setManagerTools(mode, enabled)
    }

    setManagerTools(option, enabled = true) {
        this.disableAll()

        switch (option) {
            case this.mode.BRUSH:
                this.selectedMode = option
                this.brushTools.enable = enabled
                break
            case this.mode.THRESHOLD:
                this.selectedMode = option
                this.thresholdTools.enable = enabled
                this.transferTools.enable = enabled
                break
            case this.mode.MORPH:
                this.selectedMode = option
                this.filterTools.enable = enabled
                break
            case this.mode.REGIONGROW:
                this.selectedMode = option
                this.regionGrowing.enable = enabled
                break
            case this.mode.LOGIC:
                this.selectedMode = option
                this.logicTools.enable = enabled
                break
            case this.mode.NONE:
                this.selectedMode = option
                break
            case this.mode.SCISSOR:
                this.selectedMode = option
                this.scissorTools.enable = enabled
                break
            case this.mode.ML:
                this.selectedMode = option
                //this.scissorTools.enable = enabled
                break
            case this.mode.SIZEBASED:
                this.selectedMode = option
                this.sizeBasedTools.enable = enabled
                break
            default:
                this.selectedMode = this.mode.NONE
        }
    }

    getFocusedLayer(axis) {
        let segment = this.state.focusedSegment
        let image = this.maskImages[axis]
        let index = image.index

        if (segment == null || index == -1) {
            return null
        }

        let data = image.getLayerImage(0)

        return segment.binaryLoader(axis, index, data)
    }

    setFocusedLayer(axis, index = this.maskImages[axis].index) {

        if (this.state.volume == null) {
            return
        }

        let image = this.maskImages[axis]
        this.maskImages[axis].index = index

        //取得canvas data
        let imgdata = image.getBaseImage()

        //從3D中取出指定層數的2D影像，以canvas data保存
        this.state.volume.imgLoader(axis, index, imgdata)

        if (this.state.volume.used) {
            for (let i = 0, j = 0; i < data.length; i += 4, j++) {
                data[i + 3] = this.state.volume.alpha[j]
            }
        }

        //將canvas data存回canvas中
        image.setBaseImage(imgdata)

        while (image.layers.length > this.state.segments.length) {
            image.removeLayer()
        }

        while (image.layers.length < this.state.segments.length) {
            image.addLayer()
        }

        let color, pixelData, segment
        for (let i = 0; i < this.state.segments.length; i++) {
            segment = this.state.segments[i]
            color = segment.color
            pixelData = image.getLayerImage(i)

            segment.binaryLoader(axis, index, pixelData)

            image.setLayerImage(i, pixelData, color)
        }

        image.update()
    }

    addNotifyEvent = (event, type = 'none') => {
        if (this.events[type] == null) {
            this.events[type] = []
        }

        let index = this.events[type].findIndex((e) => {
            return e === event
        })

        if (index != -1)
            return

        this.events[type].push(event)
    }

    removeNotifyEvent = (event, type = 'none') => {
        if (this.events[type] == null) {
            return
        }

        let index = this.events[type].findIndex((e) => {
            return e === event
        })
        if (index == -1)
            return

        this.events[type].splice(index, 1)
    }

    notify(type = 'none') {

        if (this.events[type] == null) {
            return
        }

        for (let event of this.events[type]) {
            event()
        }
    }

}

export { StateManager }