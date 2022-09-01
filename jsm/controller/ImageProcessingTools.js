import {  BinaryArray3DContainer, TypedArray3DContainer } from "../model/ExtendedArray.js"

export class ImageProcess {
    

    constructor() {
        // 下採樣
        this.trilinearScale = (inputData, outputData, inputDims, outputDims, inputBit = 8, outputBit = 8) => {
            let template = new TypedArray3DContainer(inputData, inputDims[0], inputDims[1], inputDims[2], 0)
        
            let bitDiff = 2 ** (outputBit - inputBit)
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
        
                        outputData[pos++] = out * bitDiff
                    }
                }
            }

            console.log(outputData)
        }

        this.postprocess = async (imageData, stored, type, inverted, onload) => {

            let dataBuffer = imageData.data

            if (stored == -1) {
                console.log('Format not support.')
                return
            }

            let max = 2 ** stored

            if (type == 0) {
                mapHE(imageData, max)
            } else if (type == 1) {
                mapLog(imageData, max)
            } else if (type == 2) {
                mapCLHE(imageData, max)
            } else if (type == 3) {
                mapCLAHE(imageData, max)
            } else if (type == 4) {
                mapResize(imageData, max)
            } else if (type == 5) {
                mapCLAHE2D(imageData, max)
            } else if (type == 6) {
                mapiCLAHE(imageData, max)
            } else if (type == 7) {
                mapGradient(imageData, max)
            } else if (type == 8) {
                mapSharpen(imageData, max)
            }
            else if (type == 9) {
                mapHE2D(imageData, max)
            }

            if (inverted) {

                let scalar = max - 1;
                for (let i = 0; i < dataBuffer.length; i++) {
                    dataBuffer[i] = scalar - dataBuffer[i];
                }
            }

            if (onload instanceof Function)
                onload()
        }

        // 待修正
        let mapSharpen = (imageData, max) => {
            let dataBuffer = imageData.data
            let dims = imageData.dims

            let kernelSize = paddingSize * 2 + 1
            let kernel = new Array(kernelSize * kernelSize * kernelSize).fill(-1)

            let kLen = Math.pow(kernelSize, 3)
            kernel[parseInt(kLen / 2) + 1] = kLen

            let kDims = [kernelSize, kernelSize, kernelSize]

            convolution_blur2(segment, kernel, kDims, paddingSize)
            //-----------
            let binData = segment.data
            let backData = segment.backData
            //let dims = segment.dims

            let kOrder = kernelOrder(kDims)
            let template = new BinaryArray3DContainer(backData, dims[0], dims[1], dims[2], 0)

            backData.copyfrom(binData)

            let kDimsHalf = [parseInt(kDims[0] / 2), parseInt(kDims[1] / 2), parseInt(kDims[2] / 2)]

            let calculate = (x, y, z) => {

                let p = 0

                x -= kDimsHalf[0]
                y -= kDimsHalf[1]
                z -= kDimsHalf[2]

                for (let i = 0; i < kOrder.length; i++) {

                    let order = kOrder[i]

                    let kPos_x = Math.abs(x + order[0])
                    let kPos_y = Math.abs(y + order[1])
                    let kPos_z = Math.abs(z + order[2])

                    p += kernel[i] * template.getValueWithPadding3D(kPos_x, y + kPos_y, kPos_z)

                }

                return p
            }

            let pos = 0
            let i, j, k, p

            for (i = 0; i < dims[2]; i++) {
                for (j = 0; j < dims[1]; j++) {
                    for (k = 0; k < dims[0]; k++) {
                        p = binData.getBit(pos) * 0.9 + calculate(k, j, i) * 0.1
                        p = Math.min(Math.max(p, 0), 65535)

                        pos++
                    }
                }
            }
        }

        this.mapGradient = (imageData, max) => {
            let dataBuffer = imageData.data
            let dims = imageData.dims

            //this.normalize(result, 0.8);
        };

        let mapiCLAHE = (imageData, max) => {
            let dataBuffer = imageData.data
            let dims = imageData.dims

            let d1 = dataBuffer
            let d2 = dataBuffer.slice()

            mapCLAHE(d1, max, dims)
            mapHE(d2, max)

            for (let i = 0; i < dataBuffer.length; i++) {
                dataBuffer[i] = d1[i] * 0.5 + d2[i] * 0.5
            }

            //mapHE(dataBuffer, dims)

        }

        let mapCLAHE2DCV = (imageData) => {
            let dataBuffer = imageData.data
            let dims = imageData.dims

            let src = new cv.Mat()

            switch (dataBuffer.BYTES_PER_ELEMENT) {
                case 1:
                    src = new cv.Mat(dims[0], dims[1], cv.CV_8UC1)
                    break
                case 2:
                    src = new cv.Mat(dims[0], dims[1], cv.CV_16UC1)
                    break
                default:
                    return
            }

            let step = dims[0] * dims[1]
            let claheDst = new cv.Mat()
            let tiltGridSize = new cv.Size(8, 8)
            let clahe = new cv.CLAHE(40, tiltGridSize)

            for (let i = 0; i < dims[2]; i++) {

                for (let j = 0; j < step; j++) {
                    src.data[j] = dataBuffer[j + i * step]
                }

                clahe.apply(src, claheDst)

                dataBuffer.set(claheDst.data, i * step)
            }
        }

        let mapResize = (imageData, max) => {
            let dataBuffer = imageData.data
            let dims = imageData.dims

            let mm = getMinMax(dataBuffer)
            let ratio = (max - 1) / (mm.max - mm.min)
            for (let i = 0; i < dataBuffer.length; i++) {
                dataBuffer[i] = (dataBuffer[i] - mm.min) * ratio
            }
        }

        let mapLog = (imageData, max) => {
            let dataBuffer = imageData.data
            let dims = imageData.dims

            for (let i = 0; i < dataBuffer.length; i++) {
                dataBuffer[i] = Math.log10(dataBuffer[i])
            }

            let mm = getMinMax(dataBuffer)
            let ratio = (max - 1) / (mm.max - mm.min)
            for (let i = 0; i < dataBuffer.length; i++) {
                dataBuffer[i] = (dataBuffer[i] - mm.min) * ratio
            }
        }

        let equalization = (histogram, max) => {
            let minIndex, maxIndex

            for (minIndex = 0; minIndex < histogram.length; minIndex++) {
                if (histogram[minIndex] > 0)
                    break
            }

            for (maxIndex = histogram.length - 1; maxIndex > minIndex; maxIndex--) {
                if (histogram[maxIndex] > 0)
                    break
            }

            for (let i = minIndex + 1; i < histogram.length; i++) {
                histogram[i] += histogram[i - 1]
            }

            let maxCDF = histogram[maxIndex]
            let minCDF = histogram[minIndex]
            let ratio = (max - 1) / (maxCDF - minCDF)

            for (let i = minIndex; i < histogram.length; i++) {
                histogram[i] = Math.round((histogram[i] - minCDF) * ratio)
            }

        }

        let contrastLimit = (histogram, limit) => {

            let counter = 0
            let total = 0
            let remain = histogram.length
            for (let i = 0; i < histogram.length; i++) {
                total += histogram[i]
                if (histogram[i] > limit) {
                    counter += (histogram[i] - limit)
                    histogram[i] = limit
                    remain--
                }
            }

            if (counter / 2 >= total) {
                let value = total / histogram.length
                histogram.fill(value)
                return
            }

            //console.log(counter, upper, limit)
            while (counter > 0) {
                let offset = counter / remain
                let upper = limit - offset
                for (let i = 0; i < histogram.length; i++) {
                    if (histogram[i] > upper) {
                        counter -= limit - histogram[i]
                        histogram[i] = limit
                        remain--
                    } else {
                        counter -= offset
                        histogram[i] += offset
                    }
                }
                //console.log(counter)
            }


            //console.log(histogram)
        }

        let mapCLAHE2D = (imageData, max) => {
            let dataBuffer = imageData.data
            let dims = imageData.dims

            let blockSize = 64

            let tiles = [
                Math.ceil(dims[0] / blockSize),
                Math.ceil(dims[1] / blockSize)]

            let cdfs = new Uint32Array(tiles[1] * tiles[0] * max).fill(0)
            let histogram = new Uint32Array(max)

            let dims01 = dims[0] * dims[1]
            let dims0 = dims[0]

            let getPosition = (x, y, z) => {
                return dims01 * z + dims0 * y + x
            }

            let tiles0 = tiles[0]

            let getTilesPos = (x, y) => {
                return tiles0 * y + x
            }

            let buildcdf = (x, y, z, kDims) => {
                histogram.fill(0)

                for (let j = 0; j < kDims[1]; j++) {
                    for (let k = 0; k < kDims[0]; k++) {
                        let index = getPosition(x + k, y + j, z)
                        histogram[dataBuffer[index]]++
                    }
                }

                let climit = kDims[0] * kDims[1] * 0.2
                contrastLimit(histogram, climit)

                //equalization
                equalization(histogram, max)

                return histogram
            }

            let i, j, k
            let kDims = [blockSize, blockSize, 1]
            let rDims = [dims[0] % blockSize, dims[1] % blockSize, dims[2] % blockSize]
            let limit = [dims[0] - blockSize, dims[1] - blockSize, dims[2] - blockSize]

            let pos = 0
            for (i = 0; i < dims[2]; i++) {

                cdfs.fill(0)

                let p = 0
                for (j = 0; j < dims[1]; j += blockSize) {

                    kDims[1] = limit[1] >= j ? blockSize : rDims[1]

                    for (k = 0; k < dims[0]; k += blockSize) {

                        kDims[0] = limit[0] >= k ? blockSize : rDims[0]

                        cdfs.set(buildcdf(k, j, i, kDims), p)
                        p += max

                    }
                }

                for (j = 0; j < dims[1]; j++) {
                    let posy = j / blockSize - 0.5
                    let ymin = Math.max(Math.floor(posy), 0)
                    let ymax = Math.min(ymin + 1, tiles[1] - 1)
                    let fy = posy - ymin
                    let ify = 1 - fy

                    for (k = 0; k < dims[0]; k++) {
                        let posx = k / blockSize - 0.5
                        let xmin = Math.max(Math.floor(posx), 0)
                        let xmax = Math.min(xmin + 1, tiles[0] - 1)
                        let fx = posx - xmin
                        let ifx = 1 - fx

                        let pixel = dataBuffer[pos]

                        let cdf0 = cdfs[getTilesPos(xmin, ymin) * max + pixel]
                        let cdf1 = cdfs[getTilesPos(xmax, ymin) * max + pixel]
                        let cdf2 = cdfs[getTilesPos(xmin, ymax) * max + pixel]
                        let cdf3 = cdfs[getTilesPos(xmax, ymax) * max + pixel]

                        let out = ifx * ify * cdf0
                            + fx * ify * cdf1
                            + ifx * fy * cdf2
                            + fx * fy * cdf3

                        dataBuffer[pos++] = out
                    }
                }
            }


            //console.log(cdfs)
            //mapHE(dataBuffer, max)

        }

        let mapCLAHE = (imageData, max) => {
            let dataBuffer = imageData.data
            let dims = imageData.dims

            let blockSize = 64

            let tiles = [
                Math.ceil(dims[0] / blockSize),
                Math.ceil(dims[1] / blockSize),
                Math.ceil(dims[2] / blockSize)]

            let cdfs = new Uint32Array(tiles[2] * tiles[1] * tiles[0] * max).fill(0)

            let dims01 = dims[0] * dims[1]
            let dims0 = dims[0]

            let getPosition = (x, y, z) => {
                return dims01 * z + dims0 * y + x
            }

            let tiles01 = tiles[0] * tiles[1]
            let tiles0 = tiles[0]

            let getTilesPos = (x, y, z) => {
                return tiles01 * z + tiles0 * y + x
            }


            let buildcdf = (x, y, z, kDims) => {
                let histogram = new Uint32Array(max).fill(0)

                let i, j, k, index

                for (i = 0; i < kDims[2]; i++) {
                    for (j = 0; j < kDims[1]; j++) {
                        for (k = 0; k < kDims[0]; k++) {
                            index = getPosition(x + k, y + j, z + i)
                            histogram[dataBuffer[index]]++
                        }
                    }
                }

                let climit = kDims[0] * kDims[1] * kDims[2] * 0.2
                contrastLimit(histogram, climit)

                //equalization
                equalization(histogram, max)

                return histogram
            }

            let i, j, k, p = 0
            let kDims = new Array(3).fill(blockSize)
            let rDims = [dims[0] % blockSize, dims[1] % blockSize, dims[2] % blockSize]
            let limit = [dims[0] - blockSize, dims[1] - blockSize, dims[2] - blockSize]

            for (i = 0; i < dims[2]; i += blockSize) {

                kDims[2] = limit[2] >= i ? blockSize : rDims[2]

                for (j = 0; j < dims[1]; j += blockSize) {

                    kDims[1] = limit[1] >= j ? blockSize : rDims[1]

                    for (k = 0; k < dims[0]; k += blockSize) {

                        kDims[0] = limit[0] >= k ? blockSize : rDims[0]

                        cdfs.set(buildcdf(k, j, i, kDims), p)
                        p += max

                    }
                }
            }

            let pos = 0
            for (i = 0; i < dims[2]; i++) {
                let posz = i / blockSize - 0.5
                let zmin = Math.max(Math.floor(posz), 0)
                let zmax = Math.min(zmin + 1, tiles[2] - 1)
                let fz = posz - zmin
                let ifz = 1 - fz

                for (j = 0; j < dims[1]; j++) {
                    let posy = j / blockSize - 0.5
                    let ymin = Math.max(Math.floor(posy), 0)
                    let ymax = Math.min(ymin + 1, tiles[1] - 1)
                    let fy = posy - ymin
                    let ify = 1 - fy

                    for (k = 0; k < dims[0]; k++) {
                        let posx = k / blockSize - 0.5
                        let xmin = Math.max(Math.floor(posx), 0)
                        let xmax = Math.min(xmin + 1, tiles[0] - 1)
                        let fx = posx - xmin
                        let ifx = 1 - fx

                        let pixel = dataBuffer[pos]

                        let cdf0 = cdfs[getTilesPos(xmin, ymin, zmin) * max + pixel]
                        let cdf1 = cdfs[getTilesPos(xmax, ymin, zmin) * max + pixel]
                        let cdf2 = cdfs[getTilesPos(xmin, ymax, zmin) * max + pixel]
                        let cdf3 = cdfs[getTilesPos(xmax, ymax, zmin) * max + pixel]
                        let cdf4 = cdfs[getTilesPos(xmin, ymin, zmax) * max + pixel]
                        let cdf5 = cdfs[getTilesPos(xmax, ymin, zmax) * max + pixel]
                        let cdf6 = cdfs[getTilesPos(xmin, ymax, zmax) * max + pixel]
                        let cdf7 = cdfs[getTilesPos(xmax, ymax, zmax) * max + pixel]

                        /*let out = ifx * ify * ifz * cdf0
                         + fx * ify * ifz * cdf1
                         + ifx * fy * ifz * cdf2
                         + fx * fy * ifz * cdf3
                         + ifx * ify * fz * cdf4
                         + fx * ify * fz * cdf5
                         + ifx * fy * fz * cdf6
                         + fx * fy * fz * cdf7
                         */

                        let out = ((ifx * cdf0 + fx * cdf1) * ify + (ifx * cdf2 + fx * cdf3) * fy) * ifz
                            + ((ifx * cdf4 + fx * cdf5) * ify + (ifx * cdf6 + fx * cdf7) * fy) * fz


                        dataBuffer[pos++] = out
                    }
                }
            }


            //console.log(cdfs)
            //mapHE(dataBuffer, max)

        }

        let mapCLHE = (imageData, max) => {
            let dataBuffer = imageData.data
            let dims = imageData.dims

            let histogram = new Uint32Array(max).fill(0)

            for (let i = 0; i < dataBuffer.length; i++) {
                histogram[dataBuffer[i]]++
            }

            let limit = dataBuffer.length / max

            contrastLimit(histogram, limit)

            equalization(histogram, max)

            for (let i = 0; i < dataBuffer.length; i++) {
                dataBuffer[i] = chistogramdf[dataBuffer[i]]
            }
        }

        let mapHE = (imageData, max) => {
            let dataBuffer = imageData.data

            let histogram = new Uint32Array(max).fill(0)

            for (let i = 0; i < dataBuffer.length; i++) {
                histogram[dataBuffer[i]]++
            }

            equalization(histogram, max)

            for (let i = 0; i < dataBuffer.length; i++) {
                dataBuffer[i] = histogram[dataBuffer[i]]
            }
        }

        let mapHE2D = (imageData, max) => {
            let dataBuffer = imageData.data
            let dims = imageData.dims
            let histogram = new Uint32Array(max)

            let size2 = dims[0] * dims[1]
            let i, j, startPos = 0

            for (i = 0; i < dims[2]; i++) {

                histogram.fill(0)

                for (j = startPos; j < startPos + size2; j++) {
                    histogram[dataBuffer[j]]++
                }

                equalization(histogram, max)

                for (j = startPos; j < startPos + size2; j++) {
                    dataBuffer[j] = histogram[dataBuffer[j]]
                }

                startPos += size2
            }

        }
    }
}
