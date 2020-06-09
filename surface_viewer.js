"use strict";

twgl.setDefaults({attribPrefix: "a_"});
var m4 = twgl.m4;
var v3 = twgl.v3;
var gl;
var shape;

function SurfaceViewer(canvasName) {
    var canvas = document.getElementById(canvasName);
    gl = this.gl = twgl.getWebGLContext(canvas, {preserveDrawingBuffer   : true});
    this.grid = this.makeGrid(gl);

    this.buttonDown = false;
    this.theta0 = 0.2;
    this.theta1 = Math.PI - this.theta0;
    this.theta = 0.7;
    this.phi = 3.71;

    var _this = this;
    gl.canvas.addEventListener('mousedown', 
        function(e) {_this.onMouseDown(e);}, false);
    gl.canvas.addEventListener('mouseup',   
        function(e) {_this.onMouseUp(e);}, false);
    gl.canvas.addEventListener('mousemove', 
        function(e) {_this.onMouseMove(e);}, false);

    gl.canvas.addEventListener('mousewheel', function(e) {
        e.stopPropagation();
        e.preventDefault();
        _this.distance = Math.max(5, _this.distance - e.wheelDelta *0.01);
    }, false);

    this.programManager = new ProgramManager(gl);


    this.camera = m4.identity();
    this.view = m4.identity();
    this.viewProjection = m4.identity();
    this.distance = 6.5;

    this.uniforms = {
        u_lightWorldPos: [1, 8, 10],
        u_lightColor: [1, 1, 1, 1],
        u_diffuseMult: [0.5,0.3,0.8,1],
        u_specular: [1, 1, 1, 1],
        u_shininess: 120,
        u_specularFactor: 1,
        u_viewInverse: this.camera,
        u_world: m4.identity(),
        u_worldInverseTranspose: m4.identity(),
        u_worldViewProjection: m4.identity(),
        u_time: 0,
        u_cc: [0,0,0,0,0,0,0,0,0,0]
    };
    
    var obj = this.makeFoo2();
    
    var quad = this.makeQuad(this.gl);
    var bgProg = new BackgroundShaderProgram(gl);
    this.bg = {
        prog: bgProg,
        type: gl.TRIANGLES,
        shape : quad,
    };
    this.objects = [obj];
}

SurfaceViewer.prototype.onMouseDown = function(e) {
    e.stopPropagation();
    e.preventDefault();
    
    this.buttonDown = true;
    this.lastPos = this.getMouseEventPos(e);
}
SurfaceViewer.prototype.onMouseUp = function(e) {
    e.stopPropagation();
    e.preventDefault();
    this.buttonDown = false;
}
SurfaceViewer.prototype.onMouseMove = function(e) {
    e.stopPropagation();
    e.preventDefault();
    if(this.buttonDown) {
        var p = this.getMouseEventPos(e);
        var dx = p.x - this.lastPos.x;
        var dy = p.y - this.lastPos.y;
        this.lastPos = p;
        this.theta = Math.max(this.theta0, 
                     Math.min(this.theta1, this.theta - dy*0.01));
        this.phi += dx*0.01;
    }
}



SurfaceViewer.prototype.drawScene = function() {

    twgl.resizeCanvasToDisplaySize(gl.canvas);

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.enable(gl.DEPTH_TEST);
    // gl.enable(gl.CULL_FACE);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);



    var eye = v3.copy([0, 0, this.distance]);
    var target = v3.copy([0, 0, 0]);
    var up = [0, 1, 0];
    var tex = twgl.createTexture(gl, {
      min: gl.NEAREST,
      mag: gl.NEAREST,
      src: [
        255, 255, 255, 255,
        192, 192, 192, 255,
        192, 192, 192, 255,
        255, 255, 255, 255,
      ],
    });

    // set viewProjection
    var fovy = 30 * Math.PI / 180;
    var projection = m4.perspective(
        fovy,
        gl.canvas.clientWidth / gl.canvas.clientHeight,
        0.5, 200);
    m4.lookAt(eye, target, up, this.camera);
    m4.inverse(this.camera, this.view);
    m4.multiply(projection, this.view, this.viewProjection);


    var uni = this.uniforms;

    var world = uni.u_world;
    m4.identity(world);
    //m4.translate(world, obj.translation, world);
    m4.rotateX(world, -this.theta, world);
    m4.rotateZ(world, this.phi, world);

    m4.transpose(
       m4.inverse(world, uni.u_worldInverseTranspose), uni.u_worldInverseTranspose);
    m4.multiply(this.viewProjection, uni.u_world, uni.u_worldViewProjection);

    
    if(this.objects) {
        var me = this;
        this.objects.forEach(function(obj) {
            var pi = obj.prog.pInfo;
            gl.useProgram(pi.program);
            twgl.setBuffersAndAttributes(gl, pi, obj.shape);
            // me.uniforms.u_time = time;
            twgl.setUniforms(pi, me.uniforms);
            twgl.drawBufferInfo(gl, obj.shape, obj.type);            
        });
    }
    
    var pi = this.programManager.linesProgram;
    gl.useProgram(pi.program);
    twgl.setBuffersAndAttributes(gl, pi, this.grid);
    twgl.setUniforms(pi, this.uniforms);
    twgl.drawBufferInfo(gl, this.grid, gl.LINES);

    if(this.bg) {
        var bg = this.bg;
        var pi = bg.prog.pInfo;
        gl.useProgram(pi.program);
        var uniforms = {
            u_worldViewProjection: m4.identity(),
        };
        var m = uniforms.u_worldViewProjection;
        m4.translate(m,uff,m);
        twgl.setBuffersAndAttributes(gl, pi, bg.shape);
        twgl.setUniforms(pi, uniforms);
        twgl.drawBufferInfo(gl, bg.shape, bg.type);            
    }

}

var uff = [0,0,.99];

SurfaceViewer.prototype.setBody = function(body) {
    if(!this.objects || this.objects.length == 0) return;
    var obj = this.objects[0];
    try {
        obj.prog.setBody(body);
    }
    catch(e)
    {
        console.log("La formula non è corretta: ", e);
        obj.prog.setBody('p.x=u;p.y=v;');
    }
}


SurfaceViewer.prototype.getMouseEventPos = function (e) {
    return {x:e.offsetX, y:e.offsetY};
}

SurfaceViewer.prototype.makeFoo = function(lines) {
    var gl = this.gl;
    var arrays = { position: [], color: []};
    lines.forEach(function(line) {
        arrays.position.push(...line);
        console.log(arrays.position);
        arrays.color.push(0.5,0.5,0.5,1.0, 0.5,0.5,0.5,1.0);
    });
    var bufferInfo = twgl.createBufferInfoFromArrays(gl, arrays);
    var obj = {
        prog: new SimpleShaderProgram(gl),
        shape: bufferInfo,
        type: gl.LINES
    };
    return obj;
}

SurfaceViewer.prototype.makeFoo2 = function() {
    var gl = this.gl;
    var shape = this.makeSurface(gl,300);
    var obj = {
        prog: new SurfaceShaderProgram(gl),
        shape: shape,
        type: gl.TRIANGLES
    };
    return obj;
}

SurfaceViewer.prototype.makeGrid = function(gl) {
    var m = 9;
    var arrays = {
      position: [], // twgl.primitives.createAugmentedTypedArray(3, m*2),
      color: [], // twgl.primitives.createAugmentedTypedArray(3, m*2),
    };

    var addLine = function (x0,y0,z0, x1,y1,z1, r,g,b) {
        arrays.position.push(x0,y0,z0, x1,y1,z1);
        arrays.color.push(r,g,b,1.0,r,g,b,1.0);
    }

    var r = 2.0;

    
    addLine(-r,0,0, r,0,0, 1,0,0);
    addLine(0,-r,0, 0,r,0, 0,1,0);
    addLine(0,0,-r, 0,0,r, 0,0,1);

    var d = 0.1;
    addLine(r,0,0, r-d, d,0, 1,0,0);
    addLine(r,0,0, r-d,-d,0, 1,0,0);

    addLine(0,r,0,  d,r-d,0, 0,1,0);
    addLine(0,r,0, -d,r-d,0, 0,1,0);

    addLine(0,0,r, 0, d,r-d, 0,0,1);
    addLine(0,0,r, 0,-d,r-d, 0,0,1);

    r = 2.0;
    var n = 21;
    for(var i = 0; i<n; i++) {   
        var v = (i%5)==0 ? 0.7 : 0.9;
        var t = i/(n-1);
        var q = r*(-1+2*t);
        addLine(-r,q,0, r,q,0, v,v,v);
        addLine(q,-r,0, q,r,0, v,v,v);        
    }

    var bufferInfo = twgl.createBufferInfoFromArrays(gl, arrays);
    return bufferInfo;
}

SurfaceViewer.prototype.makeSurface = function(gl, m) {
    m = m || 200;
    var arrays = {
        position: twgl.primitives.createAugmentedTypedArray(3, m*m),
        texcoord: twgl.primitives.createAugmentedTypedArray(2, m*m),
        indices: new Uint32Array((m-1)*(m-1)*6)
    };
    for(var i=0;i<m;i++) {
        var u = i/(m-1);
        for(var j=0;j<m;j++) {
            var k = i*m+j;
            arrays.position.push(0,0,0);
            var v = j/(m-1);
            arrays.texcoord.push(u,v);
        }
    }
  
    var s = 0;
    for(var i=0;i+1<m;i++) {
        for(var j=0;j+1<m;j++) {
            var k = i*m+j;
            var a = [k,k+1,k+1+m,  k,k+1+m,k+m];
            for(var h=0;h<6;h++) arrays.indices[s+h] = a[h];
            s+=6;
        }
    }
    
    var bufferInfo = twgl.createBufferInfoFromArrays(gl, arrays);
    return bufferInfo;
}

SurfaceViewer.prototype.makeQuad = function(gl) {
    var arrays = {
        position: twgl.primitives.createAugmentedTypedArray(3, 4),
        texcoord: twgl.primitives.createAugmentedTypedArray(2, 4),
        indices: []
    };
    var r = 1;
    arrays.position.push(
        -r,-r,0,
         r,-r,0,
        -r, r,0,
         r, r,0        
    );
    arrays.texcoord.push(
        0,0,
        1,0,
        0,1,
        1,1
    );
    arrays.indices.push(0,1,3, 0,3,2);    
    var bufferInfo = twgl.createBufferInfoFromArrays(gl, arrays);
    return bufferInfo;
}
