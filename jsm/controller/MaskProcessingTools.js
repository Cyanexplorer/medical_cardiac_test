import { Growing, SizeBased, Logic, Scissor, Kernel } from "./Algorithm.js"
import { Segment } from '../model/Segment.js'
import { SegTools } from "./template.js"
import { BinaryArray, BinaryArray3DContainer, TypedArray3DContainer } from "../model/ExtendedArray.js"

class MaskProcess {
    static trilinearScale = (inputData, outputData, inputDims, outputDims) => {
        let template = new BinaryArray3DContainer(inputData, inputDims[0], inputDims[1], inputDims[2], 0)

        let pos = 0
        let ratio = [inputDims[0] / outputDims[0], inputDims[1] / outputDims[1], inputDims[2] / outputDims[2]]

        for (let i = 0; i < outputDims[2]; i++) {
            let posz = i * ratio[2]
            let zmin = Math.floor(posz)
            let zmax = zmin + 1
            let fz = posz - zmin
            let ifz = 1 - fz

            for (let j = 0; j < outputDims[1]; j++) {
                let posy = j * ratio[1]
                let ymin = Math.floor(posy)
                let ymax = ymin + 1
                let fy = posy - ymin
                let ify = 1 - fy

                for (let k = 0; k < outputDims[0]; k++) {
                    let posx = k * ratio[0]
                    let xmin = Math.floor(posx)
                    let xmax = xmin + 1
                    let fx = posx - xmin
                    let ifx = 1 - fx

                    let cdf0 = template.getValue3D(xmin, ymin, zmin)
                    let cdf1 = template.getValue3D(xmax, ymin, zmin)
                    let cdf2 = template.getValue3D(xmin, ymax, zmin)
                    let cdf3 = template.getValue3D(xmax, ymax, zmin)
                    let cdf4 = template.getValue3D(xmin, ymin, zmax)
                    let cdf5 = template.getValue3D(xmax, ymin, zmax)
                    let cdf6 = template.getValue3D(xmin, ymax, zmax)
                    let cdf7 = template.getValue3D(xmax, ymax, zmax)

                    let out = ((ifx * cdf0 + fx * cdf1) * ify + (ifx * cdf2 + fx * cdf3) * fy) * ifz
                        + ((ifx * cdf4 + fx * cdf5) * ify + (ifx * cdf6 + fx * cdf7) * fy) * fz

                    outputData[pos++] = out * 255
                }
            }
        }
    }

    constructor() {

    }
}

class BrushTools extends SegTools {
    constructor(state, maskImages) {
        super(state)

        this.mode = {
            NONE: -1,
            MARK: 0,
            ERASER: 1,
            '3DMARK': 2,
            '3DERASER': 3
        }

        this.selectedMode = this.mode.MARK
        this.maskImages = maskImages
        this._radius = 5
        this._radius3D = []

        this.updateRaius3D = () => {
            this._radius3D = new Array()

            for (let i = 0; i < this.radius; i++) {
                let r = Math.pow(this.radius, 2) - Math.pow(this.radius - i, 2)
                r = Math.sqrt(r)
                this._radius3D.push(r)
            }

            this._radius3D.push(this.radius)

            for (let i = this.radius - 1; i >= 0; i--) {
                this._radius3D.push(this._radius3D[i])
            }

            //console.log(this._radius3D)
        }

        this.updateRaius3D()

        let penPosition = []
        let fIndex = -1
        let color = '#000000'
        let mouseMoveEvent = new Event('mousemove')

        maskImages.forEach((mimg, axis) => {
            let selectedMode = 0

            let process = () => {

                if (this.selectedMode == this.mode.MARK) {
                    let segment = this.state.focusedSegment

                    mimg.setMaskTrack(fIndex, penPosition, this.radius, color, false)
                    let data = mimg.getLayerImage(fIndex)

                    segment.binaryWriter(axis, mimg.index, data)
                    segment.binaryLoader(axis, mimg.index, data)

                    mimg.setLayerImage(fIndex, data, color)
                }

                else if (this.selectedMode == this.mode['3DMARK']) {
                    for (let i = 0; i < this._radius3D.length; i++) {
                        let r = this._radius3D[i]
                        let index = Math.round(fIndex - this.radius + i)
                        mimg.setMaskTrack(index, penPosition, r, color, false)
                    }
                }

                else if (this.selectedMode == this.mode.ERASER) {
                    let segment = this.state.focusedSegment

                    mimg.setMaskTrack(fIndex, penPosition, this.radius, color, true)
                    let data = mimg.getLayerImage(fIndex)

                    segment.binaryWriter(axis, mimg.index, data)
                    mimg.setLayerImage(fIndex, data, color)
                }
            }

            mimg.controller.addEventListener('pointerdown', (evt) => {
                if (!this.enable) {
                    return
                }

                //檢查滑鼠按鍵狀態
                if (evt.buttons == 1 && evt.button == 0) {
                    this.onstart()
                    selectedMode = 1
                    process()
                }

            })

            mimg.controller.addEventListener('pointermove', (evt) => {
                if (!this.enable) {
                    return
                }

                penPosition = getMousePos(mimg.controller, evt)

                mimg.clearControllerTrack()
                mimg.setControllerTrack(penPosition, this.radius, 'rgba(255,255,255,0.6)')

                if (selectedMode != 1) {
                    return
                }

                //檢查滑鼠按鍵狀態
                if (evt.buttons == 1 && evt.button == -1) {
                    process()
                    mimg.update()
                }
            })

            mimg.controller.addEventListener('pointerenter', (evt) => {
                if (!this.enable) {
                    return
                }

                fIndex = this.state.focusedSegIndex
                color = this.state.segments[fIndex].color

                mimg.clearControllerTrack()
            })

            mimg.controller.addEventListener('pointerleave', (evt) => {
                if (!this.enable) {
                    return
                }

                mimg.clearControllerTrack()
            })


            window.addEventListener('pointerup', (evt) => {
                if (!this.enable) {
                    return
                }

                if (selectedMode == 0) {
                    return
                }

                this.onload()

                selectedMode = 0
            })
        })
    }

    get radius() {
        return this._radius
    }

    set radius(r) {
        this._radius = r
        this.updateRaius3D()
    }
}

class LogicTools extends SegTools {
    constructor(state) {
        super(state)
        this.mode = {
            NONE: -1,
            INTERSECTION: 0,
            EXCLUSIVE: 1,
            UNION: 2,
            BOOLEAN: 3,
            COPY: 4,
            OVERLAY_TRUE: 5,
            OVERLAY_FALSE: 6
        }
        this.selectedMode = this.mode.INTERSECTION
    }

    process = (sIndex) => {
        if (!this.enable) {
            return
        }

        let segment = this.state.focusedSegment
        let index = this.state.focusedSegIndex

        if (index == null || sIndex == -1 || index == sIndex) {
            //console.log(index, sIndex)
            return
        }

        if (sIndex >= this.state.segments.length || sIndex < 0) {
            //console.log(1)
            return
        }

        this.onstart()

        let sData = this.state.segments[sIndex].data
        let dData = segment.data
        //console.log(this.selectedMode)
        switch (this.selectedMode) {
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
            case this.mode.OVERLAY_TRUE:
                Logic.overlay(sData, dData, true)
                break
            case this.mode.OVERLAY_FALSE:
                Logic.overlay(sData, dData, false)
                break
            default:
                break
        }

        this.onload()
    }
}

class FilterTools extends SegTools {
    constructor(state) {
        super(state)
        this.mode = {
            ERODE: 0,
            DILATE: 1,
            MEDIUM: 2,
            GAUSSIAN: 3,
            CLOSE: 4,
            OPEN: 5,
            EDGEDETECTION: 6
        }
        this.selectedMode = this.mode.ERODE
        this.psize = 1

        let operation = new Kernel(state.info.dims)

        this.process = async () => {

            return new Promise(async (resolve, reject) => {
                if (!this.enable) {
                    reject()
                    return
                }



                let index = this.state.focusedSegIndex
                let segment = this.state.focusedSegment

                if (index == -1 || segment == null) {
                    return
                }

                this.onstart()

                switch (this.selectedMode) {
                    case this.mode.ERODE:
                        await operation.erode(segment)
                        break
                    case this.mode.DILATE:
                        await operation.dilate(segment)
                        break
                    case this.mode.MEDIUM:
                        await operation.medium(segment, this.psize)
                        break
                    case this.mode.GAUSSIAN:
                        await operation.gaussian(segment, this.psize)
                        break
                    case this.mode.OPEN:
                        await operation.open(segment, this.psize)
                        break
                    case this.mode.CLOSE:
                        await operation.close(segment, this.psize)
                        break
                }

                this.onload()
                resolve()
            })

        }
    }


}

class GrowingTools extends SegTools {
    constructor(state, maskImages) {
        super(state)
        this.mode = {
            NORMAL: -1,
            PRESERVE: 0,
            REMOVE: 1,
            GROW: 2,
            SHRINK: 3,
            BALLOON: 4,
            EXCLUDE: 5,
            FILL: 6,
            BORDER: 7,
            NORMAL2D: 8,
            PRESERVE2D: 9,
            REMOVE2D: 10,
            EXCLUDE2D: 11,
            FILL2D: 12,
            PREVIEW2D: 13
        }

        this.selectedMode = this.mode.NORMAL
        this.serial = false
        this.bias = 0
        this.margin = 0
        this.radius = 5

        let dims = this.state.volume.dims;
        let algorithm = new Growing(dims);
        let penPosition = []
        let pos

        maskImages.forEach((mimg, index) => {
            mimg.controller.addEventListener('pointermove', (evt) => {
                if (!this.enable) {
                    return
                }

                penPosition = getMousePos(mimg.controller, evt)

                mimg.clearControllerTrack()
                mimg.setControllerTrack(penPosition, this.radius, 'rgba(255,255,255,0.6)')

                switch (index) {
                    case axisUV:
                        pos = getMousePosByScalar(mimg.controller, evt, [dims[0], dims[1]])
                        this.process(parseInt(pos[0]), parseInt(pos[1]), mimg.index)
                        break
                    case axisUD:
                        pos = getMousePosByScalar(mimg.controller, evt, [dims[0], dims[2]])
                        this.process(parseInt(pos[0]), mimg.index, parseInt(pos[1]))
                        break
                    case axisVD:
                        pos = getMousePosByScalar(mimg.controller, evt, [dims[1], dims[2]])
                        this.process(this.state.volume.dims[0] - mimg.index - 1, parseInt(pos[0]), parseInt(pos[1]))
                        break
                    default:
                        break
                }
            })
            mimg.controller.addEventListener('click', (evt) => {
                if (!this.enable) {
                    return
                }

                switch (index) {
                    case axisUV:
                        pos = getMousePosByScalar(mimg.controller, evt, [dims[0], dims[1]])
                        this.process(parseInt(pos[0]), parseInt(pos[1]), mimg.index)
                        break
                    case axisUD:
                        pos = getMousePosByScalar(mimg.controller, evt, [dims[0], dims[2]])
                        this.process(parseInt(pos[0]), mimg.index, parseInt(pos[1]))
                        break
                    case axisVD:
                        pos = getMousePosByScalar(mimg.controller, evt, [dims[1], dims[2]])
                        this.process(this.state.volume.dims[0] - mimg.index - 1, parseInt(pos[0]), parseInt(pos[1]))
                        break
                    default:
                        break
                }
            })
        })

        this.preview = (x, y, layerIndex, data) => {
            let index = this.state.focusedSegIndex
            let segment = this.state.focusedSegment

            if (index == -1 || segment == null) {
                return
            }

            let segData = segment;
            let baseData = this.state.volume.data;
            let maxVal = 2 ** this.state.info.bitsStored
            let diff = this.bias * maxVal

            algorithm.regionGrowing2D(x, y, layerIndex, baseData, diff, segData)
        }

        this.process = (x, y, layerIndex) => {
            //console.log(this.selectedMode)
            if (!this.enable) {
                return
            }

            let index = this.state.focusedSegIndex
            let segment = this.state.focusedSegment

            if (index == -1 || segment == null) {
                return
            }

            let segData = segment;
            let baseData = this.state.volume.data;
            let maxVal = 2 ** this.state.info.bitsStored
            let diff = this.bias * maxVal

            this.onstart();

            let checkExist = () => {
                let index = layerIndex * dims[1] * dims[0] + y * dims[0] + x;
                if (segData.getBit(index) == 0) {
                    console.log('No target');
                    return false;
                }
                return true;
            };

            if (!checkExist) {
                return;
            }

            let algo_type = algorithm.regionGrowing;
            if (this.type === this.mode.BORDER)
                algo_type = algorithm.edgeDetector;


            switch (this.selectedMode) {
                // 3D區塊擴張
                case this.mode.NORMAL:
                    algorithm.regionGrowing(x, y, layerIndex, baseData, diff, segData);
                    break
                case this.mode.PRESERVE:
                    algorithm.regionPreserve(x, y, layerIndex, segData);
                    break;
                case this.mode.REMOVE:
                    algorithm.regionRemove(x, y, layerIndex, segData);
                    break
                case this.mode.FILL:
                    algorithm.regionFill(x, y, layerIndex, segData)
                    break
                case this.mode.EXCLUDE:
                    algorithm.regionExclusive(x, y, layerIndex, baseData, diff, segData)
                    break
                // 2D區塊擴張
                case this.mode.NORMAL2D:

                    if (this.serial) {
                        for (let i = 0; i < dims[2]; i++) {
                            algorithm.regionGrowing2D(x, y, i, baseData, diff, segData)
                        }
                    }
                    else {
                        algorithm.regionGrowing2D(x, y, layerIndex, baseData, diff, segData)
                    }
                    break
                case this.mode.PRESERVE2D:
                    if (this.serial) {
                        for (let i = 0; i < dims[2]; i++) {
                            algorithm.regionPreserve2D(x, y, i, segData)
                        }
                    }
                    else {
                        algorithm.regionPreserve2D(x, y, layerIndex, segData)
                    }
                    break
                case this.mode.REMOVE2D:
                    if (this.serial) {
                        for (let i = 0; i < dims[2]; i++) {
                            algorithm.regionRemove2D(x, y, i, segData)
                        }
                    }
                    else {
                        algorithm.regionRemove2D(x, y, layerIndex, segData)
                    }
                    break
                case this.mode.FILL2D:
                    if (this.serial) {
                        for (let i = 0; i < dims[2]; i++) {
                            algorithm.regionFill2D(x, y, i, segData)
                        }
                    }
                    else {
                        algorithm.regionFill2D(x, y, layerIndex, segData)
                    }

                    break
                case this.mode.EXCLUDE2D:
                    if (this.serial) {
                        for (let i = 0; i < dims[2]; i++) {
                            algorithm.regionExclusive2D(x, y, i, baseData, diff, segData)
                        }
                    }
                    else {
                        algorithm.regionExclusive2D(x, y, layerIndex, baseData, diff, segData)
                    }

                    break
                default:
                    alert('Function not supporet.')
                    break
            }


            //Logic.boolean(maskData, segData)
            this.onload()
        }

    }


}

class ChanVeseTools extends SegTools {
    constructor(state) {
        super(state)

        let mask2phi = (option) => {
            //option == 0:background
            //option == 1:foreground
            return bwdist(option) - bwdist(1 - option) + option - 0.5
        }

        /** 
            this is an intermediary function, 'a' has only True, False vals, 
            so we convert them into 0, 1 values -- in reverse. True is 0, 
            False is 1, distance_transform_edt wants it that way.
        */

        let dis2Zero = () => {

        }

        let bwdist = (data, width, height) => {
            let tmp = new Array(a.length).fill(true)
            for (let i = 0; i < tmp.length; i++) {
                if (a[i] == 0) {
                    tmp[i] = false
                }
                else if (dis2Zero(a[i]) == 1) {
                    tmp[i] = false
                }
            }

            let distTrans = new cv.Mat();
            let img = cv.matFromArray(width, height, cv.CV_32FC1, data)
            // distance transform
            cv.distanceTransform(img, distTrans, cv.DIST_L2, 5);
            cv.normalize(distTrans, distTrans, 1, 0, cv.NORM_INF);
            return nd.distance_transform_edt(a == 0)
        }


        this.process = (max_iter, alpha, thres) => {
            if (!this.enable) {
                return
            }

            let index = this.state.focusedSegIndex
            let segment = this.state.focusedSegment

            if (index == -1 || segment == null) {
                return
            }

            iter = 0
            stop = false
            while (iter < max_iter && !stop) {
                iter++
            }
        }
    }
}

class CropTools extends SegTools {
    constructor(state, maskImages) {
        super(state)
        this.mode = {
            RESET: -1,
            SPHERE: 0,
            BOX: 1,
            CYLINDER: 2,
            CUSTOMIZE: 3,
            ACM: 4,
            BALLOON: 5
        }
        this.ratio = 1

        let dims = state.info.dims
        this.selectedMode = this.mode.SPHERE
        let mask  = new BinaryArray(dims[0] * dims[1] * dims[2])

        let prebuildShape = null
        let pDims = new Array(3)

        let parameter = {
            box: {
                front: 0,
                back: 0,
                left: 0,
                right: 0,
                top: 0,
                bottom: 0
            },
            sphere: {
                radius: 0,
                x: 0,
                y: 0,
                z: 0
            },
            cylinder: {
                radius: 0,
                x: 0,
                y: 0,
                top: 0,
                bottom: 0
            },
            balloon: {
                size: 0,
                x: 0,
                y: 0,
                z: 0
            },
            customize: new Uint8Array()
        }

        this.setBoxBorder = (front, back, left, right, top, bottom) => {
            parameter.box.front = front
            parameter.box.back = back
            parameter.box.left = left
            parameter.box.right = right
            parameter.box.top = top
            parameter.box.bottom = bottom
        }

        this.setSphereBorder = (radius, x, y, z) => {
            parameter.sphere.radius = radius
            parameter.sphere.x = x
            parameter.sphere.y = y
            parameter.sphere.z = z
        }

        this.setCylinderBorder = (radius, x, y, top, bottom) => {
            parameter.cylinder.radius = radius
            parameter.cylinder.x = x
            parameter.cylinder.y = y
            parameter.cylinder.top = top
            parameter.cylinder.bottom = bottom
        }

        this.setBalloonBorder = (size, x, y, z) => {
            parameter.balloon.size = size
            parameter.balloon.x = x
            parameter.balloon.y = y
            parameter.balloon.z = z
        }

        this.getBoxBorder = () => {
            return parameter.box
        }

        this.getSphereBorder = () => {
            return parameter.sphere
        }

        this.getCylinderBorder = () => {
            return parameter.cylinder
        }

        this.getBalloonBorder = () => {
            return parameter.balloon
        }

        //ACM border
        let points = []

        let squarePolar = (point, centre) => {
            return [
                Math.atan2(point.y - centre.y, point.x - centre.x),
                (point.x - centre.x) ** 2 + (point.y - centre.y) ** 2
            ]
        }

        maskImages.forEach((mimg, index) => {
            mimg.controller.addEventListener('click', (evt) => {

                if (!this.enable) {
                    return
                }

                if (this.selectedMode != this.mode.CUSTOMIZE && this.selectedMode != this.mode.ACM) {
                    return
                }

                if (evt.button == 0) {
                    let pos = getMousePos(mimg.controller, evt)

                    points.push({ x: pos[0], y: pos[1] })

                    let centre = {
                        x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
                        y: points.reduce((sum, p) => sum + p.y, 0) / points.length
                    }


                    for (let point of points) {
                        point.tmp = squarePolar(point, centre)
                    }

                    points.sort((a, b) => a.tmp[0] - b.tmp[0] || a.tmp[1] - b.tmp[1])

                    mimg.clearControllerTrack()
                    mimg.updateBorder(points)
                }

            })

            mimg.controller.addEventListener('contextmenu', (evt) => {

                if (!this.enable) {
                    return
                }

                evt.preventDefault()
                points = []
                mimg.clearControllerTrack()
            })
        })

        let maskUpCylinder = function (volDims, spacing, mask) {

            let p = parameter.cylinder
            let r = Math.round(volDims[0] * p.radius / 2)
            let i, j, k, iStep, jStep, limit_j
            let UD = [p.top * volDims[2], p.bottom * volDims[2]]
            let centerx = Math.round(p.x * volDims[0])
            let centery = Math.round(p.y * volDims[1])

            UD[0] = Math.round(UD[0])
            UD[1] = Math.round(UD[1])
            UD.sort()

            for (i = UD[0]; i < UD[1]; i++) {
                for (j = centery - r, iStep = i * volDims[1] * volDims[0]; j < centery + r; j++) {
                    if (j < 0 || j >= volDims[1]) {
                        continue
                    }

                    limit_j = Math.pow(r, 2) - Math.pow(j - centery, 2)
                    limit_j = Math.sqrt(limit_j)
                    limit_j = Math.round(limit_j) * spacing[1] / spacing[0]

                    for (k = centerx - limit_j, jStep = j * volDims[0]; k < centerx + limit_j; k++) {
                        if (k < 0 || k >= volDims[0]) {
                            continue
                        }
                        //console.log(j)
                        mask.setBit(iStep + jStep + k)
                    }
                }
            }

        }

        let maskUpBox = function (volDims, mask) {
            let i, j, k, iStep, jStep

            let p = parameter.box
            let UD = [Math.round(p.top * volDims[2]), Math.round(p.bottom * volDims[2])]
            let LR = [Math.round(p.left * volDims[0]), Math.round(p.right * volDims[0])]
            let FB = [Math.round(p.front * volDims[1]), Math.round(p.back * volDims[1])]

            let compare = (a, b) => {
                return a - b
            }

            UD.sort(compare)
            LR.sort(compare)
            FB.sort(compare)

            for (i = UD[0]; i < UD[1]; i += 1) {
                iStep = i * volDims[1] * volDims[0]
                for (j = FB[0]; j < FB[1]; j += 1) {
                    jStep = j * volDims[0]
                    for (k = LR[0]; k < LR[1]; k += 1) {
                        mask.setBit(iStep + jStep + k)
                    }
                }
            }

        }

        let maskUpSphere = function (volDims, spacing, mask) {
            let p = parameter.sphere
            let centerx = p.x * volDims[0]
            let centery = p.y * volDims[1]
            let centerz = p.z * volDims[2]

            let max = Math.max(volDims[0] * spacing[0], volDims[1] * spacing[1], volDims[2] * spacing[2])
            let r = parseInt(max / 2 * p.radius) / spacing[2]
            let limit_i, limit_j
            let i, j, k, iStep, jStep

            for (i = centerz - r; i < centerz + r; i++) {
                if (i < 0 || i >= volDims[2]) {
                    continue
                }
                limit_i = Math.pow(r, 2) - Math.pow(i - centerz, 2)
                limit_i = Math.sqrt(limit_i)
                limit_i = parseInt(limit_i) * spacing[2] / spacing[1]

                for (j = centery - limit_i, iStep = parseInt(i) * volDims[1] * volDims[0]; j < centery + limit_i; j++) {
                    if (j < 0 || j >= volDims[1]) {
                        continue
                    }
                    limit_j = Math.pow(limit_i, 2) - Math.pow(j - centery, 2)
                    limit_j = Math.sqrt(limit_j)
                    limit_j = parseInt(limit_j) * spacing[1] / spacing[0]

                    for (k = centerx - limit_j, jStep = parseInt(j) * volDims[0]; k < centerx + limit_j; k++) {
                        if (k < 0 || k >= volDims[0]) {
                            continue
                        }
                        //console.log(j)
                        mask.setBit(iStep + jStep + parseInt(k))
                    }
                }
            }

        }

        let maskUpBalloon = (volDims, spacing, mask) => {
            let p = parameter.balloon
            let size = p.size

            let tmpSize = [
                Math.round(pDims[0] * size),
                Math.round(pDims[1] * size),
                Math.round(pDims[2] * size)
            ]

            /**
            let xDiff = (p.x - 0.5) * volDims[0]
            let yDiff = (p.y - 0.5) * volDims[1]
            let zDiff = (p.z - 0.5) * volDims[2]

            let xStart = volDims[0] * 0.5 - tmpSize[0] * 0.5 + xDiff
            let yStart = volDims[1] * 0.5 - tmpSize[1] * 0.5 + yDiff
            let zStart = volDims[2] * 0.5 - tmpSize[2] * 0.5 + zDiff

             */

            let xStart = p.x * volDims[0] - tmpSize[0] * 0.5
            let yStart = p.y * volDims[1] - tmpSize[1] * 0.5
            let zStart = p.z * volDims[2] - tmpSize[2] * 0.5

            let xEnd = p.x * volDims[0] + tmpSize[0] * 0.5
            let yEnd = p.y * volDims[1] + tmpSize[1] * 0.5
            let zEnd = p.z * volDims[2] + tmpSize[2] * 0.5

            xStart = xStart >= 0 ? Math.round(xStart) : 0
            yStart = yStart >= 0 ? Math.round(yStart) : 0
            zStart = zStart >= 0 ? Math.round(zStart) : 0

            xEnd = xEnd >= volDims[0] ? volDims[0] : Math.round(xEnd)
            yEnd = yEnd >= volDims[1] ? volDims[1] : Math.round(yEnd)
            zEnd = zEnd >= volDims[2] ? volDims[2] : Math.round(zEnd)

            let tiDiff = Math.round(tmpSize[2] - zEnd + zStart)
            let tjDiff = Math.round(tmpSize[1] - yEnd + yStart)
            let tkDiff = Math.round(tmpSize[0] - xEnd + xStart)

            let iStep, jStep, tiStep, tjStep
            let sample = 1 / size

            for (let i = zStart, ti = tiDiff; i < zEnd; i++, ti++) {

                iStep = Math.round(i) * volDims[1] * volDims[0]
                tiStep = Math.round(ti * sample) * pDims[1] * pDims[0]

                for (let j = yStart, tj = tjDiff; j < yEnd; j++, tj++) {

                    jStep = Math.round(j) * volDims[0]
                    tjStep = Math.round(tj * sample) * pDims[0]

                    for (let k = xStart, tk = tkDiff; k < xEnd; k++, tk++) {
                        mask.setValue(prebuildShape[tiStep + tjStep + Math.round(tk * sample)], iStep + jStep + Math.round(k))
                    }
                }
            }

        }

        let initPrebuildShape = () => {

            let xhr = new XMLHttpRequest()
            xhr.responseType = 'arraybuffer'
            xhr.open('GET', './template/prebuild.ptn', true)
            xhr.onload = (e) => {
                if (xhr.readyselectedMode != 4 || xhr.status != 200) {
                    return
                }

                let result = xhr.response

                if (prebuildShape == null) {
                    prebuildShape = new Uint8Array();
                }

                prebuildShape.set(result);
            }
            xhr.send()
        }

        this.process = () => {
            if (!this.enable) {
                return
            }

            if (this.state.volume == null) {
                return
            }

            if (this.selectedMode == this.mode.RESET) {
                return
            }

            this.onstart()

            this.state.option = 0
            let segment = this.state.volume
            let data = segment.data
            let dims = segment.dims

            mask.clear()

            switch (this.selectedMode) {
                case this.mode.SPHERE:
                    maskUpSphere(dims, this.state.info.spacing, mask)
                    break
                case this.mode.BOX:
                    maskUpBox(dims, mask)
                    break
                case this.mode.CYLINDER:
                    maskUpCylinder(dims, this.state.info.spacing, mask)
                    break
                case this.mode.CUSTOMIZE:
                    //mask = maskUpSphere(dims, this.ratio, this.state.info.spacing)
                    break
                case this.mode.ACM:
                    break
                case this.mode.BALLOON:
                    maskUpBalloon(dims, this.state.info.spacing, mask)
                    break
                case this.mode.RESET:
                    //deprecated
                    break
            }

            //剪裁影像範圍
            for (let i = 0; i < data.length; i++) {
                if (mask.getBit(i) == 0) {
                    data[i] = 0
                }
            }

            segment.generateThumbnail()

            this.onload()
        }

        this.revert = () => {

        }

        this.reset = () => {
            this.state.volumeReset()
            this.state.generate()
            this.onload()
        }

        initPrebuildShape()
    }
}

class SizeBasedTools extends SegTools {
    constructor(state, domElement) {
        super(state)

        let sb = null
        let sizeData = state.sizeData
        let rgba = state.colorSetting.rgba
        let imageData = state.volume

        this.process = () => {
            this.onstart()

            let data = imageData.thumbnail
            let dims = imageData.thumbnailSize

            let onprogress = (_, p) => {
                console.log(p)
            }

            let onload = () => {
                console.log('finished')
                this.onload()
            }

            if (sb == null) {
                sb = new SizeBased(dims, data, sizeData, rgba)
            }

            sb.process(onprogress, onload)
        }

    }


}

class ScissorTools extends SegTools {
    constructor(state, domElement) {
        super(state)

        this.domElement = domElement
        this.canvas = document.createElement('canvas')
        this.canvas.width = domElement.clientWidth
        this.canvas.height = domElement.clientHeight
        this.canvas.classList.add('paintingViewer')
        this.context = this.canvas.getContext('2d')

        this.domElement.appendChild(this.canvas)
        this.__enable = false
        let selectedMode = 0
        let color = 'rgba(255,0,0,0.2)'
        let penPos = [0, 0]
        let radius = 5
        //console.log(this)
        this.canvas.addEventListener('mousedown', () => {
            if (!this.enable) {
                return
            }

            selectedMode = 1
        })

        this.canvas.addEventListener('mousemove', (evt) => {

            if (!this.enable) {
                return
            }

            if (selectedMode == 1) {
                penPos = getMousePos(this.canvas, evt)
                this.context.fillStyle = color
                this.context.beginPath()
                this.context.arc(penPos[0], penPos[1], radius, 0, Math.PI * 2, 1)
                this.context.fill()
            }
        })

        window.addEventListener('mouseup', () => {
            if (!this.enable) {
                return
            }

            this.context.clearRect(0, 0, this.canvas.width, this.canvas.height)
            selectedMode = 0
        })

        window.addEventListener('resize', () => {
            this.canvas.width = domElement.clientWidth
            this.canvas.height = domElement.clientHeight
        })
    }



    set enable(option) {
        if (this.canvas == null) {
            return
        }

        this.__enable = option
        if (option) {
            this.canvas.style.display = 'block'
        }
        else {
            this.canvas.style.display = 'none'
        }
    }

    get enable() {
        return this.__enable
    }

    process(camera, img) {
        if (!this.enable) {
            return
        }

        let dims = this.state.volume.dims
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
    constructor(state) {
        super(state)
        this.mode = {
            MANUAL: 0,
            AUTO: 1
        }
        this.selectedMode = 0
        this.l_limit = 0
        this.r_limit = 0

        let scalar = 2 ** this.state.info.bitsStored
        let scalar_1 = 2 ** this.state.info.bitsStored - 1

        let otsu = (histogram, total) => {

            let sum = 0;
            for (let i = 1; i < histogram.length; ++i)
                sum += i * histogram[i];
            let sumB = 0;
            let wB = 0;
            let wF = 0;
            let mB;
            let mF;
            let max = 0;
            let between = 0;
            let threshold1 = 0;
            let threshold2 = 0;

            for (let i = 0; i < histogram.length; ++i) {
                wB += histogram[i];
                if (wB == 0)
                    continue;
                wF = total - wB;
                if (wF == 0)
                    break;
                sumB += i * histogram[i];
                mB = sumB / wB;
                mF = (sum - sumB) / wF;
                between = wB * wF * (mB - mF) * (mB - mF);
                if (between >= max) {
                    threshold1 = i;
                    if (between > max) {
                        threshold2 = i;
                    }
                    max = between;
                }

            }

            return (threshold1 + threshold2) / 2.0;
        }

        this.getAutoValue = () => {
            let baseData = this.state.volume.data

            let histogram = new Array(scalar).fill(0)
            let cvtColor = 0
            let total = baseData.length

            for (let i = 0; i < baseData.length; i++) {
                cvtColor = Math.round(baseData[i])
                histogram[cvtColor]++
            }

            return otsu(histogram, total) / scalar_1
        }

        this.process = () => {
            if (!this.enable)
                return

            let index = this.state.focusedSegIndex
            let segment = this.state.focusedSegment

            if (index == -1 || segment == null)
                return

            let baseData = this.state.volume.data
            let segData = segment.data

            this.onstart()

            switch (this.selectedMode) {
                case this.mode.MANUAL:
                    for (let i = 0; i < baseData.length; i++) {
                        segData.setValue(0, i);
                        if (baseData[i] >= (this.l_limit * scalar_1) && baseData[i] <= (this.r_limit * scalar_1)) {
                            segData.setValue(1, i);
                        }
                    }
                    break
                case this.mode.AUTO:

                    let thres = this.getAutoValue()

                    for (let i = 0; i < baseData.length; i++) {
                        segData.setValue(0, i);
                        if (baseData[i] >= thres) {
                            segData.setValue(1, i);

                        }
                    }
                    break
                default:
                    break
            }
            this.onload()
        }


    }

}

class ListControlTools extends SegTools {
    constructor(state, maskImages) {
        super(state, true)
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
            console.log(state)
            if (this.state.volume == null) {
                alert('image data not load!')
                return false
            }

            this.onstart(true)

            let color = this.colorList[this.state.segments.length % this.colorList.length]
            let dims = [...this.state.volume.dims]
            let newSeg = new Segment('Segment', dims, color, true, true)
            this.state.segments.splice(this.state.focusedSegIndex + 1, 0, newSeg)
            this.state.focusedSegIndex++

            this.onload()

            maskImages.forEach((mimg) => {
                mimg.addLayer()
            })

            return true
        }

        let remove = () => {
            let index = this.state.focusedSegIndex

            if (index == -1) {
                return false
            }

            this.onstart(false)

            this.state.segments.splice(index, 1)
            this.state.focusedSegIndex--

            this.onload()

            maskImages.forEach((mimg) => {
                mimg.removeLayer(index)
            })

            return true
        }

        let moveUp = () => {
            let index = this.state.focusedSegIndex

            if (index < 1) {
                return false
            }

            this.onstart()

            let tmp = this.state.segments[index - 1]
            this.state.segments[index - 1] = this.state.segments[index]
            this.state.segments[index] = tmp

            this.onload()

            return true
        }

        let moveDown = () => {
            let index = this.state.focusedSegIndex

            if (index == -1 || index == this.state.segments.length - 1) {
                return false
            }

            this.onstart()

            let tmp = this.state.segments[index + 1]
            this.state.segments[index + 1] = this.state.segments[index]
            this.state.segments[index] = tmp

            this.onload()

            return true
        }

        let moveTop = () => {
            if (index < 1) {
                return false
            }

            this.onstart()

            let tmp = this.state.segments[index]
            this.state.segments.splice(index, 1)
            this.state.segments.splice(0, 0, tmp)

            this.onload()

            return true
        }

        let moveBottom = () => {
            let index = this.state.focusedSegIndex

            if (index == -1 || index == this.state.segments.length - 1) {
                return false
            }

            this.onstart()

            let tmp = this.state.segments[index]
            this.state.segments.splice(index, 1)
            this.state.segments.splice(this.state.segments.length, 0, tmp)

            this.onload()

            return true
        }

        this.process = () => {
            if (!this.enable) {
                return
            }

            switch (this.selectedMode) {
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

class Plot {

    static getInstance = function () {
        return new Histogram()
    }

    constructor() {
        // set the dimensions and margins of the graph
        let margin = { top: 10, right: 10, bottom: 20, left: 60 }

        this.loadView = function (domElement, data, colormap) {

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
                .domain([1, 256])     // except 0 value pixels
                .range([0, width]);

            svg.append('g')
                .attr('transform', 'translate(0,' + height + ')')
                .call(d3.axisBottom(x));

            // Y axis: scale and draw:
            let y = d3.scaleLinear()
                .range([height, 0])
                .domain([0, d3.max(dataY, function (d) { return d.length; })]);

            svg.append('g')
                .call(d3.axisLeft(y).tickFormat(d3.format('d')));

            // append the bar rectangles to the svg element
            svg.selectAll('rect')
                .data(data)
                .enter()
                .append('circle')
                .attr('class', 'dot')
                .attr('r', '1')
                .attr('cx', function (d) {

                })
                .attr('cy', function (d) {

                })
                .style('fill', function (d, i) {
                    let hex = colormap[i].toString(16)
                    if (i < 16) {
                        hex = '0' + hex
                    }
                    return '#' + hex + hex + hex
                })
        }
    }
}

class Histogram {

    static instance = null

    static getInstance = function () {
        if (Histogram.instance == null) {
            Histogram.instance = new Histogram()
        }
        return Histogram.instance
    }

    constructor() {
        // set the dimensions and margins of the graph
        const markerRange = 10
        const totalMarkerCount = 25
        let margin = { top: 10, right: 10, bottom: 20, left: 30 }
        let marker = []
        let colormap = new Array(256).fill(0).map((value, index) => {
            return index
        })

        let convertHex = function (value) {
            if (value < 16) {
                return '0' + value.toString(16)
            }

            return value.toString()
        }

        this.loadView = function (domElement, data, logEnable = false) {

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
                .domain([1, 256])     // except 0 value pixels
                .range([0, width]);

            let repaint = function () {
                d3.selectAll()

            }

            let drag = d3.drag()
                .on('drag', function (evt) {
                    let pos = d3.pointer(evt, this)[0]
                    let step = markerRange * width / 255
                    if (pos > step && pos < width - step) {
                        d3.select(this).style('x', pos)
                    }
                })

            svg.append('g')
                .attr('transform', 'translate(0,' + height + ')')
                .call(d3.axisBottom(x));

            // set the parameters for the histogram
            let histogram = d3.bin()
                .domain(x.domain())
                .thresholds(x.ticks(256));

            // apply this function to data to get the bins
            console.log()
            let bins = histogram(data);

            // Y axis: scale and draw:
            let y = d3.scaleLinear()
                .range([height, 0])
                .domain([0, d3.max(bins, function (d) {
                    if (logEnable) {
                        return Math.log(d.length + 1);
                    }
                    return d.length;
                })]);

            svg.append('g')
                .call(d3.axisLeft(y).tickFormat(d3.format('d')));

            // append the bar rectangles to the svg element
            svg.selectAll('rect')
                .data(bins)
                .enter()
                .append('rect')
                .attr('transform', function (d) {
                    let trans_y = d.length

                    if (logEnable) {
                        trans_y = Math.log(trans_y + 1)
                    }

                    return 'translate(' + x(d.x0) + ',' + y(trans_y) + ')';
                })
                .attr('width', function (d) { return x(d.x1) - x(d.x0); })
                .attr('height', function (d) {

                    let trans_y = d.length

                    if (logEnable) {
                        trans_y = Math.log(trans_y + 1)
                    }

                    return height - y(trans_y)
                })
                .style('fill', function (d, i) {
                    //console.log(colormap)
                    let hex = colormap[i].toString(16)
                    if (i < 16) {
                        hex = '0' + hex
                    }
                    return '#' + hex + hex + hex
                })
        }
    }
}

class D3AxisHelper {
    constructor(domElement, margin) {
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

        this.update = (xLength, yLength) => {
            svg.selectAll('g').remove()
            
            // X axis: scale and draw:
            let x = d3.scaleLinear()
                .domain([1, 255])     // except 0 value pixels
                .range([0, width]);

            let ratio = xLength / 255

            svg.append('g')
                .attr('transform', 'translate(0,' + height + ')')
                .call(
                    d3.axisBottom(x)
                        .tickFormat((d) => {
                            return Math.round(d * ratio)
                        })
                );

            // Y axis: scale and draw:
            let y = d3.scaleLog()
                .range([height, 0])
                .domain([1, yLength]);

            svg.append('g')
                .call(
                    d3.axisLeft(y)
                );
        }
    }
}

class TransferTools2 extends SegTools {
    constructor(state, domElement) {
        super(state)
        this.__enable = false
        this.mode = {
            GRADIENT: 0,
            SIZEDATA: 1,
            COLORMAP: 2,
            DEFAULT: 3,
            APPLY: 4
        }

        this.magData = null
        this.domElement = domElement
        this.domElement.style.position = 'relative'

        // 二維transfer function的視圖大小
        this.xLength = 256
        this.yLength = 256

        let margin = { top: 10, right: 10, bottom: 20, left: 40 }
        let style = `width: calc(${(domElement.clientWidth - margin.left - margin.right)}px);height:calc(${(domElement.clientHeight - margin.top - margin.bottom)}px);position:absolute;top:${margin.top}px;left:${margin.left}px;`
        let histogram = new Float32Array(this.xLength * this.yLength)

        //axis 繪製
        let axishelper = new D3AxisHelper(domElement, margin)

        // 二維transfer function視圖
        let transferCanvas = document.createElement('canvas')
        transferCanvas.style = style
        transferCanvas.style.background = 'black'//底色
        transferCanvas.width = this.xLength
        transferCanvas.height = this.yLength
        domElement.appendChild(transferCanvas)

        // user交互標記視圖，用來呈現鼠標選取的範圍
        let markCanvas = document.createElement('canvas')
        markCanvas.style = style
        markCanvas.width = this.xLength
        markCanvas.height = this.yLength
        domElement.appendChild(markCanvas)

        // 選取範圍標記
        let markerDiv = document.createElement('div')
        markerDiv.style = style
        domElement.appendChild(markerDiv)

        let markers = []
        let selected = null

        // 設置畫板為'2d'屬性畫板
        this.markContext = markCanvas.getContext('2d')
        this.displayContext = transferCanvas.getContext('2d')

        // 取得畫布
        let ctxData = this.displayContext.getImageData(0, 0, this.xLength, this.yLength);

        let resetRect = (ctx) => {
            ctx.save()
            ctx.clearRect(0, 0, markCanvas.width, markCanvas.height)
            ctx.rect(0, 0, markCanvas.width, markCanvas.height)
            ctx.fillStyle = 'rgba(0,0,0,0.9)'
            ctx.fill()
            ctx.restore()
        }

        let updatePath = () => {
            if (markers.length <= 0) {
                return
            }

            resetRect(this.markContext)

            this.markContext.save()
            this.markContext.fillStyle = 'rgba(0,0,0,0)'
            this.markContext.strokeStyle = '#e59acb'
            this.markContext.lineWidth = 4

            this.markContext.beginPath()

            this.markContext.moveTo(markers[0].coordinate[0], markers[0].coordinate[1])

            for (let i = 1; i < markers.length; i++) {
                this.markContext.lineTo(markers[i].coordinate[0], markers[i].coordinate[1])
            }

            this.markContext.closePath()
            this.markContext.stroke()
            this.markContext.fill()

            this.markContext.restore()
        }


        let pushMarker = (posX, posY, cposX, cposY) => {
            let marker = {
                item: document.createElement('input'),
                coordinate: [0, 0]
            }

            marker.item.type = 'radio'
            marker.item.style.width = '24px'
            marker.item.style.height = '24px'
            marker.item.style.position = 'absolute'
            marker.item.style.filter = 'hue-rotate(313deg)'
            marker.item.checked = true

            marker.setPosition = (posX, posY, cposX, cposY) => {
                marker.item.style.left = (posX - 12) + 'px'
                marker.item.style.top = (posY - 12) + 'px'

                marker.coordinate[0] = cposX
                marker.coordinate[1] = cposY

                //console.log(posX, posY, cposX, cposY)
            }

            marker.setPosition(posX, posY, cposX, cposY)

            markerDiv.appendChild(marker.item)


            marker.item.addEventListener('mousedown', () => {
                selected = marker
            })

            markers.push(marker)

            updatePath()
        }

        pushMarker(0, 0, 0, 0)
        pushMarker(0, markerDiv.clientHeight, 0, this.yLength)
        pushMarker(markerDiv.clientWidth, markerDiv.clientHeight, this.xLength, this.yLength)
        pushMarker(markerDiv.clientWidth, 0, this.xLength, 0)

        markerDiv.addEventListener('mousemove', (evt) => {
            if (!this.enable) {
                return
            }

            if (selected == null) {
                return
            }

            let pos = getMousePosNonScale(markerDiv, evt)
            let cpos = getMousePos(markCanvas, evt)

            selected.setPosition(...pos, ...cpos)

            updatePath()
        })

        window.addEventListener('mouseup', () => {
            if (!this.enable) {
                return
            }

            selected = null
        })

        let kernelOperation = new Kernel(this.state.info.dims);
        let calculateGradients = () => {

            return new Promise(async (resolve, reject) => {
                let imgData = this.state.volume;
                let tfData = this.state.transferData

                await kernelOperation.gradientMagnitude(imgData, tfData);

                resolve()
            })
        };

        let calculateDefault = () => {

            return new Promise(async (resolve) => {
                let volume = this.state.volume;
                let tfData = this.state.transferData
                tfData.data.fill(0)

                let onload = () => {
                    console.log('finished')
                    resolve()
                }

                //console.log(tfData)
                let bit = state.info.bitsStored
                let limit = 2 ** bit - 1

                let max = 0
                let counter = new Uint32Array(limit)

                for (let i = 0; i < volume.length; i++) {
                    counter[volume.data[i]]++
                    if (max < counter[volume.data[i]]) {
                        max = counter[volume.data[i]]
                    }
                }

                max = Math.log10(max + 1) - 1
                counter.fill(0)

                for (let i = 0; i < volume.length; i++) {
                    tfData.data[i] = (Math.log10(counter[volume.data[i]] + 1) - 1) / max * 255
                    counter[volume.data[i]]++
                }

                //console.log(tfData.data)

                onload()
            })

        };


        let sb = new SizeBased(this.state.volume.thumbnailSize)
        let calculateSizeData = () => {

            return new Promise(async (resolve, reject) => {

                let alpha = this.state.volume
                let tfData = this.state.transferData
                let rgba = this.state.colorSetting.rgba

                pushData(alpha.data, tfData.data)

                let onprogress = (_, p) => {
                    console.log(p)
                }

                let onload = () => {
                    console.log('finished')
                    resolve()
                }

                await sb.process(tfData, rgba, onprogress, onload)

            })

        };

        // 生成二維的transfer function視圖
        let build2dHistogram = (colormap) => {

            // 取淂CT的三維影像資料
            let baseData = this.state.volume.data;

            let tfData = this.state.transferData.data
            let colorLevel = 2 ** state.info.bitsStored

            let maxHeight = getMinMax(tfData).max

            // 初始化畫布資料
            for (let i = 0; i < ctxData.data.length; i += 4) {
                ctxData.data[i] = ctxData.data[i + 1] = ctxData.data[i + 2] = 255;
                ctxData.data[i + 3] = 0;
            }

            let xIndex, yIndex, index;

            // 加速計算過程
            let scalarX = (this.xLength - 1) / (colorLevel - 1)
            let scalarY = (this.yLength - 1) / (255)

            // 畫布的資料類別為Uint8Clamped，會將輸入的數值強轉成整數
            // 目前的二維視圖，其訊號的疊加採用浮點數計算，需另設參數保存計算結果
            histogram.fill(0)

            //將影像梯度的像素分布繪製成圖表

            for (let i = 0; i < baseData.length; i++) {

                xIndex = Math.round(baseData[i] * scalarX);
                yIndex = Math.round(this.yLength - 1 - tfData[i] * scalarY);

                // 訊號強度介於0~1，根據索引的單位內剩餘的空間，作為疊加訊號的強度
                index = this.xLength * yIndex + xIndex;
                histogram[index] += (1 - histogram[index]) / 255;
            }

            let maxValue = 0.01
            for (let i = 0; i < histogram.length; i++) {
                if (maxValue < histogram[i]) {
                    maxValue = histogram[i]
                }
            }

            // 將計算結果回傳至畫布上
            let counter = 0
            for (let i = 0; i < this.yLength; i++) {
                for (let j = 0; j < this.xLength; j++) {
                    let colorIndex = parseInt(j / this.xLength * 255)
                    ctxData.data[4 * counter] = colormap[0][colorIndex] * 255
                    ctxData.data[4 * counter + 1] = colormap[1][colorIndex] * 255
                    ctxData.data[4 * counter + 2] = colormap[2][colorIndex] * 255
                    ctxData.data[4 * counter + 3] = histogram[counter] / maxValue * 255
                    counter++
                }
            }

            this.displayContext.putImageData(ctxData, 0, 0);

            
            axishelper.update(colorLevel, maxHeight)
        }

        // 根據視圖的狀態設置樣板的標記範圍
        let applyHistogramData = () => {

            return new Promise((resolve, reject) => {
                let segment = state.focusedSegment;

                let mapData = this.markContext.getImageData(0, 0, this.xLength, this.yLength).data

                let getMapDataByPosition = (posX, posY) => {
                    return mapData[(posY * this.xLength + posX) * 4 + 3]
                }

                // 防呆
                if (segment === null || !(segment instanceof Segment)) {
                    alert('No usable Segment found! Please create one first.')
                    return;
                }

                // 清除樣板上的內容
                segment.data.clear()

                let baseData = state.volume.data;
                let tfData = state.transferData.data
                let maxVal = 2 ** state.info.bitsStored

                let xIndex, yIndex;

                // 加速計算過程
                let scalarX = (this.xLength - 1) / (maxVal - 1)
                let scalarY = (this.yLength - 1) / (255)

                for (let i = 0; i < baseData.length; i++) {

                    xIndex = Math.round(baseData[i] * scalarX);
                    yIndex = Math.round(this.yLength - 1 - tfData[i] * scalarY);

                    if (getMapDataByPosition(xIndex, yIndex) == 0) {
                        segment.data.setBit(i);
                    }
                }
                resolve()
            })

        };

        // 根據該類別當前的狀態(selectedMode)，決定執行的動作
        this.process = () => {
            return new Promise(async (resolve, reject) => {
                // 未啟動前，強制返回
                //if (!this.enable) {
                //  reject()
                //return
                //}

                let rgba = state.colorSetting.rgba

                // 執行call
                this.onstart()

                switch (this.selectedMode) {
                    case this.mode.GRADIENT:
                        await calculateGradients();
                        build2dHistogram(rgba)
                        break
                    case this.mode.SIZEDATA:
                        await calculateSizeData();
                        build2dHistogram(rgba)
                        break
                    case this.mode.DEFAULT:
                        await calculateDefault();
                        build2dHistogram(rgba, true)
                        break
                    case this.mode.APPLY:
                        await applyHistogramData()
                        break
                    default:
                        break
                }

                // 完成call
                this.onload()

                resolve()
            })
        }

    }

    set enable(option) {
        this.__enable = option
    }

    get enable() {
        return this.__enable
    }

}

export { MaskProcess, ListControlTools, BrushTools, ThresholdTools, GrowingTools, FilterTools, LogicTools, CropTools, SizeBasedTools, ScissorTools, TransferTools2 }