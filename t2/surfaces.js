"use strict";
var canvas;
var engine;
var scene;
var camera;
var Vector3 = BABYLON.Vector3;
var Color4 = BABYLON.Color4;

// numero di punti su cui la superficie è calcolata
var m = 50, n = 50;

//
// createGrid()
//
// Crea una griglia quadrata di linee sul piano XZ
// Parametri:
//   size = lato del quadrato
//   count = numero di linee per ogni direzione 
//           (la griglia ha 2*count linee)
//   ticks = ogni tick linee viene tracciata una linea principale 
//           (di colore diverso)
//   color = colore delle linee
//   tickColor = colore delle linee principali
//
function createGrid(params) {    
    var pts = [];
    var colors = [];
    
    var currentColor;
    // funzione di comodo: aggiunge la linea (x0,y0,z0)-(x1,y1,z1) di
    // colore = currentColor
    function line(x0,y0,z0, x1,y1,z1) { 
        pts.push([new Vector3(x0,y0,z0), new Vector3(x1,y1,z1)]); 
        colors.push([currentColor,currentColor]); 
    }
    
    var r = params.size/2;
    
    // aggiungo le linee
    for(var i=0;i<params.count;i++) {
        currentColor = (i%params.ticks)==0 ? params.tickColor : params.color;
        var u = -r+2*r*i/(params.count-1); // u : -r => r        
        line(u,0,-r, u,0,r);
        line(-r,0,u, r,0,u);
    }
    
    // creo e aggiungo alla scena il LineSystem    
    var lines = BABYLON.MeshBuilder.CreateLineSystem(
        "lines", {
            lines: pts,
            colors: colors,                
        }, 
        scene);
    return lines;
}

// questa funzione viene chiamata quando la pagina 
// è stata completamente caricata nel browser.
// crea l'engine (il componente che fa i disegni), la scena
// ecc.
window.onload = function() {
    canvas = document.getElementById("renderCanvas");
    engine = new BABYLON.Engine(canvas, true);
    scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color3(0.2,0.2,0.2);
    scene.ambientColor.set(1,1,1);
    // camera
    camera = new BABYLON.ArcRotateCamera(
        "camera1", 0.0 ,1.0,15, BABYLON.Vector3.Zero(),scene);
    camera.attachControl(canvas, false);
    camera.wheelPrecision = 20;
    camera.lowerRadiusLimit = 8;

    // luce
    var light = new BABYLON.PointLight(
        "light1", new BABYLON.Vector3(0, 1, 0), scene);
    light.intensity = .9;
    light.parent = camera;
    
    // crea gli oggetti in scena
    createGrid({
        size  : 10,
        count : 21,
        ticks : 5,
        color : new Color4(0.5,0.5,0.5),
        tickColor : new Color4(0.8,0.8,0.95),        
    });
    
    createModel();
    
    // fa partire il rendering
    engine.runRenderLoop(function () { scene.render(); });   
    // informa l'engine se la finestra del browser cambia dimensioni
    window.addEventListener('resize', function(){ engine.resize(); });   
}

// calcola posizione e normale nel punto (u,v)
function computeVertex(f, u, v) {
    var h = 0.001;
    var p = f(u,v);
    var dpdu = f(u+h,v).subtract(f(u-h,v));
    var dpdv = f(u,v+h).subtract(f(u,v-h));
    var nrm = Vector3.Cross(dpdu, dpdv).normalize();
    return [p, nrm];
}

// crea una superficie a partire dalla sua definizione parametrica
function createSurface(f) {
    
    // creo la mesh
    var mesh = new BABYLON.Mesh("mesh", scene);

    // creo i materiali per le due facce
    var mat1 = new BABYLON.StandardMaterial("mat1", scene);
    mat1.diffuseColor.set(1,1,0);
    mat1.specularColor.set(0.3,0.3,0.3);

    var mat2 = new BABYLON.StandardMaterial("mat1", scene);
    mat2.diffuseColor.set(0,1,1);
    mat2.specularColor.set(0.3,0.3,0.3);

    // metto insieme i due materiali    

    var material = mesh.material = new BABYLON.MultiMaterial("mat", scene);
    material.subMaterials.push(mat1);
    material.subMaterials.push(mat2);
    
    // creo la geometria
    var positions = [];
    var normals = [];
    var indices = [];
    
    var vCount = n*m;

    // vertici
    for(var side=0; side<2; side++) {
        var sgn = 1 - 2*side;
        for(var i=0; i<n; i++) {
            var u = i/(n-1);
            for(var j=0; j<m; j++) {
                var v = j/(m-1);
                var pn = computeVertex(f,u,v);
                positions.push(pn[0].x,pn[0].y,pn[0].z);
                normals.push(sgn*pn[1].x,sgn*pn[1].y,sgn*pn[1].z);
            }
        }    
    }

    // facce
    for(var side=0; side<2; side++) {
        for(var i=0; i+1<n; i++) {
            for(var j=0; j+1<m; j++) {
                var k = i*m+j + vCount * side;
                if(side == 0) {
                    indices.push(k,k+1,k+1+m);
                    indices.push(k,k+1+m, k+m);
                } else {
                    indices.push(k,k+1+m,k+1);
                    indices.push(k,k+m,k+1+m);
                }
            }
        }
    }
    
    let faceCount = (n-1)*(m-1)*2;

    // applico la geometria alla mesh
    var vertexData = new BABYLON.VertexData();
    vertexData.positions = positions;
    vertexData.normals = normals;
    vertexData.indices = indices;    

    
    vertexData.applyToMesh(mesh);
    new BABYLON.SubMesh(1, 0, vCount*2, 0, 6*(n-1)*(m-1), mesh);

    return mesh;
}

//
// Questa è la funzione che crea le superfici da mostrare
//
function createModel()
{
    createSurface(sphere);
    createSurface(torus);
    createSurface(strip);
}


// 
// Qui di seguito ci sono le funzioni parametriche
// che definiscono un certo numero di superfici
//
// Le funzione accettano i due parametri (u,v) compresi fra 0 e 1
// e calcolano il punto nello spazio (x,y,z) che corrisponde a
// quella coppia di parametri
//

// sfera (centrata nell'origine)
function sphere(u,v) {
    
    var radius = 2;

    var x,y,z;
 
    // theta è la latitudine (misurata a partire dal polo nord)
    // (nota: per evitare un problema nel calcolo delle normali  
    // theta non va esattamente da 0 a pi : ci fermiamo appena
    // un po' prima dei poli)
    var theta = Math.PI* (v * 0.999998 + 0.000001); 
 
    // phi è la longitudine
    var phi = Math.PI*2*u;
 
    // calcolo subito la coordinata y (che va dal polo sud al polo nord)
    y = radius * Math.cos(theta);

    // rxy è la distanza del punto sphere(u,v) dall'asse polo sud -> polo nord
    var rxz = radius * Math.sin(theta);

    // calcolo x e z
    x = rxz * Math.cos(phi);
    z = rxz * Math.sin(phi);

    // restituisco un punto nello spazio di coordinate x,y,z
    return new Vector3(x,y,z);
}

// ciambella (centrata nell'origine)
function torus(u,v) {
    var r1 = 3, r2 = 0.5;
    var x,y,z;
    // latitudine
    var theta = Math.PI*2*u; 
    // longitudine
    var phi = Math.PI*2*v;

    // anche qui calcolo prima y
    y = r2 * Math.cos(theta);

    // poi la distanza del punto dall'asse di rotazione
    var rxz = r1 + r2 * Math.sin(theta);

    // e infine x e z
    x = rxz * Math.cos(phi);
    z = rxz * Math.sin(phi);
    return new Vector3(x,y,z);
}

// un nastro (non di moebius) con 3 torsioni complete (6 mezze torsioni)
// il nastro non è centrato nell'origine, ma spostato verso l'alto di 2 unità

function strip(u,v) {
    var r1 = 2, r2 = 0.5;

    var x,y,z;
    var phi = Math.PI*2*u;
    var theta = phi*3;

    // t controlla la posizione del punto rispetto alla "riga di mezzeria" del nastro
    var t = -1 + v*2;

    // molto simile al toro
    var rxz = r1 + r2 * Math.cos(theta) * t;

    // infatti prima calcolo y
    var y = r2* Math.sin(theta) * t;

    // e poi x e z
    x = rxz * Math.cos(phi);
    z = rxz * Math.sin(phi);

    // sposto il tutto verso l'alto
    return new Vector3(x,y+2,z);
}

