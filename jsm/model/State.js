import { ImageProcess } from "../controller/ImageProcessingTools.js"
import { ImageData8, ImageData} from "./Segment.js"

class colorSetting {
    constructor() {
        this.histogram = new Array(256).fill(0)
        this.isHistogramLog10 = false
        this.rgba = new Array(4)
        this.path = new Array(256).fill(0)
        this.clickTriangle = null
        this.mylist = new Array()
        this.renderType = 0
        this.isovalue = 1
        this.cli_min = 0.0
        this.cli_max = 1.0

        for (let i = 0; i < 3; i++) {
            this.rgba[i] = new Float32Array(256).fill(1)
        }

        this.rgba[3] = new Float32Array(256)
        for (let i = 0; i < 256; i++) {
            this.rgba[3][i] = i / 255
        }

        this._colormap = new Float32Array(256 * 4)

        // ***依據色彩標記重建colomap***
        let compare_list = (first, second) => {
            return first.x - second.x
        }

        let fillColor = (t1, t2) => {
            let rgb1 = t1.hsv.to_RGB();
            let rgb2 = t2.hsv.to_RGB();
            let frac = 0;

            for (let i = t1.x; i <= t2.x; i++) {
                frac = (i - t1.x) / (t2.x - t1.x);
                this.rgba[0][i] = (1.0 - frac) * rgb1.R + frac * rgb2.R;
                this.rgba[1][i] = (1.0 - frac) * rgb1.G + frac * rgb2.G;
                this.rgba[2][i] = (1.0 - frac) * rgb1.B + frac * rgb2.B;
                this.rgba[3][i] = this.path[i] / 255
            }
        }

        this.fillColorUpdate = () => {
            this.mylist.sort(compare_list);
            for (let i = 0; i < this.mylist.length - 1; i++) {
                fillColor(this.mylist[i], this.mylist[i + 1])
            }
        }
        // ***依據色彩標記重建colomap***
    }

    get colormap() {
        for (let i = 0; i < 256; i++) {
            this._colormap[4 * i] = this.rgba[0][i]
            this._colormap[4 * i + 1] = this.rgba[1][i]
            this._colormap[4 * i + 2] = this.rgba[2][i]
            this._colormap[4 * i + 3] = this.rgba[3][i]
        }

        return this._colormap
    }
}

class State {
    constructor() {

        this._volume = new ImageData()
        this._backup = this._volume.clone()

        this.order = -1
        this.segments = []
        this.fIndex = -1// 當前被選擇的樣板
  
        this.transferData = null

        this.volumeProcessType = 100;
        this.volumeRenderType = 0
        this.isInverted = false
        this.info = null

        this.colorSetting = new colorSetting()
        
        let imageProcess = new ImageProcess()

        // 設置CT影像內容並生成其相關資訊，例如取樣縮圖和色彩分布圖
        this.generate = (onload) => {
            imageProcess.postprocess(this._volume, this.info.bitsStored, this.volumeProcessType, this.isInverted, () => {
                this._volume.generateThumbnail()
                if(onload instanceof Function)
                    onload()
            })
        }

        // 複製當前的樣板狀態存檔，並將結果回傳
        this.clone = () => {
            let cl = new state()

            cl.order = this.order
            cl.fIndex = this.fIndex

            this.segments.forEach((segment) => {
                cl.segments.push(segment.clone())
            })

            return cl
        }

        // 從另一個樣板狀態存檔，讀取內容並複製
        this.copyfrom = (state) => {

            this.order = state.order
            this.segments = []
            this.fIndex = state.fIndex

            state.segments.forEach((segment) => {
                this.segments.push(segment.clone())
            })

        }

        this.volumeReset = () => {
            if (this._volume == null) {
                console.error('Internal data missing!');
            }

            pushData(this._backup.data, this._volume.data);
        }

    }

    // 取得當前需要啟用的樣板索引值
    get focusedSegIndex() {
        return this.fIndex
    }

    // 設置當前需要啟用的樣板索引值
    set focusedSegIndex(x) {
        this.fIndex = x
    }

    // 取得當前正在使用的樣板
    get focusedSegment() {
        if (this.fIndex >= 0 && this.fIndex < this.segments.length) {
            return this.segments[this.fIndex]
        }
        return null
    }

    // 設置當前正在使用的樣板
    set focusedSegment(x) {
        this.segments[this.fIndex] = x
    }

    // 設置CT影像的內容，同時製作備分
    set volume(imgData) {
        this._volume = imgData
        this._backup = imgData.clone()
        this.transferData = new ImageData8('transfer', this._volume.dims)
    }

    // 取得CT影像的內容
    get volume() {
        return this._volume
    };


}

export {State}