
const LAMBDA = 0.01
const N = 57
const K = 1
const FLT_MAX = 3.40282347e+38
const D_T = 0.25

class Morphology {
	constructor() {

		let getIndex = (dims, index) => {
			let zIndex = index / ((dims[0]) * (dims[1]))
			let yIndex = index % (dims[0]) * (dims[1]) / dims[0]
			let xIndex = index % (dims[0]) * (dims[1]) % dims[0]

			return { x: xIndex, y: yIndex, z: zIndex }
		}

		this.erode = (dims, dataBuffer, paddingSize) => {
			let kernelSize = paddingSize * 2 + 1
			let kernel = new Uint8Array(kernelSize * kernelSize * kernelSize).fill(0)
			let kDims = [kernelSize, kernelSize, kernelSize]

			process(dataBuffer, dims, kernel, kDims, paddingSize)
		}

		this.dilate = (dims, dataBuffer, paddingSize) => {
			let kernelSize = paddingSize * 2 + 1
			let kernel = new Uint8Array(kernelSize * kernelSize * kernelSize).fill(255)
			let kDims = [kernelSize, kernelSize, kernelSize]

			process(dataBuffer, dims, kernel, kDims, paddingSize)
		}

		this.open = () => {
			this.erode(dims, dataBuffer, paddingSize)
			this.dilate(dims, dataBuffer, paddingSize)
		}

		this.close = (dims, dataBuffer, paddingSize) => {
			this.dilate(dims, dataBuffer, paddingSize)
			this.erode(dims, dataBuffer, paddingSize)
		}

		// covert position with padding size
		let header, body
		let preset = (dims, padding) => {
			let padding2 = padding * 2
			let pdims = [dims[0] + padding2, dims[1] + padding2, dims[2] + padding2]
			header = pdims[0] * pdims[1]
			body = pdims[0]
		}

		let getPosition = (x, y, z, padding = 0, withPadOffset = false) => {

			if (withPadOffset) {
				let px = x + padding
				let py = y + padding
				let pz = z + padding
				return header * pz + body * py + px
			}
			else {
				return header * z + body * y + x
			}
		}

		// Padding
		let padding = (dims, dataBuffer, paddingSize) => {

			let padding2 = paddingSize * 2
			let buffer = new Uint8Array((dims[0] + padding2) * (dims[1] + padding2) * (dims[2] + padding2)).fill(0)
			let pos = 0

			preset(dims, paddingSize)

			for (let i = 0; i < dims[2]; i++) {
				for (let j = 0; j < dims[1]; j++) {
					for (let k = 0; k < dims[0]; k++) {
						buffer[getPosition(k, j, i, paddingSize, true)] = dataBuffer[pos++]
					}
				}
			}

			return buffer
		}

		let process = (dataBuffer, dims, kernel, kDims, paddingSize) => {

			let paddingBuffer = padding(dims, dataBuffer, paddingSize)
			
			let calculate = (x, y, z) => {

				let kpos = 0
				
				for (let i = 0; i < kDims[2]; i++)
				{
					for (let j = 0; j < kDims[1]; j++)
					{
						for (let k = 0; k < kDims[0]; k++)
						{
							paddingBuffer[getPosition(x + k, y + j, z + i, paddingSize, false)] = kernel[kpos++]
						}
					}
				}
			}
			
			preset(dims, paddingSize)

			let kCenter = kernel[parseInt((kernel.length + 1) / 2)]
			let pos = 0

			for (let i = 0; i < dims[2]; i++) {
				for (let j = 0; j < dims[1]; j++) {
					for (let k = 0; k < dims[0]; k++) {
						if (dataBuffer[pos] == kCenter) {
							calculate(k, j, i)
						}
						pos += 1
					}
				}
			}

			pos = 0
			for (let i = 0; i < dims[2]; i++) {
				for (let j = 0; j < dims[1]; j++) {
					for (let k = 0; k < dims[0]; k++) {
						dataBuffer[pos++] = paddingBuffer[getPosition(k, j, i, paddingSize, true)]
					}
				}
			}
        }
	}
}

/**
 * 
 
class Kernel {
	constructor() {

		let getPosition = (dims, index) => {
			let header = (dims[0] + this.padding * 2) * (dims[1] + this.padding * 2) * this.padding
			let layer = index / ((dims[0]) * (dims[1]))
			let body = (dims[0] + this.padding * 2) * (dims[1] + this.padding * 2) * layer
			let row = index % (dims[0]) * (dims[1]) / dims[0]
			let footer = (dims[0] + this.padding * 2) * (this.padding + row)
			let remain = index % (dims[0]) * (dims[1]) % dims[0] + this.padding
			return header + body + footer + remain
		}

		this.erode = (dims, dataBuffer, size) => {

			let kernelSize = size * 2 + 1
			let kernel = new Uint8Array(kernelSize * kernelSize * kernelSize).fill(1)

			let paddingBuffer = padding(dims, dataBuffer, size)

			process(dims, kernel, paddingBuffer, dataBuffer, size)

		}

		this.dilate = (dims, dataBuffer, size) => {

			let kernelSize = size * 2 + 1
			let kernel = new Uint8Array(kernelSize * kernelSize).fill(1)

			let paddingBuffer = padding(dims, dataBuffer, size)

			process(dims, kernel, paddingBuffer, dataBuffer, size)
		}

		this.medium = (dims, dataBuffer, size) => {

			let kernelSize = size * 2 + 1
			let kernel = new Uint8Array(kernelSize * kernelSize).fill(1)

			let paddingBuffer = padding(dims, dataBuffer, size)

			process(dims, kernel, paddingBuffer, dataBuffer, size)
		}

		this.gaussian = (dims, dataBuffer, size) => {
			let kernelSize = size * 2 + 1
			let kernel = new Uint8Array(kernelSize * kernelSize).fill(1)

			let paddingBuffer = padding(dims, dataBuffer, size)

			process(dims, kernel, paddingBuffer, dataBuffer, size)
		}

		let padding = (dims, dataBuffer, paddingSize) => {

			let buffer = new Uint8Array((dims[0] + paddingSize * 2) * (dims[1] + paddingSize * 2) * (dims[2] + paddingSize * 2)).fill(0)
			let pos = (dims[0] + paddingSize * 2) * (dims[1] + paddingSize * 2) * paddingSize

			for (let i = 0; i < dims[2]; i++) {
				pos += (dims[0] + paddingSize * 2) * paddingSize
				for (let j = 0; j < dims[1]; j++) {
					pos += paddingSize
					for (let k = 0; k < dims[0]; k++) {
						buffer[pos] = dataBuffer[i * dims[1] * dims[0] + j * dims[0] + k]
						pos++
					}
					pos += paddingSize
				}
				pos += (dims[0] + paddingSize * 2) * paddingSize
            }
			console.log(dims)
			console.log(paddingSize)
			return buffer
		}

		let process = (dims, kernel, paddingBuffer, dataBuffer, size) => {
			let sum = 0
			let kernelSize = size * 2 + 1

			for (let i = 0; i < kernel.length; i++) {
				sum += kernel[i]
			}

			for (let i = 0; i < dims[2]; i++) {
				for (let j = 0; j < dims[1]; j++) {
					for (let k = 0; k < dims[0]; k++) {

						for (let j = 0; j < kernelSize; j++) {
							for (let k = 0; k < kernelSize; k++) {
								
								if (i >= dims[2] || i < 0 || j >= dims[2] || j < 0 || k >= dims[2] || k < 0) {
									continue
								}
								else {
									p += dataBuffer[i * dims[1] * dims[0] + j * dims[0] + k]
								}
							}
						}
						
					}
					pos += paddingSize
				}
				pos += (dims[0] + paddingSize * 2) * paddingSize
			}

			for (let i = 0; i < dataBuffer.length; i++) {
				let p = 0
				let pos = 0

				for (let j = 0; j < kernelSize; j++) {
					for (let k = 0; k < kernelSize; k++) {
						if()
						p += paddingBuffer[i + k + j * (size * 2 + dims[0])] * kernel[j * kernelSize + k]

					}

				}
				//pos += (dims[0] + size * 2) * size * 2

				dataBuffer[i] = p
			}
		}
	}
}

*/

class Logic{
	static checkInput = (source, destination) => {
		if (source.length != destination) {
			console.error('Data length out of range.')
			return false
		}
		return true
	}

	static union = (source, destination) => {
		if (!this.checkInput) {
			return
		}

		for (let i = 0; i < source.length; i++) {
			if (source[i] > 0) {
				destination[i] = 255
            }
		}
	}

	static intersection = (source, destination) => {
		if (!this.checkInput) {
			return
		}

		for (let i = 0; i < source.length; i++) {
			if (source[i] > 0 && destination[i] > 0) {
				destination[i] = 255
			}
			else {
				destination[i] = 0
            }
		}
	}

	static boolean = (source, destination) => {
		if (!this.checkInput) {
			return
		}

		for (let i = 0; i < source.length; i++) {
			if (source[i] > 0) {
				destination[i] = 0
			}
		}
    }

	static exclusive = (source, destination) => {
		if (!this.checkInput) {
			return
		}

		for (let i = 0; i < source.length; i++) {
			if (source[i] > 0 && destination[i] > 0) {
				destination[i] = 0
			}
			else {
				destination[i] = source[i]
            }
		}
	}

	static copy = (source, destination) => {
		if (!this.checkInput) {
			return
		}

		for (let i = 0; i < source.length; i++) {
			destination[i] = source[i]
		}
	}
}

const dir = [
	{ x: 0, y: 1, z: 0 },
	{ x: 1, y: 0, z: 0 },
	{ x: 0, y: -1, z: 0 },
	{ x: -1, y: 0, z: 0 },
	{ x: 0, y: 0, z: -1 },
	{ x: 0, y: 0, z: 1 }
]

class RegionGrowing {
	static process = (x, y, layerIndex, source, dims, bias, margin) => {
		let count = dims[0] * dims[1] * dims[2] + 10// remain 10 bit for range overflow
		let visit = new Uint8Array(count).fill(0)
		let mask = new Uint8Array(count).fill(0)
		let target = source[layerIndex * dims[1] * dims[0] + y * dims[0] + x]

		//let segBuffer = bufferLoader(axisUV, dims, segData, layerIndex)

		/**
		 * 
		 * Count size is the predictable maximun length of region growing, and there should be 5 elements for an iterator.
		 * Stack will occupy count * 5 blocks.
		 * 
		 * */

		let stack = new Uint16Array(count * 5)
		let stackSize = 0
		//x, y, z, direction, remain life
		stack.set([x, y, layerIndex, -1, margin], 0)
		stackSize = 1

		let upperBound = target + bias
		let lowerBound = target - bias

		let cx, cy, cz, life
		let index, pre_dir
		//console.log(dims)
		while (stackSize > 0) {

			stackSize--
			cx = stack[stackSize * 5]
			cy = stack[stackSize * 5 + 1]
			cz = stack[stackSize * 5 + 2]
			pre_dir = stack[stackSize * 5 + 3]
			life = stack[stackSize * 5 + 4]

			if (cx < 0 || cy < 0 || cz < 0 || cx >= dims[0] || cy >= dims[1] || cz >= dims[2]) {
				continue
			}

			index = cz * dims[1] * dims[0] + cy * dims[0] + cx
			if (visit[index] == 1) {
				continue
			}

			if (source[index] > upperBound || source[index] < lowerBound) {
				life--
			}
			else {
				life = margin
			}

			if (life < 0) {
				continue
			}

			mask[index] = 255
			visit[index] = 1

			dir.forEach((d, index) => {
				if (pre_dir == index) {
					return
				}
				
				stack.set([cx + d.x, cy + d.y, cz + d.z, index, life], stackSize * 5)
				stackSize++
			})
		}
		return mask
	}
}

class ScaleField {

	constructor(volDims, dataBuffer, rgba) {
		this.height = volDims[1]
		this.width = volDims[0]
		this.depth = volDims[2]
		this.rgba = rgba
		let arraySize = this.depth * this.height * this.width
		this.laplacianValue = new Array(3).fill(new Float32Array(arraySize))
		this.volumeData = new Array(3).fill(new Float32Array(arraySize))

		this.t = new Float32Array(arraySize)
		this.sizeData = new Float32Array(arraySize)
		this.alpha = new Float32Array(arraySize)

		this.volumeData[0].set(dataBuffer)
		this.alpha.set(dataBuffer)

		this.used = false
	}

	add() {
		let temp = this.volumeData[0]
		this.volumeData[0] = this.volumeData[1]
		this.volumeData[1] = this.volumeData[2]
		this.volumeData[2] = temp
	}

	laplacian(x, y, z, t) {

		let index = x * this.height * this.width + y * this.width + z
		let sum = (-6) * (this.volumeData[t][index])
		if ((x - 1) >= 0) {
			sum += this.volumeData[t][index - this.height * this.width]
		}
		else {
			sum += this.volumeData[t][index + this.height * this.width]
		}
		if ((x + 1) < this.depth) {
			sum += this.volumeData[t][index + this.height * this.width]
		}
		else {
			sum += this.volumeData[t][index - this.height * this.width]
		}
		if ((y - 1) >= 0) {
			sum += this.volumeData[t][index - this.width]
		}
		else {
			sum += this.volumeData[t][index + this.width]
		}
		if ((y + 1) < 0) {
			sum += this.volumeData[t][index + this.width]
		}
		else {
			sum += this.volumeData[t][index - this.width]
		}
		if ((z - 1) >= 0) {
			sum += this.volumeData[t][index - 1]
		}
		else {
			sum += this.volumeData[t][index + 1]
		}
		if ((z + 1) < this.depth) {
			sum += this.volumeData[t][index + 1]
		}
		else {
			sum += this.volumeData[t][index - 1]
		}

		return Math.abs(sum)
	}

	scaleDetection(index, t) {
		if (this.t[index] == (N - 1) && this.laplacianValue[1][index] > this.laplacianValue[0][index] && this.laplacianValue[1][index] > this.laplacianValue[2][index])
			this.t[index] = t - 1.0;

		this.laplacianValue[0][index] = this.laplacianValue[1][index];
		this.laplacianValue[1][index] = this.laplacianValue[2][index];
	}

	theta(d, h) {
		h = h * K;
		let temp = 1.0 - (d / h);
		if (temp > 1.0)
			temp = 1.0;
		else if (temp < 0.0)
			temp = 0.0;
		else
			temp = Math.pow(temp, 4);

		return temp * (((4 * d) / h) + 1.0);
	}

	interp() {
		this.sizeMax = 0.0;
		this.sizeMin = FLT_MAX;

		let temp = new Float32Array((this.depth) * (this.height) * (this.width)).fill(0)

		for (let i = 0; i < this.depth; i++)
			for (let j = 0; j < this.height; j++)
				for (let k = 0; k < this.width; k++)
					this.dotInterp(temp, i, j, k);

		let diff = this.sizeMax - this.sizeMin
		if (diff > 0.0) {
			for (let i = 0; i < this.sizeData.length; i++) {
				this.sizeData[i] = ((temp[i] - this.sizeMin) * 255.0) / diff + 0.5
			}
		}

		this.used = true;
	}

	dotInterp(temp, x, y, z) {
		let index = x * (this.height) * (this.width) + y * (this.width) + z;
		if (this.rgba[this.alpha[index]] > 0) {

			let n = parseInt(this.t[index] * D_T)
			let iInit = (x - n >= 0) ? -n : -x
			let jInit = (y - n >= 0) ? -n : -y
			let kInit = (z - n >= 0) ? -n : -z

			let t = (this.t[index]) * D_T
			let d, offset;

			for (let i = iInit; (i <= n) && ((i + x) < this.depth); i++) {
				for (let j = jInit, iStep = i * (this.height) * (this.width); (j <= n) && ((j + y) < this.height); j++) {
					for (let k = kInit, jStep = j * (this.width); (k <= n) && ((k + z) < this.width); k++) {
						offset = index + iStep + jStep + k;
						d = Math.sqrt(parseFloat(i * i + j * j + k * k));

						temp[offset] += (this.theta(d, t)) * t;

						if (this.sizeMax < temp[offset])
							this.sizeMax = temp[offset];
						if (this.sizeMin > temp[offset])
							this.sizeMin = temp[offset];
					}
				}
			}
		}
	}
}

class Gaussian {

	constructor(n, dt) {
		this.size = 2 * n + 1
		this.dt = dt
		this.coeff = new Float32Array(Math.pow(this.size, 3))
		this.compCoeff(dt)
		//this.print()
	}

	diff(data) {
		let index = 0;
		for (let i = 0; i < data.depth; i++)
			for (let j = 0; j < data.height; j++)
				for (let k = 0; k < data.width; k++)
					this.dotDiff(data, 0, i, j, k);
		console.log("iteration: 1\n");

		index = 0;
		for (let i = 0; i < data.depth; i++) {
			for (let j = 0; j < data.height; j++) {
				for (let k = 0; k < data.width; k++) {
					data.laplacianValue[0][index] = 0.0
					data.laplacianValue[1][index] = data.laplacian(i, j, k, 1)
					this.dotDiff(data, 1, i, j, k)
					data.t[index] = N - 1
					index++
				}
			}
		}
		console.log("iteration: 2\n");

		for (let t = 2; t < N; t++) {
			index = 0;
			data.add();
			for (let i = 0; i < data.depth; i++) {
				for (let j = 0; j < data.height; j++) {
					for (let k = 0; k < data.width; k++) {
						data.laplacianValue[2][index] = data.laplacian(i, j, k, 1) * t;
						this.dotDiff(data, 1, i, j, k);
						data.scaleDetection(index, t);
						index++;
					}
				}
			}
			console.log("iteration: %d\n", t + 1);
		}

		console.log("end iteration\n");
	}

	dotDiff(data, temp, dotI, dotJ, dotK) {
		let dotOffset, coeffOffset
		let sum = 0
		let n = (this.size - 1) / 2

		let iInit = (dotI >= n) ? -n : -dotI
		let jInit = (dotJ >= n) ? -n : -dotJ
		let kInit = (dotK >= n) ? -n : -dotK

		let dotIndex = dotI * data.height * data.width + dotJ * data.width + dotK
		let coeffIndex = (this.size * this.size + this.size + 1) * n

		data.volumeData[temp + 1][dotIndex] = 0
		//console.log("k")
		for (let i = iInit; (i <= n) && ((i + dotI) < data.depth); i++) {
			for (let j = jInit, iStep = i * (data.height) * (data.width); (j <= n) && ((j + dotJ) < data.height); j++) {
				for (let k = kInit, jStep = j * (data.width); (k <= n) && ((k + dotK) < data.width); k++) {
					dotOffset = iStep + jStep + k;
					coeffOffset = i * (this.size) * (this.size) + j * (this.size) + k;
					data.volumeData[temp + 1][dotIndex] += this.phi(data.volumeData[temp][dotIndex + dotOffset] - data.volumeData[temp][dotIndex]) * (this.coeff[coeffIndex + coeffOffset]);
					sum += (this.coeff[coeffIndex + coeffOffset]);
				}
			}
		}

		data.volumeData[temp + 1][dotIndex] = data.volumeData[temp + 1][dotIndex] * (this.dt);

		if (sum != 1.0)
			data.volumeData[temp + 1][dotIndex] = data.volumeData[temp + 1][dotIndex] / sum;

		data.volumeData[temp + 1][dotIndex] += data.volumeData[temp][dotIndex];
	}

	compCoeff(t) {
		let i, j, k
		let n = (this.size - 1) / 2
		let index = 0
		let sum = 0
		for (i = 0; i <= n; i++) {
			for (j = -n; j <= n; j++) {
				for (k = -n; k <= n; k++) {
					this.coeff[index] = Math.exp(-(i * i + j * j + k * k) / (2 * t)) / (2 * Math.PI * t)
					sum += this.coeff[index]
					index++
				}
			}
		}

		this.coeff = this.coeff.map(x => x / sum)
	}

	phi(x) {
		return x * this.C(x)
	}

	C(x) {
		x = x / 256
		let l = LAMBDA
		if (x > 0) {
			return (l * l) / (l * l + x * x)
		}
		return 1.0
	}
}

class SizeBased {
	constructor(baseData, dims) {
		this.baseData = baseData
		this.dims = dims
	}

	process() {

		let rgba = new Float32Array(256).map((x, index) => {
			if (index < 200) {
				return (255 - index) / 255
			}
			return 0
		})

		let volumeData = new ScaleField(this.dims, this.baseData, rgba)
		let gaussian1 = new Gaussian(1, D_T)
		gaussian1.diff(volumeData)
		volumeData.interp()
		return volumeData.alpha
    }
}

import * as THREE from "./../../build/three.module.js"
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
			mouse.y = - (event.y / window.innerHeight) * 2 + 1;
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

			return mask
		}

		initTemplate()
    }
}

export { RegionGrowing, SizeBased, Logic, Scissor, Morphology }