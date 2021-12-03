import { RegionGrowing, SizeBased, Logic, Scissor, Morphology } from "./Functions.js"
import { Segment } from './Segment.js'

let getMousePos = (canvas, evt) => {
    let rect = canvas.getBoundingClientRect()
    let scaleX = (evt.clientX - rect.left) * (canvas.width / rect.width)
    let scaleY = (evt.clientY - rect.top) * (canvas.height / rect.height)
    let intX = parseInt(scaleX)
    let intY = parseInt(scaleY)
    return [intX, intY]
}

class SegTools {
    constructor(segState, enable = false) {
        this.segState = segState
        this.onstart = () => {}
        this.onload = () => {}
        this.mode = {}
        this.state = -1
        this.enable = enable
    }
}

class BrushTools extends SegTools {
    constructor(segState, maskImages) {
        super(segState)

        this.mode = {
            NONE: -1,
            MARK: 0,
            ERASER: 1
        }

        this.state = this.mode.MARK
        this.maskImages = maskImages
        this.radius = 5

        let hover = false
        let pressing = false
        let penPosition = []

        maskImages.forEach((mimg, axis) => {
            mimg.domElement.addEventListener('mouseenter', (evt) => {
                if (!this.enable) {
                    return
                }

                evt.preventDefault()
                hover = true
            })

            mimg.domElement.addEventListener('mousedown', (evt) => {
                if (!this.enable) {
                    return
                }

                evt.preventDefault()
                pressing = true

                let color = this.segState.segments[this.segState.focusedSegIndex].color
                mimg.setMaskColor(this.segState.focusedSegIndex, color)
            })

            mimg.domElement.addEventListener('mousemove', (evt) => {
                if (!this.enable) {
                    return
                }

                evt.preventDefault()
                if (!pressing || !hover) {
                    return
                }

                penPosition = getMousePos(mimg.domElement, evt)
                if (this.state == this.mode.MARK) {
                    mimg.setMaskTrack(this.segState.focusedSegIndex, penPosition, this.radius, false)
                }

                else if (this.state == this.mode.ERASER) {
                    mimg.setMaskTrack(this.segState.focusedSegIndex, penPosition, this.radius, true)
                }

                mimg.update()
            })

            mimg.domElement.addEventListener('mouseup', (evt) => {
                if (!this.enable) {
                    return
                }

                evt.preventDefault()
                pressing = false

                let index = this.segState.focusedSegIndex
                let img = mimg.getLayerImage(index)
                let segment = this.segState.focusedSegment

                if (segment == null) {
                    return
                }

                this.onstart()

                segment.setBuffer(axis, mimg.index, img.data)

                this.onload()
            })

            mimg.domElement.addEventListener('mouseleave', (evt) => {
                if (!this.enable) {
                    return
                }

                evt.preventDefault()
                hover = false
            })
        })
    }
}

class LogicTools extends SegTools {
    constructor(segState) {
        super(segState)
        this.mode = {
            NONE: -1,
            INTERSECTION: 0,
            EXCLUSIVE: 1,
            UNION: 2,
            BOOLEAN: 3,
            COPY: 4
        }
        this.state = this.mode.INTERSECTION
    }

    process = (sIndex) => {
        if (!this.enable) {
            return
        }

        let segment = this.segState.focusedSegment
        let index = this.segState.focusedSegIndex

        if (index == null || sIndex == -1 || index == sIndex) {
            console.log(index, sIndex)
            return
        }

        if (sIndex >= this.segState.segments.length || sIndex < 0) {
            console.log(1)
            return
        }

        this.onstart()

        let sData = this.segState.segments[sIndex].data
        let dData = segment.data
        console.log(this.state)
        switch (this.state) {
            case this.mode.INTERSECTION:
                Logic.intersection(sData, dData)
                break
            case this.mode.EXCLUSIVE:
                Logic.exclusive(sData, dData)
                break
            case this.mode.UNION:
                Logic.union(sData, dData)
                break
            case this.mode.BOOLEAN:
                Logic.boolean(sData, dData)
                break
            case this.mode.COPY:
                Logic.copy(sData, dData)
                break
            default:
                break
        }

        this.onload()
    }
}

class MorphologyTools extends SegTools {
    constructor(segState) {
        super(segState)
        this.mode = {
            ERODE: 0,
            DILATE: 1,
            MEDIUM: 2,
            GAUSSIAN: 3,
            CLOSE: 4,
            OPEN: 5
        }
        this.state = this.mode.ERODE
        this.ksize = 1
    }

    process = () => {
        if (!this.enable) {
            return
        }

        let operation = new Morphology()

        let index = this.segState.focusedSegIndex
        let segment = this.segState.focusedSegment

        if (index == -1 || segment == null) {
            return
        }

        this.onstart()

        let data = segment.data
        let dims = segment.dims

        switch (this.state) {
            case this.mode.ERODE:
                operation.erode(dims, data, this.ksize)
                break
            case this.mode.DILATE:
                operation.dilate(dims, data, this.ksize)
                break
            case this.mode.MEDIUM:
                operation.medium(dims, data, this.ksize)
                break
            case this.mode.GAUSSIAN:
                operation.gaussian(dims, data, this.ksize)
                break
            case this.mode.OPEN:
                operation.open(dims, data, this.ksize)
                break
            case this.mode.CLOSE:
                operation.close(dims, data, this.ksize)
                break
        }

        this.onload()
    }
}

class RegionGrowTools extends SegTools {
    constructor(segState, maskImages) {
        super(segState)
        this.mode = {
            NORMAL: -1,
            PRESERVE: 0,
            REMOVE: 1,
            GROW: 2,
            SHRINK: 3
        }
        this.state = this.mode.NORMAL
        this.bias = 0
        this.margin = 0

        maskImages.forEach((mimg, index) => {
            mimg.domElement.addEventListener('click', (evt) => {

                let pos = getMousePos(mimg.domElement, evt)
                switch (index) {
                    case axisUV:
                        this.process(pos[0], pos[1], mimg.index, this.bias)
                        break
                    case axisUD:
                        this.process(pos[0], mimg.index, pos[1], this.bias)
                        break
                    case axisVD:
                        this.process(this.segState.base.dims[0] - mimg.index - 1, pos[0], pos[1], this.bias)
                        break
                    default:
                        break
                }
            })
        })

    }

    process = (x, y, layerIndex) => {
        if (!this.enable) {
            return
        }

        let index = this.segState.focusedSegIndex
        let segment = this.segState.focusedSegment

        if (index == -1 || segment == null) {
            return
        }

        this.onstart()

        let segData = segment.data
        let baseData = this.segState.base.data
        let dims = this.segState.base.dims
        let mask = null

        let checkExist = () => {
            let index = layerIndex * dims[1] * dims[0] + y * dims[0] + x
            if (segData[index] == 0) {
                console.log('No target')
                return false
            }
            return true
        }

        switch (this.state) {
            case this.mode.NORMAL:
                mask = RegionGrowing.process(x, y, layerIndex, baseData, dims, this.bias, this.margin)
                Logic.union(mask, segData)
                break
            case this.mode.PRESERVE:
                if (!checkExist) {
                    return
                }

                mask = RegionGrowing.process(x, y, layerIndex, segData, dims, this.bias, this.margin)
                segData.set(mask)
                break
            case this.mode.REMOVE:
                if (!checkExist) {
                    return
                }

                mask = RegionGrowing.process(x, y, layerIndex, segData, dims, this.bias, this.margin)
                Logic.boolean(mask, segData)
                break
            case this.mode.GROW:
                mask = RegionGrowing.process(x, y, layerIndex, segData, dims, this.bias, this.margin)
                segData.set(mask)
                break
            case this.mode.SHRINK:
                break
            default:
                console.error('Function not supporet.')
                break
        }

        this.onload()
    }
}

class CropTools extends SegTools {
    constructor(segState) {
        super(segState)
        this.mode = {
            CROP: 0,
            RESET: 1
        }
        this.ratio = 1
        this.state = this.mode.CROP
        let backup = new Segment('backup', [1,1,1], null, false)

        let maskUpCylinder = function (volDims, ratio) {

            let mask = buildMask()
            let r = parseInt(volDims[0] * ratio / 2)

            for (let j = parseInt(volDims[1] / 2 - r); j < parseInt(volDims[1] / 2 + r); j++) {
                let limit = Math.pow(r, 2) - Math.pow(j - volDims[1] / 2, 2)
                limit = Math.sqrt(limit) + volDims[0] / 2
                limit = parseInt(limit)
                for (let k = volDims[0] - limit; k < limit; k++) {
                    mask[j][k] = 1
                }
            }

            return mask
        }

        let maskUpBox = function (volDims, width, height, depth) {
            let mask = buildMask(volDims)
            let i, j, k
            let limit_i = volDims[2] * depth / 2
            let limit_j = volDims[1] * height / 2
            let limit_k = volDims[0] * width / 2

            for (i = volDims[2] / 2 - limit_i; i < volDims[2] / 2 + limit_i; i++) {
                for (j = volDims[1] / 2 - limit_j; j < volDims[1] / 2 + limit_j; j++) {
                    for (k = volDims[0] / 2 - limit_k; k < volDims[0] / 2 + limit_k; k++) {
                        mask[parseInt(i)][parseInt(j)][parseInt(k)] = 1
                    }
                }
            }

            return mask
        }

        let maskUpShape = function (dims, pDims, cameraPos, pixelData) {

        }
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

        this.process = () => {
            if (!this.enable) {
                return
            }

            if (this.segState.base == null) {
                return
            }          

            if (this.state == this.mode.RESET && backup == null) {
                return
            }

            this.onstart()

            switch (this.state) {
                case this.mode.CROP:

                    let dims = this.segState.base.dims
                    let segData = this.segState.base.data
                    
                    backup.copyfrom(this.segState.base)

                    let mask = maskUpSphere(dims, this.ratio)
                    maskUp2(segData, [mask])
                    break
                case this.mode.RESET:
                    this.segState.base.data.set(backup.data)
                    break
            }

            this.onload()
        }
    }
}

class SizeBasedTools extends SegTools {
    constructor(segState) {
        super(segState)
    }

    process() {
        if (!this.enable) {
            return
        }

        this.onstart()

        let alphaData = this.segState.base.alpha
        let sb = new SizeBased(this.segState.base.data, this.segState.base.dims)
        alphaData.set(sb.process())

        this.onload()
    }
}

class ScissorTools extends SegTools {
    constructor(segState) {
        super(segState)
    }

    process(camera, img) {
        if (!this.enable) {
            return
        }

        let dims = this.segState.base.dims
        let ss = new Scissor(dims)
        let mask = ss.process(camera, img)

        let seg = this.getFocusedSegment()

        if (seg == null) {
            return
        }

        let segData = seg.data

        this.onstart()

        Logic.union(segData, mask)

        this.onload()
    }
}

class ThresholdTools extends SegTools {
    constructor(segState) {
        super(segState)
        this.l_limit = 0
        this.r_limit = 0
    }

    process() {
        console.log('ttt')
        if (!this.enable) {
            return
        }
        console.log('ttk')
        let index = this.segState.focusedSegIndex
        let segment = this.segState.focusedSegment

        if (index == -1 || segment == null) {
            
            return
        }
console.log(index, segment)
        let baseData = this.segState.base.data
        let segData = segment.data

        if (baseData.length != segData.length) {
            console.error('Segment / Image buffer out of range.')
            return
        }

        this.onstart()

        for (let i = 0; i < baseData.length; i++) {
            segData[i] = 0
            if (baseData[i] >= this.l_limit && baseData[i] <= this.r_limit) {
                segData[i] = 255
            }
        }
       

        this.onload()
    }
}

class ListControlTools extends SegTools {
    constructor(segState, maskImages) {
        super(segState, true)
        this.mode = {
            CREATE: 0,
            REMOVE: 1,
            MOVEUP: 2,
            MOVEDOWN: 3,
            MOVETOP: 4,
            MOVEBOTTOM: 5
        }
        this.colorList = ['#FF0000', '#00FF00', '#0000FF', '#F0F0F0', '#0F0F0F']

        let create = () => {
            if (this.segState.base == null) {
                alert('image data not load!')
                return false
            }

            this.onstart(true)

            let color = this.colorList[this.segState.segments.length % this.colorList.length]
            let dims = [...this.segState.base.dims]
            let newSeg = new Segment('Segment', dims, color)
            this.segState.segments.splice(this.segState.focusedSegIndex + 1, 0, newSeg)
            this.segState.focusedSegIndex++

            this.onload()

            maskImages.forEach((mimg) => {
                mimg.addLayer()
            })

            return true
        }

        let remove = () => {
            let index = this.segState.focusedSegIndex

            if (index == -1) {
                return false
            }

            this.onstart(false)

            this.segState.segments.splice(index, 1)
            this.segState.focusedSegIndex--

            this.onload()

            maskImages.forEach((mimg) => {
                mimg.removeLayer(index)
            })

            return true
        }

        let moveUp = () => {
            let index = this.segState.focusedSegIndex

            if (index < 1) {
                return false
            }

            this.onstart()

            let tmp = this.segState.segments[index - 1]
            this.segState.segments[index - 1] = this.segState.segments[index]
            this.segState.segments[index] = tmp

            this.onload()

            return true
        }

        let moveDown = () => {
            let index = this.segState.focusedSegIndex

            if (index == -1 || index == this.segState.segments.length - 1) {
                return false
            }

            this.onstart()

            let tmp = this.segState.segments[index + 1]
            this.segState.segments[index + 1] = this.segState.segments[index]
            this.segState.segments[index] = tmp

            this.onload()

            return true
        }

        let moveTop = () => {
            if (index < 1) {
                return false
            }

            this.onstart()

            let tmp = this.segState.segments[index]
            this.segState.segments.splice(index, 1)
            this.segState.segments.splice(0, 0, tmp)

            this.onload()

            return true
        }

        let moveBottom = () => {
            let index = this.segState.focusedSegIndex

            if (index == -1 || index == this.segState.segments.length - 1) {
                return false
            }

            this.onstart()

            let tmp = this.segState.segments[index]
            this.segState.segments.splice(index, 1)
            this.segState.segments.splice(this.segState.segments.length, 0, tmp)

            this.onload()

            return true
        }

        this.process = () => {
            if (!this.enable) {
                return
            }

            switch (this.state) {
                case this.mode.CREATE:
                    create()
                    break
                case this.mode.REMOVE:
                    remove()
                    break
                case this.mode.MOVEUP:
                    moveUp()
                    break
                case this.mode.MOVEDOWN:
                    moveDown()
                    break
                case this.mode.MOVETOP:
                    moveTop()
                    break
                case this.mode.MOVEBOTTOM:
                    moveBottom()
                    break
            }
            
        }
    }
}

export { ListControlTools, BrushTools, ThresholdTools, RegionGrowTools, MorphologyTools, LogicTools, CropTools, SizeBasedTools, ScissorTools }