//constant
const axisXY = 1
const axisXZ = 0
const axisYZ = 2
const axisUD = 1
const axisUV = 0
const axisVD = 2
const NONE = -1;
const WAIT = 0;
const GEN = 1;
const clpPlaneXY = 'CLPPLAINXY'
const clpPlaneXZ = 'CLPPLAINXZ'
const clpPlaneYZ = 'CLPPLAINYZ'

//model id
const CARDIAC_MESH = "cardiac_mesh"
const CARDIAC_VOLUME = "cardiac_volume"

//general function
var checkPassiveSupported = (option) => {
    var supported = option
    try {
        var options = Object.defineProperty({}, "passive", {
            get: function () {
                supported = { passive: option }
            }
        })
        window.addEventListener('test',null,options)
    }
    catch (e) { }

    return supported
}

var copyArray = function (dims, buffer) {
    var dataBuffer = []
    var volDims = [dims[0], dims[1], dims[2]]
    for (var i = 0; i < buffer.length; i++) {
        dataBuffer.push(buffer[i])
    }

    return [volDims, dataBuffer]
}