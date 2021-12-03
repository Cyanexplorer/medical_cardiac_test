
class dualSlider {
    constructor(domElement, min, max) {
        this.min = min
        this, max = max
        this.step = 1
        this.domElement = domElement

        this.lowerBound = document.createElement('input')
        this.lowerBound.type = 'range'
        this.lowerBound.className = 'lower-bound'
        this.lowerBound.min = min
        this.lowerBound.max = max

        this.higherBound = document.createElement('input')
        this.higherBound.type = 'range'
        this.higherBound.className = 'higher-bound'
        this.higherBound.min = min
        this.higherBound.max = max

        this.domElement.append(this.lowerBound)
        this.domElement.append(this.higherBound)

        this.lowerBound.addEventListener('input', () => {
           this.update()
        })
        this.update()
    }

    update = () => {
        let width = window.getComputedStyle(this.domElement).getPropertyValue('width')
        width = parseInt(width) - 14
        this.lowerBound.style.width = `${width}px`

        let limit = this.lowerBound.value / this.lowerBound.max
        this.higherBound.style.width = `${limit * width}px`
        let hwidth = window.getComputedStyle(this.higherBound).getPropertyValue('width')
        hwidth = parseInt(hwidth)
        this.higherBound.style.width = `${hwidth + (1 - limit) * 16}px`
        this.higherBound.max = this.lowerBound.value * 1
    }

    setLowerValue = (value) => {
        this.lowerBound.value = this.lowerBound.max * 1 - value * 1
        this.update()
    }

    getLowerValue = () => {
        return this.lowerBound.max * 1 - this.lowerBound.value * 1
    }

    getRange = () => {
        return this.higherBound.value * 1
    }

    setHigherValue = (value) => {
        this.higherBound.value = value - this.getLowerValue()
    }

    getHigherValue = () => {
        return this.getLowerValue() * 1 + this.getRange() * 1
    }

    event = (cb) => {
        this.lowerBound.addEventListener('input', () => {
            cb(this.getLowerValue() * 1, this.getHigherValue() * 1)
        })
        this.higherBound.addEventListener('input', () => {
            cb(this.getLowerValue() * 1, this.getHigherValue() * 1)
        })
    }
}

export { dualSlider }

