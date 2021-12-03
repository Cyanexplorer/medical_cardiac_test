class SegState {
    constructor() {
        this.base = null
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

    get focusedSegment() {
        if (this.fIndex >= 0 && this.fIndex < this.segments.length) {
            return this.segments[this.fIndex]
        }
        return null
    }

    set focusedSegment(x) {
        this.segments[this.fIndex] = x
    }

    set baseSegment(segment) {
        this.segState.base = segment
    }

    get baseSegment() {
        return this.segState.base
    }

    clone() {
        let cl = new SegState()

        cl.order = this.order
        cl.fIndex = this.fIndex

        this.segments.forEach((segment) => {
            cl.segments.push(segment.clone())
        })

        return cl
    }

    copyfrom(state) {

        this.order = state.order
        this.segments = []
        this.fIndex = state.fIndex

        state.segments.forEach((segment) => {
            this.segments.push(segment.clone())
        })

    }
}

let imgWriter = function (axis, uvdDims, dataBuffer, index, result) {

    //pixelEnhense(dataBuffer)
    bufferWriter(axis, uvdDims, dataBuffer, index, convert2data(result))
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

let imgLoader = function (axis, uvdDims, dataBuffer, index) {

    let buffer = bufferLoader(axis, uvdDims, dataBuffer, index)
    return convert2Img(buffer)
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

class Segment {
    /**
     * 
     * @param {any} name used for segment identity
     * @param {any} dims 3 dimentions: x, y, z
     * @param {any} color used for segment identity
     */
    constructor(name = 'default', dims = [0,0,0], color = '000000', visible = true) {
        this.dims = [...dims]
        this.name = name
        this.color = color
        this.step = 1
        this.data = new Uint8Array(dims[0] * dims[1] * dims[2]).fill(0)
        this.visible = visible
    }

    get layer() {
        return this.dims[2]
    }

    setBuffer(axis, index, result) {
        imgWriter(axis, this.dims, this.data, index, result)
    }

    getBuffer(axis, index) {
        return imgLoader(axis, this.dims, this.data, index)
    }

    clone() {
        let tmpSeg = new Segment(this.name, this.dims, this.color, this.visible)
        tmpSeg.data.set(this.data)

        return tmpSeg
    }

    copyfrom(segment) {
        this.dims = [...segment.dims]

        this.name = segment.name
        this.color = segment.color
        this.step = segment.step

        if (this.data.length == segment.data.length) {
            this.data.set(segment.data)
        }
        else {
            this.data = new Uint8Array(segment.data)
        }

        this.visible = segment.visible
    }
}

export { Segment, SegState }