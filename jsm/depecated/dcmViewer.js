class dcmViewer {
    constructor(domElemnt) {
        let element = '<div class="d-flex flex-column viewer-group"> <div id="horizontalView" class="dcmViewer" data-toggle=false> <div class="viewer-body"> <div class="viewport"> <canvas></canvas> </div>  <div class="w-100 verticalRange d-flex justify-content-center" style="position:absolute;left:-45%;top:50%;z-index:2"> <input class="viewer-slider" type="range" id="horizontalRange" /> </div> <p class="counter" style="position:absolute;top:0px;left:10px;z-index:3">0</p> <p style="position:absolute;top:0px;right:10px;z-index:3">Horizontal</p> </div> <div class="viewer-bar"> <button class="btn  func"><img src="./../img/svg/maximun.svg"/></button> </div> </div> <div class="tmpViewer"><div class="viewer-body"></div></div> <div id="coronalView" class="dcmViewer" data-toggle=false> <div class="viewer-body"> <div class="viewport"> <canvas></canvas> </div> <div class="w-100 d-flex justify-content-center" style="position:absolute;bottom:5%;z-index:2;"> <input class="viewer-slider" type="range" id="coronalRange" /> </div> <p class="counter" style="position:absolute;top:0px;left:10px;z-index:3">0</p> <p style="position:absolute;top:0px;right:10px;z-index:3">Coronal</p> </div> <div class="viewer-bar"> <button class="btn  func"><img src="./../img/svg/maximun.svg"/></button> </div> </div><div class="tmpViewer"><div class="viewer-body"></div></div> <div id="sagittalView" class="dcmViewer" data-toggle=false> <div class="viewer-body"> <div class="viewport"> <canvas></canvas> </div> <div class="w-100 d-flex justify-content-center" style="position:absolute;bottom:5%;z-index:2;direction: rtl;"> <input class="viewer-slider" type="range" id="sagittalRange" /> </div> <p class="counter" style="position:absolute;top:0px;left:10px;z-index:3">0</p> <p style="position:absolute;top:0px;right:10px;z-index:3">Saggital</p> </div> <div class="viewer-bar"> <button class="btn  func"><img src="./../img/svg/maximun.svg"/></button> </div> </div><div class="tmpViewer"><div class="viewer-body"></div></div> </div><div id="dcmVolume" class="modelViewer"></div><div id="paintingBoard" class="paintingViewer" data-toggle="off"></div> <div id="dcmBody" class="bodyViewer m-2"></div>'
        
        domElemnt.innerHTML = element
    }
}

export { dcmViewer }