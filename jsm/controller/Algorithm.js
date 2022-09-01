import * as THREE from "../build/three.module.js"
import { BinaryArray, TypedArray3DContainer, BinaryArray3DContainer } from "../model/ExtendedArray.js"

const LAMBDA2 = 0.0001
const N = 57
const K = 1
const DBL_MAX = 3.4 * Math.E ** 38
const D_T = 0.25

let trilinearScale = (inputData, outputData, inputDims, outputDims) => {
    let template = new TypedArray3DContainer(inputData, inputDims[0], inputDims[1], inputDims[2], 0)

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

                outputData[pos++] = out
            }
        }
    }
}

class Kernel {
    constructor(dims) {
        let backData = new BinaryArray(dims[0] * dims[1] * dims[2])

        // 使用 3D container 封裝資料，以便進行三維的座標檢索
        let template = new BinaryArray3DContainer(backData, dims[0], dims[1], dims[2], 0)

        let buildKernel_e_d = (kernelSize, r) => {
            let kernel = new Array(kernelSize * kernelSize * kernelSize).fill(0);
            let limit_i, limit_j;
            let i, j, k, iStep, jStep;

            for (i = r - r;
                i <= r + r; i++) {

                limit_i = Math.pow(r, 2) - Math.pow(i - r, 2)
                limit_i = Math.sqrt(limit_i)
                limit_i = parseInt(limit_i)
                iStep = parseInt(i * kernelSize * kernelSize)

                for (j = r - limit_i; j <= r + limit_i; j++) {

                    limit_j = Math.pow(limit_i, 2) - Math.pow(j - r, 2)
                    limit_j = Math.sqrt(limit_j)
                    limit_j = parseInt(limit_j)
                    jStep = parseInt(j * kernelSize)

                    for (k = r - limit_j; k <= r + limit_j; k++) {

                        kernel[iStep + jStep + parseInt(k)] = 1
                    }
                }
            }

            return kernel;
        };

        // 形態學 侵蝕
        this.erode = async (segment, paddingSize = 1) => {

            let kernelSize = paddingSize * 2 + 1
            let kDims = [kernelSize, kernelSize, kernelSize]
            let kernel = buildKernel_e_d(kernelSize, paddingSize)

            await convolution_edgeAsync(segment, kernel, kDims, 0)
        };

        // 形態學 擴張
        this.dilate = async (segment, paddingSize = 1) => {

            let kernelSize = paddingSize * 2 + 1
            let kernel = buildKernel_e_d(kernelSize, paddingSize)
            let kDims = [kernelSize, kernelSize, kernelSize]

            await convolution_edgeAsync(segment, kernel, kDims, 1)
        };

        // 計算影像梯度分布圖
        // normalize 是否將數值二值化(0 or 1)
        this.gradientMagnitude = async (imgData, tfData) => {
            let kDims = [3, 3, 3];
            let kernels = new Array(3);

            //x axis

            kernels[0] = [
                1, 0, -1, 2, 0, -2, 1, 0, -1,
                2, 0, -2, 4, 0, -4, 2, 0, -2,
                1, 0, -1, 2, 0, -2, 1, 0, -1];

            //y axis
            kernels[1] = [
                1, 2, 1, 0, 0, 0, -1, -2, -1,
                2, 4, 2, 0, 0, 0, -2, -4, -2,
                1, 2, 1, 0, 0, 0, -1, -2, -1];

            //z axis
            kernels[2] = [
                1, 2, 1, 2, 4, 2, 1, 2, 1,
                0, 0, 0, 0, 0, 0, 0, 0, 0,
                -1, -2, -1, -2, -4, -2, -1, -2, -1];

            await sobelAsync2(imgData, kernels, kDims, tfData)
        };

        // 二值化影像數值至0, 1
        this.normalize = (result, threshold = 0) => {
            for (let i = 0; i < result.length; i++) {
                result[i] = result[i] > threshold ? 1 : 0;
            }
        }

        // 邊界偵測
        this.canny = (segment, paddingSize, result) => {
            //this.gaussian(segment, paddingSize)
            //this.gradientMagnitude(segment, result)
        }

        // 形態學 開合
        this.open = async (segment, paddingSize) => {

            await this.erode(segment, paddingSize)
            await this.dilate(segment, paddingSize)
        }

        // 形態學 閉合
        this.close = async (segment, paddingSize) => {
            await this.dilate(segment, paddingSize)
            await this.erode(segment, paddingSize)
        }

        // 影像平均濾波
        this.medium = async (segment, paddingSize = 1) => {

            let kernelSize = paddingSize * 2 + 1
            let kernel = new Array(kernelSize * kernelSize * kernelSize).fill(1)
            let kDims = [kernelSize, kernelSize, kernelSize]

            await convolution_blurAsync(segment, kernel, kDims, paddingSize)
        }

        this.trend = async (segment, paddingSize = 1) => {
            let kernelSize = paddingSize * 2 + 1
            let kernel = new Array(kernelSize * kernelSize * kernelSize).fill(1)
            let kDims = [kernelSize, kernelSize, kernelSize]

            await convolution_blurAsync(segment, kernel, kDims)
        }

        this.gaussian = async (segment, paddingSize = 1) => {
            let ksize = paddingSize * 2 + 1
            let kernel = new Array(ksize * ksize * ksize).fill(0)

            let center = paddingSize;
            let x2, y2, z2;
            let pos = 0;
            let sigma = 0.8
            for (let i = 0; i < ksize; i++) {
                x2 = Math.pow(i - center, 2);
                for (let j = 0; j < ksize; j++) {
                    y2 = Math.pow(j - center, 2);
                    for (let k = 0; k < ksize; k++) {
                        z2 = Math.pow(k - center, 2);
                        let g = Math.exp(-(x2 + y2 + z2) / (2 * sigma * sigma));
                        g /= 2 * Math.PI * sigma;
                        kernel[pos++] = g;
                    }
                }
            }

            let m = 1 / kernel[0];
            pos = 0
            for (let i = 0; i < ksize; i++) {
                for (let j = 0; j < ksize; j++) {
                    for (let k = 0; k < ksize; k++) {
                        kernel[pos++] *= m;
                    }
                }
            }

            let kDims = [ksize, ksize, ksize]

            await convolution_blurAsync(segment, kernel, kDims)
        }

        // 預處理捲積計算中，kernel陣列裡各項元素的索引位置
        let kernelOrder = (kDims) => {

            let arr = new Array()
            let i, j, k

            for (i = 0; i < kDims[2]; i++) {
                for (j = 0; j < kDims[1]; j++) {
                    for (k = 0; k < kDims[0]; k++) {
                        arr.push([k, j, i])
                    }
                }
            }

            return arr
        }

        // 模糊處理
        let convolution_blur = (segment, kernel, kDims) => {

            let binData = segment.data
            //let backData = segment.backData
            let dims = segment.dims

            // 將kernel計算時的座標索引，由三維攤平成一維陣列
            let kOrder = kernelOrder(kDims)

            //let template = new BinaryArray3DContainer(backData, dims[0], dims[1], dims[2], 0)

            // 將前景資料複製至背景(暫存)資料陣列中
            backData.copyfrom(binData)

            let kSum = 0
            // 預先計算kernel的size
            for (let i of kernel) {
                kSum += i
            }

            let calculate = (x, y, z) => {

                let p = 0

                for (let i = 0; i < kOrder.length; i++) {
                    let order = kOrder[i]

                    let kPos_x = Math.abs(x + order[0])
                    let kPos_y = Math.abs(y + order[1])
                    let kPos_z = Math.abs(z + order[2])

                    p += kernel[i] * template.getValue3D(kPos_x, kPos_y, kPos_z)

                }

                return Math.round(p / kSum)
            }

            // 當kernel center == 暫存資料的數值，計算之
            let offset = (kernel.length + 1) / 2
            let kCenter = kernel[offset]

            let pos = 0
            let i, j, k

            for (i = 0; i < dims[2]; i++) {
                for (j = 0; j < dims[1]; j++) {
                    for (k = 0; k < dims[0]; k++) {
                        if (template.getValue(pos) == kCenter) {
                            binData.setValue(calculate(k, j, i), pos)
                        }
                        pos++
                    }
                }
            }

            //segment.switchData()
        }

        // 模糊處理
        let convolution_blurAsync = (segment, kernel, kDims) => {

            return new Promise((resolve) => {
                let binData = segment.data
                //let backData = segment.backData
                let dims = segment.dims
                let kOrder = kernelOrder(kDims)

                let src = './jsm/webWorkers/blurWorker.js'

                let xhr = new XMLHttpRequest()
                xhr.onload = () => {
                    if (xhr.readyState != 4 || xhr.status != 200) {
                        return
                    }

                    let url = URL.createObjectURL(new Blob([xhr.responseText], { type: 'application/javascript' }))

                    let worker = new Worker(url, { type: 'module' })

                    worker.onmessage = (e) => {
                        resolve()
                    }

                    worker.postMessage({
                        dataBuffer: binData.data.buffer,
                        dims: dims,
                        backDataBuffer: backData.data.buffer,
                        kernel: kernel,
                        kDims: kDims,
                        kOrder: kOrder,
                    })
                }

                xhr.open('get', src)
                xhr.send()
            })

        }

        let convolution_edgeAsync = (segment, kernel, kDims, target) => {

            return new Promise((resolve) => {
                //padding(dims, binData, paddingSize)

                let binData = segment.data
                //let backData = segment.backData
                let dims = segment.dims
                let kOrder = kernelOrder(kDims)

                backData.copyfrom(binData)

                let src = './jsm/webWorkers/edgeWorker.js'

                let xhr = new XMLHttpRequest()
                xhr.onload = () => {
                    if (xhr.readyState != 4 || xhr.status != 200) {
                        return
                    }

                    let url = URL.createObjectURL(new Blob([xhr.responseText], { type: 'application/javascript' }))

                    let worker = new Worker(url, { type: 'module' })

                    worker.onmessage = (e) => {
                        pushData(backData.data, backData.data)
                        //segment.switchData()
                        resolve()
                    }

                    worker.postMessage({
                        dataBuffer: binData.data.buffer,
                        dims: dims,
                        backDataBuffer: backData.data.buffer,
                        kernel: kernel,
                        kDims: kDims,
                        kOrder: kOrder,
                        target: target
                    })
                }

                xhr.open('get', src)
                xhr.send()


            })


        }


        // 邊界偵測
        let sobel = (imageData, kernels, kDims, result) => {

            //padding(dims, binData, paddingSize)
            let data = imageData.data
            let dims = imageData.dims
            //let backData = imageData.backData

            pushData(data, backData)

            let template = new TypedArray3DContainer(backData, dims[0], dims[1], dims[2], 0)

            let kOrder = kernelOrder(kDims)
            let p, q, r
            let kmultiply = (x, y, z) => {

                p = q = r = 0;

                for (let i = 0; i < kOrder.length; i++) {
                    let order = kOrder[i]

                    let kPos_x = Math.abs(x + order[0])
                    let kPos_y = Math.abs(y + order[1])
                    let kPos_z = Math.abs(z + order[2])

                    let pValue = template.getValue3D(kPos_x, kPos_y, kPos_z)

                    p += kernels[0][i] * pValue
                    q += kernels[1][i] * pValue
                    r += kernels[2][i] * pValue
                }

                return (p * p + q * q + r * r) ** 0.5
            }

            let pos = 0
            let i, j, k
            for (i = 0; i < dims[2]; i++) {
                for (j = 0; j < dims[1]; j++) {
                    for (k = 0; k < dims[0]; k++) {
                        result[pos++] = kmultiply(k, j, i)
                    }
                }
            }
        }

        let sobelAsync2 = (imageData, kernels, kDims, tfData) => {

            return new Promise((resolve, reject) => {

                let xhr = new XMLHttpRequest()
                xhr.onload = () => {
                    if (xhr.readyState != 4 || xhr.status != 200) {
                        return
                    }

                    //載入縮圖減少運算壓力
                    let imagetb = imageData.thumbnail
                    let dims = imageData.thumbnailSize

                    let tftb = tfData.thumbnail
                    tftb.fill(0)

                    let kOrder = kernelOrder(kDims)
                    let counter = 0

                    let url = URL.createObjectURL(new Blob([xhr.responseText], { type: 'application/javascript' }))

                    for (let i = 0; i < kernels.length; i++) {

                        let worker = new Worker(url, { type: 'module' })

                        worker.onmessage = (e) => {
                            counter++

                            if (counter == 3) {

                                for (let j = 0; j < tftb.length; j++) {
                                    tftb[j] = tftb[j] ** 0.5 * 16
                                }

                                let result = tfData.data
                                let tfdims = tfData.dims

                                trilinearScale(tftb, result, dims, tfdims)
                                console.log(result)
                                resolve()
                            }
                        }

                        worker.postMessage({
                            dataBuffer: imagetb.buffer,
                            dims: dims,
                            backDataBuffer: tftb.buffer,
                            kernel: kernels[i],
                            kOrder: kOrder
                        })
                    }
                }

                xhr.open('get', './jsm/webWorkers/gradientWorker8.js')
                xhr.send()
            })



        }

    }
}


class Logic {
    static checkInput = (source, destination) => {
        if (source.length != destination.length) {
            console.error('Data length out of range.')
            return false
        }
        return true
    }

    static union = (source, destination) => {
        if (!this.checkInput(source, destination)) {
            return
        }

        for (let i = 0; i < source.length; i++) {
            if (source.getBit(i) > 0) {
                destination.setBit(i)
            }
        }
    }

    static intersection = (source, destination) => {
        if (!this.checkInput(source, destination)) {
            return
        }

        for (let i = 0; i < source.length; i++) {
            if (source.getBit(i) > 0 && destination.getBit(i) > 0) {
                destination.setBit(i);
            } else {
                destination.clearBit(i);
            }
        }
    }

    static boolean = (source, destination) => {
        if (!this.checkInput(source, destination)) {
            return;
        }

        for (let i = 0; i < source.length; i++) {
            if (source.getBit(i) > 0) {
                destination.clearBit(i);
            }
        }
    }

    static exclusive = (source, destination) => {
        if (!this.checkInput(source, destination)) {
            return;
        }

        for (let i = 0; i < source.length; i++) {
            if ((source.getBit(i) + destination.getBit(i)) == 1) {
                destination.setBit(i);
            } else {
                destination.clearBit(i);
            }
        }
    }

    static copy = (source, destination) => {
        if (!this.checkInput(source, destination)) {
            return;
        }

        for (let i = 0; i < source.length; i++) {
            destination.setValue(source.getBit(i), i);
        }
    }

    static overlay = (source, destination, option) => {
        if (!this.checkInput(source, destination)) {
            return;
        }

        if (option) {
            for (let i = 0; i < source.length; i++) {
                if (source.getBit(i) & destination.getBit(i) == 0)
                    destination.clearBit(i)
            }
        } else {
            for (let i = 0; i < source.length; i++) {
                if (source.getBit(i) & destination.getBit(i) == 1)
                    destination.setBit(i)
            }
        }

    }
}

const dir = [
    //0
    { x: 0, y: 1, z: 0 },
    { x: 1, y: 0, z: 0 },
    { x: 0, y: -1, z: 0 },
    { x: -1, y: 0, z: 0 },
    { x: 1, y: 1, z: 0 },
    { x: 1, y: -1, z: 0 },
    { x: -1, y: -1, z: 0 },
    { x: -1, y: 1, z: 0 },

    //1
    { x: 0, y: 1, z: 1 },
    { x: 1, y: 0, z: 1 },
    { x: 0, y: -1, z: 1 },
    { x: -1, y: 0, z: 1 },
    { x: 1, y: 1, z: 1 },
    { x: 1, y: -1, z: 1 },
    { x: -1, y: -1, z: 1 },
    { x: -1, y: 1, z: 1 },

    //-1
    { x: 0, y: 1, z: -1 },
    { x: 1, y: 0, z: -1 },
    { x: 0, y: -1, z: -1 },
    { x: -1, y: 0, z: -1 },
    { x: 1, y: 1, z: -1 },
    { x: 1, y: -1, z: -1 },
    { x: -1, y: -1, z: -1 },
    { x: -1, y: 1, z: -1 },

    { x: 0, y: 0, z: -1 },
    { x: 0, y: 0, z: 1 }
]

const dir2D = [
    { x: 0, y: 1, z: 0 },
    { x: 1, y: 0, z: 0 },
    { x: 0, y: -1, z: 0 },
    { x: -1, y: 0, z: 0 },
    { x: 1, y: 1, z: 0 },
    { x: 1, y: -1, z: 0 },
    { x: -1, y: -1, z: 0 },
    { x: -1, y: 1, z: 0 }
]

class Growing {
    constructor(dims) {

        //let segBuffer = bufferLoader(axisUV, dims, segData, layerIndex)

        /**
         * 
         * Count size is the predictable maximun length of region growing, and there should be 3 elements for an iterator.
         * Stack will occupy count * 3 blocks.
         * 
         * */

        let count = (dims[0] * dims[1] + dims[1] * dims[2] + dims[2] * dims[0]) * 2;
        //let count3d = dims[0] * dims[1] * dims[2];

        //let visit = new BinaryArray(count3d);
        let visit = new BinaryArray(dims[0] * dims[1] * dims[2])
        let stack_x = [new Uint16Array(count), new Uint16Array(count)];
        let stack_y = [new Uint16Array(count), new Uint16Array(count)];
        let stack_z = [new Uint16Array(count), new Uint16Array(count)];

        const DISCARD = -1
        const NONSELECT = 0
        const SELECTED = 1

        let search = (coordinates, ptn, onload, directions) => {
            //let visit = ptn.backData
            let bin = ptn.data
            visit.clear()

            let dims01 = dims[1] * dims[0]
            let index = coordinates.z * dims01 + coordinates.y * dims[0] + coordinates.x;

            visit.setBit(index);
            bin.setBit(index);

            //x, y, z, direction, remain life
            stack_x[0].set([coordinates.x], 0);
            stack_y[0].set([coordinates.y], 0);
            stack_z[0].set([coordinates.z], 0);

            let slot = 0;
            let slot_size = 1;

            let searchResult = {
                '-1': () => {
                    return false
                },
                0: (index) => {
                    visit.setBit(index);
                    return false
                },
                1: (index) => {
                    visit.setBit(index);
                    return true
                }
            }

            while (true) {
                let slot_n = (slot + 1) % 2;
                let slot_size_n = 0;

                for (let i = 0; i < slot_size; i++) {
                    let cx = stack_x[slot][i];
                    let cy = stack_y[slot][i];
                    let cz = stack_z[slot][i];

                    directions.forEach((d) => {
                        let ncx = cx + d.x;
                        let ncy = cy + d.y;
                        let ncz = cz + d.z;

                        //ncx  < 0 || ncy < 0 || ncz < 0
                        //ncx >= dims[0] || ncy >= dims[1] || ncz >= dims[2]
                        //檢查是否出界
                        if (ncx < 0 || ncy < 0 || ncz < 0 || ncx >= dims[0] || ncy >= dims[1] || ncz >= dims[2]) {
                            return;
                        }

                        //排除重複搜尋
                        let nextIndex = ncz * dims01 + ncy * dims[0] + ncx;
                        if (visit.getBit(nextIndex) === 1) {
                            return;
                        }

                        let result = onload(bin, nextIndex)
                        if (searchResult[result] == null || !searchResult[result](nextIndex)) {
                            return
                        }

                        stack_x[slot_n].set([ncx], slot_size_n);
                        stack_y[slot_n].set([ncy], slot_size_n);
                        stack_z[slot_n].set([ncz], slot_size_n);
                        slot_size_n++;
                    });
                }

                //未發現新區域
                if (slot_size_n === 0) {
                    break;
                }

                slot = slot_n;
                slot_size = slot_size_n;
            }


        }

        this.edgeDetector = (x, y, layerIndex, source, bias, margin, mask, result) => {
            //let visit = result.backData
            visit.clear()
            let index = layerIndex * dims[1] * dims[0] + y * dims[0] + x
            visit.setValue(1, index)
            result[index] = 1


            let target = source[index]

            //x, y, z, direction, remain life
            stack_x.set([x], 0);
            stack_y.set([y], 0);
            stack_z.set([layerIndex], 0);

            let cx, cy, cz, life;
            let stackIndex = 0
            let stackSize = 1
            let buffer = []
            let option = false

            //console.log(dims)
            while (stackIndex < stackSize) {

                cx = stack_x[stackIndex]
                cy = stack_y[stackIndex]
                cz = stack_z[stackIndex]

                stackIndex++

                index = cz * dims[1] * dims[0] + cy * dims[0] + cx
                option = false
                buffer = []

                dir.forEach((d) => {
                    let ncx = cx + d.x
                    let ncy = cy + d.y
                    let ncz = cz + d.z

                    //ncx  < 0 || ncy < 0 || ncz < 0
                    //ncx >= dims[0] || ncy >= dims[1] || ncz >= dims[2]
                    //檢查是否出界
                    if (ncx < 0 || ncy < 0 || ncz < 0 || ncx >= dims[0] || ncy >= dims[1] || ncz >= dims[2]) {
                        return
                    }

                    //排除重複搜尋
                    let nextIndex = ncz * dims[1] * dims[0] + ncy * dims[0] + ncx
                    if (visit.getValue(nextIndex) == 1) {
                        return
                    }

                    visit.setValue(1, nextIndex)


                    //閥值檢測
                    if (Math.abs(target - source[nextIndex]) < 0.05) {
                        buffer.push([ncx, ncy, ncz])

                    } else {
                        option = true

                    }

                })

                if (option) {

                    result[index] = 1

                    for (let i = 0; i < buffer.length; i++) {
                        stack_x.set(buffer[i][0], stackSize);
                        stack_y.set(buffer[i][1], stackSize);
                        stack_z.set(buffer[i][2], stackSize);
                        stackSize++;
                    }
                }


            }

        }

        this.regionGrowing = (x, y, layerIndex, source, bias, pattern) => {

            let coordinates = {
                x: x,
                y: y,
                z: layerIndex
            }

            let index = coordinates.z * dims[1] * dims[0] + coordinates.y * dims[0] + coordinates.x;
            let target = source[index];
            let upperBound = target + bias;
            let lowerBound = target - bias;

            let onload = (bin, index) => {
                if (source[index] >= upperBound || source[index] < lowerBound) {
                    return NONSELECT;
                }

                bin.setBit(index);

                return SELECTED
            }

            search(coordinates, pattern, onload, dir)

        };

        this.regionExclusive = (x, y, layerIndex, source, bias, pattern) => {
            let coordinates = {
                x: x,
                y: y,
                z: layerIndex
            }

            let index = coordinates.z * dims[1] * dims[0] + coordinates.y * dims[0] + coordinates.x;
            let target = source[index];
            let upperBound = target + bias;
            let lowerBound = target - bias;

            let onload = (bin, index) => {
                if (source[index] >= upperBound || source[index] < lowerBound) {
                    return NONSELECT;
                }

                if (bin.getBit[index] == 1) {
                    return NONSELECT
                }

                bin.setBit(index);
                return SELECTED
            }

            search(coordinates, pattern, onload, dir)
        }

        this.regionFill = (x, y, layerIndex, pattern) => {
            let coordinates = {
                x: x,
                y: y,
                z: layerIndex
            }

            let onload = (bin, index) => {
                if (bin.getBit(index) == 1) {
                    return NONSELECT
                }

                bin.setBit(index)
                return SELECTED
            }

            search(coordinates, pattern, onload, dir)
        }

        this.regionPreserve = (x, y, layerIndex, pattern) => {
            let coordinates = {
                x: x,
                y: y,
                z: layerIndex
            }

            let onload = (bin, index) => {
                if (bin.getBit(index) == 0) {
                    return DISCARD
                }

                return SELECTED
            }

            search(coordinates, pattern, onload, dir)

            pushData(visit.data, pattern.data.data)
            //pattern.switchData()
        }

        this.regionRemove = (x, y, layerIndex, pattern) => {
            let coordinates = {
                x: x,
                y: y,
                z: layerIndex
            }

            let onload = (bin, index) => {
                if (bin.getBit(index) == 0) {
                    return NONSELECT
                }

                bin.clearBit(index);
                return SELECTED
            }

            search(coordinates, pattern, onload, dir)
        }

        this.regionGrowing2D = (x, y, layerIndex, source, bias, pattern) => {
            let coordinates = {
                x: x,
                y: y,
                z: layerIndex
            }

            let index = coordinates.z * dims[1] * dims[0] + coordinates.y * dims[0] + coordinates.x;
            let target = source[index];
            let upperBound = target + bias;
            let lowerBound = target - bias;

            let onload = (bin, index) => {
                if (source[index] >= upperBound || source[index] < lowerBound) {
                    return NONSELECT;
                }

                bin.setBit(index);

                return SELECTED
            }

            search(coordinates, pattern, onload, dir2D)
        }

        this.regionPreserve2D = (x, y, layerIndex, pattern) => {
            let coordinates = {
                x: x,
                y: y,
                z: layerIndex
            }

            let onload = (bin, index) => {
                if (bin.getBit(index) == 0) {
                    return NONSELECT
                }

                return SELECTED
            }

            search(coordinates, pattern, onload, dir2D)

            let dims = pattern.dims
            let size2 = dims[0] * dims[1]
            for (let i = size2 * layerIndex; i < size2 * (layerIndex + 1); i++)
                pattern.data.setBit(i, pattern.backData.getBit(i))

            //pattern.switchData()
        }

        this.regionRemove2D = (x, y, layerIndex, pattern) => {
            let coordinates = {
                x: x,
                y: y,
                z: layerIndex
            }

            let onload = (bin, index) => {
                if (bin.getBit(index) == 0) {
                    return NONSELECT
                }

                bin.clearBit(index);
                return SELECTED
            }

            search(coordinates, pattern, onload, dir2D)

            let dims = pattern.dims
            let size2 = dims[0] * dims[1]
            for (let i = size2 * layerIndex; i < size2 * (layerIndex + 1); i++)
                pattern.data.setBit(i, pattern.backData.getBit(i))
        }

        this.regionExclusive = (x, y, layerIndex, source, bias, pattern) => {
            let coordinates = {
                x: x,
                y: y,
                z: layerIndex
            }

            let index = coordinates.z * dims[1] * dims[0] + coordinates.y * dims[0] + coordinates.x;
            let target = source[index];
            let upperBound = target + bias;
            let lowerBound = target - bias;

            let onload = (bin, index) => {
                if (source[index] >= upperBound || source[index] < lowerBound) {
                    return NONSELECT;
                }

                if (bin.getBit[index] == 1) {
                    return NONSELECT
                }

                bin.setBit(index);
                return SELECTED
            }

            search(coordinates, pattern, onload, dir2D)
        }

        this.regionFill = (x, y, layerIndex, pattern) => {
            let coordinates = {
                x: x,
                y: y,
                z: layerIndex
            }

            let onload = (bin, index) => {
                if (bin.getBit(index) == 1) {
                    return NONSELECT
                }

                bin.setBit(index)
                return SELECTED
            }

            search(coordinates, pattern, onload, dir2D)
        }
    }

}

class Gaussian {

    constructor(n) {

        let size = 2 * n + 1
        let size2 = Math.pow(size, 2)
        let size3 = Math.pow(size, 3)
        let dt = D_T
        let coeff = new Float32Array(size3)

        let C = function (x) {
            if (x > 0)
                return LAMBDA2 / (LAMBDA2 + x * x / 65535);
            return 1.0
        }

        let phi = function (x) {
            return x * C(x)
        }

        let dotDiff = function (data, temp, dotI, dotJ, dotK) {

            let dotOffset, coeffOffset
            let sum = 0
            let n = (size - 1) / 2

            let iInit = (dotI >= n) ? -n : -dotI
            let jInit = (dotJ >= n) ? -n : -dotJ
            let kInit = (dotK >= n) ? -n : -dotK

            let dotIndex = dotI * data.dims[1] * data.dims[0] + dotJ * data.dims[0] + dotK
            let coeffIndex = (size2 + size + 1) * n

            let vol1 = data.volumeData[temp]
            let vol2 = data.volumeData[temp + 1]

            vol2[dotIndex] = 0

            for (let i = iInit; (i <= n) && ((i + dotI) < data.dims[2]); i++) {
                for (let j = jInit, iStep = i * (data.dims[1]) * (data.dims[0]); (j <= n) && ((j + dotJ) < data.dims[1]); j++) {
                    for (let k = kInit, jStep = j * (data.dims[0]); (k <= n) && ((k + dotK) < data.dims[0]); k++) {
                        dotOffset = iStep + jStep + k;
                        coeffOffset = i * size2 + j * size + k;
                        vol2[dotIndex] += phi(vol1[dotIndex + dotOffset] - vol1[dotIndex]) * (coeff[coeffIndex + coeffOffset]);

                        sum += (coeff[coeffIndex + coeffOffset]);
                    }
                }
            }

            if (sum != 1.0)
                vol2[dotIndex] /= sum;

            vol2[dotIndex] = vol2[dotIndex] * (dt) + vol1[dotIndex];
        }

        this.compCoeff = function (t) {
            let i, j, k
            let n = (size - 1) / 2
            let index = 0
            let sum = 0

            for (i = -n; i <= n; i++) {
                for (j = -n; j <= n; j++) {
                    for (k = -n; k <= n; k++) {
                        coeff[index] = Math.exp(-(i * i + j * j + k * k) / (2 * t)) / (2 * Math.PI * t)
                        sum += coeff[index]
                        index++
                    }
                }
            }

            coeff = coeff.map(x => x / sum)
        }

        this.diff = function (data, onload) {
            let tmp = {
                alpha: data.alpha.slice(),
                dims: data.dims
            }
            let index = 0;

            for (let i = 0; i < data.dims[2]; i++)
                for (let j = 0; j < data.dims[1]; j++)
                    for (let k = 0; k < data.dims[0]; k++)
                        dotDiff(data, 0, i, j, k);

            //console.log("iteration: 1\n");
            index = 0;

            for (let i = 0; i < data.dims[2]; i++) {
                for (let j = 0; j < data.dims[1]; j++) {
                    for (let k = 0; k < data.dims[0]; k++) {
                        data.laplacianValue[0][index] = 0.0
                        data.laplacianValue[1][index] = data.laplacian(i, j, k, 1)
                        dotDiff(data, 1, i, j, k)
                        tmp.alpha[index] = data.volumeData[1][index]
                        data.t[index] = N - 1
                        index++
                    }
                }
            }
            onload(tmp, 2 / N)
            //console.log("iteration: 2\n");

            let loop = function (t) {
                index = 0;
                data.add();
                for (let i = 0; i < data.dims[2]; i++) {
                    for (let j = 0; j < data.dims[1]; j++) {
                        for (let k = 0; k < data.dims[0]; k++) {
                            data.laplacianValue[2][index] = data.laplacian(i, j, k, 1) * t;
                            dotDiff(data, 1, i, j, k);
                            tmp.alpha[index] = data.volumeData[1][index]
                            data.scaleDetection(index, t);
                            index++;
                        }
                    }
                }

                onload(tmp, (t) / N)
                //console.log("iteration: %d\n", t + 1);
                if (t < N) {
                    t++
                    setTimeout(() => {
                        loop(t)
                    }, 5)
                }
            }
            loop(2)
        }

        this.compCoeff(D_T)
    }
}

class SizeBased {
    constructor(dims) {

        this.dims = dims
        this.alpha = null
        this.rgba = null

        let arraySize = this.dims[2] * this.dims[1] * this.dims[0]
        this.laplacianValue = [new Float32Array(arraySize), new Float32Array(arraySize), new Float32Array(arraySize)]
        this.volumeData = [new Float32Array(arraySize), new Float32Array(arraySize), new Float32Array(arraySize)]

        this.t = new Float32Array(arraySize)

        let sizeMax = 0.0;
        let sizeMin = DBL_MAX;

        this.process = (volume, rgba, onprogress, onload) => {
            this.rgba = rgba

            volume.generateThumbnail()
            this.alpha = volume.thumbnail

            for (let i = 0; i < this.alpha.length; i++) {
                this.volumeData[0][i] = this.alpha[i]
            }

            let gaussian1 = new Gaussian(1)
            gaussian1.diff(this, (result, progress) => {
                if (onprogress instanceof Function) {
                    onprogress(result, progress)
                }

                if (progress == 1) {
                    this.interp()

                    trilinearScale(volume.thumbnail, volume.data, volume.thumbnailSize, volume.dims)

                    if (onload instanceof Function) {

                        onload()
                    }
                }
            })

        }

        this.add = function () {
            let temp = this.volumeData[0]
            this.volumeData[0] = this.volumeData[1]
            this.volumeData[1] = this.volumeData[2]
            this.volumeData[2] = temp
        }

        this.laplacian = function (x, y, z, t) {
            let wh = this.dims[1] * this.dims[0]
            let vol = this.volumeData[t]
            let index = x * wh + y * this.dims[0] + z
            let sum = (-6) * vol[index]

            if ((x - 1) >= 0) {
                sum += vol[index - wh]
            }
            else {
                sum += vol[index + wh]
            }

            if ((x + 1) >= this.dims[2]) {
                sum += vol[index - wh]
            }
            else {
                sum += vol[index + wh]
            }

            if ((y - 1) >= 0) {
                sum += vol[index - this.dims[0]]
            }
            else {
                sum += vol[index + this.dims[0]]
            }

            if ((y + 1) >= this.dims[2]) {
                sum += vol[index - this.dims[0]]
            }
            else {
                sum += vol[index + this.dims[0]]
            }

            if ((z - 1) >= 0) {
                sum += vol[index - 1]
            }
            else {
                sum += vol[index + 1]
            }

            if ((z + 1) >= this.dims[2]) {
                sum += vol[index - 1]
            }
            else {
                sum += vol[index + 1]
            }

            return Math.abs(sum)
        }

        this.scaleDetection = function (index, t) {
            if (this.t[index] == (N - 1) && this.laplacianValue[1][index] > this.laplacianValue[0][index] && this.laplacianValue[1][index] > this.laplacianValue[2][index])
                this.t[index] = t - 1.0;

            this.laplacianValue[0][index] = this.laplacianValue[1][index];
            this.laplacianValue[1][index] = this.laplacianValue[2][index];
        }

        function theta(d, h) {
            h = h * K;

            let temp = 1.0 - (d / h);

            if (temp > 1.0)
                temp = 1.0;
            else if (temp < 0.0)
                temp = 0.0;

            temp = Math.pow(temp, 4);

            return temp * (((4 * d) / h) + 1.0);
        }

        this.dotInterp = function (temp, x, y, z) {
            let index = x * (this.dims[1]) * (this.dims[0]) + y * (this.dims[0]) + z;
            //console.log(this.alpha[index], index)
            if (this.rgba[3][this.alpha[index]] > 0) {

                let t = (this.t[index]) * D_T
                let n = parseInt(t)
                let d, offset;

                let iInit = (x - n >= 0) ? -n : -x
                let jInit = (y - n >= 0) ? -n : -y
                let kInit = (z - n >= 0) ? -n : -z

                for (let i = iInit; (i <= n) && ((i + x) < this.dims[2]); i++) {
                    for (let j = jInit, iStep = i * (this.dims[1]) * (this.dims[0]); (j <= n) && ((j + y) < this.dims[1]); j++) {
                        for (let k = kInit, jStep = j * (this.dims[0]); (k <= n) && ((k + z) < this.dims[0]); k++) {
                            offset = index + iStep + jStep + k;
                            d = Math.sqrt(i * i + j * j + k * k);

                            temp[offset] += (theta(d, t)) * t;
                            if (sizeMax < temp[offset])
                                sizeMax = temp[offset];
                            if (sizeMin > temp[offset])
                                sizeMin = temp[offset];
                        }
                    }
                }
            }
        }

        this.interp = function () {
            sizeMax = 0.0;
            sizeMin = DBL_MAX;

            let temp = new Float32Array(this.dims[2] * this.dims[1] * this.dims[0]).fill(0)

            for (let i = 0; i < this.dims[2]; i++)
                for (let j = 0; j < this.dims[1]; j++)
                    for (let k = 0; k < this.dims[0]; k++)
                        this.dotInterp(temp, i, j, k);

            //console.log(temp)
            let diff = sizeMax - sizeMin
            if (diff > 0.0) {
                for (let i = 0; i < this.alpha.length; i++) {
                    this.alpha[i] = ((temp[i] - sizeMin) * 255.0) / diff + 0.5
                }

            }
            this.used = true;
        }

    }

}


class Scissor {
    constructor(dims) {
        let size = dims[0]
        let size2 = dims[0] * dims[1]
        let size3 = dims[0] * dims[1] * dims[2]
        let obj = null
        let min = Math.min(dims)
        let rc = new THREE.Raycaster()

        let getRotateMatrix = (angle, x, y, z) => {
            let rcos = 1 - Math.cos(angle)
            let rxcos = x * rcos
            let rycos = y * rcos
            let rzcos = z * rcos
            let sin = Math.sin(angle)
            let cos = Math.cos(angle)
            let rxsin = x * sin
            let rysin = y * sin
            let rzsin = z * sin

            let m0 = cos + x * rxcos
            let m1 = x * rycos - rzsin
            let m2 = x * rzcos + rysin
            let m4 = y * rxcos + rzsin
            let m5 = cos + y * rycos
            let m6 = y * rzcos - rxsin
            let m8 = z * rxcos - rysin
            let m9 = z * rycos + rxsin
            let m10 = cos + z * rzcos

            return new THREE.Matrix4(
                m0, m1, m2, 0,
                m4, m5, m6, 0,
                m8, m9, m10, 0,
                0, 0, 0, 1
            )
        }

        /**
         * 
         * @param {any} camera
         * @param {any} evt
         * @param {any} dims
         * 
         let project = (camera, evt, dims) => {
         let vec = new THREE.Vector3()
         vec.set(evt[0] / window.innerWidth * 2 - 1, -(evt[1] / window.innerHeight) * 2 + 1, 0)
         vec.unproject(camera)
         
         while (vec.x >= 0 && vec.x < dims[0] && vec.y >= 0 && vec.y < dims[1] && vec.z >= 0 && vec.z < dims[2]) {
         
         }
         }*/

        function onMouseMove(event) {

            // calculate mouse position in normalized device coordinates
            // (-1 to +1) for both components
            let mouse = new THREE.Vector2()
            mouse.x = (event.x / window.innerWidth) * 2 - 1;
            mouse.y = -(event.y / window.innerHeight) * 2 + 1;
            return mouse
        }

        let getPosition = (pos) => {
            return size2 * pos.z + size * pos.y + pos.x
        }

        let raycast = (camera, selected, mask) => {

            rc.setFromCamera(onMouseMove(selected), camera)
            let result = rc.intersectObject([obj], false, [{ point, faceIndex }])

            for (let i = 0; i < result.length; i++) {
                mask[getPosition(result[i].point)] = 1
            }

        }

        let initTemplate = () => {
            obj = new THREE.Mesh(new THREE.BoxGeometry(dims[0], dims[1], dims[2]))
            obj.material.side = THREE.DoubleSide
        }

        let adjustTemplate = () => {
            if (obj == null) {
                return
            }

            let width = obj.parameter.width--
            let height = obj.parameter.height--
            let depth = obj.parameter.depth--

            if (width < 0) {
                width = 0
            }

            if (height < 0) {
                height = 0
            }

            if (depth < 0) {
                depth = 0
            }

            obj.geometry = new THREE.BoxGeometry(width, height, depth)
        }

        this.process = (camera, selected) => {

            let mask = new Uint8Array(size3).fill(0)

            for (let i = 0; i < min; i++) {
                adjustTemplate()
                for (let j = 0; j < selected.length; j++) {
                    raycast(camera, selected[j], mask)
                }
            }

            return mask;
        }

        initTemplate();
    }
}

export { Growing, SizeBased, Logic, Scissor, Kernel }