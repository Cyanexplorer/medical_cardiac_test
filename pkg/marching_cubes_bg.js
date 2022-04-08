//import * as wasm from './marching_cubes_bg.wasm';

const heap = new Array(32).fill(undefined);

heap.push(undefined, null, true, false);

let heap_next = heap.length;

function addHeapObject(obj) {
    if (heap_next === heap.length) heap.push(heap.length + 1);
    const idx = heap_next;
    heap_next = heap[idx];

    heap[idx] = obj;
    return idx;
}

function getObject(idx) { return heap[idx]; }

function dropObject(idx) {
    if (idx < 36) return;
    heap[idx] = heap_next;
    heap_next = idx;
}

function takeObject(idx) {
    const ret = getObject(idx);
    dropObject(idx);
    return ret;
}

const lTextDecoder = typeof TextDecoder === 'undefined' ? (0, module.require)('util').TextDecoder : TextDecoder;

let cachedTextDecoder = new lTextDecoder('utf-8', { ignoreBOM: true, fatal: true });

cachedTextDecoder.decode();

let cachegetUint8Memory0 = null;
function getUint8Memory0() {
    if (cachegetUint8Memory0 === null || cachegetUint8Memory0.buffer !== wasm.memory.buffer) {
        cachegetUint8Memory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachegetUint8Memory0;
}

function getStringFromWasm0(ptr, len) {
    return cachedTextDecoder.decode(getUint8Memory0().subarray(ptr, ptr + len));
}

let WASM_VECTOR_LEN = 0;

function passArray8ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 1);
    getUint8Memory0().set(arg, ptr / 1);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}
/**
*/
export class MarchingCubes {

    static __wrap(ptr) {
        const obj = Object.create(MarchingCubes.prototype);
        obj.ptr = ptr;

        return obj;
    }

    free() {
        const ptr = this.ptr;
        this.ptr = 0;

        wasm.__wbg_marchingcubes_free(ptr);
    }
    /**
    * @returns {MarchingCubes}
    */
    static new() {
        var ret = wasm.marchingcubes_new();
        return MarchingCubes.__wrap(ret);
    }
    /**
    * @param {Uint8Array} volume
    * @param {number} dims_x
    * @param {number} dims_y
    * @param {number} dims_z
    */
    set_volume(volume, dims_x, dims_y, dims_z) {
        var ptr0 = passArray8ToWasm0(volume, wasm.__wbindgen_malloc);
        var len0 = WASM_VECTOR_LEN;
        wasm.marchingcubes_set_volume(this.ptr, ptr0, len0, dims_x, dims_y, dims_z);
    }
    /**
    * @param {number} isovalue
    * @returns {Float32Array}
    */
    marching_cubes(isovalue) {
        var ret = wasm.marchingcubes_marching_cubes(this.ptr, isovalue);
        return takeObject(ret);
    }
}

export const __wbindgen_memory = function() {
    var ret = wasm.memory;
    return addHeapObject(ret);
};

export const __wbg_buffer_bc64154385c04ac4 = function(arg0) {
    var ret = getObject(arg0).buffer;
    return addHeapObject(ret);
};

export const __wbg_newwithbyteoffsetandlength_193d0d8755287921 = function(arg0, arg1, arg2) {
    var ret = new Float32Array(getObject(arg0), arg1 >>> 0, arg2 >>> 0);
    return addHeapObject(ret);
};

export const __wbindgen_object_drop_ref = function(arg0) {
    takeObject(arg0);
};

export const __wbindgen_throw = function(arg0, arg1) {
    throw new Error(getStringFromWasm0(arg0, arg1));
};

